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

async function checkRemainingBase64() {
  console.log('🔍 Checking for remaining base64 data in overhead line inspections...');
  console.log(`📊 Database: ${COSMOS_DATABASE}`);
  
  try {
    // Get a sample of inspections to check
    console.log('🔍 Fetching sample of overhead line inspections...');
    const { resources: inspections } = await container.items.query('SELECT * FROM c').fetchAll();
    // Take only first 20 for sample check
    const sampleInspections = inspections.slice(0, 20);
    console.log(`📊 Found ${sampleInspections.length} inspections to check (sample)`);

    let totalBase64Count = 0;
    let inspectionsWithBase64 = 0;

    const photoFields = [
      'photo', 'photoUrl', 'photos', 'image', 'imageUrl', 'images',
      'beforePhoto', 'afterPhoto', 'inspectionPhoto', 'evidencePhoto'
    ];

    for (const inspection of sampleInspections) {
      let inspectionBase64Count = 0;

      for (const field of photoFields) {
        if (inspection[field]) {
          if (typeof inspection[field] === 'string' && inspection[field].startsWith('data:image')) {
            inspectionBase64Count++;
            totalBase64Count++;
            console.log(`   📸 Found base64 in ${inspection.id}.${field} (${inspection[field].length} chars)`);
          } else if (Array.isArray(inspection[field])) {
            inspection[field].forEach((photo, index) => {
              if (typeof photo === 'string' && photo.startsWith('data:image')) {
                inspectionBase64Count++;
                totalBase64Count++;
                console.log(`   📸 Found base64 in ${inspection.id}.${field}[${index}] (${photo.length} chars)`);
              }
            });
          }
        }
      }

      if (inspectionBase64Count > 0) {
        inspectionsWithBase64++;
        console.log(`   📊 Inspection ${inspection.id}: ${inspectionBase64Count} base64 photos`);
      }
    }

    // Summary
    console.log('\n📊 Remaining Base64 Check Summary:');
    console.log(`   Sample inspections checked: ${sampleInspections.length}`);
    console.log(`   Inspections with base64: ${inspectionsWithBase64}`);
    console.log(`   Total base64 photos found: ${totalBase64Count}`);

    if (totalBase64Count === 0) {
      console.log('\n✅ No remaining base64 data found in sample!');
      console.log('   Migration appears to be successful!');
    } else {
      console.log('\n⚠️  Some base64 data still remains');
      console.log('   You may need to run the migration again for failed records');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

// Run the check
checkRemainingBase64().catch(console.error); 