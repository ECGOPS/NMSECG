const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Cosmos DB connection
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

// Load permissions from JSON file
const permissionsPath = path.join(__dirname, '../backend/config/permissions.json');
const permissionsData = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));

async function checkAndUpdateRoles() {
  try {
    console.log('🔍 Checking Roles in Database...\n');
    console.log('Environment:', {
      endpoint,
      database: databaseId,
      keySet: !!key
    });
    console.log('');

    // Get all containers
    const { resources: containers } = await database.containers.readAll().fetchAll();
    console.log('📦 Available containers:', containers.map(c => c.id).join(', '));
    console.log('');

    // Check for 'permissions' container
    const permissionsContainerId = 'permissions';
    const permissionsContainer = database.container(permissionsContainerId);

    try {
      // Try to read the permissions document
      const { resource: permissionsDoc } = await permissionsContainer.item('permissions', 'permissions').read();
      
      console.log('✅ Permissions document found');
      console.log('📄 Document structure:');
      console.log(JSON.stringify(permissionsDoc, null, 2));
      console.log('');

      // Check for ashsubt and accsubt roles
      if (permissionsDoc.roles) {
        console.log('📋 Current roles in database:');
        Object.keys(permissionsDoc.roles).forEach(role => {
          console.log(`  - ${role}: ${permissionsDoc.roles[role].description} (priority: ${permissionsDoc.roles[role].priority})`);
        });
        console.log('');

        const hasAshsubt = permissionsDoc.roles.ashsubt;
        const hasAccsubt = permissionsDoc.roles.accsubt;

        if (!hasAshsubt || !hasAccsubt) {
          console.log('⚠️  Missing roles detected:');
          if (!hasAshsubt) console.log('  - ashsubt is missing');
          if (!hasAccsubt) console.log('  - accsubt is missing');
          console.log('');

          console.log('🔧 Updating permissions document...');
          
          // Update roles
          if (!hasAshsubt) {
            permissionsDoc.roles.ashsubt = {
              "description": "Ashanti Subtransmission Engineer - Access to Ashanti regions",
              "priority": 7
            };
            console.log('  ✅ Added ashsubt role');
          }

          if (!hasAccsubt) {
            permissionsDoc.roles.accsubt = {
              "description": "Accra Subtransmission Engineer - Access to Accra regions",
              "priority": 7
            };
            console.log('  ✅ Added accsubt role');
          }

          // Replace the document
          await permissionsContainer.item('permissions', 'permissions').replace(permissionsDoc);
          console.log('');
          console.log('✅ Permissions document updated successfully!');
        } else {
          console.log('✅ ashsubt and accsubt roles are already in the database');
        }
      }

      // Check features for ashsubt and accsubt
      console.log('');
      console.log('🔍 Checking permissions for ashsubt and accsubt in features...');
      
      const missingInFeatures = [];
      for (const [featureName, feature] of Object.entries(permissionsDoc.features)) {
        for (const [action, permissionData] of Object.entries(feature.permissions)) {
          if (permissionData.roles) {
            const hasAshsubt = permissionData.roles.includes('ashsubt');
            const hasAccsubt = permissionData.roles.includes('accsubt');
            
            if (!hasAshsubt || !hasAccsubt) {
              missingInFeatures.push({
                feature: featureName,
                action: action,
                missing: []
              });
              
              if (!hasAshsubt) {
                permissionData.roles.push('ashsubt');
                missingInFeatures[missingInFeatures.length - 1].missing.push('ashsubt');
              }
              if (!hasAccsubt) {
                permissionData.roles.push('accsubt');
                missingInFeatures[missingInFeatures.length - 1].missing.push('accsubt');
              }
            }
          }
        }
      }

      if (missingInFeatures.length > 0) {
        console.log(`⚠️  Found ${missingInFeatures.length} features/actions missing ashsubt/accsubt permissions`);
        console.log('Updating permissions...');
        
        // Replace the document with updated permissions
        await permissionsContainer.item('permissions', 'permissions').replace(permissionsDoc);
        console.log('✅ All permissions updated successfully!');
      } else {
        console.log('✅ All features already have ashsubt and accsubt permissions');
      }

      console.log('');
      console.log('📊 Final Summary:');
      console.log('   - Total roles:', Object.keys(permissionsDoc.roles).length);
      console.log('   - Total features:', Object.keys(permissionsDoc.features).length);
      console.log('');
      console.log('✅ Database check and update completed successfully!');

    } catch (readError) {
      console.log('⚠️  Permissions document not found or error reading it:', readError.message);
      console.log('');
      console.log('🔄 Creating new permissions document from permissions.json...');
      
      // Create the permissions document
      const newPermissionsDoc = {
        id: 'permissions',
        type: 'permissions',
        features: permissionsData.features,
        roles: permissionsData.roles,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      await permissionsContainer.items.create(newPermissionsDoc);
      console.log('✅ New permissions document created!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the check
checkAndUpdateRoles();

