require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function fixUserUID(email, azureADObjectId = null) {
  try {
    console.log(`🔍 Finding user: ${email}\n`);
    console.log('='.repeat(60));
    
    // Find user by email
    const { resources: users } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email }]
    }).fetchAll();
    
    if (users.length === 0) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }
    
    const user = users[0];
    
    console.log('📋 Current user data:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Current UID: ${user.uid || 'N/A'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   ID: ${user.id}`);
    
    // If Azure AD Object ID is provided, use it; otherwise, we need to get it from the user
    // For now, we'll set a placeholder that indicates the UID needs to be updated on first login
    // The backend auth.js should handle this, but let's make sure the user can be found by email
    
    console.log('\n💡 Solution:');
    console.log('   The backend should find this user by email and update the UID automatically.');
    console.log('   However, if the user is stuck, we can:');
    console.log('   1. Ensure the user can be found by email (already working)');
    console.log('   2. Make sure the backend updates the UID when found by email');
    console.log('   3. Or manually set the UID if you know the Azure AD Object ID');
    
    if (azureADObjectId) {
      console.log(`\n🔄 Updating UID to Azure AD Object ID: ${azureADObjectId}`);
      const updatedUser = {
        ...user,
        uid: azureADObjectId,
        updatedAt: new Date().toISOString()
      };
      
      const { resource: updated } = await container.items.upsert(updatedUser);
      console.log('✅ UID updated successfully!');
      console.log(`   New UID: ${updated.uid}`);
      return updated;
    } else {
      console.log('\n⚠️  No Azure AD Object ID provided.');
      console.log('   The backend should automatically update the UID when the user logs in.');
      console.log('   If the user is still stuck, check the backend logs to see if the UID update is happening.');
      console.log('\n   To get the Azure AD Object ID:');
      console.log('   1. Have the user log in');
      console.log('   2. Check the backend logs for the JWT payload');
      console.log('   3. Look for "req.auth.payload.oid" in the logs');
      console.log('   4. Run this script again with that OID value');
    }
    
    // Also ensure the user has the correct status and role
    if (user.status !== 'active' || user.role !== 'system_admin') {
      console.log('\n🔄 Ensuring user has correct status and role...');
      const updatedUser = {
        ...user,
        status: 'active',
        role: 'system_admin',
        updatedAt: new Date().toISOString()
      };
      
      const { resource: updated } = await container.items.upsert(updatedUser);
      console.log('✅ Status and role verified!');
      console.log(`   Status: ${updated.status}`);
      console.log(`   Role: ${updated.role}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing user UID:', error);
    process.exit(1);
  }
}

const email = process.argv[2] || 'afiifi@ecgprojectopsgmail.onmicrosoft.com';
const azureADObjectId = process.argv[3] || null;

fixUserUID(email, azureADObjectId).then(() => {
  console.log('\n✅ Process complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

