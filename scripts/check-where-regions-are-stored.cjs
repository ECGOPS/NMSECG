const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

async function checkWhereRegionsAreStored() {
  try {
    console.log('🔍 Checking where regions are stored...\n');

    // Check roles collection
    const rolesContainer = database.container('roles');
    
    console.log('📋 Checking roles collection...');
    const { resources: roles } = await rolesContainer.items.readAll().fetchAll();
    
    console.log(`Found ${roles.length} roles\n`);
    
    roles.forEach(role => {
      console.log(`Role: ${role.id || role.roleName}`);
      console.log(`  Allowed Regions:`, role.allowedRegions || 'none');
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
checkWhereRegionsAreStored();

