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

async function fixNewRolesInRolePermissions() {
  try {
    console.log('🔍 Fixing new roles in rolePermissions to match regional_engineer...\n');

    // Get the regional_engineer entry as a template
    console.log('📋 Getting regional_engineer as template...');
    const { resources: allPerms } = await rolePermissionsContainer.items.readAll().fetchAll();
    const regionalEngineer = allPerms.find(p => p.roleName === 'regional_engineer');
    
    if (!regionalEngineer) {
      console.log('❌ regional_engineer not found in rolePermissions!');
      process.exit(1);
    }

    console.log('✅ Found regional_engineer');
    console.log('   Has allowedRegions:', !!regionalEngineer.allowedRegions);
    console.log('   Has permissions:', !!regionalEngineer.permissions);
    console.log('');

    // Now fix ashsubt
    console.log('🔧 Fixing ashsubt...');
    const ashsubtRP = allPerms.find(p => p.id === 'role_ashsubt');
    
    if (ashsubtRP) {
      console.log('Current ashsubt structure:');
      console.log('  ID:', ashsubtRP.id);
      console.log('  roleName:', ashsubtRP.roleName || 'undefined');
      console.log('  Has allowedRegions:', !!ashsubtRP.allowedRegions);
      if (ashsubtRP.allowedRegions) {
        console.log('  allowedRegions:', ashsubtRP.allowedRegions);
      }
      
      // Fix: Add roleName and remove allowedRegions (like regional_engineer)
      const fixedAshsubt = {
        ...ashsubtRP,
        roleName: 'ashsubt',
        lastUpdated: new Date().toISOString()
      };
      
      // Remove allowedRegions if it exists
      if (fixedAshsubt.allowedRegions) {
        delete fixedAshsubt.allowedRegions;
      }
      
      await rolePermissionsContainer.item('role_ashsubt', 'role_ashsubt').replace(fixedAshsubt);
      console.log('✅ Fixed ashsubt (removed allowedRegions, added roleName)');
    } else {
      console.log('⚠️  ashsubt not found');
    }
    console.log('');

    // Now fix accsubt
    console.log('🔧 Fixing accsubt...');
    const accsubtRP = allPerms.find(p => p.id === 'role_accsubt');
    
    if (accsubtRP) {
      console.log('Current accsubt structure:');
      console.log('  ID:', accsubtRP.id);
      console.log('  roleName:', accsubtRP.roleName || 'undefined');
      console.log('  Has allowedRegions:', !!accsubtRP.allowedRegions);
      if (accsubtRP.allowedRegions) {
        console.log('  allowedRegions:', accsubtRP.allowedRegions);
      }
      
      // Fix: Add roleName and remove allowedRegions (like regional_engineer)
      const fixedAccsubt = {
        ...accsubtRP,
        roleName: 'accsubt',
        lastUpdated: new Date().toISOString()
      };
      
      // Remove allowedRegions if it exists
      if (fixedAccsubt.allowedRegions) {
        delete fixedAccsubt.allowedRegions;
      }
      
      await rolePermissionsContainer.item('role_accsubt', 'role_accsubt').replace(fixedAccsubt);
      console.log('✅ Fixed accsubt (removed allowedRegions, added roleName)');
    } else {
      console.log('⚠️  accsubt not found');
    }
    console.log('');

    // Verify
    console.log('🔍 Verifying changes...\n');
    const { resources: finalAllPerms } = await rolePermissionsContainer.items.readAll().fetchAll();
    
    const finalAshsubt = finalAllPerms.find(p => p.id === 'role_ashsubt');
    const finalAccsubt = finalAllPerms.find(p => p.id === 'role_accsubt');
    
    console.log('📊 Final Summary:');
    console.log('\nregional_engineer:');
    console.log('  roleName:', regionalEngineer.roleName);
    console.log('  Has allowedRegions:', !!regionalEngineer.allowedRegions);
    
    console.log('\nashsubt:');
    console.log('  roleName:', finalAshsubt?.roleName || 'not found');
    console.log('  Has allowedRegions:', !!finalAshsubt?.allowedRegions);
    
    console.log('\naccsubt:');
    console.log('  roleName:', finalAccsubt?.roleName || 'not found');
    console.log('  Has allowedRegions:', !!finalAccsubt?.allowedRegions);
    
    console.log('\n✅ Successfully fixed both roles to match regional_engineer structure!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
fixNewRolesInRolePermissions();

