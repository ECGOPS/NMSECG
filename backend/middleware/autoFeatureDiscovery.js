const fs = require('fs');
const path = require('path');
const { CosmosClient } = require('@azure/cosmos');

class AutoFeatureDiscovery {
  constructor() {
    // Don't initialize Cosmos DB until needed
    this.cosmosClient = null;
    this.database = null;
    this.permissionsContainer = null;
    this.featuresContainer = null;
    this.hasRun = false; // Track if middleware has run
  }

  // Initialize Cosmos DB connection when needed
  async initializeCosmosDB() {
    if (!this.cosmosClient) {
      if (!process.env.COSMOS_DB_ENDPOINT || !process.env.COSMOS_DB_KEY || !process.env.COSMOS_DB_DATABASE) {
        console.log('⚠️ Cosmos DB environment variables not set, skipping auto-discovery');
        return false;
      }
      
      this.cosmosClient = new CosmosClient({
        endpoint: process.env.COSMOS_DB_ENDPOINT,
        key: process.env.COSMOS_DB_KEY
      });
      this.database = this.cosmosClient.database(process.env.COSMOS_DB_DATABASE);
      this.permissionsContainer = this.database.container('permissions');
      this.featuresContainer = this.database.container('features');
      return true;
    }
    return true;
  }

  // Auto-discover routes from the routes directory
  async discoverRoutes() {
    try {
      console.log('🔍 [AUTO-DISCOVERY] Starting route discovery...');
      const routesDir = path.join(__dirname, '../routes');
      console.log('📁 [AUTO-DISCOVERY] Routes directory path:', routesDir);
      
      // Check if routes directory exists
      if (!fs.existsSync(routesDir)) {
        console.error('❌ [AUTO-DISCOVERY] Routes directory does not exist:', routesDir);
        return [];
      }
      
      const routeFiles = fs.readdirSync(routesDir)
        .filter(file => file.endsWith('.js') && file !== 'index.js')
        .map(file => file.replace('.js', ''));

      console.log('🔍 [AUTO-DISCOVERY] Discovered route files:', routeFiles);
      console.log('📊 [AUTO-DISCOVERY] Total routes discovered:', routeFiles.length);
      return routeFiles;
    } catch (error) {
      console.error('❌ [AUTO-DISCOVERY] Error discovering routes:', error);
      console.error('🔍 [AUTO-DISCOVERY] Error stack:', error.stack);
      return [];
    }
  }

  // Auto-create permissions for new features
  async createPermissionsForFeature(featureName) {
    try {
      if (!await this.initializeCosmosDB()) {
        return;
      }

      // Check if feature already exists in permissions
      const { resources: existingPermissions } = await this.permissionsContainer.items
        .query('SELECT * FROM c WHERE c.id = "permissions"')
        .fetchAll();

      if (existingPermissions.length > 0) {
        const permissionsDoc = existingPermissions[0];
        
        // Check if feature already exists
        if (permissionsDoc.features && permissionsDoc.features[featureName]) {
          console.log(`✅ Feature ${featureName} already exists in permissions`);
          return;
        }

        // Add new feature with default permissions
        const defaultPermissions = {
          access: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'senior_technician', 'technician', 'assistant_technician'],
          create: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'senior_technician', 'technician', 'assistant_technician'],
          update: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'senior_technician', 'technician'],
          delete: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer']
        };

        permissionsDoc.features[featureName] = {
          description: `${featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} System`,
          permissions: {
            access: { description: `Can view ${featureName.replace(/_/g, ' ')}`, roles: defaultPermissions.access },
            create: { description: `Can create new ${featureName.replace(/_/g, ' ')}`, roles: defaultPermissions.create },
            update: { description: `Can edit existing ${featureName.replace(/_/g, ' ')}`, roles: defaultPermissions.update },
            delete: { description: `Can delete ${featureName.replace(/_/g, ' ')}`, roles: defaultPermissions.delete }
          }
        };

        permissionsDoc.updatedAt = new Date().toISOString();
        
        // Update permissions document
        await this.permissionsContainer.item('permissions', 'permissions').replace(permissionsDoc);
        console.log(`✅ Added permissions for feature: ${featureName}`);
      }
    } catch (error) {
      console.error(`❌ Error creating permissions for ${featureName}:`, error);
    }
  }

  // Auto-create feature in features container
  async createFeatureInContainer(featureName) {
    try {
      if (!await this.initializeCosmosDB()) {
        return;
      }

      // Check if feature already exists
      const { resources: existingFeatures } = await this.featuresContainer.items
        .query('SELECT * FROM c WHERE c.id = @featureName', { parameters: [{ name: '@featureName', value: featureName }] })
        .fetchAll();

      if (existingFeatures.length > 0) {
        console.log(`✅ Feature ${featureName} already exists in features container`);
        return;
      }

      // Create new feature
      const newFeature = {
        id: featureName,
        name: featureName,
        displayName: featureName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `Manage ${featureName.replace(/_/g, ' ')} records and operations`,
        category: 'general',
        permissions: {
          access: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'senior_technician', 'technician', 'assistant_technician'],
          create: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'senior_technician', 'technician', 'assistant_technician'],
          update: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'senior_technician', 'technician'],
          delete: ['system_admin', 'admin', 'global_engineer', 'regional_engineer', 'district_engineer']
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'auto-discovery',
        updatedBy: 'auto-discovery'
      };

      await this.featuresContainer.items.create(newFeature);
      console.log(`✅ Created feature in features container: ${featureName}`);
    } catch (error) {
      console.error(`❌ Error creating feature ${featureName}:`, error);
    }
  }

  // Main method to auto-discover and setup everything
  async autoDiscoverAndSetup() {
    try {
      console.log('🚀 [AUTO-DISCOVERY] Starting auto-discovery and setup process...');
      
      // Discover routes
      const routes = await this.discoverRoutes();
      console.log('📋 [AUTO-DISCOVERY] Routes to process:', routes);
      
      if (routes.length === 0) {
        console.warn('⚠️ [AUTO-DISCOVERY] No routes discovered, skipping setup');
        return;
      }
      
      // Process each route
      let processedCount = 0;
      let errorCount = 0;
      
      for (const route of routes) {
        try {
          console.log(`🔧 [AUTO-DISCOVERY] Processing route: ${route}`);
          
          // Create permissions for this feature
          await this.createPermissionsForFeature(route);
          console.log(`✅ [AUTO-DISCOVERY] Permissions processed for: ${route}`);
          
          // Create feature in features container
          await this.createFeatureInContainer(route);
          console.log(`✅ [AUTO-DISCOVERY] Feature created for: ${route}`);
          
          processedCount++;
          
        } catch (error) {
          console.error(`❌ [AUTO-DISCOVERY] Error processing route ${route}:`, error.message);
          console.error(`🔍 [AUTO-DISCOVERY] Error details:`, error.stack);
          errorCount++;
        }
      }
      
      console.log('📊 [AUTO-DISCOVERY] Setup summary:');
      console.log(`  ✅ Successfully processed: ${processedCount} routes`);
      console.log(`  ❌ Failed to process: ${errorCount} routes`);
      console.log(`  📋 Total routes: ${routes.length}`);
      
      if (errorCount > 0) {
        console.warn('⚠️ [AUTO-DISCOVERY] Some routes failed to process. Check the logs above for details.');
      }
      
      console.log('✅ [AUTO-DISCOVERY] Auto-discovery and setup completed!');
      
    } catch (error) {
      console.error('❌ [AUTO-DISCOVERY] Critical error in auto-discovery setup:', error);
      console.error('🔍 [AUTO-DISCOVERY] Error stack:', error.stack);
    }
  }

  // Express middleware function
  middleware() {
    return async (req, res, next) => {
      try {
        console.log('🔧 [AUTO-DISCOVERY] Middleware called for path:', req.path);
        
        // Only run once on startup
        if (this.hasRun) {
          console.log('✅ [AUTO-DISCOVERY] Middleware already run, skipping...');
          return next();
        }
        
        console.log('🚀 [AUTO-DISCOVERY] First time middleware call, running auto-discovery...');
        this.hasRun = true;
        
        // Run auto-discovery in background (don't block the request)
        this.autoDiscoverAndSetup().then(() => {
          console.log('✅ [AUTO-DISCOVERY] Background auto-discovery completed successfully');
        }).catch((error) => {
          console.error('❌ [AUTO-DISCOVERY] Background auto-discovery failed:', error);
        });
        
        next();
      } catch (error) {
        console.error('❌ [AUTO-DISCOVERY] Middleware error:', error);
        console.error('🔍 [AUTO-DISCOVERY] Error stack:', error.stack);
        next(error);
      }
    };
  }
}

module.exports = new AutoFeatureDiscovery();
