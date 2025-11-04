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

async function checkRolePermissionsCollection() {
  try {
    console.log('🔍 Checking rolePermissions Collection in Database...\n');
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

    // Check for 'rolePermissions' container
    const rolePermissionsContainerId = 'rolePermissions';
    const hasRolePermissionsContainer = containers.find(c => c.id === rolePermissionsContainerId);
    
    if (!hasRolePermissionsContainer) {
      console.log('❌ rolePermissions container not found in database');
      console.log('');
      console.log('Available containers are:');
      containers.forEach(c => console.log(`  - ${c.id}`));
      return;
    }

    console.log('✅ rolePermissions container found\n');
    const rolePermissionsContainer = database.container(rolePermissionsContainerId);

    // Query all role permissions
    const { resources: rolePermissions } = await rolePermissionsContainer.items.query('SELECT * FROM c').fetchAll();
    
    console.log(`📊 Found ${rolePermissions.length} role permissions entries\n`);
    
    if (rolePermissions.length === 0) {
      console.log('⚠️  No role permissions found in the collection');
      return;
    }

    // Check for ashsubt and accsubt
    const ashsubtRole = rolePermissions.find(r => r.id === 'ashsubt' || r.name === 'ashsubt');
    const accsubtRole = rolePermissions.find(r => r.id === 'accsubt' || r.name === 'accsubt');

    console.log('Checking for new roles...\n');
    
    if (ashsubtRole) {
      console.log('✅ ashsubt found in rolePermissions collection:');
      console.log(JSON.stringify(ashsubtRole, null, 2));
      console.log('');
    } else {
      console.log('❌ ashsubt NOT found in rolePermissions collection');
      console.log('');
    }

    if (accsubtRole) {
      console.log('✅ accsubt found in rolePermissions collection:');
      console.log(JSON.stringify(accsubtRole, null, 2));
      console.log('');
    } else {
      console.log('❌ accsubt NOT found in rolePermissions collection');
      console.log('');
    }

    // List all role names
    console.log('📋 All roles in rolePermissions collection:');
    rolePermissions.forEach(role => {
      console.log(`  - ${role.id || role.name || 'unnamed'}: ${role.displayName || role.description || 'no description'}`);
    });
    console.log('');

    // Check for regional_engineer as reference
    const regionalEngineerRole = rolePermissions.find(r => r.id === 'regional_engineer' || r.name === 'regional_engineer');
    if (regionalEngineerRole) {
      console.log('📄 regional_engineer role for reference:');
      console.log(JSON.stringify(regionalEngineerRole, null, 2));
      console.log('');
    }

    // Summary
    console.log('📊 Summary:');
    console.log(`   - Total role permissions: ${rolePermissions.length}`);
    console.log(`   - ashsubt present: ${ashsubtRole ? '✅ YES' : '❌ NO'}`);
    console.log(`   - accsubt present: ${accsubtRole ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (!ashsubtRole || !accsubtRole) {
      console.log('⚠️  Action Required:');
      console.log('   The new roles are missing from rolePermissions collection.');
      console.log('   They need to be added manually or via the role management interface.');
      console.log('');
    } else {
      console.log('✅ All new roles are present in rolePermissions collection!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the check
checkRolePermissionsCollection();

