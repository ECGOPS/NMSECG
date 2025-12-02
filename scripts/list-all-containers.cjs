require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

async function listAllContainers() {
  try {
    console.log(`📦 Listing all containers in database '${databaseId}'...\n`);
    
    // List all containers
    const { resources: containers } = await database.containers.readAll().fetchAll();
    
    console.log(`📊 Total containers: ${containers.length}/25 (limit)\n`);
    
    if (containers.length >= 25) {
      console.log('⚠️  WARNING: Database has reached the 25 container limit!\n');
    }
    
    // Get item counts for each container
    const containerDetails = [];
    
    for (const container of containers) {
      try {
        const containerRef = database.container(container.id);
        
        // Try to get item count
        let itemCount = 0;
        try {
          const { resources: countResult } = await containerRef.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
          itemCount = countResult[0] || 0;
        } catch (countError) {
          itemCount = -1; // Error getting count
        }
        
        containerDetails.push({
          id: container.id,
          partitionKey: container.partitionKey?.paths?.[0] || 'N/A',
          itemCount: itemCount,
          indexingMode: container.indexingPolicy?.indexingMode || 'default'
        });
      } catch (err) {
        containerDetails.push({
          id: container.id,
          partitionKey: 'N/A',
          itemCount: -1,
          indexingMode: 'N/A',
          error: err.message
        });
      }
    }
    
    // Sort by item count (empty containers first)
    containerDetails.sort((a, b) => {
      if (a.itemCount === -1 && b.itemCount === -1) return 0;
      if (a.itemCount === -1) return 1;
      if (b.itemCount === -1) return -1;
      return a.itemCount - b.itemCount;
    });
    
    console.log('📋 Container Details:\n');
    console.log('┌─────────────────────────────────────┬──────────────────┬─────────────┬──────────────┐');
    console.log('│ Container Name                      │ Partition Key    │ Item Count  │ Status       │');
    console.log('├─────────────────────────────────────┼──────────────────┼─────────────┼──────────────┤');
    
    containerDetails.forEach((detail, index) => {
      const name = detail.id.padEnd(35).substring(0, 35);
      const partitionKey = (detail.partitionKey || 'N/A').padEnd(18).substring(0, 18);
      const count = detail.itemCount === -1 ? 'Error' : detail.itemCount.toString();
      const countStr = count.padEnd(11).substring(0, 11);
      
      let status = '✅ Active';
      if (detail.itemCount === 0) {
        status = '⚠️  Empty';
      } else if (detail.itemCount === -1) {
        status = '❌ Error';
      }
      const statusStr = status.padEnd(14).substring(0, 14);
      
      console.log(`│ ${name} │ ${partitionKey} │ ${countStr} │ ${statusStr} │`);
    });
    
    console.log('└─────────────────────────────────────┴──────────────────┴─────────────┴──────────────┘\n');
    
    // Summary
    const emptyContainers = containerDetails.filter(c => c.itemCount === 0);
    const activeContainers = containerDetails.filter(c => c.itemCount > 0);
    const errorContainers = containerDetails.filter(c => c.itemCount === -1);
    
    console.log('📊 Summary:');
    console.log(`   ✅ Active containers (with data): ${activeContainers.length}`);
    console.log(`   ⚠️  Empty containers (no data): ${emptyContainers.length}`);
    console.log(`   ❌ Error containers: ${errorContainers.length}`);
    console.log(`   📦 Total: ${containerDetails.length}/25\n`);
    
    if (emptyContainers.length > 0) {
      console.log('💡 Empty containers that could potentially be deleted:');
      emptyContainers.forEach(c => {
        console.log(`   - ${c.id}`);
      });
      console.log('');
    }
    
    // Check if targets container exists
    const targetsExists = containers.some(c => c.id === 'targets');
    if (!targetsExists) {
      console.log('❌ "targets" container does NOT exist');
      console.log('💡 To create it, you need to:');
      console.log('   1. Delete an unused container (preferably an empty one)');
      console.log('   2. Or upgrade your Cosmos DB plan');
      console.log('   3. Then the targets container will be created automatically\n');
    } else {
      console.log('✅ "targets" container exists\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing containers:', error);
    process.exit(1);
  }
}

listAllContainers();


