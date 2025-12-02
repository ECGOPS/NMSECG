require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

const TEST_EMAIL = 'afiifi@ecgprojectopsgmail.onmicrosoft.com';

// Simulate the /api/users/me endpoint logic
async function testUsersMeEndpoint(userId, userEmail) {
  console.log('🧪 Testing /api/users/me endpoint logic');
  console.log('='.repeat(60));
  console.log(`   Simulated userId (from JWT): ${userId || 'N/A'}`);
  console.log(`   Simulated userEmail (from JWT): ${userEmail || 'N/A'}`);
  console.log('');
  
  try {
    // Step 1: Try to find user by ID (userId from JWT)
    if (userId) {
      console.log('📋 Step 1: Looking for user by ID...');
      const { resources: idUsers } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: userId }]
      }).fetchAll();
      
      if (idUsers.length > 0) {
        const user = idUsers[0];
        console.log(`   ✅ Found user by ID: ${user.email}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Status: ${user.status}`);
        return { success: true, user, method: 'id' };
      } else {
        console.log(`   ❌ No user found with ID: ${userId}`);
      }
    }
    
    // Step 2: Try to find user by email (from JWT payload)
    if (userEmail) {
      console.log('\n📋 Step 2: Looking for user by email...');
      const { resources: emailUsers } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.email = @email',
        parameters: [{ name: '@email', value: userEmail }]
      }).fetchAll();
      
      if (emailUsers.length > 0) {
        const user = emailUsers[0];
        console.log(`   ✅ Found user by email: ${user.email}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Status: ${user.status}`);
        console.log(`      UID: ${user.uid || 'N/A'}`);
        return { success: true, user, method: 'email' };
      } else {
        console.log(`   ❌ No user found with email: ${userEmail}`);
      }
    }
    
    // Step 3: Try to find user by UID (if userId is actually a UID)
    if (userId) {
      console.log('\n📋 Step 3: Looking for user by UID...');
      const { resources: uidUsers } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.uid = @uid',
        parameters: [{ name: '@uid', value: userId }]
      }).fetchAll();
      
      if (uidUsers.length > 0) {
        const user = uidUsers[0];
        console.log(`   ✅ Found user by UID: ${user.email}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Status: ${user.status}`);
        return { success: true, user, method: 'uid' };
      } else {
        console.log(`   ❌ No user found with UID: ${userId}`);
      }
    }
    
    console.log('\n❌ User not found by any method');
    return { success: false, error: 'User not found' };
    
  } catch (error) {
    console.error('\n❌ Error testing endpoint:', error);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testing /api/users/me Endpoint Logic\n');
  console.log(`   Database: ${databaseId}`);
  console.log(`   Container: ${containerId}`);
  console.log(`   Test Email: ${TEST_EMAIL}\n`);
  
  // Test Scenario 1: User found by email (most common case)
  console.log('\n' + '='.repeat(60));
  console.log('📝 Test Scenario 1: User found by email (from JWT payload)');
  console.log('='.repeat(60));
  const result1 = await testUsersMeEndpoint(null, TEST_EMAIL);
  
  if (result1.success) {
    console.log('\n✅ Test 1 PASSED');
    console.log(`   Method: Found by ${result1.method}`);
    console.log(`   User Role: ${result1.user.role}`);
    console.log(`   User Status: ${result1.user.status}`);
    
    if (result1.user.role === 'system_admin' && result1.user.status === 'active') {
      console.log('\n✅ User has correct admin role and active status!');
      console.log('   This user should be able to login successfully.');
    } else {
      console.log('\n⚠️  User role or status may need adjustment');
    }
  } else {
    console.log('\n❌ Test 1 FAILED');
    console.log(`   Error: ${result1.error}`);
  }
  
  // Test Scenario 2: User found by ID (if UID was updated)
  if (result1.success && result1.user.uid) {
    console.log('\n' + '='.repeat(60));
    console.log('📝 Test Scenario 2: User found by UID (after first login)');
    console.log('='.repeat(60));
    const result2 = await testUsersMeEndpoint(result1.user.uid, null);
    
    if (result2.success) {
      console.log('\n✅ Test 2 PASSED - User can be found by UID after first login');
    } else {
      console.log('\n⚠️  Test 2: User not found by UID (this is OK if UID not updated yet)');
    }
  }
  
  // Test Scenario 3: User found by document ID
  if (result1.success) {
    console.log('\n' + '='.repeat(60));
    console.log('📝 Test Scenario 3: User found by document ID');
    console.log('='.repeat(60));
    const result3 = await testUsersMeEndpoint(result1.user.id, null);
    
    if (result3.success) {
      console.log('\n✅ Test 3 PASSED - User can be found by document ID');
    } else {
      console.log('\n⚠️  Test 3: User not found by document ID');
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));
  console.log(`   Test Email: ${TEST_EMAIL}`);
  if (result1.success) {
    console.log(`   ✅ User exists in database`);
    console.log(`   ✅ Can be found by email: ${result1.method === 'email' ? 'YES' : 'NO'}`);
    console.log(`   ✅ Role: ${result1.user.role}`);
    console.log(`   ✅ Status: ${result1.user.status}`);
    console.log(`   ✅ Disabled: ${result1.user.disabled ? 'YES' : 'NO'}`);
    
    console.log('\n💡 Endpoint Behavior:');
    console.log('   1. When user logs in, JWT contains email and oid/sub');
    console.log('   2. Backend tries to find user by oid/sub (UID) first');
    console.log('   3. If not found, backend tries to find by email');
    console.log('   4. If found by email, backend updates UID in database');
    console.log('   5. Returns user data to frontend');
    console.log('   6. Frontend updates user state with correct role/status');
    
    if (result1.user.role === 'system_admin' && result1.user.status === 'active') {
      console.log('\n✅ CONCLUSION: User should be able to login successfully!');
      console.log('   If user is stuck on pending page, check:');
      console.log('   - Browser console for API errors');
      console.log('   - Backend logs for /api/users/me calls');
      console.log('   - Network tab to see if API call succeeds');
    }
  } else {
    console.log(`   ❌ User not found in database`);
    console.log(`   Error: ${result1.error}`);
  }
}

runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

