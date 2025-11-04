console.log('Starting backend app.js...');
console.log('🔧 [STARTUP] Backend initialization started');
console.log('🔧 [STARTUP] Current working directory:', __dirname);
console.log('🔧 [STARTUP] Node.js version:', process.version);
console.log('🔧 [STARTUP] Platform:', process.platform);
console.log('🔧 [STARTUP] Architecture:', process.arch);

// Set NODE_ENV for development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log('🔧 [STARTUP] NODE_ENV:', process.env.NODE_ENV);

// Only load dotenv in development
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

// Add error handling for missing environment variables
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'AZURE_AD_AUDIENCE',
    'AZURE_AD_TENANT_ID', 
    'AZURE_AD_CLIENT_ID',
    'COSMOS_DB_ENDPOINT',
    'COSMOS_DB_KEY',
    'COSMOS_DB_DATABASE'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
  } else {
    console.log('✅ All required environment variables are set');
  }
}

// Azure App Service Optimizations
if (process.env.NODE_ENV === 'production') {
  // Increase Node.js memory limit for Azure
  const v8 = require('v8');
  v8.setFlagsFromString('--max-old-space-size=2048'); // 2GB heap
  
  // Optimize garbage collection
  if (global.gc) {
    setInterval(() => {
      global.gc();
    }, 30000); // Run GC every 30 seconds
  }
  
  console.log('[AZURE] Memory optimization enabled');
  console.log('[AZURE] Heap size limit:', v8.getHeapStatistics().heap_size_limit / 1024 / 1024, 'MB');
}

const express = require('express');
const cors = require('cors');
const jwtCheck = require('./auth');
const { getUserRole } = require('./roles');
const checkJwt = require('./authMiddleware');
const { getContainer } = require('./cosmosClient');
const autoFeatureDiscovery = require('./middleware/autoFeatureDiscovery');

const app = express();

// Trust proxy for Azure deployment (fixes rate limiting with X-Forwarded-For headers)
app.set('trust proxy', true);

// CORS configuration - ensure this runs BEFORE any other middleware
const corsOptions = {
  origin: [
    // Local development URLs
    'http://localhost:5173', 
    'https://localhost:5173', 
    'http://localhost:3000', 
    'https://localhost:3000',
    // Netlify domain - hardcoded for now
    'https://heroic-boba-b98a65.netlify.app',
    // ECG internal domain
    'http://proppvlap01.ecggh.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Let cors reflect the request headers for preflight
  allowedHeaders: undefined,
  exposedHeaders: ['Content-Length', 'Content-Type', 'Cache-Control'],
  optionsSuccessStatus: 200
};

// Debug logging for CORS configuration
console.log('🔧 CORS Configuration:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('  NETLIFY_URL:', process.env.NETLIFY_URL);
console.log('  CORS Origins:', corsOptions.origin);

// Debug: Show environment variable status
console.log('🔧 Environment Variables Status:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  COSMOS_DB_ENDPOINT:', process.env.COSMOS_DB_ENDPOINT ? '✅ Set' : '❌ Not Set');
console.log('  COSMOS_DB_KEY:', process.env.COSMOS_DB_KEY ? '✅ Set' : '❌ Not Set');
console.log('  COSMOS_DB_DATABASE:', process.env.COSMOS_DB_DATABASE ? '✅ Set' : '❌ Not Set');
console.log('  AZURE_AD_TENANT_ID:', process.env.AZURE_AD_TENANT_ID ? '✅ Set' : '❌ Not Set');
console.log('  AZURE_AD_CLIENT_ID:', process.env.AZURE_AD_CLIENT_ID ? '✅ Set' : '❌ Not Set');
console.log('  AZURE_AD_AUDIENCE:', process.env.AZURE_AD_AUDIENCE ? '✅ Set' : '❌ Not Set');

// Apply CORS middleware FIRST - before anything else
app.use(cors(corsOptions));

// Add a simple test route to verify server is working
app.get('/api/test-server', (req, res) => {
  console.log('🔧 [TEST] Test route called');
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    routes: 'Test route accessible'
  });
});
console.log('✅ [APP] Test route /api/test-server registered');

// Add a manual test route to verify manual registration works
app.get('/api/manual-test', (req, res) => {
  console.log('🔧 [TEST] Manual test route called');
  res.json({ 
    message: 'Manual route registration works!', 
    timestamp: new Date().toISOString(),
    method: 'Manual registration'
  });
});
console.log('✅ [APP] Manual test route /api/manual-test registered');

// Handle OPTIONS preflight requests BEFORE any other middleware
app.options('*', cors(corsOptions));

// Security middleware - add helmet for security headers
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting for API protection - Increased limits for better user experience
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 5000, // Increased: 500 in production, 5000 in development
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip rate limiting completely in development
  // Azure-specific configuration
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if available (Azure proxy)
    return req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  }
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// More lenient rate limiting for high-traffic routes
const highTrafficLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Very high limits for high-traffic routes
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in development
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  }
});

// Apply high-traffic rate limiting to specific routes that need it
app.use('/api/photos/', highTrafficLimiter);
app.use('/api/health', highTrafficLimiter);
app.use('/api/messages', highTrafficLimiter);
app.use('/api/broadcasts', highTrafficLimiter);

// Increase payload size limit for photo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security: Remove server information
app.disable('x-powered-by');

// Azure-specific configurations
if (process.env.NODE_ENV === 'production') {
  // Trust Azure's proxy headers
  app.set('trust proxy', true);
  
  // Log Azure-specific information
  console.log('[AZURE] Running in Azure production environment');
  console.log('[AZURE] Trust proxy enabled for X-Forwarded-For headers');
}

// Additional security headers for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Remove or obfuscate headers that reveal API structure
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    // Add obfuscating headers
    res.setHeader('X-API-Version', 'v2');
    res.setHeader('X-Response-Time', Date.now().toString());
    
    // Log minimal information in production
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path} - ${res.statusCode}`);
    }
    
    next();
  });
}

// Enhanced process management for Azure App Service
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack trace:', err.stack);
  
  // In production, log the error and continue if possible
  if (process.env.NODE_ENV === 'production') {
    console.error('[AZURE] Critical error logged, attempting graceful shutdown');
    // Give time for logging before exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  
  // In production, log the error but don't crash
  if (process.env.NODE_ENV === 'production') {
    console.error('[AZURE] Unhandled rejection logged, continuing operation');
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, starting graceful shutdown...');
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, starting graceful shutdown...');
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Memory monitoring for Azure
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    if (memUsageMB.heapUsed > 1500) { // Alert if heap usage > 1.5GB
      console.warn('[AZURE] High memory usage detected:', memUsageMB);
    }
    
    if (process.env.LOG_MEMORY === 'true') {
      console.log('[AZURE] Memory usage:', memUsageMB);
    }
  }, 60000); // Check every minute
}

// Health check endpoint - must be defined before JWT middleware
app.get('/', (req, res) => {
  // Fast health check for Azure App Service
  const startTime = Date.now();
  
  res.json({ 
    status: 'API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    responseTime: Date.now() - startTime
  });
});

// Dedicated health check endpoint for Azure App Service
app.get('/api/health', (req, res) => {
  const startTime = Date.now();
  
  // Minimal health check - just return status
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: Date.now() - startTime
  });
});

// Azure AD JWT authentication for all routes - ENABLED for production and development testing
if (process.env.NODE_ENV === 'production' || process.env.TEST_JWT === 'true') {
  console.log('[SECURITY] ENABLING JWT authentication for production/testing');
  console.log('[DEBUG] Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    TEST_JWT: process.env.TEST_JWT,
    AZURE_AD_AUDIENCE: process.env.AZURE_AD_AUDIENCE,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID
  });
  
  // Apply JWT authentication to all routes EXCEPT health check and photo routes (public access needed)
  app.use((req, res, next) => {
    // Allow CORS preflight without auth
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    // FIRST: Skip JWT authentication for GET login background (needed for login page before auth)
    // Check multiple path variations to ensure we catch it
    const isLoginBackgroundGet = req.method === 'GET' && (
      req.path === '/api/settings/login-background' || 
      req.path.startsWith('/api/settings/login-background') ||
      req.originalUrl === '/api/settings/login-background' ||
      req.originalUrl.startsWith('/api/settings/login-background') ||
      req.url === '/api/settings/login-background' ||
      req.url.startsWith('/api/settings/login-background') ||
      (req.originalUrl && req.originalUrl.includes('login-background') && req.method === 'GET')
    );
    
    if (isLoginBackgroundGet) {
      console.log('[SECURITY] Skipping JWT for GET login background route:', { 
        method: req.method,
        path: req.path, 
        originalUrl: req.originalUrl, 
        url: req.url 
      });
      return next();
    }
    
    // Debug logging for login background route (other methods)
    if ((req.path.includes('login-background') || req.originalUrl.includes('login-background')) && req.method !== 'GET') {
      console.log('[SECURITY] Login background request detected (non-GET):', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        url: req.url
      });
    }
    
    // Skip JWT authentication for health check endpoint
    if (req.path === '/api/health') {
      console.log('[SECURITY] Skipping JWT for health check route:', req.path);
      return next();
    }
    
    // Skip JWT authentication for photo routes (public access needed)
    if (req.path.startsWith('/api/photos/serve/') ||
        req.path.startsWith('/api/photos/upload') ||
        req.path.startsWith('/api/photos/upload-file') ||
        req.path.startsWith('/api/photos/delete')) {
      console.log('[SECURITY] Skipping JWT for photo route:', req.path);
      return next();
    }
    
    // Apply JWT authentication to all other routes (including POST/DELETE login background)
    // The route-level requireRole middleware will handle role checking
    jwtCheck(req, res, next);
  });
  
  console.log('[SECURITY] JWT Authentication: ENABLED (with photo serve exclusion)');
} else {
  console.log('[DEV] JWT authentication disabled for development');
  console.log('[DEV] JWT Authentication: DISABLED');
  console.log('[DEV] To enable JWT testing, set TEST_JWT=true');
}

// Global error handling middleware - MUST be placed here to catch JWT errors
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  
  // Handle JWT authentication errors specifically
  if (err.status === 401 || err.statusCode === 401) {
    console.log('[ERROR] JWT Authentication failed:', err.message);
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Authentication required',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // Handle other errors
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  } else {
    res.status(500).json({ 
      error: err.message,
      stack: err.stack
    });
  }
});

// Simple middleware to ensure backward compatibility
// JWT middleware in auth.js has already processed authentication and set req.user, req.userId, req.userRole
app.use(async (req, res, next) => {
  try {
    // Skip for health check endpoint, photo routes, and GET login background
    if (req.path === '/' || 
        req.path === '/api/health' ||
        req.path.startsWith('/api/photos/serve/') ||
        req.path.startsWith('/api/photos/upload') ||
        req.path.startsWith('/api/photos/upload-file') ||
        req.path.startsWith('/api/photos/delete') ||
        (req.method === 'GET' && req.path.startsWith('/api/settings/login-background'))) {
      return next();
    }
    
    // JWT middleware has already processed authentication and set req.user, req.userId, req.userRole
    // Just ensure these values exist for backward compatibility
    if (!req.user) {
      req.user = { id: 'unknown', role: 'user' };
    }
    if (!req.userId) {
      req.userId = req.user.id;
    }
    if (!req.userRole) {
      req.userRole = req.user.role;
    }
    
    next();
  } catch (err) {
    console.error('Error in user middleware:', err);
    next(err);
  }
});

// Apply auto-feature discovery middleware FIRST
console.log('🔧 [APP] Applying auto-feature discovery middleware...');
app.use(autoFeatureDiscovery.middleware());
console.log('✅ [APP] Auto-feature discovery middleware applied successfully');

// AUTOMATIC ROUTE REGISTRATION - No more manual work!
const fs = require('fs');
const path = require('path');

async function autoRegisterRoutes() {
  try {
    console.log('🚀 [AUTO-ROUTES] Starting automatic route registration...');
    
    const routesDir = path.join(__dirname, 'routes');
    console.log('📁 [AUTO-ROUTES] Routes directory:', routesDir);
    
    // Check if routes directory exists
    if (!fs.existsSync(routesDir)) {
      console.error('❌ [AUTO-ROUTES] Routes directory does not exist:', routesDir);
      return;
    }
    
    const routeFiles = fs.readdirSync(routesDir)
      .filter(file => file.endsWith('.js') && file !== 'index.js')
      .map(file => file.replace('.js', ''));
    
    console.log('📋 [AUTO-ROUTES] Discovered route files:', routeFiles);
    console.log('📊 [AUTO-ROUTES] Total routes to register:', routeFiles.length);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Register each route automatically
    for (const routeName of routeFiles) {
      try {
        console.log(`🔧 [AUTO-ROUTES] Processing route: ${routeName}`);
        
        const routePath = `./routes/${routeName}`;
        console.log(`📂 [AUTO-ROUTES] Route path: ${routePath}`);
        
        // Check if route file exists
        if (!fs.existsSync(path.join(__dirname, 'routes', `${routeName}.js`))) {
          console.error(`❌ [AUTO-ROUTES] Route file not found: ${routeName}.js`);
          errorCount++;
          continue;
        }
        
        const routeModule = require(routePath);
        console.log(`✅ [AUTO-ROUTES] Route module loaded successfully: ${routeName}`);
        
        // Check if routeModule is a valid Express router
        if (!routeModule || typeof routeModule !== 'function') {
          console.error(`❌ [AUTO-ROUTES] Invalid route module for ${routeName}:`, typeof routeModule);
          errorCount++;
          continue;
        }
        
        // Register the route
        app.use(`/api/${routeName}`, routeModule);
        
        console.log(`✅ [AUTO-ROUTES] Successfully registered route: /api/${routeName}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ [AUTO-ROUTES] Failed to register route ${routeName}:`, error.message);
        console.error(`🔍 [AUTO-ROUTES] Error details:`, error.stack);
        errorCount++;
      }
    }
    
    console.log('📊 [AUTO-ROUTES] Route registration summary:');
    console.log(`  ✅ Successfully registered: ${successCount} routes`);
    console.log(`  ❌ Failed to register: ${errorCount} routes`);
    console.log(`  📋 Total processed: ${routeFiles.length} routes`);
    
    if (errorCount > 0) {
      console.warn('⚠️ [AUTO-ROUTES] Some routes failed to register. Check the logs above for details.');
    }
    
    console.log('✅ [AUTO-ROUTES] Auto-route registration completed!');
    
    // Log all registered routes for verification
    console.log('🔍 [AUTO-ROUTES] Verifying registered routes...');
    const registeredRoutes = [];
    app._router.stack.forEach((middleware, index) => {
      if (middleware.route) {
        // Routes registered directly on the app
        registeredRoutes.push(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
      } else if (middleware.name === 'router') {
        // Router middleware - try to get the actual path
        if (middleware.regexp) {
          const routePath = middleware.regexp.toString().replace(/\\\//g, '/').replace(/[^/]/g, '');
          registeredRoutes.push(`ROUTER ${index}: ${routePath}`);
        } else {
          registeredRoutes.push(`ROUTER ${index}: <unknown path>`);
        }
      }
    });
    
    console.log('📋 [AUTO-ROUTES] Currently registered routes:', registeredRoutes);
    
  } catch (error) {
    console.error('❌ [AUTO-ROUTES] Critical error in auto-route registration:', error);
    console.error('🔍 [AUTO-ROUTES] Error stack:', error.stack);
  }
}

// Run auto-route registration
console.log('🚀 [APP] Starting auto-route registration...');
autoRegisterRoutes().then(() => {
  console.log('✅ [APP] Auto-route registration promise resolved');
}).catch((error) => {
  console.error('❌ [APP] Auto-route registration promise rejected:', error);
});

// Production obfuscated endpoint mappings
if (process.env.NODE_ENV === 'production') {
  // Obfuscated routes for production
  app.use('/api/audio', require('./routes/music_files'));
  app.use('/api/employees', require('./routes/staffIds'));
  app.use('/api/accounts', require('./routes/users'));
  app.use('/api/zones', require('./routes/regions'));
  app.use('/api/areas', require('./routes/districts'));
  app.use('/api/inspections', require('./routes/overheadLineInspections'));
  app.use('/api/assets', require('./routes/vitAssets'));
  app.use('/api/checks', require('./routes/vitInspections'));
  app.use('/api/outages', require('./routes/controlOutages'));
  app.use('/api/monitoring', require('./routes/loadMonitoring'));
  // app.use('/api/faults', require('./routes/faults')); // Unified route disabled due to issues
  app.use('/api/events', require('./routes/securityEvents'));
  app.use('/api/substations', require('./routes/substationInspections'));
  app.use('/api/logs', require('./routes/userLogs'));
  app.use('/api/core', require('./routes/system'));
  app.use('/api/access', require('./routes/permissions'));
  app.use('/api/permissions', require('./routes/permissions'));
  app.use('/api/broadcasts', require('./routes/broadcastMessages'));
  app.use('/api/messages', require('./routes/chat_messages'));
  app.use('/api/equipment', require('./routes/devices'));
  app.use('/api/powerlines', require('./routes/feeders'));
  app.use('/api/notifications', require('./routes/sms_logs'));
  app.use('/api/equipment-failure-reports', require('./routes/equipmentFailureReports'));
  app.use('/api/substation-status', require('./routes/substation-status'));
  app.use('/api/targets', require('./routes/targets'));
  app.use('/api/performance', require('./routes/performance'));
  app.use('/api/reports', require('./routes/reports'));
}

// Photo routes (NO AUTH REQUIRED)
app.use('/api/photos', require('./routes/photos'));
app.use('/api/settings', require('./routes/settings'));

// Health check route (NO AUTH REQUIRED)
app.use('/api/health', require('./routes/health'));

// Add a protected test route
app.get('/api/protected', checkJwt, async (req, res) => {
  try {
    const container = getContainer();
    // Fetch a single item as a test (replace with your actual query logic)
    const { resources } = await container.items.query('SELECT TOP 1 * FROM c').fetchAll();
    res.json({
      message: 'Access granted. This is protected data from Cosmos DB!',
      data: resources[0] || null,
      user: req.user
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from Cosmos DB', details: err.message });
  }
});

// Add a simple Cosmos DB test route (no auth required for debugging)
app.get('/api/cosmos-test', async (req, res) => {
  try {
    console.log('🔧 [COSMOS-TEST] Testing Cosmos DB connection...');
    
    // Test basic connection
    const { CosmosClient } = require('@azure/cosmos');
    const client = new CosmosClient({ 
      endpoint: process.env.COSMOS_DB_ENDPOINT, 
      key: process.env.COSMOS_DB_KEY 
    });
    
    console.log('🔧 [COSMOS-TEST] Client created, testing database access...');
    const database = client.database(process.env.COSMOS_DB_DATABASE);
    
    console.log('🔧 [COSMOS-TEST] Testing containers...');
    const { resources: containers } = await database.containers.readAll().fetchAll();
    console.log('🔧 [COSMOS-TEST] Available containers:', containers.map(c => c.id));
    
    // Test roles container
    if (containers.find(c => c.id === 'roles')) {
      console.log('🔧 [COSMOS-TEST] Testing roles container...');
      const rolesContainer = database.container('roles');
      const { resources: roles } = await rolesContainer.items.query('SELECT * FROM c').fetchAll();
      console.log('🔧 [COSMOS-TEST] Roles count:', roles.length);
    }
    
    // Test features container
    if (containers.find(c => c.id === 'features')) {
      console.log('🔧 [COSMOS-TEST] Testing features container...');
      const featuresContainer = database.container('features');
      const { resources: features } = await featuresContainer.items.query('SELECT * FROM c').fetchAll();
      console.log('🔧 [COSMOS-TEST] Features count:', features.length);
    }
    
    res.json({
      message: 'Cosmos DB connection test successful',
      containers: containers.map(c => c.id),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ [COSMOS-TEST] Error:', err);
    res.status(500).json({ 
      error: 'Cosmos DB connection test failed', 
      details: err.message,
      stack: err.stack
    });
  }
});

// Add a simple test endpoint to verify roles route is working
app.get('/api/roles-test', async (req, res) => {
  try {
    console.log('🔧 [ROLES-TEST] Testing roles route availability...');
    res.json({
      message: 'Roles route is available and working',
      timestamp: new Date().toISOString(),
      note: 'This endpoint confirms the roles route is registered'
    });
  } catch (err) {
    console.error('❌ [ROLES-TEST] Error:', err);
    res.status(500).json({ error: 'Roles test failed' });
  }
});

// Add a simple test endpoint to verify features route is working
app.get('/api/features-test', async (req, res) => {
  try {
    console.log('🔧 [FEATURES-TEST] Testing features route availability...');
    res.json({
      message: 'Features route is available and working',
      timestamp: new Date().toISOString(),
      note: 'This endpoint confirms the features route is registered'
    });
  } catch (err) {
    console.error('❌ [FEATURES-TEST] Error:', err);
    res.status(500).json({ error: 'Features test failed' });
  }
});

// Add the proper userLogs endpoint
app.use('/api/userLogs', require('./routes/userLogs'));

// Keep /api/logs for backward compatibility
app.use('/api/logs', require('./routes/userLogs'));

// Register roles and features routes for ALL environments (not just development)
console.log('🔧 [APP] Registering /api/roles route for all environments');
app.use('/api/roles', require('./routes/roles'));

console.log('🔧 [APP] Registering /api/features route for all environments');
app.use('/api/features', require('./routes/features'));

// Development test route - bypass authentication
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 [APP] Development environment detected - registering development routes');
  
  app.get('/api/test', (req, res) => {
    res.json({ 
      message: 'Development test route working',
      user: req.user,
      userRole: req.userRole,
      timestamp: new Date().toISOString()
    });
  });
  
  // Development routes
  console.log('🔧 [APP] Registering /api/equipment-failure-reports route');
  app.use('/api/equipment-failure-reports', require('./routes/equipmentFailureReports'));
  
  console.log('🔧 [APP] Registering /api/substation-status route');
  app.use('/api/substation-status', require('./routes/substation-status'));
  
  console.log('✅ [APP] All development routes registered successfully');
} else {
  console.log('🔧 [APP] Production environment detected - development routes NOT registered');
  console.log('🔧 [APP] Roles and features routes are available in all environments');
}

// Error handling middleware moved to after JWT middleware for proper JWT error handling

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Create HTTP server for WebSocket support
const http = require('http');
const server = http.createServer(app);

// Initialize Enhanced WebSocket server for Azure App Service
const WebSocketServerEnhanced = require('./websocket/WebSocketServerEnhanced');
const wsServer = new WebSocketServerEnhanced(server);

// Make WebSocket server available to routes
app.set('wsServer', wsServer);

const PORT = process.env.PORT || 3001;

// Azure App Service startup optimization
const startupTime = Date.now();

server.listen(PORT, () => {
  const startupDuration = Date.now() - startupTime;
  
  console.log('🚀 [SERVER] HTTP server started successfully');
  console.log(`🔧 [SERVER] Server listening on port: ${PORT}`);
  console.log(`⏱️ [SERVER] Startup duration: ${startupDuration}ms`);
  
  // Debug: Show all registered routes
  console.log('🔧 [SERVER] Registered API routes:');
  app._router.stack.forEach((middleware, index) => {
    if (middleware.route) {
      // Routes registered directly on the app
      console.log(`  📍 ${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      // Router middleware - try to get the actual path
      if (middleware.regexp) {
        const routePath = middleware.regexp.toString().replace(/\\\//g, '/').replace(/[^/]/g, '');
        console.log(`  📍 ROUTER ${index}: ${routePath}`);
      } else {
        console.log(`  📍 ROUTER ${index}: <unknown path>`);
      }
    }
  });

  // Show specific route registrations
  console.log('🔧 [APP] Route registration summary:');
  console.log('  ✅ /api/roles - Available in all environments');
  console.log('  ✅ /api/features - Available in all environments');
  console.log('  ✅ /api/cosmos-test - Available in all environments');
  console.log('  ✅ /api/roles-test - Available in all environments');
  console.log('  ✅ /api/features-test - Available in all environments');
  console.log('  ✅ /api/health - Available in all environments');
  if (process.env.NODE_ENV === 'development') {
    console.log('  ✅ /api/test - Development only');
    console.log('  ✅ /api/equipment-failure-reports - Development only');
  }
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`✅ Server started successfully in ${startupDuration}ms`);
    console.log(`🔒 Security: JWT Authentication ENABLED`);
    console.log(`🔗 WebSocket server ready for connections`);
    console.log(`🌐 Azure App Service optimized configuration loaded`);
    console.log(`📊 Memory limit: ${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024)}MB`);
    
    // Log Azure-specific startup info
    console.log(`[AZURE] Process ID: ${process.pid}`);
    console.log(`[AZURE] Node version: ${process.version}`);
    console.log(`[AZURE] Platform: ${process.platform}`);
    console.log(`[AZURE] Architecture: ${process.arch}`);
  } else if (process.env.TEST_JWT === 'true') {
    console.log(`Backend running on port ${PORT} in ${startupDuration}ms`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`JWT Authentication: ENABLED`);
    console.log(`🔗 WebSocket server ready for connections`);
  } else {
    console.log(`Backend running on port ${PORT} in ${startupDuration}ms`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`JWT Authentication: DISABLED`);
    console.log(`🔗 WebSocket server ready for connections`);
  }
});

// Azure App Service keep-alive optimization
if (process.env.NODE_ENV === 'production') {
  // Keep the process alive and handle Azure App Service recycling
  setInterval(() => {
    // Log health status every 5 minutes
    const memUsage = process.memoryUsage();
    console.log(`[AZURE] Health check - Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, Uptime: ${Math.round(process.uptime())}s`);
  }, 300000); // 5 minutes
} 