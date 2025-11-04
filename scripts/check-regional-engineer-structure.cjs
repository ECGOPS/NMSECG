const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const rolePermissionsContainer = database.container('rolePermissions');

async function checkRegionalEngineerStructure() {
  try {
    console.log('🔍 Checking regional_engineer Structure in rolePermissions...\n');

    // Get all role permissions
    const { resources: allRolePermissions } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    // Find regional_engineer
    const regionalEngineer = allRolePermissions.find(r => 
      r.id === 'role_regional_engineer' || 
      r.roleName === 'regional_engineer' ||
      r.name === 'regional_engineer'
    );

    console.log('📄 regional_engineer structure:');
    console.log(JSON.stringify(regionalEngineer, null, 2));
    console.log('');

    // Now find ashsubt and accsubt
    const ashsubtRP = allRolePermissions.find(r => 
      r.id === 'role_ashsubt' || 
      r.name === 'ashsubt' ||
      r.roleName === 'ashsubt'
    );

    const accsubtRP = allRolePermissions.find(r => 
      r.id === 'role_accsubt' || 
      r.name === 'accsubt' ||
      r.roleName === 'accsubt'
    );

    console.log('\n🔍 Comparing ashsubt and accsubt to regional_engineer...\n');

    if (ashsubtRP) {
      console.log('📄 ashsubt structure:');
      console.log(JSON.stringify(ashsubtRP, null, 2));
      console.log('');
    } else {
      console.log('❌ ashsubt not found');
    }

    if (accsubtRP) {
      console.log('📄 accsubt structure:');
      console.log(JSON.stringify(accsubtRP, null, 2));
      console.log('');
    } else {
      console.log('❌ accsubt not found');
    }

    // Show what needs to be fixed
    console.log('\n📊 Comparison:\n');
    console.log('regional_engineer allowedRegions:', regionalEngineer?.allowedRegions || 'not set');
    console.log('ashsubt allowedRegions:', ashsubtRP?.allowedRegions || 'not set');
    console.log('accsubt allowedRegions:', accsubtRP?.allowedRegions || 'not set');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
checkRegionalEngineerStructure();

