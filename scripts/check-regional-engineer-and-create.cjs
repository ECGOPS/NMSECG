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

async function checkAndCreate() {
  try {
    console.log('🔍 Checking regional_engineer structure in rolePermissions...\n');

    // Get all role permissions
    const { resources: allPerms } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    // Find regional_engineer
    const regionalEngineer = allPerms.find(p => p.roleName === 'regional_engineer');
    
    if (!regionalEngineer) {
      console.log('❌ regional_engineer not found in rolePermissions!');
      process.exit(1);
    }

    console.log('✅ Found regional_engineer');
    console.log('\n📋 regional_engineer structure:');
    console.log(JSON.stringify(regionalEngineer, null, 2));
    console.log('');
    
    console.log('Key fields:');
    console.log('   id:', regionalEngineer.id);
    console.log('   roleName:', regionalEngineer.roleName);
    console.log('   Has allowedRegions:', !!regionalEngineer.allowedRegions);
    console.log('   Has permissions:', !!regionalEngineer.permissions);
    console.log('   Permissions keys count:', Object.keys(regionalEngineer.permissions || {}).length);
    console.log('');

    // Check if ashsubt and accsubt already exist
    const ashsubt = allPerms.find(p => p.roleName === 'ashsubt');
    const accsubt = allPerms.find(p => p.roleName === 'accsubt');
    
    console.log('Current state:');
    console.log('   ashsubt exists:', !!ashsubt);
    console.log('   accsubt exists:', !!accsubt);
    console.log('');

    // If they exist, delete them first
    if (ashsubt) {
      console.log('🗑️  Deleting existing ashsubt...');
      try {
        await rolePermissionsContainer.item(ashsubt.id, ashsubt.roleName).delete();
        console.log('   ✅ Deleted');
      } catch (error) {
        console.log('   ⚠️  Error deleting:', error.message);
      }
      console.log('');
    }

    if (accsubt) {
      console.log('🗑️  Deleting existing accsubt...');
      try {
        await rolePermissionsContainer.item(accsubt.id, accsubt.roleName).delete();
        console.log('   ✅ Deleted');
      } catch (error) {
        console.log('   ⚠️  Error deleting:', error.message);
      }
      console.log('');
    }

    // Create ashsubt - EXACT same structure as regional_engineer
    console.log('🔧 Creating ashsubt with EXACT same structure as regional_engineer...');
    
    const newAshsubt = {
      id: 'role_ashsubt',
      roleName: 'ashsubt',
      permissions: regionalEngineer.permissions,  // Copy the exact permissions object
      lastUpdated: new Date().toISOString()
      // NO allowedRegions field (like regional_engineer)
    };
    
    await rolePermissionsContainer.items.create(newAshsubt);
    console.log('   ✅ Created ashsubt');
    console.log('   id: role_ashsubt');
    console.log('   roleName: ashsubt');
    console.log('   permissions: SAME AS regional_engineer');
    console.log('   allowedRegions: NOT INCLUDED (like regional_engineer)');
    console.log('');

    // Create accsubt - EXACT same structure as regional_engineer
    console.log('🔧 Creating accsubt with EXACT same structure as regional_engineer...');
    
    const newAccsubt = {
      id: 'role_accsubt',
      roleName: 'accsubt',
      permissions: regionalEngineer.permissions,  // Copy the exact permissions object
      lastUpdated: new Date().toISOString()
      // NO allowedRegions field (like regional_engineer)
    };
    
    await rolePermissionsContainer.items.create(newAccsubt);
    console.log('   ✅ Created accsubt');
    console.log('   id: role_accsubt');
    console.log('   roleName: accsubt');
    console.log('   permissions: SAME AS regional_engineer');
    console.log('   allowedRegions: NOT INCLUDED (like regional_engineer)');
    console.log('');

    // Final verification
    console.log('🔍 Verifying final structure...\n');
    const { resources: finalPerms } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    const finalRegionalEngineer = finalPerms.find(p => p.roleName === 'regional_engineer');
    const finalAshsubt = finalPerms.find(p => p.roleName === 'ashsubt');
    const finalAccsubt = finalPerms.find(p => p.roleName === 'accsubt');
    
    console.log('📊 Final Comparison:');
    console.log('\nregional_engineer:');
    console.log('   id:', finalRegionalEngineer.id);
    console.log('   roleName:', finalRegionalEngineer.roleName);
    console.log('   allowedRegions:', !!finalRegionalEngineer.allowedRegions ? 'YES ❌' : 'NO ✓');
    console.log('   permissions count:', Object.keys(finalRegionalEngineer.permissions || {}).length);
    
    console.log('\nashsubt:');
    console.log('   id:', finalAshsubt?.id || 'NOT FOUND');
    console.log('   roleName:', finalAshsubt?.roleName || 'NOT FOUND');
    console.log('   allowedRegions:', !!finalAshsubt?.allowedRegions ? 'YES ❌' : 'NO ✓');
    console.log('   permissions count:', Object.keys(finalAshsubt?.permissions || {}).length);
    
    console.log('\naccsubt:');
    console.log('   id:', finalAccsubt?.id || 'NOT FOUND');
    console.log('   roleName:', finalAccsubt?.roleName || 'NOT FOUND');
    console.log('   allowedRegions:', !!finalAccsubt?.allowedRegions ? 'YES ❌' : 'NO ✓');
    console.log('   permissions count:', Object.keys(finalAccsubt?.permissions || {}).length);
    
    // Verify they have the same structure
    const regionalKeys = Object.keys(finalRegionalEngineer).sort();
    const ashsubtKeys = finalAshsubt ? Object.keys(finalAshsubt).sort() : [];
    const accsubtKeys = finalAccsubt ? Object.keys(finalAccsubt).sort() : [];
    
    console.log('\n📋 Structure comparison:');
    console.log('regional_engineer keys:', regionalKeys);
    console.log('ashsubt keys:', ashsubtKeys);
    console.log('accsubt keys:', accsubtKeys);
    
    const structureMatches = 
      JSON.stringify(regionalKeys) === JSON.stringify(ashsubtKeys) &&
      JSON.stringify(regionalKeys) === JSON.stringify(accsubtKeys) &&
      !finalAshsubt?.allowedRegions &&
      !finalAccsubt?.allowedRegions;
    
    if (structureMatches) {
      console.log('\n✅ SUCCESS! Both new roles have EXACTLY the same structure as regional_engineer!');
    } else {
      console.log('\n⚠️  WARNING: Structure mismatch detected');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

checkAndCreate();

