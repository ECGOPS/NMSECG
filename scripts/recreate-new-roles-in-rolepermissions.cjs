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

async function recreateNewRoles() {
  try {
    console.log('🔍 Recreating new roles in rolePermissions...\n');

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
    console.log('');

    // Get current ashsubt and accsubt (if they exist)
    const ashsubt = allPerms.find(p => p.id === 'role_ashsubt');
    const accsubt = allPerms.find(p => p.id === 'role_accsubt');

    console.log('Current state:');
    console.log('   ashsubt exists:', !!ashsubt);
    console.log('   accsubt exists:', !!accsubt);
    console.log('');

    // Delete existing if they exist (with incorrect structure)
    if (ashsubt) {
      try {
        // Try to delete with the actual roleName if it exists, otherwise use query
        console.log('🗑️  Deleting old ashsubt entry...');
        
        // Try to delete with roleName if it exists
        if (ashsubt.roleName) {
          await rolePermissionsContainer.item(ashsubt.id, ashsubt.roleName).delete();
        } else {
          // Use bulk delete via query
          const query = `SELECT * FROM c WHERE c.id = '${ashsubt.id}'`;
          const { resources } = await rolePermissionsContainer.items.query(query).fetchAll();
          for (const doc of resources) {
            await rolePermissionsContainer.item(doc.id, doc.id).delete();
          }
        }
        console.log('   ✅ Deleted');
      } catch (error) {
        console.log('   ⚠️  Could not delete (might not exist):', error.message);
      }
    }
    console.log('');

    if (accsubt) {
      try {
        console.log('🗑️  Deleting old accsubt entry...');
        
        if (accsubt.roleName) {
          await rolePermissionsContainer.item(accsubt.id, accsubt.roleName).delete();
        } else {
          const query = `SELECT * FROM c WHERE c.id = '${accsubt.id}'`;
          const { resources } = await rolePermissionsContainer.items.query(query).fetchAll();
          for (const doc of resources) {
            await rolePermissionsContainer.item(doc.id, doc.id).delete();
          }
        }
        console.log('   ✅ Deleted');
      } catch (error) {
        console.log('   ⚠️  Could not delete (might not exist):', error.message);
      }
    }
    console.log('');

    // Now create new entries with correct structure
    console.log('🔧 Creating new entries with correct structure...\n');
    
    // Create ashsubt
    const newAshsubt = {
      id: 'role_ashsubt',
      roleName: 'ashsubt',
      permissions: regionalEngineer.permissions,  // Same permissions as regional_engineer
      lastUpdated: new Date().toISOString()
    };
    
    // Don't include allowedRegions (like regional_engineer)
    
    await rolePermissionsContainer.items.create(newAshsubt);
    console.log('✅ Created ashsubt with correct structure');
    console.log('   roleName: ashsubt');
    console.log('   allowedRegions: NO');
    console.log('');

    // Create accsubt
    const newAccsubt = {
      id: 'role_accsubt',
      roleName: 'accsubt',
      permissions: regionalEngineer.permissions,  // Same permissions as regional_engineer
      lastUpdated: new Date().toISOString()
    };
    
    await rolePermissionsContainer.items.create(newAccsubt);
    console.log('✅ Created accsubt with correct structure');
    console.log('   roleName: accsubt');
    console.log('   allowedRegions: NO');
    console.log('');

    // Verify
    console.log('🔍 Verifying...\n');
    const { resources: finalPerms } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    const finalAshsubt = finalPerms.find(p => p.roleName === 'ashsubt');
    const finalAccsubt = finalPerms.find(p => p.roleName === 'accsubt');
    
    console.log('📊 Final Summary:');
    console.log('\nregional_engineer:');
    console.log('   roleName:', regionalEngineer.roleName);
    console.log('   allowedRegions:', !!regionalEngineer.allowedRegions ? 'YES (WRONG)' : 'NO (CORRECT) ✓');
    
    if (finalAshsubt) {
      console.log('\nashsubt:');
      console.log('   roleName:', finalAshsubt.roleName);
      console.log('   allowedRegions:', !!finalAshsubt.allowedRegions ? 'YES (WRONG)' : 'NO (CORRECT) ✓');
    }
    
    if (finalAccsubt) {
      console.log('\naccsubt:');
      console.log('   roleName:', finalAccsubt.roleName);
      console.log('   allowedRegions:', !!finalAccsubt.allowedRegions ? 'YES (WRONG)' : 'NO (CORRECT) ✓');
    }
    
    console.log('\n✅ Success! Both roles now match regional_engineer structure!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

recreateNewRoles();

