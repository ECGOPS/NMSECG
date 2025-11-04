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

function calculateBase64Size(base64String) {
  if (!base64String) return 0;
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
  return Math.ceil((base64Data.length * 3) / 4);
}

async function dryRunMigration() {
  console.log('🔍 Starting VIT photo migration DRY RUN...');
  console.log('📊 Configuration:');
  console.log(`   - Cosmos DB: ${COSMOS_DATABASE}/${COSMOS_CONTAINER}`);
  console.log(`   - Blob Storage: ${BLOB_CONTAINER_NAME}`);
  console.log('');
  
  try {
    // Check blob container access
    console.log('📦 Checking blob container access...');
    try {
      await blobContainerClient.getProperties();
      console.log('✅ Blob container accessible');
    } catch (error) {
      console.log('⚠️  Blob container not accessible:', error.message);
      console.log('   This is expected if the container does not exist yet.');
    }
    
    // Query all VIT assets
    console.log('🔍 Querying VIT assets...');
    const { resources: assets } = await container.items.query('SELECT * FROM c').fetchAll();
    console.log(`📋 Found ${assets.length} VIT assets`);
    
    // Filter assets with base64 photos
    const assetsWithPhotos = assets.filter(asset => {
      return (asset.photo && isBase64Image(asset.photo)) || 
             (asset.photoUrl && isBase64Image(asset.photoUrl));
    });
    
    const assetsWithPhotoUrl = assets.filter(asset => {
      return asset.photoUrl && !isBase64Image(asset.photoUrl) && !asset.photo;
    });
    
    const assetsWithBoth = assets.filter(asset => {
      return (asset.photo && isBase64Image(asset.photo)) && 
             (asset.photoUrl && !isBase64Image(asset.photoUrl));
    });
    
    const assetsWithNeither = assets.filter(asset => {
      return !asset.photo && (!asset.photoUrl || !isBase64Image(asset.photoUrl));
    });
    
    console.log(`📸 Analysis:`);
    console.log(`   - Assets with base64 photos: ${assetsWithPhotos.length}`);
    console.log(`   - Assets with photoUrl only: ${assetsWithPhotoUrl.length}`);
    console.log(`   - Assets with both: ${assetsWithBoth.length}`);
    console.log(`   - Assets with neither: ${assetsWithNeither.length}`);
    console.log('');
    
    if (assetsWithPhotos.length === 0) {
      console.log('✅ No assets with base64 photos found. Nothing to migrate!');
      return;
    }
    
    // Calculate total size
    let totalBase64Size = 0;
    let totalBlobSize = 0;
    
    console.log('📊 Size Analysis:');
    assetsWithPhotos.forEach((asset, index) => {
      const photoData = asset.photo || asset.photoUrl;
      const base64Size = calculateBase64Size(photoData);
      const blobName = generateBlobName(asset.id);
      const estimatedBlobSize = Math.ceil(base64Size * 0.75); // Rough estimate
      
      totalBase64Size += base64Size;
      totalBlobSize += estimatedBlobSize;
      
      console.log(`   ${index + 1}. ${asset.serialNumber}:`);
      console.log(`      - Base64 size: ${(base64Size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`      - Estimated blob size: ${(estimatedBlobSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`      - Blob path: ${blobName}`);
      console.log(`      - Field: ${asset.photo ? 'photo' : 'photoUrl'}`);
    });
    
    console.log('');
    console.log('📈 Summary:');
    console.log(`   - Total base64 size: ${(totalBase64Size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Estimated blob storage: ${(totalBlobSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Estimated cost savings: ${(totalBase64Size / 1024 / 1024 * 0.00025).toFixed(4)} USD/month`);
    console.log('');
    
    // Show sample data
    console.log('📋 Sample Asset Data:');
    assetsWithPhotos.slice(0, 3).forEach((asset, index) => {
      console.log(`   ${index + 1}. ${asset.serialNumber} (${asset.id}):`);
      console.log(`      - Region: ${asset.region}`);
      console.log(`      - District: ${asset.district}`);
      console.log(`      - Status: ${asset.status}`);
      console.log(`      - Photo size: ${(calculateBase64Size(asset.photo) / 1024 / 1024).toFixed(2)} MB`);
      console.log(`      - Photo starts with: ${asset.photo.substring(0, 50)}...`);
    });
    
    console.log('');
    console.log('🎯 Migration Plan:');
    console.log(`   - Will migrate ${assetsWithPhotos.length} assets`);
    console.log(`   - Will create ${assetsWithPhotos.length} blob files`);
    console.log(`   - Will update ${assetsWithPhotos.length} Cosmos DB records`);
    console.log(`   - Estimated time: ${Math.ceil(assetsWithPhotos.length * 0.5)} minutes`);
    console.log('');
    console.log('⚠️  This is a DRY RUN. No actual changes will be made.');
    console.log('   To run the actual migration, use: npm run migrate:vit-photos');
    
  } catch (error) {
    console.error('💥 Dry run failed:', error);
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
    await dryRunMigration();
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main(); 