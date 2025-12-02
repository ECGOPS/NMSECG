require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

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

// Simple password hashing function (matches backend logic)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createAdminUser(email, name = null) {
  try {
    console.log('🔍 Checking if user already exists...');
    console.log('='.repeat(60));
    
    // Check if user already exists
    const { resources: existingUsers } = await container.items.query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email }]
    }).fetchAll();
    
    if (existingUsers.length > 0) {
      console.log('⚠️  User already exists!');
      const existing = existingUsers[0];
      console.log(`\n📋 Existing user details:`);
      console.log(`   Email: ${existing.email}`);
      console.log(`   Name: ${existing.name || 'N/A'}`);
      console.log(`   Role: ${existing.role || 'N/A'}`);
      console.log(`   Status: ${existing.status || 'N/A'}`);
      console.log(`   ID: ${existing.id}`);
      
      // Update to admin if not already
      if (existing.role !== 'system_admin') {
        console.log('\n🔄 Updating user to system_admin...');
        const updatedUser = {
          ...existing,
          role: 'system_admin',
          status: 'active',
          updatedAt: new Date().toISOString()
        };
        
        const { resource: updated } = await container.items.upsert(updatedUser);
        console.log('✅ User updated to system_admin successfully!');
        console.log(`   New Role: ${updated.role}`);
        console.log(`   New Status: ${updated.status}`);
        return updated;
      } else {
        console.log('\n✅ User is already a system_admin!');
        return existing;
      }
    }
    
    // Generate a unique ID (use email-based or UUID)
    const userId = email.replace(/[@.]/g, '_') + '_' + Date.now();
    const uid = uuidv4();
    
    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '123';
    const hashedPassword = hashPassword(tempPassword);
    
    // Extract name from email if not provided
    const userName = name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Create new admin user
    const newUser = {
      id: userId,
      uid: uid,
      email: email,
      name: userName,
      displayName: userName,
      role: 'system_admin',
      status: 'active',
      password: hashedPassword,
      tempPassword: tempPassword,
      mustChangePassword: true,
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('\n📋 Creating new admin user:');
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Name: ${newUser.name}`);
    console.log(`   Role: ${newUser.role}`);
    console.log(`   Status: ${newUser.status}`);
    console.log(`   ID: ${newUser.id}`);
    console.log(`   UID: ${newUser.uid}`);
    
    console.log('\n🔄 Creating user in database...');
    const { resource: createdUser } = await container.items.create(newUser);
    
    console.log('\n✅ Admin user created successfully!');
    console.log('='.repeat(60));
    console.log('📋 User Details:');
    console.log(`   Email: ${createdUser.email}`);
    console.log(`   Name: ${createdUser.name}`);
    console.log(`   Role: ${createdUser.role}`);
    console.log(`   Status: ${createdUser.status}`);
    console.log(`   ID: ${createdUser.id}`);
    console.log(`   UID: ${createdUser.uid}`);
    console.log('\n🔑 Temporary Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Temporary Password: ${tempPassword}`);
    console.log('\n⚠️  IMPORTANT: User must change password on first login!');
    console.log('✅ This user can now login and approve other admin users!');
    
    return createdUser;
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    if (error.code === 409) {
      console.error('   User with this email or ID already exists');
    }
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2] || 'afiifi@ecgprojectopsgmail.onmicrosoft.com';
const name = process.argv[3] || null;

if (!email || !email.includes('@')) {
  console.error('❌ Invalid email address');
  console.error('   Usage: node create-admin-user.cjs <email> [name]');
  process.exit(1);
}

createAdminUser(email, name).then(() => {
  console.log('\n✅ Process complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

