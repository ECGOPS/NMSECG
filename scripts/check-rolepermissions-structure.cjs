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

async function checkRolePermissionsStructure() {
  try {
    console.log('🔍 Checking rolePermissions structure...\n');

    // Get all role permissions
    const { resources: allRolePerms } = await rolePermissionsContainer.items.readAll().fetchAll();
    
    console.log(`Found ${allRolePerms.length} role permission entries\n`);
    
    console.log('📋 All role permission entries:');
    allRolePerms.forEach(rolePerm => {
      console.log(`\nID: ${rolePerm.id}`);
      console.log(`Role Name: ${rolePerm.roleName}`);
      console.log(`Has allowedRegions: ${!!rolePerm.allowedRegions}`);
      if (rolePerm.allowedRegions) {
        console.log(`  Allowed Regions:`, rolePerm.allowedRegions);
      }
      console.log(`Has permissions object: ${!!rolePerm.permissions}`);
    });

    console.log('\n\n🔍 Checking specifically for regional_engineer, ashsubt, accsubt...\n');
    
    const targetRoles = ['role_regional_engineer', 'role_ashsubt', 'role_accsubt'];
    
    for (const roleId of targetRoles) {
      try {
        const { resource } = await rolePermissionsContainer.item(roleId, roleId).read();
        if (resource) {
          console.log(`\n${roleId}:`);
          console.log('  Has allowedRegions:', !!resource.allowedRegions);
          console.log('  Has permissions:', !!resource.permissions);
          if (resource.allowedRegions) {
            console.log('  Allowed Regions:', resource.allowedRegions);
          }
        } else {
          console.log(`\n${roleId}: NOT FOUND`);
        }
      } catch (error) {
        if (error.code === 404) {
          console.log(`\n${roleId}: NOT FOUND (404)`);
        } else {
          console.log(`\n${roleId}: ERROR -`, error.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
checkRolePermissionsStructure();

