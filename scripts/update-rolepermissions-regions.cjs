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

async function updateRolePermissionsRegions() {
  try {
    console.log('🔍 Updating rolePermissions with Region Names...\n');

    // Define region names mapping
    const regionMapping = {
      'region-1': 'subtransmission-accra',
      'region-2': 'subtransmission-ashanti',
      'region-3': 'accra-east',
      'region-4': 'accra-west',
      'region-5': 'ashanti-east',
      'region-6': 'ashanti-west',
      'region-7': 'ashanti-south'
    };

    // Get ashsubt
    const { resource: ashsubtRP } = await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').read();
    
    console.log('Current ashsubt structure:');
    console.log(JSON.stringify(ashsubtRP, null, 2));
    console.log('');

    // Update ashsubt - add allowedRegions field
    const updatedAshsubt = {
      ...ashsubtRP,
      allowedRegions: [
        regionMapping['region-2'], // subtransmission-ashanti
        regionMapping['region-5'], // ashanti-east
        regionMapping['region-6'], // ashanti-west
        regionMapping['region-7']  // ashanti-south
      ],
      updatedAt: new Date().toISOString()
    };

    console.log('Updated ashsubt structure:');
    console.log(JSON.stringify(updatedAshsubt, null, 2));
    console.log('');

    await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').replace(updatedAshsubt);
    console.log('✅ Updated ashsubt in rolePermissions');
    console.log('   Allowed regions:', updatedAshsubt.allowedRegions.join(', '));
    console.log('');

    // Get accsubt
    const { resource: accsubtRP } = await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').read();
    
    console.log('Current accsubt structure:');
    console.log(JSON.stringify(accsubtRP, null, 2));
    console.log('');

    // Update accsubt - add allowedRegions field
    const updatedAccsubt = {
      ...accsubtRP,
      allowedRegions: [
        regionMapping['region-1'], // subtransmission-accra
        regionMapping['region-3'], // accra-east
        regionMapping['region-4']  // accra-west
      ],
      updatedAt: new Date().toISOString()
    };

    console.log('Updated accsubt structure:');
    console.log(JSON.stringify(updatedAccsubt, null, 2));
    console.log('');

    await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').replace(updatedAccsubt);
    console.log('✅ Updated accsubt in rolePermissions');
    console.log('   Allowed regions:', updatedAccsubt.allowedRegions.join(', '));
    console.log('');

    // Final verification
    console.log('🔍 Verifying updates...\n');
    const { resource: finalAshsubt } = await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').read();
    const { resource: finalAccsubt } = await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').read();

    console.log('📊 Final Summary:');
    console.log('\nashsubt allowedRegions:', finalAshsubt.allowedRegions?.join(', ') || 'not set');
    console.log('accsubt allowedRegions:', finalAccsubt.allowedRegions?.join(', ') || 'not set');
    console.log('');

    console.log('✅ Successfully updated rolePermissions with region names!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
updateRolePermissionsRegions();

