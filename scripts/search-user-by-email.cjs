require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'users';

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

async function searchUser(searchTerm) {
  try {
    console.log(`🔍 Searching for users containing: "${searchTerm}"\n`);
    
    // Search by email containing the term
    const { resources: users } = await container.items.query({
      query: 'SELECT c.email, c.name, c.role, c.status, c.id FROM c WHERE CONTAINS(c.email, @search) OR CONTAINS(c.name, @search)',
      parameters: [{ name: '@search', value: searchTerm }]
    }).fetchAll();
    
    if (users.length === 0) {
      console.log('❌ No users found matching the search term.');
      return;
    }
    
    console.log(`📊 Found ${users.length} user(s):\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   - Name: ${user.name || 'N/A'}`);
      console.log(`   - Role: ${user.role || 'N/A'}`);
      console.log(`   - Status: ${user.status || 'N/A'}`);
      console.log(`   - ID: ${user.id}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error searching users:', error);
  }
}

const searchTerm = process.argv[2] || 'afiifi';
searchUser(searchTerm).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

