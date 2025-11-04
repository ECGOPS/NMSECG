const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const rolesContainer = database.container('roles');

async function checkRolesCollection() {
  try {
    console.log('🔍 Checking roles Collection in Database...\n');

    // Get all roles
    const { resources: allRoles } = await rolesContainer.items.query('SELECT * FROM c').fetchAll();
    
    console.log(`📊 Found ${allRoles.length} roles in collection\n`);
    
    // Display all roles
    console.log('📋 All roles in roles collection:');
    allRoles.forEach((role, index) => {
      console.log(`\n${index + 1}. Role ID: ${role.id}`);
      console.log(`   Name: ${role.name || 'N/A'}`);
      console.log(`   Display Name: ${role.displayName || 'N/A'}`);
      console.log(`   Description: ${role.description || 'N/A'}`);
      console.log(`   Priority: ${role.priority || 'N/A'}`);
      console.log(`   Created At: ${role.createdAt || 'N/A'}`);
      console.log(`   Updated At: ${role.updatedAt || 'N/A'}`);
    });
    console.log('');

    // Check for ashsubt
    const ashsubt = allRoles.find(r => 
      r.id === 'ashsubt' || 
      r.name === 'ashsubt' ||
      r.displayName?.toLowerCase().includes('ashanti subtransmission')
    );

    // Check for accsubt
    const accsubt = allRoles.find(r => 
      r.id === 'accsubt' || 
      r.name === 'accsubt' ||
      r.displayName?.toLowerCase().includes('accra subtransmission')
    );

    console.log('Checking for new roles...');
    console.log(`ashsubt exists: ${ashsubt ? '✅ YES' : '❌ NO'}`);
    if (ashsubt) {
      console.log(JSON.stringify(ashsubt, null, 2));
      console.log('');
    }
    
    console.log(`accsubt exists: ${accsubt ? '✅ YES' : '❌ NO'}`);
    if (accsubt) {
      console.log(JSON.stringify(accsubt, null, 2));
      console.log('');
    }

    console.log('📊 Summary:');
    console.log(`   - Total roles in collection: ${allRoles.length}`);
    console.log(`   - ashsubt present: ${ashsubt ? '✅ YES' : '❌ NO'}`);
    console.log(`   - accsubt present: ${accsubt ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // Check if we need to add the roles
    if (!ashsubt || !accsubt) {
      console.log('⚠️  Missing roles detected. Need to add them to roles collection.');
      console.log('');
      
      // Try to create them
      if (!ashsubt) {
        console.log('🔧 Creating ashsubt role...');
        const newAshsubt = {
          id: 'ashsubt',
          name: 'ashsubt',
          displayName: 'Ashanti Subtransmission Engineer',
          description: 'Ashanti Subtransmission Engineer - Access to Ashanti regions',
          priority: 7,
          allowedRegions: ['region-2', 'region-5', 'region-6', 'region-7'],
          allowedDistricts: [],
          accessLevel: 'regional',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        try {
          await rolesContainer.items.create(newAshsubt);
          console.log('✅ Successfully created ashsubt role');
        } catch (error) {
          console.error('❌ Error creating ashsubt:', error.message);
        }
        console.log('');
      }

      if (!accsubt) {
        console.log('🔧 Creating accsubt role...');
        const newAccsubt = {
          id: 'accsubt',
          name: 'accsubt',
          displayName: 'Accra Subtransmission Engineer',
          description: 'Accra Subtransmission Engineer - Access to Accra regions',
          priority: 7,
          allowedRegions: ['region-1', 'region-3', 'region-4'],
          allowedDistricts: [],
          accessLevel: 'regional',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        try {
          await rolesContainer.items.create(newAccsubt);
          console.log('✅ Successfully created accsubt role');
        } catch (error) {
          console.error('❌ Error creating accsubt:', error.message);
        }
        console.log('');
      }

      // Re-verify
      const { resources: finalRoles } = await rolesContainer.items.query('SELECT * FROM c').fetchAll();
      console.log('🔍 Re-verifying after creation...');
      console.log(`   - Total roles now: ${finalRoles.length}`);
      console.log(`   - ashsubt present: ${finalRoles.find(r => r.id === 'ashsubt' || r.name === 'ashsubt') ? '✅ YES' : '❌ NO'}`);
      console.log(`   - accsubt present: ${finalRoles.find(r => r.id === 'accsubt' || r.name === 'accsubt') ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('✅ Both ashsubt and accsubt are present in the roles collection!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
checkRolesCollection();

