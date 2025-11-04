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

async function checkBase64Count() {
  console.log('🔍 Checking for base64 photos in VIT assets...');
  console.log('📊 Configuration:');
  console.log(`   - Cosmos DB: ${COSMOS_DATABASE}/${COSMOS_CONTAINER}`);
  console.log('');
  
  try {
    // Query a small sample to check for base64 data
    console.log('🔍 Querying sample VIT assets...');
    const { resources: assets } = await container.items.query('SELECT c.id, c.serialNumber, c.photoUrl, c.photo FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 20').fetchAll();
    console.log(`📋 Found ${assets.length} VIT assets (sample)`);
    
    if (assets.length === 0) {
      console.log('❌ No VIT assets found in the container');
      return;
    }
    
    // Check for base64 data
    const assetsWithBase64Photo = assets.filter(a => a.photo && isBase64Image(a.photo));
    const assetsWithBase64PhotoUrl = assets.filter(a => a.photoUrl && isBase64Image(a.photoUrl));
    const assetsWithRegularPhotoUrl = assets.filter(a => a.photoUrl && !isBase64Image(a.photoUrl));
    const assetsWithNoPhotos = assets.filter(a => !a.photo && !a.photoUrl);
    
    console.log('\n📊 Analysis of sample:');
    console.log(`Assets with base64 in photo field: ${assetsWithBase64Photo.length}`);
    console.log(`Assets with base64 in photoUrl field: ${assetsWithBase64PhotoUrl.length}`);
    console.log(`Assets with regular photoUrl (blob links): ${assetsWithRegularPhotoUrl.length}`);
    console.log(`Assets with no photos: ${assetsWithNoPhotos.length}`);
    
    if (assetsWithBase64PhotoUrl.length > 0) {
      console.log('\n📸 Sample assets with base64 in photoUrl:');
      assetsWithBase64PhotoUrl.slice(0, 3).forEach((asset, index) => {
        console.log(`  ${index + 1}. ${asset.serialNumber} - PhotoUrl length: ${asset.photoUrl.length} chars`);
        console.log(`     Starts with: ${asset.photoUrl.substring(0, 50)}...`);
      });
    }
    
    if (assetsWithBase64Photo.length > 0) {
      console.log('\n📸 Sample assets with base64 in photo field:');
      assetsWithBase64Photo.slice(0, 3).forEach((asset, index) => {
        console.log(`  ${index + 1}. ${asset.serialNumber} - Photo length: ${asset.photo.length} chars`);
        console.log(`     Starts with: ${asset.photo.substring(0, 50)}...`);
      });
    }
    
    // Estimate total based on sample
    const base64Percentage = (assetsWithBase64Photo.length + assetsWithBase64PhotoUrl.length) / assets.length;
    console.log(`\n📈 Estimated percentage with base64: ${(base64Percentage * 100).toFixed(1)}%`);
    
    // Get total count
    console.log('\n🔍 Getting total count...');
    try {
      const { resources: countResult } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
      const totalCount = countResult[0];
      console.log(`Total VIT assets in container: ${totalCount}`);
      
      const estimatedBase64Count = Math.round(totalCount * base64Percentage);
      console.log(`Estimated assets with base64 data: ${estimatedBase64Count}`);
      
      if (estimatedBase64Count > 0) {
        console.log('\n🎯 Migration needed!');
        console.log(`Estimated ${estimatedBase64Count} assets need migration from base64 to blob storage.`);
        console.log('Run: npm run migrate:vit-photos');
      } else {
        console.log('\n✅ No migration needed - all assets are already optimized!');
      }
    } catch (error) {
      console.log('Could not get total count due to timeout');
    }
    
  } catch (error) {
    console.error('💥 Error checking VIT assets:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    await checkBase64Count();
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

main(); 