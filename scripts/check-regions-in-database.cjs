const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

async function checkRegions() {
  try {
    console.log('🔍 Checking regions in database...\n');

    const regionsContainer = database.container('regions');
    
    // Get all regions
    const { resources: regions } = await regionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    console.log(`Found ${regions.length} regions\n`);
    
    // Show first few regions as sample
    console.log('Sample regions:');
    regions.slice(0, 5).forEach(region => {
      console.log(`  ${region.id}: ${region.name || region.name} (code: ${region.code})`);
    });
    
    console.log('\nAll regions:');
    regions.forEach(region => {
      console.log(`  id: ${region.id}`);
      console.log(`  name: ${region.name}`);
      console.log(`  code: ${region.code}`);
      console.log('');
    });
    
    // Check for Accra and Ashanti regions
    console.log('\n📋 Searching for Accra and Ashanti regions...');
    const accraRegions = regions.filter(r => 
      r.name?.toUpperCase().includes('ACCRA') || 
      r.code?.toUpperCase().includes('ACCRA')
    );
    
    const ashantiRegions = regions.filter(r => 
      r.name?.toUpperCase().includes('ASHANTI') || 
      r.code?.toUpperCase().includes('ASHANTI')
    );
    
    console.log(`\nAccra regions found: ${accraRegions.length}`);
    accraRegions.forEach(r => {
      console.log(`  ${r.id}: ${r.name} (${r.code})`);
    });
    
    console.log(`\nAshanti regions found: ${ashantiRegions.length}`);
    ashantiRegions.forEach(r => {
      console.log(`  ${r.id}: ${r.name} (${r.code})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRegions();

