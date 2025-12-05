require('dotenv').config({ path: './backend/.env' });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables');
  console.error('Required: COSMOS_DB_ENDPOINT, COSMOS_DB_KEY, COSMOS_DB_DATABASE');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function updateUserStatus(email, newStatus) {
  try {
    console.log(`\n🔍 Searching for user: ${email}\n`);
    
    // Query by email (case-insensitive search)
    const querySpec = {
      query: 'SELECT * FROM c WHERE LOWER(c.email) = @email',
      parameters: [{ name: '@email', value: email.toLowerCase() }]
    };
    
    const { resources } = await container.items.query(querySpec).fetchAll();
    
    if (resources.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    if (resources.length > 1) {
      console.log(`⚠️  Warning: Found ${resources.length} users with this email`);
    }
    
    for (const user of resources) {
      console.log(`\n📋 Current User Details:`);
      console.log('─'.repeat(50));
      console.log(`   ID:     ${user.id || user.uid || 'N/A'}`);
      console.log(`   Name:   ${user.name || 'N/A'}`);
      console.log(`   Email:  ${user.email || 'N/A'}`);
      console.log(`   Role:   ${user.role || 'N/A'}`);
      console.log(`   Status: ${user.status || 'N/A'} → ${newStatus}`);
      
      // Update the user
      const updatedUser = {
        ...user,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      
      console.log(`\n🔄 Updating user status...`);
      const { resource } = await container.item(user.id, user.id).replace(updatedUser);
      
      console.log(`\n✅ User updated successfully!`);
      console.log('─'.repeat(50));
      console.log(`   ID:     ${resource.id || resource.uid || 'N/A'}`);
      console.log(`   Name:   ${resource.name || 'N/A'}`);
      console.log(`   Email:  ${resource.email || 'N/A'}`);
      console.log(`   Role:   ${resource.role || 'N/A'}`);
      console.log(`   Status: ${resource.status || 'N/A'}`);
      console.log(`   Updated At: ${resource.updatedAt || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('❌ Error updating user status:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    });
    throw error;
  }
}

// Get email and status from command line arguments
const email = process.argv[2];
const newStatus = process.argv[3] || 'active';

if (!email) {
  console.error('❌ Please provide an email address as an argument');
  console.error('Usage: node scripts/update-user-status.cjs <email> [status]');
  console.error('Default status: active');
  process.exit(1);
}

if (!['active', 'inactive', 'pre_registered'].includes(newStatus)) {
  console.error(`❌ Invalid status: ${newStatus}`);
  console.error('Valid statuses: active, inactive, pre_registered');
  process.exit(1);
}

updateUserStatus(email, newStatus)
  .then(() => {
    console.log('\n✅ Update complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

