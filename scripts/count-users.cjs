require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

async function countUsers() {
  try {
    console.log('Connecting to Cosmos DB...');
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    const container = database.container(containerId);

    // Count all users
    const countQuery = 'SELECT VALUE COUNT(1) FROM c';
    console.log('Executing count query...');
    const { resources: countResources } = await container.items.query(countQuery).fetchAll();
    const totalCount = countResources[0] || 0;

    console.log('\n📊 User Collection Statistics:');
    console.log('================================');
    console.log(`Total Users: ${totalCount}`);

    // Get breakdown by status if status field exists
    try {
      const statusQuery = 'SELECT c.status, COUNT(1) as count FROM c GROUP BY c.status';
      const { resources: statusResults } = await container.items.query(statusQuery).fetchAll();
      
      if (statusResults.length > 0) {
        console.log('\nUsers by Status:');
        statusResults.forEach(result => {
          console.log(`  ${result.status || 'No status'}: ${result.count}`);
        });
      }
    } catch (err) {
      // Status field might not exist, ignore
    }

    // Get breakdown by role if role field exists
    try {
      const roleQuery = 'SELECT c.role, COUNT(1) as count FROM c GROUP BY c.role';
      const { resources: roleResults } = await container.items.query(roleQuery).fetchAll();
      
      if (roleResults.length > 0) {
        console.log('\nUsers by Role:');
        roleResults.forEach(result => {
          console.log(`  ${result.role || 'No role'}: ${result.count}`);
        });
      }
    } catch (err) {
      // Role field might not exist, ignore
    }

    console.log('\n✅ Count completed successfully!');
    return totalCount;

  } catch (error) {
    console.error('❌ Error counting users:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

countUsers();

