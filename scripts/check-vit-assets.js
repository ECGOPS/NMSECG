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

async function checkVITAssets() {
  console.log('🔍 Checking VIT assets container...');
  console.log('📊 Configuration:');
  console.log(`   - Cosmos DB: ${COSMOS_DATABASE}/${COSMOS_CONTAINER}`);
  console.log('');
  
  try {
    // Query VIT assets with pagination to avoid timeout
    console.log('🔍 Querying VIT assets (first 10)...');
    const { resources: assets } = await container.items.query('SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 10').fetchAll();
    console.log(`📋 Found ${assets.length} VIT assets (showing first 10)`);
    
    if (assets.length === 0) {
      console.log('❌ No VIT assets found in the container');
      return;
    }
    
    // Show first few assets with their complete structure
    console.log('\n📋 Sample VIT Assets:');
    assets.slice(0, 3).forEach((asset, index) => {
      console.log(`\n--- Asset ${index + 1} ---`);
      console.log(`ID: ${asset.id}`);
      console.log(`Serial Number: ${asset.serialNumber}`);
      console.log(`Region: ${asset.region}`);
      console.log(`District: ${asset.district}`);
      console.log(`Status: ${asset.status}`);
      console.log(`Type: ${asset.typeOfUnit}`);
      console.log(`Voltage: ${asset.voltageLevel}`);
      console.log(`Location: ${asset.location || 'Not specified'}`);
      console.log(`GPS Coordinates: ${asset.gpsCoordinates || 'Not specified'}`);
      console.log(`Photo URL: ${asset.photoUrl || 'Not specified'}`);
      console.log(`Photo field exists: ${asset.hasOwnProperty('photo') ? 'Yes' : 'No'}`);
      if (asset.hasOwnProperty('photo')) {
        console.log(`Photo type: ${typeof asset.photo}`);
        if (asset.photo) {
          console.log(`Photo starts with: ${asset.photo.substring(0, 50)}...`);
          console.log(`Photo length: ${asset.photo.length} characters`);
        } else {
          console.log(`Photo value: ${asset.photo}`);
        }
      }
      console.log(`Created At: ${asset.createdAt}`);
      console.log(`Updated At: ${asset.updatedAt}`);
      
      // Show all available fields
      console.log('\nAll available fields:');
      Object.keys(asset).forEach(key => {
        const value = asset[key];
        const type = typeof value;
        const length = value && typeof value === 'string' ? value.length : 'N/A';
        console.log(`  - ${key}: ${type} (${length})`);
      });
    });
    
    // Analyze the sample assets
    console.log('\n📊 Analysis of sample assets:');
    
    const assetsWithPhoto = assets.filter(a => a.hasOwnProperty('photo') && a.photo);
    const assetsWithPhotoUrl = assets.filter(a => a.photoUrl);
    const assetsWithLocation = assets.filter(a => a.location);
    const assetsWithGPS = assets.filter(a => a.gpsCoordinates);
    
    console.log(`Assets with photo field: ${assetsWithPhoto.length}`);
    console.log(`Assets with photoUrl: ${assetsWithPhotoUrl.length}`);
    console.log(`Assets with location: ${assetsWithLocation.length}`);
    console.log(`Assets with GPS coordinates: ${assetsWithGPS.length}`);
    
    // Check for base64 photos
    const base64Photos = assets.filter(a => {
      return a.hasOwnProperty('photo') && 
             a.photo && 
             typeof a.photo === 'string' && 
             (a.photo.startsWith('data:image/') || a.photo.length > 1000);
    });
    
    console.log(`Assets with base64 photos: ${base64Photos.length}`);
    
    if (base64Photos.length > 0) {
      console.log('\n📸 Assets with base64 photos:');
      base64Photos.slice(0, 3).forEach((asset, index) => {
        console.log(`  ${index + 1}. ${asset.serialNumber} - Photo size: ${asset.photo.length} chars`);
      });
    }
    
    // Show field statistics
    console.log('\n📈 Field Statistics:');
    const allFields = new Set();
    assets.forEach(asset => {
      Object.keys(asset).forEach(key => allFields.add(key));
    });
    
    console.log('All available fields in the container:');
    Array.from(allFields).sort().forEach(field => {
      const count = assets.filter(a => a.hasOwnProperty(field)).length;
      console.log(`  - ${field}: ${count}/${assets.length} assets`);
    });
    
    // Get total count
    console.log('\n🔍 Getting total count...');
    try {
      const { resources: countResult } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
      const totalCount = countResult[0];
      console.log(`Total VIT assets in container: ${totalCount}`);
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
    await checkVITAssets();
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

main(); 