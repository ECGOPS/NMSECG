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

async function removeRegionsFromRolePermissions() {
  try {
    console.log('🔍 Removing regions from rolePermissions...\n');

    // Get ashsubt
    const { resource: ashsubtRP } = await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').read();
    
    console.log('Current ashsubt structure:');
    console.log('  Has allowedRegions:', !!ashsubtRP.allowedRegions);
    console.log('  Allowed Regions:', ashsubtRP.allowedRegions || 'none');
    console.log('');
    
    // Remove allowedRegions if it exists
    if (ashsubtRP.allowedRegions) {
      delete ashsubtRP.allowedRegions;
      ashsubtRP.lastUpdated = new Date().toISOString();
      
      await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').replace(ashsubtRP);
      console.log('✅ Removed allowedRegions from ashsubt');
    } else {
      console.log('⚠️  ashsubt had no allowedRegions to remove');
    }
    console.log('');

    // Get accsubt
    const { resource: accsubtRP } = await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').read();
    
    console.log('Current accsubt structure:');
    console.log('  Has allowedRegions:', !!accsubtRP.allowedRegions);
    console.log('  Allowed Regions:', accsubtRP.allowedRegions || 'none');
    console.log('');
    
    // Remove allowedRegions if it exists
    if (accsubtRP.allowedRegions) {
      delete accsubtRP.allowedRegions;
      accsubtRP.lastUpdated = new Date().toISOString();
      
      await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').replace(accsubtRP);
      console.log('✅ Removed allowedRegions from accsubt');
    } else {
      console.log('⚠️  accsubt had no allowedRegions to remove');
    }
    console.log('');

    // Verify removal
    console.log('🔍 Verifying removal...\n');
    const { resource: finalAshsubt } = await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').read();
    const { resource: finalAccsubt } = await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').read();

    console.log('📊 Final Summary:');
    console.log('\nashsubt:');
    console.log('  Has allowedRegions:', !!finalAshsubt.allowedRegions);
    console.log('\naccsubt:');
    console.log('  Has allowedRegions:', !!finalAccsubt.allowedRegions);
    console.log('');

    console.log('✅ Successfully removed regions from rolePermissions!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
removeRegionsFromRolePermissions();

