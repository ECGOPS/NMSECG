require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function verifyUser(email) {
  try {
    console.log(`🔍 Verifying user can be found for login: ${email}\n`);
    console.log('='.repeat(60));
    
    // Test different email formats (case variations)
    const emailVariations = [
      email,
      email.toLowerCase(),
      email.toUpperCase(),
      email.replace('@', ' @'), // In case of typos
    ];
    
    for (const testEmail of emailVariations) {
      console.log(`\n🔍 Testing email: "${testEmail}"`);
      
      // Test exact match
      const { resources: exactMatch } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.email = @email',
        parameters: [{ name: '@email', value: testEmail }]
      }).fetchAll();
      
      if (exactMatch.length > 0) {
        const user = exactMatch[0];
        console.log(`   ✅ Found user with exact match!`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Name: ${user.name}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Status: ${user.status}`);
        console.log(`      UID: ${user.uid || 'N/A'}`);
        
        // Verify the user has correct admin settings
        if (user.role !== 'system_admin') {
          console.log(`   ⚠️  WARNING: Role is "${user.role}", not "system_admin"`);
        }
        if (user.status !== 'active') {
          console.log(`   ⚠️  WARNING: Status is "${user.status}", not "active"`);
        }
        if (user.disabled === true) {
          console.log(`   ⚠️  WARNING: User is disabled`);
        }
        
        return user;
      }
      
      // Test case-insensitive match
      const { resources: caseInsensitive } = await container.items.query({
        query: 'SELECT * FROM c WHERE LOWER(c.email) = @email',
        parameters: [{ name: '@email', value: testEmail.toLowerCase() }]
      }).fetchAll();
      
      if (caseInsensitive.length > 0) {
        const user = caseInsensitive[0];
        console.log(`   ✅ Found user with case-insensitive match!`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Email in DB: ${user.email}`);
        console.log(`      Name: ${user.name}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Status: ${user.status}`);
        
        if (user.email.toLowerCase() !== email.toLowerCase()) {
          console.log(`   ⚠️  WARNING: Email case mismatch!`);
          console.log(`      Expected: ${email}`);
          console.log(`      Found: ${user.email}`);
        }
        
        return user;
      }
    }
    
    console.log(`\n❌ User not found with any email variation`);
    return null;
    
  } catch (error) {
    console.error('❌ Error verifying user:', error);
    return null;
  }
}

async function main() {
  const email = process.argv[2] || 'afiifi@ecgprojectopsgmail.onmicrosoft.com';
  const user = await verifyUser(email);

  if (user) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ User verification complete!');
    console.log('\n📋 Summary:');
    console.log(`   User exists: ✅`);
    console.log(`   Role: ${user.role} ${user.role === 'system_admin' ? '✅' : '❌'}`);
    console.log(`   Status: ${user.status} ${user.status === 'active' ? '✅' : '❌'}`);
    console.log(`   Disabled: ${user.disabled ? '❌' : '✅'}`);
    
    if (user.role === 'system_admin' && user.status === 'active' && !user.disabled) {
      console.log('\n✅ User should be able to login!');
      console.log('\n💡 If user is still stuck on pending page:');
      console.log('   1. Check browser console for errors');
      console.log('   2. Check backend logs when user tries to login');
      console.log('   3. Verify the /api/users/me endpoint is being called');
      console.log('   4. Check if the email in JWT token matches exactly');
    } else {
      console.log('\n⚠️  User needs to be fixed!');
      console.log('   Run: node scripts/update-user-to-admin.cjs "' + email + '"');
    }
    process.exit(0);
  } else {
    console.log('\n❌ User not found!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

