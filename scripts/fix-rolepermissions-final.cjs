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

async function fixRolePermissions() {
  try {
    console.log('🔍 Fixing rolePermissions to match regional_engineer structure...\n');

    // Query all role permissions
    const { resources: allPerms } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    // Find regional_engineer as template
    const regionalEngineer = allPerms.find(p => p.roleName === 'regional_engineer');
    
    if (!regionalEngineer) {
      console.log('❌ regional_engineer not found!');
      process.exit(1);
    }

    console.log('✅ Template: regional_engineer');
    console.log('   roleName:', regionalEngineer.roleName);
    console.log('   Has allowedRegions:', !!regionalEngineer.allowedRegions);
    console.log('   Has permissions:', !!regionalEngineer.permissions);
    console.log('');

    // Fix ashsubt
    const ashsubt = allPerms.find(p => p.id === 'role_ashsubt');
    
    if (ashsubt) {
      console.log('🔧 Fixing ashsubt...');
      console.log('   Current roleName:', ashsubt.roleName || 'undefined');
      console.log('   Current allowedRegions:', ashsubt.allowedRegions ? 'YES' : 'NO');
      
      // Create fixed version: remove allowedRegions, add roleName, keep permissions
      const fixed = {
        ...ashsubt,
        roleName: 'ashsubt',  // Add roleName
        lastUpdated: new Date().toISOString()
      };
      
      // Remove allowedRegions if it exists
      if (fixed.allowedRegions) {
        delete fixed.allowedRegions;
      }
      
      // Replace using id and roleName as partition key
      await rolePermissionsContainer.item(fixed.id, fixed.roleName).replace(fixed);
      console.log('   ✅ Fixed (removed allowedRegions, added roleName)');
    } else {
      console.log('⚠️  ashsubt not found');
    }
    console.log('');

    // Fix accsubt
    const accsubt = allPerms.find(p => p.id === 'role_accsubt');
    
    if (accsubt) {
      console.log('🔧 Fixing accsubt...');
      console.log('   Current roleName:', accsubt.roleName || 'undefined');
      console.log('   Current allowedRegions:', accsubt.allowedRegions ? 'YES' : 'NO');
      
      // Create fixed version: remove allowedRegions, add roleName, keep permissions
      const fixed = {
        ...accsubt,
        roleName: 'accsubt',  // Add roleName
        lastUpdated: new Date().toISOString()
      };
      
      // Remove allowedRegions if it exists
      if (fixed.allowedRegions) {
        delete fixed.allowedRegions;
      }
      
      // Replace using id and roleName as partition key
      await rolePermissionsContainer.item(fixed.id, fixed.roleName).replace(fixed);
      console.log('   ✅ Fixed (removed allowedRegions, added roleName)');
    } else {
      console.log('⚠️  accsubt not found');
    }
    console.log('');

    // Verify
    console.log('🔍 Verifying changes...\n');
    const { resources: finalPerms } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    const finalAshsubt = finalPerms.find(p => p.id === 'role_ashsubt');
    const finalAccsubt = finalPerms.find(p => p.id === 'role_accsubt');
    
    console.log('📊 Final Summary:');
    console.log('\nregional_engineer:');
    console.log('   roleName:', regionalEngineer.roleName);
    console.log('   allowedRegions:', !!regionalEngineer.allowedRegions ? 'YES (WRONG)' : 'NO (CORRECT)');
    
    if (finalAshsubt) {
      console.log('\nashsubt:');
      console.log('   roleName:', finalAshsubt.roleName);
      console.log('   allowedRegions:', !!finalAshsubt.allowedRegions ? 'YES (WRONG)' : 'NO (CORRECT)');
    }
    
    if (finalAccsubt) {
      console.log('\naccsubt:');
      console.log('   roleName:', finalAccsubt.roleName);
      console.log('   allowedRegions:', !!finalAccsubt.allowedRegions ? 'YES (WRONG)' : 'NO (CORRECT)');
    }
    
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixRolePermissions();

