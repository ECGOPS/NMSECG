import { CosmosClient } from '@azure/cosmos';
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

// Initialize clients
const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const database = cosmosClient.database(COSMOS_DATABASE);
const container = database.container(COSMOS_CONTAINER);

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

async function removeBase64Photos() {
  console.log('🔍 Starting VIT base64 photo removal...');
  console.log('📊 Configuration:');
  console.log(`   - Cosmos DB: ${COSMOS_DATABASE}/${COSMOS_CONTAINER}`);
  console.log('');
  
  try {
    // Query assets with base64 photos (small batch to avoid timeout)
    console.log('🔍 Querying VIT assets with base64 photos...');
    const { resources: assets } = await container.items.query('SELECT c.id, c.serialNumber, c.photoUrl, c.photo FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50').fetchAll();
    console.log(`📋 Found ${assets.length} VIT assets (sample)`);
    
    if (assets.length === 0) {
      console.log('❌ No VIT assets found in the container');
      return;
    }
    
    // Filter assets with base64 photos
    const assetsWithBase64 = assets.filter(asset => {
      return (asset.photo && isBase64Image(asset.photo)) || 
             (asset.photoUrl && isBase64Image(asset.photoUrl));
    });
    
    console.log(`📸 Found ${assetsWithBase64.length} assets with base64 photos`);
    
    if (assetsWithBase64.length === 0) {
      console.log('✅ No base64 photos found - no action needed');
      return;
    }
    
    // Process each asset
    let processedCount = 0;
    let errorCount = 0;
    
    for (const asset of assetsWithBase64) {
      try {
        console.log(`\n🔄 Processing: ${asset.serialNumber} (${asset.id})`);
        
        // Create updated asset object
        const updatedAsset = {
          ...asset,
          photoUrl: null, // Remove base64 photoUrl
          photo: undefined // Remove photo field
        };
        
        // Remove the photo field completely
        delete updatedAsset.photo;
        
        // Update the record in Cosmos DB
        await container.item(asset.id, asset.id).replace(updatedAsset);
        
        console.log(`✅ Removed base64 photo from: ${asset.serialNumber}`);
        processedCount++;
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to process ${asset.serialNumber}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully processed: ${processedCount} assets`);
    console.log(`❌ Errors: ${errorCount} assets`);
    console.log(`📸 Total base64 photos removed: ${processedCount}`);
    
    if (processedCount > 0) {
      console.log('\n🎉 Performance improvement achieved!');
      console.log('The VIT page should now load much faster.');
    }
    
  } catch (error) {
    console.error('💥 Error removing base64 photos:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    await removeBase64Photos();
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

main(); 