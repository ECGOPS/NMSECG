require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');
const path = require('path');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function updateUserToAdmin(email) {
  try {
    console.log('🔍 Searching for user:', email);
    console.log('='.repeat(60));
    
    // Find user by email
    const { resources: users } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email }]
    }).fetchAll();
    
    if (users.length === 0) {
      console.error(`❌ User not found: ${email}`);
      console.log('\n💡 Available users with similar emails:');
      
      // Try to find similar emails
      const { resources: allUsers } = await container.items.query({
        query: 'SELECT c.email, c.name, c.role FROM c WHERE CONTAINS(c.email, @search)',
        parameters: [{ name: '@search', value: email.split('@')[0] }]
      }).fetchAll();
      
      if (allUsers.length > 0) {
        allUsers.slice(0, 10).forEach(user => {
          console.log(`   - ${user.email} (${user.name || 'N/A'}) - Role: ${user.role || 'N/A'}`);
        });
      }
      
      process.exit(1);
    }
    
    const user = users[0];
    console.log('\n📋 Current user details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Current Role: ${user.role || 'N/A'}`);
    console.log(`   Status: ${user.status || 'N/A'}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   UID: ${user.uid || 'N/A'}`);
    
    // Update user to system_admin
    const updatedUser = {
      ...user,
      role: 'system_admin',
      status: 'active', // Ensure they can login
      updatedAt: new Date().toISOString()
    };
    
    console.log('\n🔄 Updating user...');
    const { resource: updated } = await container.items.upsert(updatedUser);
    
    console.log('\n✅ User updated successfully!');
    console.log('='.repeat(60));
    console.log('📋 Updated user details:');
    console.log(`   Email: ${updated.email}`);
    console.log(`   Name: ${updated.name || 'N/A'}`);
    console.log(`   Role: ${updated.role}`);
    console.log(`   Status: ${updated.status}`);
    console.log(`   Updated: ${updated.updatedAt}`);
    console.log('\n✅ This user can now login and approve other admin users!');
    
  } catch (error) {
    console.error('❌ Error updating user:', error);
    if (error.code === 404) {
      console.error('   User not found in database');
    }
    process.exit(1);
  }
}

// Get email from command line argument or use the provided one
const email = process.argv[2] || 'afiifi@ecgprojectopsgmail.onmicrosoft.com';

if (!email || !email.includes('@')) {
  console.error('❌ Invalid email address');
  console.error('   Usage: node update-user-to-admin.cjs <email>');
  process.exit(1);
}

updateUserToAdmin(email).then(() => {
  console.log('\n✅ Update complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

