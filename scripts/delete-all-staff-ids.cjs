const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const staffIdsContainer = database.container('staffIds');

async function deleteAllStaffIds() {
  try {
    console.log('🔍 Fetching all staff ID records...\n');

    // Get all staff IDs
    const query = 'SELECT c.id, c.name, c.email, c.role, c.region, c.district FROM c';
    const { resources: allStaffIds } = await staffIdsContainer.items.query(query).fetchAll();
    
    const count = allStaffIds.length;
    console.log(`📊 Found ${count} staff ID records\n`);
    
    if (count === 0) {
      console.log('✅ No staff ID records found. Nothing to delete.');
      return;
    }

    // Show first 10 as sample
    console.log('Sample of records to be deleted (first 10):');
    allStaffIds.slice(0, 10).forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.name || record.email || record.id} (ID: ${record.id}, Role: ${record.role || 'N/A'}, Region: ${record.region || 'N/A'})`);
    });
    if (count > 10) {
      console.log(`  ... and ${count - 10} more records\n`);
    }

    console.log(`\n⚠️  WARNING: About to delete ALL ${count} staff ID records!`);
    console.log('Starting deletion...\n');

    let deletedCount = 0;
    let errorCount = 0;

    // Delete each record
    for (const record of allStaffIds) {
      try {
        await staffIdsContainer.item(record.id, record.id).delete();
        deletedCount++;
        if (deletedCount % 100 === 0) {
          console.log(`  Deleted ${deletedCount}/${count} records...`);
        }
      } catch (error) {
        console.error(`  ❌ Error deleting record ${record.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n✅ Deletion completed!');
    console.log(`   Successfully deleted: ${deletedCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }

    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const countQuery = 'SELECT VALUE COUNT(1) FROM c';
    const { resources: remainingCount } = await staffIdsContainer.items.query(countQuery).fetchAll();
    const finalCount = remainingCount[0] || 0;
    
    if (finalCount === 0) {
      console.log('✅ All staff ID records have been deleted.');
    } else {
      console.log(`⚠️  Warning: ${finalCount} staff ID records still remain.`);
    }

    console.log(`\n📊 Final staff ID count: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error deleting staff IDs:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

deleteAllStaffIds();

