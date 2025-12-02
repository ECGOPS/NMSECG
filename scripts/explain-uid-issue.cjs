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

async function explainUIDIssue() {
  console.log('🔍 Analyzing UID Issue for User Login');
  console.log('='.repeat(60));
  
  // Get the user
  const { resources: users } = await container.items.query({
    query: 'SELECT * FROM c WHERE c.email = @email',
    parameters: [{ name: '@email', value: TEST_EMAIL }]
  }).fetchAll();
  
  if (users.length === 0) {
    console.log('❌ User not found');
    return;
  }
  
  const user = users[0];
  
  console.log('\n📋 Current User UID:');
  console.log(`   UID in Database: ${user.uid}`);
  console.log(`   Type: Random UUID (generated when user was created)`);
  console.log(`   Status: ❌ NOT valid for Azure AD login`);
  
  console.log('\n🔐 How Azure AD Login Works:');
  console.log('   1. User logs in with Azure AD');
  console.log('   2. Azure AD issues JWT token with "oid" (Object ID)');
  console.log('   3. Backend extracts "oid" from JWT token');
  console.log('   4. Backend tries to find user by matching "oid" with "uid" in database');
  console.log('   5. If UID doesn\'t match → Backend tries to find by email');
  console.log('   6. If found by email → Backend updates UID to match Azure AD "oid"');
  
  console.log('\n⚠️  The Problem:');
  console.log(`   Current UID: ${user.uid}`);
  console.log(`   This is a random UUID, NOT the Azure AD Object ID`);
  console.log(`   When user logs in, Azure AD will provide a different "oid"`);
  console.log(`   The UIDs won't match initially`);
  
  console.log('\n✅ The Solution (Automatic):');
  console.log('   The backend SHOULD handle this automatically:');
  console.log('   1. User logs in → JWT has Azure AD "oid" (e.g., "abc123...")');
  console.log('   2. Backend tries to find by UID → Not found (UID mismatch)');
  console.log('   3. Backend finds user by email → ✅ Found!');
  console.log('   4. Backend updates UID to Azure AD "oid" → ✅ Fixed!');
  console.log('   5. Future logins will find user by UID directly');
  
  console.log('\n🔍 Why User Might Be Stuck:');
  console.log('   1. Email matching might fail (case sensitivity, exact match)');
  console.log('   2. UID update might fail (database error)');
  console.log('   3. Frontend might check user state before backend updates');
  console.log('   4. Backend might not be finding user by email correctly');
  
  console.log('\n💡 To Fix This:');
  console.log('   Option 1: Let user log in once - backend will auto-update UID');
  console.log('   Option 2: Get Azure AD Object ID and update manually');
  console.log('   Option 3: Check backend logs to see if email lookup is working');
  
  console.log('\n📝 To Get Azure AD Object ID:');
  console.log('   1. Have user log in');
  console.log('   2. Check backend logs for: "[JWT] req.auth.payload.oid: ..."');
  console.log('   3. Or check browser console for JWT token payload');
  console.log('   4. Then run: node scripts/fix-user-uid.cjs "' + TEST_EMAIL + '" "<azure-ad-oid>"');
  
  console.log('\n✅ Current Status:');
  console.log(`   User exists: ✅`);
  console.log(`   Role: ${user.role} ✅`);
  console.log(`   Status: ${user.status} ✅`);
  console.log(`   Email: ${user.email} ✅`);
  console.log(`   UID: ${user.uid} ⚠️  (Will be updated on first login)`);
  
  console.log('\n🎯 Conclusion:');
  console.log('   The UID is NOT valid for Azure AD login initially.');
  console.log('   But the backend SHOULD find the user by email and update the UID.');
  console.log('   If user is stuck, the issue is likely in the email matching or UID update process.');
}

explainUIDIssue().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

