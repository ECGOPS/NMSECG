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

async function findAndUpdateRolePermissions() {
  try {
    console.log('🔍 Finding and Updating rolePermissions Entries...\n');

    // Get all role permissions
    const { resources: allRolePermissions } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    console.log(`📊 Found ${allRolePermissions.length} role permissions entries\n`);

    // Find ashsubt and accsubt
    const ashsubtRP = allRolePermissions.find(r => 
      r.id === 'role_ashsubt' || 
      r.id === 'ashsubt' || 
      r.name === 'ashsubt' ||
      r.roleName === 'ashsubt'
    );

    const accsubtRP = allRolePermissions.find(r => 
      r.id === 'role_accsubt' || 
      r.id === 'accsubt' || 
      r.name === 'accsubt' ||
      r.roleName === 'accsubt'
    );

    console.log('Searching for ashsubt and accsubt...');
    console.log(`ashsubt found: ${ashsubtRP ? 'YES' : 'NO'}`);
    console.log(`accsubt found: ${accsubtRP ? 'YES' : 'NO'}`);
    console.log('');

    if (ashsubtRP) {
      console.log('Found ashsubt entry with ID:', ashsubtRP.id);
      console.log('Current structure:', JSON.stringify(ashsubtRP, null, 2));
      console.log('');
    }

    if (accsubtRP) {
      console.log('Found accsubt entry with ID:', accsubtRP.id);
      console.log('Current structure:', JSON.stringify(accsubtRP, null, 2));
      console.log('');
    }

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

    // Update ashsubt if found
    if (ashsubtRP) {
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

      try {
        await rolePermissionsContainer.item(ashsubtRP.id, ashsubtRP.id).replace(updatedAshsubt);
        console.log('✅ Updated ashsubt in rolePermissions');
        console.log('   Allowed regions:', updatedAshsubt.allowedRegions.join(', '));
        console.log('');
      } catch (error) {
        console.log('❌ Error updating ashsubt:', error.message);
      }
    } else {
      console.log('⚠️  ashsubt not found in rolePermissions');
    }

    // Update accsubt if found
    if (accsubtRP) {
      const updatedAccsubt = {
        ...accsubtRP,
        allowedRegions: [
          regionMapping['region-1'], // subtransmission-accra
          regionMapping['region-3'], // accra-east
          regionMapping['region-4']  // accra-west
        ],
        updatedAt: new Date().toISOString()
      };

      try {
        await rolePermissionsContainer.item(accsubtRP.id, accsubtRP.id).replace(updatedAccsubt);
        console.log('✅ Updated accsubt in rolePermissions');
        console.log('   Allowed regions:', updatedAccsubt.allowedRegions.join(', '));
        console.log('');
      } catch (error) {
        console.log('❌ Error updating accsubt:', error.message);
      }
    } else {
      console.log('⚠️  accsubt not found in rolePermissions');
    }

    // Final summary
    console.log('📊 Final Summary:');
    const { resources: finalRolePermissions } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    const finalAshsubt = finalRolePermissions.find(r => 
      r.id === 'role_ashsubt' || r.name === 'ashsubt' || r.roleName === 'ashsubt'
    );
    const finalAccsubt = finalRolePermissions.find(r => 
      r.id === 'role_accsubt' || r.name === 'accsubt' || r.roleName === 'accsubt'
    );

    console.log(`   - Total rolePermissions: ${finalRolePermissions.length}`);
    console.log(`   - ashsubt present: ${finalAshsubt ? '✅ YES' : '❌ NO'}`);
    console.log(`   - accsubt present: ${finalAccsubt ? '✅ YES' : '❌ NO'}`);
    
    if (finalAshsubt) {
      console.log(`   - ashsubt allowedRegions: ${finalAshsubt.allowedRegions?.join(', ') || 'none'}`);
    }
    if (finalAccsubt) {
      console.log(`   - accsubt allowedRegions: ${finalAccsubt.allowedRegions?.join(', ') || 'none'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
findAndUpdateRolePermissions();

