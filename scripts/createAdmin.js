const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

async function createAdminUser() {
  try {
    const adminData = {
      email: 'admin@ecg.com',
      name: 'System Administrator',
      role: 'system_admin',
      staffId: 'ADMIN001',
      region: 'All Regions',
      district: 'All Districts',
      disabled: false,
      mustChangePassword: true,
      tempPassword: 'Admin@123'
    };

    console.log('Creating admin user...');
    
    const response = await axios.post(`${API_BASE_URL}/users`, adminData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'your-admin-token'}`
      }
    });

    console.log('Admin user created successfully:', response.data);
    console.log('Email:', adminData.email);
    console.log('Temporary Password:', adminData.tempPassword);
    console.log('Please change the password on first login.');
    
  } catch (error) {
    console.error('Error creating admin user:', error.response?.data || error.message);
    process.exit(1);
  }
}

createAdminUser(); 