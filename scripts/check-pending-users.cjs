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

async function checkPendingUsers() {
  try {
    console.log('\n🔍 Searching for pending users...\n');
    
    // Query for pending users: status = 'pre_registered' OR role = 'pending'
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.status = @status OR c.role = @role',
      parameters: [
        { name: '@status', value: 'pre_registered' },
        { name: '@role', value: 'pending' }
      ]
    };
    
    const { resources } = await container.items.query(querySpec).fetchAll();
    
    if (resources.length === 0) {
      console.log('✅ No pending users found in database');
      console.log('\n💡 All users have been approved or there are no new registrations.');
      return;
    }
    
    console.log(`📋 Found ${resources.length} pending user(s):\n`);
    console.log('═'.repeat(80));
    
    resources.forEach((user, index) => {
      console.log(`\n${index + 1}. User Details:`);
      console.log('─'.repeat(80));
      console.log(`   ID:           ${user.id || user.uid || 'N/A'}`);
      console.log(`   UID:          ${user.uid || 'N/A'}`);
      console.log(`   Name:         ${user.name || 'N/A'}`);
      console.log(`   Display Name: ${user.displayName || 'N/A'}`);
      console.log(`   Email:        ${user.email || 'N/A'}`);
      console.log(`   Role:         ${user.role || 'N/A'}`);
      console.log(`   Status:       ${user.status || 'N/A'}`);
      console.log(`   Staff ID:     ${user.staffId || 'N/A'}`);
      console.log(`   Region:       ${user.region || 'N/A'}`);
      console.log(`   District:     ${user.district || 'N/A'}`);
      console.log(`   Disabled:     ${user.disabled ? 'Yes' : 'No'}`);
      console.log(`   Created At:   ${user.createdAt || 'N/A'}`);
      console.log(`   Updated At:   ${user.updatedAt || 'N/A'}`);
      
      // Show why this user is pending
      const reasons = [];
      if (user.status === 'pre_registered') {
        reasons.push('Status: pre_registered');
      }
      if (user.role === 'pending') {
        reasons.push('Role: pending');
      }
      console.log(`\n   ⚠️  Pending Reason: ${reasons.join(' AND ')}`);
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total Pending Users: ${resources.length}`);
    console.log(`   Users with status 'pre_registered': ${resources.filter(u => u.status === 'pre_registered').length}`);
    console.log(`   Users with role 'pending': ${resources.filter(u => u.role === 'pending').length}`);
    console.log(`   Users with both: ${resources.filter(u => u.status === 'pre_registered' && u.role === 'pending').length}`);
    
  } catch (error) {
    console.error('❌ Error checking pending users:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    });
  }
}

checkPendingUsers()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

