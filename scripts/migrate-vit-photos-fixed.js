import { CosmosClient } from '@azure/cosmos';
import { BlobServiceClient } from '@azure/storage-blob';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../backend/.env') });

// Configuration
const COSMOS_ENDPOINT = process.env.COSMOS_DB_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_DB_KEY;
const COSMOS_DATABASE = process.env.COSMOS_DB_DATABASE_NAME || process.env.COSMOS_DB_DATABASE;
const COSMOS_CONTAINER = 'vitAssets';

const BLOB_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const BLOB_CONTAINER_NAME = 'uploads';

// Initialize clients
const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const database = cosmosClient.database(COSMOS_DATABASE);
const container = database.container(COSMOS_CONTAINER);

const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
const blobContainerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER_NAME);

// Utility functions
function generateBlobName(assetId, originalName = 'photo') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = 'jpg';
  return `vit-assets/${assetId}/${originalName}-${timestamp}.${extension}`;
}

function isBase64Image(base64String) {
  if (!base64String || typeof base64String !== 'string') return false;
  
  if (base64String.startsWith('data:image/')) {
    return true;
  }
  
  try {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const cleanBase64 = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
    return base64Regex.test(cleanBase64);
  } catch (error) {
    return false;
  }
}

async function uploadBase64ToBlob(base64String, blobName) {
  try {
    // Remove data URL prefix if present
    const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Get blob client
    const blockBlobClient = blobContainerClient.getBlockBlobClient(blobName);
    
    // Upload to blob storage
    const uploadResult = await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: 'image/jpeg',
        blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
      }
    });
    
    // Generate public URL (we'll handle access differently)
    const publicUrl = `https://${blobServiceClient.accountName}.blob.core.windows.net/${BLOB_CONTAINER_NAME}/${blobName}`;
    
    console.log(`✅ Uploaded: ${blobName} (${buffer.length} bytes)`);
    return publicUrl;
  } catch (error) {
    console.error(`❌ Failed to upload ${blobName}:`, error.message);
    throw error;
  }
}

async function updateAssetRecord(asset, photoUrl) {
  try {
    // Create updated asset object
    const updatedAsset = {
      ...asset,
      photoUrl: photoUrl,
      // Remove the base64 photo field
      photo: undefined
    };
    
    // Remove the photo field completely
    delete updatedAsset.photo;
    
    // Update the record in Cosmos DB
    const { resource } = await container.item(asset.id, asset.id).replace(updatedAsset);
    
    console.log(`✅ Updated asset: ${asset.serialNumber} (${asset.id})`);
    return resource;
  } catch (error) {
    console.error(`❌ Failed to update asset ${asset.id}:`, error.message);
    throw error;
  }
}

async function migrateVITPhotos() {
  console.log('🚀 Starting VIT photo migration (Fixed)...');
  console.log('📊 Configuration:');
  console.log(`   - Cosmos DB: ${COSMOS_DATABASE}/${COSMOS_CONTAINER}`);
  console.log(`   - Blob Storage: ${BLOB_CONTAINER_NAME}`);
  console.log('');
  
  try {
    // Try to create container without public access
    console.log('📦 Setting up blob container...');
    try {
      await blobContainerClient.createIfNotExists();
      console.log('✅ Blob container ready');
    } catch (error) {
      console.log('⚠️  Container creation issue:', error.message);
      console.log('   Continuing with existing container...');
    }
    
    // Query assets in batches to avoid timeout
    console.log('🔍 Querying VIT assets in batches...');
    let allAssets = [];
    let offset = 0;
    const batchSize = 20;
    
    while (true) {
      const { resources: assets } = await container.items.query(
        `SELECT c.id, c.serialNumber, c.photoUrl, c.photo, c.region, c.district, c.status FROM c ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${batchSize}`
      ).fetchAll();
      
      if (assets.length === 0) break;
      
      allAssets = allAssets.concat(assets);
      offset += batchSize;
      
      console.log(`📋 Loaded ${allAssets.length} assets so far...`);
      
      if (assets.length < batchSize) break;
    }
    
    console.log(`📋 Found ${allAssets.length} VIT assets total`);
    
    // Filter assets with base64 photos
    const assetsWithPhotos = allAssets.filter(asset => {
      return (asset.photo && isBase64Image(asset.photo)) || 
             (asset.photoUrl && isBase64Image(asset.photoUrl));
    });
    
    console.log(`📸 Found ${assetsWithPhotos.length} assets with base64 photos`);
    console.log('');
    
    if (assetsWithPhotos.length === 0) {
      console.log('✅ No assets with base64 photos found. Migration complete!');
      return;
    }
    
    // Process each asset
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < assetsWithPhotos.length; i++) {
      const asset = assetsWithPhotos[i];
      console.log(`\n🔄 Processing ${i + 1}/${assetsWithPhotos.length}: ${asset.serialNumber}`);
      
      try {
        // Generate blob name
        const blobName = generateBlobName(asset.id);
        
        // Get base64 data from either photo or photoUrl field
        const base64Data = asset.photo || asset.photoUrl;
        
        // Upload to blob storage
        const photoUrl = await uploadBase64ToBlob(base64Data, blobName);
        
        // Update Cosmos DB record
        await updateAssetRecord(asset, photoUrl);
        
        successCount++;
        console.log(`✅ Successfully migrated: ${asset.serialNumber}`);
        
        // Add a small delay to avoid overwhelming the services
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errorCount++;
        errors.push({
          assetId: asset.id,
          serialNumber: asset.serialNumber,
          error: error.message
        });
        console.error(`❌ Failed to migrate: ${asset.serialNumber} - ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📸 Total processed: ${assetsWithPhotos.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.serialNumber} (${error.assetId}): ${error.error}`);
      });
    }
    
    console.log('\n🎉 Migration complete!');
    console.log('📸 Photos are now stored in blob storage and accessible via URLs.');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Validation
function validateEnvironment() {
  const requiredEnvVars = [
    'COSMOS_DB_ENDPOINT',
    'COSMOS_DB_KEY', 
    'COSMOS_DB_DATABASE',
    'AZURE_STORAGE_CONNECTION_STRING'
  ];
  
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these environment variables before running the script.');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed');
}

// Main execution
async function main() {
  try {
    validateEnvironment();
    await migrateVITPhotos();
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

main(); 