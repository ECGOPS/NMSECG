const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const usersContainer = database.container('users');

async function deleteUsersWithNoStatus() {
  try {
    console.log('🔍 Finding users with no status...\n');

    // First, get all users with no status
    // In Cosmos DB, we need to check for null, undefined, or missing status field
    const query = `
      SELECT c.id, c.email, c.name, c.role, c.status 
      FROM c 
      WHERE c.status = null OR NOT IS_DEFINED(c.status) OR c.status = ""
    `;
    
    const { resources: usersToDelete } = await usersContainer.items.query(query).fetchAll();
    
    const count = usersToDelete.length;
    console.log(`📊 Found ${count} users with no status\n`);
    
    if (count === 0) {
      console.log('✅ No users with no status found. Nothing to delete.');
      return;
    }

    // Show first 10 as sample
    console.log('Sample of users to be deleted (first 10):');
    usersToDelete.slice(0, 10).forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email || user.name || user.id} (ID: ${user.id}, Role: ${user.role || 'N/A'})`);
    });
    if (count > 10) {
      console.log(`  ... and ${count - 10} more\n`);
    }

    console.log(`\n⚠️  WARNING: About to delete ${count} user records!`);
    console.log('Starting deletion...\n');

    let deletedCount = 0;
    let errorCount = 0;

    // Delete each user
    for (const user of usersToDelete) {
      try {
        await usersContainer.item(user.id, user.id).delete();
        deletedCount++;
        if (deletedCount % 100 === 0) {
          console.log(`  Deleted ${deletedCount}/${count} users...`);
        }
      } catch (error) {
        console.error(`  ❌ Error deleting user ${user.id}: ${error.message}`);
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
    const { resources: remainingUsers } = await usersContainer.items.query(query).fetchAll();
    const remainingCount = remainingUsers.length;
    
    if (remainingCount === 0) {
      console.log('✅ All users with no status have been deleted.');
    } else {
      console.log(`⚠️  Warning: ${remainingCount} users with no status still remain.`);
    }

    // Show final count
    const finalCountQuery = 'SELECT VALUE COUNT(1) FROM c';
    const { resources: finalCount } = await usersContainer.items.query(finalCountQuery).fetchAll();
    console.log(`\n📊 Final user count: ${finalCount[0]}`);

  } catch (error) {
    console.error('❌ Error deleting users:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

deleteUsersWithNoStatus();

