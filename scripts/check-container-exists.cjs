require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerName = process.argv[2] || 'controlOutages';

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

async function checkContainerExists() {
  try {
    console.log(`🔍 Checking if container '${containerName}' exists in database '${databaseId}'...\n`);
    
    // List all containers
    const { resources: containers } = await database.containers.readAll().fetchAll();
    
    console.log(`📦 Found ${containers.length} container(s) in database:\n`);
    containers.forEach((container, index) => {
      const marker = container.id === containerName ? '✅' : '  ';
      console.log(`${marker} ${index + 1}. ${container.id}`);
    });
    
    // Check if the specific container exists
    const containerExists = containers.some(c => c.id === containerName);
    
    console.log(`\n${containerExists ? '✅' : '❌'} Container '${containerName}' ${containerExists ? 'EXISTS' : 'DOES NOT EXIST'}`);
    
    if (containerExists) {
      // Get container details
      const container = database.container(containerName);
      const { resource: containerDef } = await container.read();
      
      console.log(`\n📋 Container Details:`);
      console.log(`   Partition Key: ${JSON.stringify(containerDef.partitionKey)}`);
      console.log(`   Indexing Policy: ${JSON.stringify(containerDef.indexingPolicy?.indexingMode || 'default')}`);
      
      // Count items
      try {
        const { resources: items } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
        const count = items[0] || 0;
        console.log(`   Item Count: ${count}`);
      } catch (countError) {
        console.log(`   Item Count: Unable to count (${countError.message})`);
      }
    } else {
      console.log(`\n💡 To create the container, the backend route will create it automatically on first use.`);
      console.log(`   Or you can use the restore-database.cjs script if you have exported data.`);
    }
    
    process.exit(containerExists ? 0 : 1);
  } catch (error) {
    console.error('❌ Error checking container:', error);
    process.exit(1);
  }
}

checkContainerExists();

