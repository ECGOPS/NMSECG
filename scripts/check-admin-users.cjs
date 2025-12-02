require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');
const path = require('path');

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

async function checkAdminUsers() {
  try {
    console.log('🔍 Checking admin users in the users collection...\n');
    console.log('Database:', databaseId);
    console.log('Container:', containerId);
    console.log('Endpoint:', endpoint);
    console.log('='.repeat(60));
    
    // Query for admin users (system_admin and admin roles)
    const adminQuery = `
      SELECT * FROM c 
      WHERE c.role = 'system_admin' OR c.role = 'admin'
      ORDER BY c.email
    `;
    
    const { resources: adminUsers } = await container.items.query(adminQuery).fetchAll();
    
    console.log(`\n📊 Found ${adminUsers.length} admin user(s):\n`);
    
    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found in the collection.');
    } else {
      adminUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email || user.name || 'Unknown'}`);
        console.log(`   - ID: ${user.id || 'N/A'}`);
        console.log(`   - UID: ${user.uid || 'N/A'}`);
        console.log(`   - Name: ${user.name || 'N/A'}`);
        console.log(`   - Role: ${user.role || 'N/A'}`);
        console.log(`   - Status: ${user.status || 'N/A'}`);
        console.log(`   - Region: ${user.regionId || 'N/A'}`);
        console.log(`   - District: ${user.districtId || 'N/A'}`);
        const formatDate = (dateValue) => {
          if (!dateValue) return 'N/A';
          try {
            const date = dateValue._seconds ? new Date(dateValue._seconds * 1000) : new Date(dateValue);
            return isNaN(date.getTime()) ? 'Invalid date' : date.toISOString();
          } catch {
            return 'Invalid date';
          }
        };
        console.log(`   - Created: ${formatDate(user.createdAt)}`);
        console.log(`   - Updated: ${formatDate(user.updatedAt)}`);
        console.log('');
      });
    }
    
    // Also get a count of all users by role
    console.log('\n📈 User count by role:');
    console.log('-'.repeat(60));
    
    const allUsersQuery = 'SELECT c.role, COUNT(1) as count FROM c GROUP BY c.role';
    const { resources: roleCounts } = await container.items.query(allUsersQuery).fetchAll();
    
    roleCounts.forEach(roleCount => {
      console.log(`   ${roleCount.role || '(no role)'}: ${roleCount.count}`);
    });
    
    // Get total user count
    const { resources: totalCount } = await container.items.query(
      'SELECT VALUE COUNT(1) FROM c'
    ).fetchAll();
    
    console.log(`\n   Total users: ${totalCount[0]}`);
    
  } catch (error) {
    console.error('❌ Error checking admin users:', error);
    process.exit(1);
  }
}

checkAdminUsers().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

