import { CosmosClient } from '@azure/cosmos';
import { BlobServiceClient } from '@azure/storage-blob';
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
const STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = 'uploads';

if (!COSMOS_ENDPOINT || !COSMOS_KEY || !COSMOS_DATABASE || !STORAGE_CONNECTION_STRING) {
  console.error('❌ Missing required environment variables');
  console.error('Required: COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE, AZURE_STORAGE_CONNECTION_STRING');
  process.exit(1);
}

// Initialize clients
const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const database = cosmosClient.database(COSMOS_DATABASE);
const container = database.container('overheadLineInspections');

const blobServiceClient = BlobServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

async function migrateOverheadPhotos() {
  console.log('🚀 Starting overhead line inspection photo migration...');
  console.log(`📊 Database: ${COSMOS_DATABASE}`);
  console.log(`📦 Container: ${CONTAINER_NAME}`);
  
  try {
    // Ensure container exists
    await containerClient.createIfNotExists();
    console.log('✅ Blob container ready');

    // Get all overhead line inspections
    console.log('🔍 Fetching overhead line inspections...');
    const { resources: inspections } = await container.items.query('SELECT * FROM c').fetchAll();
    console.log(`📊 Found ${inspections.length} inspections`);

    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const inspection of inspections) {
      try {
        processedCount++;
        console.log(`\n[${processedCount}/${inspections.length}] Processing inspection: ${inspection.id}`);

        // Check for base64 photos
        const photosToMigrate = [];
        
        // Check various photo fields that might contain base64
        const photoFields = [
          'photo', 'photoUrl', 'photos', 'image', 'imageUrl', 'images',
          'beforePhoto', 'afterPhoto', 'inspectionPhoto', 'evidencePhoto'
        ];

        for (const field of photoFields) {
          if (inspection[field]) {
            if (typeof inspection[field] === 'string' && inspection[field].startsWith('data:image')) {
              photosToMigrate.push({ field, data: inspection[field] });
            } else if (Array.isArray(inspection[field])) {
              inspection[field].forEach((photo, index) => {
                if (typeof photo === 'string' && photo.startsWith('data:image')) {
                  photosToMigrate.push({ field: `${field}[${index}]`, data: photo });
                }
              });
            }
          }
        }

        if (photosToMigrate.length === 0) {
          console.log('   ⏭️  No base64 photos found');
          skippedCount++;
          continue;
        }

        console.log(`   📸 Found ${photosToMigrate.length} base64 photo(s) to migrate`);

        // Migrate each photo
        for (const photo of photosToMigrate) {
          try {
            // Extract base64 data
            const base64Data = photo.data.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');

            // Generate unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `overhead-inspections/${inspection.id}/${photo.field}-${timestamp}.jpg`;
            
            // Upload to blob storage
            const blockBlobClient = containerClient.getBlockBlobClient(filename);
            await blockBlobClient.upload(buffer, buffer.length, {
              blobHTTPHeaders: { blobContentType: 'image/jpeg' }
            });

            // Generate public URL
            const blobUrl = `https://faultmasterstorage.blob.core.windows.net/${CONTAINER_NAME}/${filename}`;
            
            // Update the inspection record
            if (photo.field.includes('[')) {
              // Array field
              const [fieldName, indexStr] = photo.field.split('[');
              const index = parseInt(indexStr.replace(']', ''));
              inspection[fieldName][index] = blobUrl;
            } else {
              // Single field
              inspection[photo.field] = blobUrl;
            }

            console.log(`   ✅ Migrated ${photo.field} to: ${filename}`);
          } catch (photoError) {
            console.error(`   ❌ Error migrating ${photo.field}:`, photoError.message);
            errorCount++;
          }
        }

        // Update the inspection record in Cosmos DB
        await container.item(inspection.id, inspection.id).replace(inspection);
        console.log(`   💾 Updated inspection record`);
        migratedCount++;

      } catch (inspectionError) {
        console.error(`   ❌ Error processing inspection ${inspection.id}:`, inspectionError.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total inspections: ${inspections.length}`);
    console.log(`   Processed: ${processedCount}`);
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log(`\n⚠️  Migration completed with ${errorCount} errors`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateOverheadPhotos().catch(console.error); 