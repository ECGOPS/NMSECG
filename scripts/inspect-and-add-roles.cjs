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

async function inspectAndAddRoles() {
  try {
    console.log('🔍 Inspecting and Adding Roles to rolePermissions Collection...\n');

    // Get all roles
    const { resources: allRoles } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    console.log(`📊 Found ${allRoles.length} roles in collection\n`);
    
    // Display all roles
    console.log('📋 All roles in rolePermissions collection:');
    allRoles.forEach((role, index) => {
      console.log(`\n${index + 1}. Role ID: ${role.id}`);
      console.log(`   Name: ${role.name || 'N/A'}`);
      console.log(`   Display Name: ${role.displayName || 'N/A'}`);
      console.log(`   Description: ${role.description || 'N/A'}`);
      console.log(`   Priority: ${role.priority || 'N/A'}`);
    });
    console.log('');

    // Check for regional_engineer
    const regionalEngineer = allRoles.find(r => 
      r.id === 'role_regional_engineer' || 
      r.id === 'regional_engineer' || 
      r.name === 'regional_engineer' ||
      r.displayName?.toLowerCase().includes('regional engineer')
    );

    if (regionalEngineer) {
      console.log('✅ Found regional_engineer role:');
      console.log(JSON.stringify(regionalEngineer, null, 2));
      console.log('');
    } else {
      console.log('❌ regional_engineer role not found');
      console.log('Available role IDs:', allRoles.map(r => r.id).join(', '));
      return;
    }

    // Check if ashsubt exists
    const ashsubtExists = allRoles.find(r => 
      r.id === 'role_ashsubt' || 
      r.id === 'ashsubt' || 
      r.name === 'ashsubt'
    );

    // Check if accsubt exists
    const accsubtExists = allRoles.find(r => 
      r.id === 'role_accsubt' || 
      r.id === 'accsubt' || 
      r.name === 'accsubt'
    );

    console.log('Checking for new roles...');
    console.log(`ashsubt exists: ${ashsubtExists ? 'YES' : 'NO'}`);
    console.log(`accsubt exists: ${accsubtExists ? 'YES' : 'NO'}\n`);

    // Create ashsubt if it doesn't exist
    if (!ashsubtExists) {
      console.log('🔧 Creating ashsubt role...');
      const ashsubtRole = {
        id: 'role_ashsubt',
        name: 'ashsubt',
        displayName: 'Ashanti Subtransmission Engineer',
        description: 'Ashanti Subtransmission Engineer - Access to Ashanti regions',
        priority: 7,
        permissions: regionalEngineer.permissions || [],
        allowedRegions: ['region-2', 'region-5', 'region-6', 'region-7'],
        allowedDistricts: [],
        accessLevel: 'regional',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await rolePermissionsContainer.items.create(ashsubtRole);
        console.log('✅ Successfully created ashsubt role');
        console.log(JSON.stringify(ashsubtRole, null, 2));
        console.log('');
      } catch (error) {
        console.error('❌ Error creating ashsubt:', error.message);
      }
    } else {
      console.log('ℹ️  ashsubt already exists, skipping creation');
    }

    // Create accsubt if it doesn't exist
    if (!accsubtExists) {
      console.log('🔧 Creating accsubt role...');
      const accsubtRole = {
        id: 'role_accsubt',
        name: 'accsubt',
        displayName: 'Accra Subtransmission Engineer',
        description: 'Accra Subtransmission Engineer - Access to Accra regions',
        priority: 7,
        permissions: regionalEngineer.permissions || [],
        allowedRegions: ['region-1', 'region-3', 'region-4'],
        allowedDistricts: [],
        accessLevel: 'regional',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await rolePermissionsContainer.items.create(accsubtRole);
        console.log('✅ Successfully created accsubt role');
        console.log(JSON.stringify(accsubtRole, null, 2));
        console.log('');
      } catch (error) {
        console.error('❌ Error creating accsubt:', error.message);
      }
    } else {
      console.log('ℹ️  accsubt already exists, skipping creation');
    }

    // Final verification
    console.log('🔍 Final Verification...\n');
    const { resources: finalRoles } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    const ashsubtFinal = finalRoles.find(r => 
      r.id === 'role_ashsubt' || 
      r.id === 'ashsubt' || 
      r.name === 'ashsubt'
    );
    
    const accsubtFinal = finalRoles.find(r => 
      r.id === 'role_accsubt' || 
      r.id === 'accsubt' || 
      r.name === 'accsubt'
    );

    console.log('📊 Final Summary:');
    console.log(`   - Total roles in collection: ${finalRoles.length}`);
    console.log(`   - ashsubt present: ${ashsubtFinal ? '✅ YES' : '❌ NO'}`);
    console.log(`   - accsubt present: ${accsubtFinal ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (ashsubtFinal) {
      console.log('📄 ashsubt details:');
      console.log(JSON.stringify(ashsubtFinal, null, 2));
      console.log('');
    }

    if (accsubtFinal) {
      console.log('📄 accsubt details:');
      console.log(JSON.stringify(accsubtFinal, null, 2));
      console.log('');
    }

    if (ashsubtFinal && accsubtFinal) {
      console.log('✅ Successfully added both roles to rolePermissions collection!');
    } else {
      console.log('⚠️  Some roles may not have been added successfully');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
inspectAndAddRoles();

