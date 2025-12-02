require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function checkUser(email) {
  try {
    console.log(`🔍 Checking user: ${email}\n`);
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
    
    console.log('📋 Complete User Information:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(user, null, 2));
    console.log('\n');
    
    console.log('📊 Key Fields:');
    console.log('-'.repeat(60));
    console.log(`   ID: ${user.id || 'N/A'}`);
    console.log(`   UID: ${user.uid || 'N/A'}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Name: ${user.name || user.displayName || 'N/A'}`);
    console.log(`   Role: ${user.role || 'N/A'}`);
    console.log(`   Status: ${user.status || 'N/A'}`);
    console.log(`   Disabled: ${user.disabled !== undefined ? user.disabled : 'N/A'}`);
    console.log(`   Must Change Password: ${user.mustChangePassword !== undefined ? user.mustChangePassword : 'N/A'}`);
    console.log(`   Region: ${user.regionId || user.region || 'N/A'}`);
    console.log(`   District: ${user.districtId || user.district || 'N/A'}`);
    console.log(`   Created: ${user.createdAt ? (typeof user.createdAt === 'object' && user.createdAt._seconds ? new Date(user.createdAt._seconds * 1000).toISOString() : new Date(user.createdAt).toISOString()) : 'N/A'}`);
    console.log(`   Updated: ${user.updatedAt ? (typeof user.updatedAt === 'object' && user.updatedAt._seconds ? new Date(user.updatedAt._seconds * 1000).toISOString() : new Date(user.updatedAt).toISOString()) : 'N/A'}`);
    
    // Check for approval-related fields
    console.log('\n🔍 Approval/Status Fields:');
    console.log('-'.repeat(60));
    const approvalFields = ['approved', 'approvalStatus', 'pending', 'isApproved', 'needsApproval', 'approvedBy', 'approvedAt'];
    let foundApprovalFields = false;
    approvalFields.forEach(field => {
      if (user[field] !== undefined) {
        console.log(`   ${field}: ${JSON.stringify(user[field])}`);
        foundApprovalFields = true;
      }
    });
    if (!foundApprovalFields) {
      console.log('   No approval-related fields found');
    }
    
    // Check all fields
    console.log('\n📝 All Fields in User Document:');
    console.log('-'.repeat(60));
    Object.keys(user).forEach(key => {
      if (!key.startsWith('_')) { // Skip Cosmos DB internal fields
        const value = user[key];
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
        console.log(`   ${key}: ${displayValue}`);
      }
    });
    
    // Analysis
    console.log('\n🔍 Analysis:');
    console.log('-'.repeat(60));
    const issues = [];
    
    if (!user.status || user.status === 'pending' || user.status === 'pre_registered') {
      issues.push(`⚠️  Status is "${user.status || 'N/A'}" - should be "active"`);
    }
    
    if (user.disabled === true) {
      issues.push('⚠️  User is disabled');
    }
    
    if (user.role !== 'system_admin') {
      issues.push(`⚠️  Role is "${user.role}" - may need to be "system_admin"`);
    }
    
    if (user.approved === false || user.isApproved === false || user.approvalStatus === 'pending') {
      issues.push('⚠️  User approval is pending');
    }
    
    if (issues.length === 0) {
      console.log('✅ No obvious issues found. User should be able to login.');
    } else {
      console.log('❌ Potential issues found:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
    process.exit(1);
  }
}

const email = process.argv[2] || 'afiifi@ecgprojectopsgmail.onmicrosoft.com';
checkUser(email).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

