#!/usr/bin/env node

/**
 * Script to restart backend server with JWT testing enabled
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Backend Server Restart Helper');
console.log('================================');

// Check if .env file exists in backend directory
const envPath = path.join(__dirname, '..', 'backend', '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('📁 Backend .env file found');
  
  if (envContent.includes('TEST_JWT=true')) {
    console.log('✅ TEST_JWT=true is set');
  } else {
    console.log('⚠️  TEST_JWT=true is not set');
    console.log('📝 Adding TEST_JWT=true to .env file...');
    fs.appendFileSync(envPath, '\nTEST_JWT=true\n');
    console.log('✅ Added TEST_JWT=true to .env file');
  }
} else {
  console.log('❌ No backend .env file found');
  console.log('📝 Creating .env file with JWT testing enabled...');
  const envContent = `NODE_ENV=development
TEST_JWT=true
AZURE_AD_AUDIENCE=your_azure_ad_audience
AZURE_AD_TENANT_ID=your_azure_ad_tenant_id
AZURE_AD_CLIENT_ID=your_azure_ad_client_id
COSMOS_DB_ENDPOINT=your_cosmos_db_endpoint
COSMOS_DB_KEY=your_cosmos_db_key
COSMOS_DB_DATABASE=your_cosmos_db_database
PORT=3001
`;
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created backend .env file with JWT testing enabled');
}

console.log('\n🚀 To restart the backend server:');
console.log('1. Stop the current server (Ctrl+C)');
console.log('2. Run: cd backend && node app.js');
console.log('3. Or run: npm start (if configured)');

console.log('\n📋 Expected server startup logs:');
console.log('[SECURITY] ENABLING JWT authentication for production/testing');
console.log('[SECURITY] JWT Authentication: ENABLED');

console.log('\n🧪 Test the endpoint after restart:');
console.log('curl http://localhost:3001/api/music_files');
console.log('# Should return: 401 Unauthorized');

console.log('\n✅ With JWT token:');
console.log('curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3001/api/music_files');
console.log('# Should return: 200 OK (if token is valid)'); 