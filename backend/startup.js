#!/usr/bin/env node

/**
 * Azure App Service Startup Script
 * This script optimizes the Node.js startup process for Azure App Service
 */

console.log('🚀 Azure App Service startup script starting...');

// Set production environment
process.env.NODE_ENV = 'production';

// Azure App Service specific optimizations
process.env.UV_THREADPOOL_SIZE = '64'; // Increase thread pool size
process.env.NODE_OPTIONS = '--max-old-space-size=2048 --expose-gc';

// Preload critical modules
console.log('📦 Preloading critical modules...');

try {
  // Preload Express and other heavy modules
  require('express');
  require('@azure/cosmos');
  require('helmet');
  require('cors');
  
  console.log('✅ Critical modules preloaded successfully');
} catch (error) {
  console.error('❌ Error preloading modules:', error.message);
}

// Memory optimization
if (global.gc) {
  console.log('🧹 Garbage collection enabled');
} else {
  console.log('⚠️ Garbage collection not available (run with --expose-gc)');
}

// Start the main application
console.log('🎯 Starting main application...');
require('./app.js');
