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

async function addNewRolesToRolePermissions() {
  try {
    console.log('🔍 Adding ashsubt and accsubt to rolePermissions collection...\n');

    // Get the regional_engineer role as a template
    const regionalEngineerId = 'regional_engineer';
    let regionalEngineerRole;
    
    try {
      const { resource } = await rolePermissionsContainer.item(regionalEngineerId, regionalEngineerId).read();
      regionalEngineerRole = resource;
      console.log('✅ Found regional_engineer role as template');
      console.log(JSON.stringify(regionalEngineerRole, null, 2));
      console.log('');
    } catch (error) {
      console.log('⚠️  Could not find regional_engineer role, will create from template');
      regionalEngineerRole = {
        id: 'regional_engineer',
        name: 'regional_engineer',
        displayName: 'Regional Engineer',
        description: 'Regional Engineer - Access to specific region',
        permissions: [],
        allowedRegions: [],
        allowedDistricts: [],
        accessLevel: 'regional',
        isActive: true
      };
    }

    // Check if ashsubt already exists
    let ashsubtExists = false;
    try {
      await rolePermissionsContainer.item('ashsubt', 'ashsubt').read();
      ashsubtExists = true;
      console.log('⚠️  ashsubt already exists in rolePermissions');
    } catch (error) {
      // Doesn't exist, will create it
    }

    // Check if accsubt already exists
    let accsubtExists = false;
    try {
      await rolePermissionsContainer.item('accsubt', 'accsubt').read();
      accsubtExists = true;
      console.log('⚠️  accsubt already exists in rolePermissions');
    } catch (error) {
      // Doesn't exist, will create it
    }

    console.log('');

    // Create ashsubt role
    if (!ashsubtExists) {
      const ashsubtRole = {
        id: 'ashsubt',
        name: 'ashsubt',
        displayName: 'Ashanti Subtransmission Engineer',
        description: 'Ashanti Subtransmission Engineer - Access to Ashanti regions',
        priority: 7,
        permissions: regionalEngineerRole.permissions || [],
        allowedRegions: ['region-2', 'region-5', 'region-6', 'region-7'], // SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        allowedDistricts: [], // All districts in allowed regions
        accessLevel: 'regional',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await rolePermissionsContainer.items.create(ashsubtRole);
        console.log('✅ Created ashsubt role in rolePermissions collection');
        console.log(JSON.stringify(ashsubtRole, null, 2));
        console.log('');
      } catch (error) {
        console.error('❌ Error creating ashsubt:', error.message);
      }
    }

    // Create accsubt role
    if (!accsubtExists) {
      const accsubtRole = {
        id: 'accsubt',
        name: 'accsubt',
        displayName: 'Accra Subtransmission Engineer',
        description: 'Accra Subtransmission Engineer - Access to Accra regions',
        priority: 7,
        permissions: regionalEngineerRole.permissions || [],
        allowedRegions: ['region-1', 'region-3', 'region-4'], // SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        allowedDistricts: [], // All districts in allowed regions
        accessLevel: 'regional',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await rolePermissionsContainer.items.create(accsubtRole);
        console.log('✅ Created accsubt role in rolePermissions collection');
        console.log(JSON.stringify(accsubtRole, null, 2));
        console.log('');
      } catch (error) {
        console.error('❌ Error creating accsubt:', error.message);
      }
    }

    // Final verification
    console.log('🔍 Verifying roles were added...\n');
    const { resources: allRoles } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    const ashsubtFinal = allRoles.find(r => r.id === 'ashsubt' || r.name === 'ashsubt');
    const accsubtFinal = allRoles.find(r => r.id === 'accsubt' || r.name === 'accsubt');

    console.log('📊 Final Summary:');
    console.log(`   - Total roles: ${allRoles.length}`);
    console.log(`   - ashsubt present: ${ashsubtFinal ? '✅ YES' : '❌ NO'}`);
    console.log(`   - accsubt present: ${accsubtFinal ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (ashsubtFinal && accsubtFinal) {
      console.log('✅ Successfully added both roles to rolePermissions collection!');
      console.log('');
      console.log('📄 ashsubt details:');
      console.log(`   - Display Name: ${ashsubtFinal.displayName}`);
      console.log(`   - Priority: ${ashsubtFinal.priority}`);
      console.log(`   - Allowed Regions: ${ashsubtFinal.allowedRegions ? ashsubtFinal.allowedRegions.join(', ') : 'all'}`);
      console.log('');
      console.log('📄 accsubt details:');
      console.log(`   - Display Name: ${accsubtFinal.displayName}`);
      console.log(`   - Priority: ${accsubtFinal.priority}`);
      console.log(`   - Allowed Regions: ${accsubtFinal.allowedRegions ? accsubtFinal.allowedRegions.join(', ') : 'all'}`);
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
addNewRolesToRolePermissions();

