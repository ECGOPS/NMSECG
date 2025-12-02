require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function testUsersMeLogic() {
  try {
    console.log('🧪 Testing /api/users/me endpoint logic...\n');
    
    // Simulate what the endpoint does with userId from JWT
    const userId = 'c6b38e1b-d6cb-4054-b9e6-88e44d7d1655'; // The UID from Azure AD
    const userEmail = 'afiifi@ecgprojectopsgmail.onmicrosoft.com';
    
    console.log(`Testing with userId (UID): ${userId}`);
    console.log(`Testing with email: ${userEmail}\n`);
    
    // Step 1: Try to find by UID (what the fixed endpoint does first)
    console.log('Step 1: Looking for user by UID...');
    let { resources } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.uid = @uid',
      parameters: [{ name: '@uid', value: userId }]
    }).fetchAll();
    
    if (resources.length > 0) {
      console.log(`✅ Found user by UID: ${resources[0].email}`);
      console.log(`   Role: ${resources[0].role}`);
      console.log(`   Status: ${resources[0].status}`);
      console.log(`   ID: ${resources[0].id}`);
      console.log(`   UID: ${resources[0].uid}`);
      return;
    }
    
    console.log('❌ Not found by UID\n');
    
    // Step 2: Try to find by document ID
    console.log('Step 2: Looking for user by document ID...');
    const { resources: idUsers } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: userId }]
    }).fetchAll();
    
    if (idUsers.length > 0) {
      console.log(`✅ Found user by ID: ${idUsers[0].email}`);
      console.log(`   Role: ${idUsers[0].role}`);
      console.log(`   Status: ${idUsers[0].status}`);
      return;
    }
    
    console.log('❌ Not found by ID\n');
    
    // Step 3: Try to find by email
    console.log('Step 3: Looking for user by email...');
    const { resources: emailUsers } = await container.items.query({
      query: 'SELECT * FROM c WHERE LOWER(c.email) = @email',
      parameters: [{ name: '@email', value: userEmail.toLowerCase() }]
    }).fetchAll();
    
    if (emailUsers.length > 0) {
      console.log(`✅ Found user by email: ${emailUsers[0].email}`);
      console.log(`   Role: ${emailUsers[0].role}`);
      console.log(`   Status: ${emailUsers[0].status}`);
      console.log(`   ID: ${emailUsers[0].id}`);
      console.log(`   UID: ${emailUsers[0].uid}`);
      return;
    }
    
    console.log('❌ Not found by email\n');
    console.log('❌ User not found with any method!');
    
  } catch (error) {
    console.error('❌ Error testing endpoint logic:', error);
    process.exit(1);
  }
}

testUsersMeLogic().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
