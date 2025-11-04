#!/usr/bin/env node

/**
 * Script to enable JWT authentication testing in development mode
 * 
 * Usage:
 * 1. Set environment variable: TEST_JWT=true
 * 2. Restart the backend server
 * 3. Use proper JWT tokens for API requests
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔐 JWT Testing Configuration Helper');
console.log('=====================================');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

if (!envExists) {
  console.log('❌ No .env file found. Creating one...');
  
  const envContent = `# Development Environment Variables
NODE_ENV=development
TEST_JWT=true

# Azure AD Configuration (required for JWT testing)
AZURE_AD_AUDIENCE=your_azure_ad_audience
AZURE_AD_TENANT_ID=your_azure_ad_tenant_id
AZURE_AD_CLIENT_ID=your_azure_ad_client_id

# Cosmos DB Configuration
COSMOS_DB_ENDPOINT=your_cosmos_db_endpoint
COSMOS_DB_KEY=your_cosmos_db_key
COSMOS_DB_DATABASE=your_cosmos_db_database

# Other Configuration
PORT=3001
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with JWT testing enabled');
} else {
  console.log('📁 .env file found');
  
  // Read existing .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if TEST_JWT is already set
  if (envContent.includes('TEST_JWT=true')) {
    console.log('✅ TEST_JWT=true is already set');
  } else {
    console.log('⚠️  TEST_JWT=true is not set');
    console.log('📝 Add TEST_JWT=true to your .env file to enable JWT testing');
  }
}

console.log('\n📋 Next Steps:');
console.log('1. Set TEST_JWT=true in your .env file');
console.log('2. Restart your backend server');
console.log('3. The music_files endpoint will now require JWT authentication');
console.log('4. Test with: curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3001/api/music_files');
console.log('\n🔒 Security Note:');
console.log('- JWT authentication will be enforced for all API endpoints');
console.log('- Query parameter authentication (userId) will be disabled');
console.log('- Proper JWT tokens from Azure AD will be required'); 