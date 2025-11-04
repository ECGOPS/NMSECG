import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

// Configuration
const COSMOS_ENDPOINT = process.env.COSMOS_DB_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_DB_KEY;
const COSMOS_DATABASE = process.env.COSMOS_DB_DATABASE;

if (!COSMOS_ENDPOINT || !COSMOS_KEY || !COSMOS_DATABASE) {
  console.error('❌ Missing required environment variables');
  console.error('Required: COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE');
  process.exit(1);
}

// Initialize client
const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const database = cosmosClient.database(COSMOS_DATABASE);
const container = database.container('overheadLineInspections');

async function checkOverheadBase64() {
  console.log('🔍 Checking for base64 data in overhead line inspections...');
  console.log(`📊 Database: ${COSMOS_DATABASE}`);
  
  try {
    // Get all overhead line inspections
    console.log('🔍 Fetching overhead line inspections...');
    const { resources: inspections } = await container.items.query('SELECT * FROM c').fetchAll();
    console.log(`📊 Found ${inspections.length} inspections`);

    let totalBase64Count = 0;
    let inspectionsWithBase64 = 0;
    let totalSizeBytes = 0;

    const photoFields = [
      'photo', 'photoUrl', 'photos', 'image', 'imageUrl', 'images',
      'beforePhoto', 'afterPhoto', 'inspectionPhoto', 'evidencePhoto'
    ];

    for (const inspection of inspections) {
      let inspectionBase64Count = 0;
      let inspectionSizeBytes = 0;

      for (const field of photoFields) {
        if (inspection[field]) {
          if (typeof inspection[field] === 'string' && inspection[field].startsWith('data:image')) {
            inspectionBase64Count++;
            totalBase64Count++;
            inspectionSizeBytes += inspection[field].length;
            totalSizeBytes += inspection[field].length;
            
            console.log(`   📸 Found base64 in ${inspection.id}.${field} (${inspection[field].length} chars)`);
          } else if (Array.isArray(inspection[field])) {
            inspection[field].forEach((photo, index) => {
              if (typeof photo === 'string' && photo.startsWith('data:image')) {
                inspectionBase64Count++;
                totalBase64Count++;
                inspectionSizeBytes += photo.length;
                totalSizeBytes += photo.length;
                
                console.log(`   📸 Found base64 in ${inspection.id}.${field}[${index}] (${photo.length} chars)`);
              }
            });
          }
        }
      }

      if (inspectionBase64Count > 0) {
        inspectionsWithBase64++;
        console.log(`   📊 Inspection ${inspection.id}: ${inspectionBase64Count} base64 photos (${(inspectionSizeBytes / 1024).toFixed(2)} KB)`);
      }
    }

    // Summary
    console.log('\n📊 Base64 Check Summary:');
    console.log(`   Total inspections: ${inspections.length}`);
    console.log(`   Inspections with base64: ${inspectionsWithBase64}`);
    console.log(`   Total base64 photos: ${totalBase64Count}`);
    console.log(`   Total size: ${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);

    if (totalBase64Count === 0) {
      console.log('\n✅ No base64 data found - no migration needed!');
    } else {
      console.log('\n⚠️  Base64 data found - migration recommended!');
      console.log(`   Estimated time to migrate: ${Math.ceil(totalBase64Count / 10)} minutes`);
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

// Run the check
checkOverheadBase64().catch(console.error); 