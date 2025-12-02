const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'staffIds';

async function countStaffIds() {
  try {
    console.log('Connecting to Cosmos DB...');
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    const container = database.container(containerId);

    // Count all staff IDs
    const countQuery = 'SELECT VALUE COUNT(1) FROM c';
    console.log('Executing count query...');
    const { resources: countResources } = await container.items.query(countQuery).fetchAll();
    const totalCount = countResources[0] || 0;

    console.log('\n📊 Staff ID Collection Statistics:');
    console.log('===================================');
    console.log(`Total Staff IDs: ${totalCount}`);

    // Get breakdown by role if role field exists
    try {
      const roleQuery = 'SELECT c.role, COUNT(1) as count FROM c GROUP BY c.role';
      const { resources: roleResults } = await container.items.query(roleQuery).fetchAll();
      
      if (roleResults.length > 0) {
        console.log('\nStaff IDs by Role:');
        roleResults.forEach(result => {
          console.log(`  ${result.role || 'No role'}: ${result.count}`);
        });
      }
    } catch (err) {
      // Role field might not exist, ignore
      console.log('(Could not get role breakdown)');
    }

    // Get breakdown by region if region field exists
    try {
      const regionQuery = 'SELECT c.region, COUNT(1) as count FROM c GROUP BY c.region';
      const { resources: regionResults } = await container.items.query(regionQuery).fetchAll();
      
      if (regionResults.length > 0) {
        console.log('\nStaff IDs by Region:');
        regionResults.forEach(result => {
          console.log(`  ${result.region || 'No region'}: ${result.count}`);
        });
      }
    } catch (err) {
      // Region field might not exist, ignore
      console.log('(Could not get region breakdown)');
    }

    // Get breakdown by district if district field exists
    try {
      const districtQuery = 'SELECT c.district, COUNT(1) as count FROM c GROUP BY c.district';
      const { resources: districtResults } = await container.items.query(districtQuery).fetchAll();
      
      if (districtResults.length > 0) {
        console.log('\nStaff IDs by District (top 10):');
        districtResults.slice(0, 10).forEach(result => {
          console.log(`  ${result.district || 'No district'}: ${result.count}`);
        });
        if (districtResults.length > 10) {
          console.log(`  ... and ${districtResults.length - 10} more districts`);
        }
      }
    } catch (err) {
      // District field might not exist, ignore
      console.log('(Could not get district breakdown)');
    }

    console.log('\n✅ Count completed successfully!');
    return totalCount;

  } catch (error) {
    console.error('❌ Error counting staff IDs:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

countStaffIds();

