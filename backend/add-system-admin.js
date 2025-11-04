require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');

// Get configuration from environment variables
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });

async function addSystemAdmin() {
  try {
    console.log('👑 Adding new system admin user...');
    console.log('📧 Email: bortianorboss@gmail.com');
    console.log('');

    const database = client.database(databaseId);
    const usersContainer = database.container('users');
    
    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const { resources: existingUsers } = await usersContainer.items.query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: 'bortianorboss@gmail.com' }]
    }).fetchAll();

    if (existingUsers.length > 0) {
      console.log('⚠️  User already exists!');
      const existingUser = existingUsers[0];
      console.log(`   Current role: ${existingUser.role}`);
      console.log(`   Current status: ${existingUser.status || 'N/A'}`);
      
      if (existingUser.role === 'system_admin') {
        console.log('✅ User is already a system admin');
        return;
      }
      
      // Update existing user to system admin
      console.log('🔄 Updating existing user to system admin...');
      const updatedUser = {
        ...existingUser,
        role: 'system_admin',
        updatedAt: new Date().toISOString()
      };
      
      const { resource: updated } = await usersContainer.item(existingUser.id, existingUser.id).replace(updatedUser);
      console.log('✅ User successfully updated to system admin');
      console.log(`   User ID: ${updated.id}`);
      console.log(`   Email: ${updated.email}`);
      console.log(`   Role: ${updated.role}`);
      console.log(`   Updated: ${updated.updatedAt}`);
      
    } else {
      // Create new system admin user
      console.log('➕ Creating new system admin user...');
      
      const newAdmin = {
        id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: 'bortianorboss@gmail.com',
        name: 'Bortianor Boss',
        displayName: 'Bortianor Boss',
        role: 'system_admin',
        status: 'active',
        region: '',
        district: '',
        staffId: 'ADMIN_BORTIANOR',
        disabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const { resource: created } = await usersContainer.items.create(newAdmin);
      console.log('✅ New system admin user created successfully');
      console.log(`   User ID: ${created.id}`);
      console.log(`   Email: ${created.email}`);
      console.log(`   Name: ${created.name}`);
      console.log(`   Role: ${created.role}`);
      console.log(`   Staff ID: ${created.staffId}`);
      console.log(`   Created: ${created.createdAt}`);
    }

    // Verify the addition
    console.log('\n🔍 Verifying system admin was added...');
    const { resources: allSystemAdmins } = await usersContainer.items.query({
      query: 'SELECT * FROM c WHERE c.role = @role',
      parameters: [{ name: '@role', value: 'system_admin' }]
    }).fetchAll();

    console.log(`✅ Total system admins now: ${allSystemAdmins.length}`);
    console.log('\n👑 Current System Admins:');
    allSystemAdmins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.email} (${admin.name})`);
    });

  } catch (error) {
    console.error('❌ Error adding system admin:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
addSystemAdmin().then(() => {
  console.log('\n✅ System admin addition completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
