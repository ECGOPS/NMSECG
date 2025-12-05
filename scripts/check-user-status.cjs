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

async function checkUserStatus(email) {
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
    
    resources.forEach((user, index) => {
      console.log(`\n${index + 1}. User Details:`);
      console.log('─'.repeat(50));
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
      
      // Check if user is pending
      const isPending = user.status === 'pre_registered' || user.role === 'pending';
      console.log(`\n   ⚠️  Pending Status: ${isPending ? 'YES (Waiting for approval)' : 'NO'}`);
      
      if (isPending) {
        console.log(`      - Status: ${user.status}`);
        console.log(`      - Role: ${user.role}`);
        console.log(`      - This user should appear in the pending approval list`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking user status:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    });
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address as an argument');
  console.error('Usage: node scripts/check-user-status.cjs <email>');
  process.exit(1);
}

checkUserStatus(email)
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

