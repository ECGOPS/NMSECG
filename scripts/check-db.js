const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

async function checkDatabase() {
  try {
    console.log('Checking database connectivity...');
    
    // Test basic connectivity
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test users endpoint
    const usersResponse = await axios.get(`${API_BASE_URL}/users?limit=1`);
    console.log('✅ Users endpoint working');
    
    // Test regions endpoint
    const regionsResponse = await axios.get(`${API_BASE_URL}/regions`);
    console.log('✅ Regions endpoint working');
    
    // Test districts endpoint
    const districtsResponse = await axios.get(`${API_BASE_URL}/districts`);
    console.log('✅ Districts endpoint working');
    
    console.log('\n🎉 Database connectivity check completed successfully!');
    console.log('All endpoints are responding correctly.');
    
  } catch (error) {
    console.error('❌ Database connectivity check failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

checkDatabase(); 