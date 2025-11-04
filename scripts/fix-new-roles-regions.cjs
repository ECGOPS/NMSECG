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

async function fixNewRolesRegions() {
  try {
    console.log('🔍 Fixing New Roles Regions in rolePermissions...\n');

    // According to the regions.json file and the user's requirement:
    // Use region names NOT IDs
    const ashsubtRegions = [
      'SUBTRANSMISSION ASHANTI',
      'ASHANTI EAST REGION', 
      'ASHANTI WEST REGION',
      'ASHANTI SOUTH REGION'
    ];

    const accsubtRegions = [
      'SUBTRANSMISSION ACCRA',
      'ACCRA EAST REGION',
      'ACCRA WEST REGION'
    ];

    // Get ashsubt
    const { resource: ashsubtRP } = await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').read();
    
    console.log('Before update - ashsubt allowedRegions:', ashsubtRP.allowedRegions);
    
    // Update to use region names
    ashsubtRP.allowedRegions = ashsubtRegions;
    ashsubtRP.lastUpdated = new Date().toISOString();
    
    await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').replace(ashsubtRP);
    console.log('✅ Updated ashsubt with region names');
    console.log('   New allowedRegions:', ashsubtRP.allowedRegions.join(', '));
    console.log('');

    // Get accsubt
    const { resource: accsubtRP } = await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').read();
    
    console.log('Before update - accsubt allowedRegions:', accsubtRP.allowedRegions);
    
    // Update to use region names
    accsubtRP.allowedRegions = accsubtRegions;
    accsubtRP.lastUpdated = new Date().toISOString();
    
    await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').replace(accsubtRP);
    console.log('✅ Updated accsubt with region names');
    console.log('   New allowedRegions:', accsubtRP.allowedRegions.join(', '));
    console.log('');

    // Final verification
    console.log('🔍 Verifying updates...\n');
    const { resource: finalAshsubt } = await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').read();
    const { resource: finalAccsubt } = await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').read();

    console.log('📊 Final Summary:');
    console.log('\nashsubt:');
    console.log('   Allowed regions:', finalAshsubt.allowedRegions?.join(', ') || 'not set');
    console.log('\naccsubt:');
    console.log('   Allowed regions:', finalAccsubt.allowedRegions?.join(', ') || 'not set');
    console.log('');

    console.log('✅ Successfully updated both roles with region names!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
fixNewRolesRegions();

