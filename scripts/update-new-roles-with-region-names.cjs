const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

async function updateNewRolesWithRegionNames() {
  try {
    console.log('🔍 Updating New Roles with Region Names...\n');

    // Define region names mapping
    const regionMapping = {
      'region-1': 'subtransmission-accra',
      'region-2': 'subtransmission-ashanti',
      'region-3': 'accra-east',
      'region-4': 'accra-west',
      'region-5': 'ashanti-east',
      'region-6': 'ashanti-west',
      'region-7': 'ashanti-south',
      'region-8': 'central',
      'region-9': 'eastern',
      'region-10': 'tema',
      'region-11': 'volta',
      'region-12': 'western'
    };

    // Update roles collection
    console.log('📄 Updating roles collection...');
    const rolesContainer = database.container('roles');
    
    try {
      // Get ashsubt
      const { resource: ashsubtRole } = await rolesContainer.item('ashsubt', 'ashsubt').read();
      
      // Update allowedRegions with region names
      ashsubtRole.allowedRegions = [
        regionMapping['region-2'], // subtransmission-ashanti
        regionMapping['region-5'], // ashanti-east
        regionMapping['region-6'], // ashanti-west
        regionMapping['region-7']  // ashanti-south
      ];
      ashsubtRole.updatedAt = new Date().toISOString();
      
      await rolesContainer.item('ashsubt', 'ashsubt').replace(ashsubtRole);
      console.log('✅ Updated ashsubt in roles collection');
      console.log('   Allowed regions:', ashsubtRole.allowedRegions.join(', '));
      console.log('');
    } catch (error) {
      console.log('❌ Error updating ashsubt in roles:', error.message);
    }

    try {
      // Get accsubt
      const { resource: accsubtRole } = await rolesContainer.item('accsubt', 'accsubt').read();
      
      // Update allowedRegions with region names
      accsubtRole.allowedRegions = [
        regionMapping['region-1'], // subtransmission-accra
        regionMapping['region-3'], // accra-east
        regionMapping['region-4']  // accra-west
      ];
      accsubtRole.updatedAt = new Date().toISOString();
      
      await rolesContainer.item('accsubt', 'accsubt').replace(accsubtRole);
      console.log('✅ Updated accsubt in roles collection');
      console.log('   Allowed regions:', accsubtRole.allowedRegions.join(', '));
      console.log('');
    } catch (error) {
      console.log('❌ Error updating accsubt in roles:', error.message);
    }

    // Update rolePermissions collection
    console.log('📄 Updating rolePermissions collection...');
    const rolePermissionsContainer = database.container('rolePermissions');
    
    try {
      // Get ashsubt
      const { resource: ashsubtRP } = await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').read();
      
      // Update allowedRegions with region names
      ashsubtRP.allowedRegions = [
        regionMapping['region-2'], // subtransmission-ashanti
        regionMapping['region-5'], // ashanti-east
        regionMapping['region-6'], // ashanti-west
        regionMapping['region-7']  // ashanti-south
      ];
      ashsubtRP.updatedAt = new Date().toISOString();
      
      await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').replace(ashsubtRP);
      console.log('✅ Updated ashsubt in rolePermissions collection');
      console.log('   Allowed regions:', ashsubtRP.allowedRegions.join(', '));
      console.log('');
    } catch (error) {
      console.log('❌ Error updating ashsubt in rolePermissions:', error.message);
    }

    try {
      // Get accsubt
      const { resource: accsubtRP } = await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').read();
      
      // Update allowedRegions with region names
      accsubtRP.allowedRegions = [
        regionMapping['region-1'], // subtransmission-accra
        regionMapping['region-3'], // accra-east
        regionMapping['region-4']  // accra-west
      ];
      accsubtRP.updatedAt = new Date().toISOString();
      
      await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').replace(accsubtRP);
      console.log('✅ Updated accsubt in rolePermissions collection');
      console.log('   Allowed regions:', accsubtRP.allowedRegions.join(', '));
      console.log('');
    } catch (error) {
      console.log('❌ Error updating accsubt in rolePermissions:', error.message);
    }

    // Final verification
    console.log('🔍 Final Verification...\n');
    
    const { resource: finalAshsubt } = await rolesContainer.item('ashsubt', 'ashsubt').read();
    const { resource: finalAccsubt } = await rolesContainer.item('accsubt', 'accsubt').read();

    console.log('📊 Updated Roles Summary:');
    console.log('\nashsubt:');
    console.log('   Allowed regions:', finalAshsubt.allowedRegions?.join(', ') || 'none');
    console.log('\naccsubt:');
    console.log('   Allowed regions:', finalAccsubt.allowedRegions?.join(', ') || 'none');
    console.log('');

    console.log('✅ Successfully updated both roles with region names!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
updateNewRolesWithRegionNames();

