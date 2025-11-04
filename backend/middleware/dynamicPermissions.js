const { CosmosClient } = require('@azure/cosmos');

class DynamicPermissionsMiddleware {
  constructor() {
    this.permissionsCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Initialize Cosmos DB client
    this.client = new CosmosClient({
      endpoint: process.env.COSMOS_DB_ENDPOINT,
      key: process.env.COSMOS_DB_KEY
    });
    
    this.database = this.client.database(process.env.COSMOS_DB_DATABASE);
    this.permissionsContainer = this.database.container('permissions');
  }

  isCacheValid() {
    return Date.now() - this.lastCacheUpdate < this.cacheTTL;
  }

  async refreshPermissionsCache() {
    try {
      console.log('[DynamicPermissions] Refreshing permissions cache from database...');
      
      // Try to read from database first
      try {
        const { resource: permissionsDoc } = await this.permissionsContainer.item('permissions', 'permissions').read();
        
        if (permissionsDoc && permissionsDoc.features) {
          console.log('[DynamicPermissions] Successfully loaded permissions from database');
          
          // Clear existing cache
          this.permissionsCache.clear();
          
          // Build permissions cache from database
          Object.entries(permissionsDoc.features).forEach(([featureName, feature]) => {
            Object.entries(feature.permissions).forEach(([action, permissionData]) => {
              permissionData.roles.forEach(roleName => {
                if (!this.permissionsCache.has(roleName)) {
                  this.permissionsCache.set(roleName, {});
                }
                this.permissionsCache.get(roleName)[`${featureName}_${action}`] = true;
              });
            });
          });
          
          this.lastCacheUpdate = Date.now();
          console.log('[DynamicPermissions] Cache refreshed successfully from database');
          console.log('[DynamicPermissions] Cached roles:', Array.from(this.permissionsCache.keys()));
          return;
        }
      } catch (dbError) {
        console.log('[DynamicPermissions] Database read failed, falling back to file:', dbError.message);
      }
      
      // Fallback to permissions.json file
      console.log('[DynamicPermissions] Falling back to permissions.json file...');
      const fs = require('fs');
      const path = require('path');
      const permissionsPath = path.join(__dirname, '../config/permissions.json');
      
      if (!fs.existsSync(permissionsPath)) {
        console.error('[DynamicPermissions] Permissions file not found:', permissionsPath);
        throw new Error('Permissions file not found');
      }
      
      const permissionsData = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
      console.log('[DynamicPermissions] Loaded permissions from file');
      
      // Clear existing cache
      this.permissionsCache.clear();
      
      // Build permissions cache from permissions.json structure
      Object.entries(permissionsData.features).forEach(([featureName, feature]) => {
        Object.entries(feature.permissions).forEach(([action, permissionData]) => {
          permissionData.roles.forEach(roleName => {
            if (!this.permissionsCache.has(roleName)) {
              this.permissionsCache.set(roleName, {});
            }
            this.permissionsCache.get(roleName)[`${featureName}_${action}`] = true;
          });
        });
      });
      
      this.lastCacheUpdate = Date.now();
      console.log('[DynamicPermissions] Cache refreshed successfully from permissions.json');
      console.log('[DynamicPermissions] Cached roles:', Array.from(this.permissionsCache.keys()));
      
    } catch (error) {
      console.error('[DynamicPermissions] Error refreshing permissions cache:', error);
      throw error;
    }
  }

  async canPerformAction(userRole, feature, action) {
    try {
      console.log(`[DynamicPermissions] Checking permission: ${userRole} -> ${feature} -> ${action}`);
      
      // Check cache first
      if (this.isCacheValid()) {
        const cachedPermissions = this.permissionsCache.get(userRole);
        console.log(`[DynamicPermissions] Cache valid, cached permissions for ${userRole}:`, cachedPermissions);
        
        if (cachedPermissions && cachedPermissions[`${feature}_${action}`]) {
          console.log(`[DynamicPermissions] ✅ Permission granted from cache: ${feature}_${action}`);
          return true;
        }
      }

      // Refresh cache and check database
      console.log(`[DynamicPermissions] Cache invalid or permission not found, refreshing...`);
      await this.refreshPermissionsCache();
      
      const rolePermissions = this.permissionsCache.get(userRole);
      console.log(`[DynamicPermissions] Fresh permissions for ${userRole}:`, rolePermissions);
      
      const hasPermission = rolePermissions && rolePermissions[`${feature}_${action}`] ? true : false;
      console.log(`[DynamicPermissions] Final permission check result: ${hasPermission}`);
      
      return hasPermission;
      
    } catch (error) {
      console.error('[DynamicPermissions] Error checking permissions:', error);
      // Fallback to hardcoded permissions
      console.log(`[DynamicPermissions] Using fallback permissions for ${userRole} -> ${feature} -> ${action}`);
      return this.fallbackCanPerformAction(userRole, feature, action);
    }
  }

  // Fallback permissions for critical operations
  fallbackCanPerformAction(userRole, feature, action) {
    const fallbackPermissions = {
      system_admin: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      admin: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      global_engineer: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      regional_engineer: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      district_engineer: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      project_engineer: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      technician: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': false,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': false,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': false,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': false,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': false
      },
      regional_general_manager: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      district_manager: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      ict: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': false,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': false,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': false,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': false,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': false
      },
      ashsubt: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      },
      accsubt: {
        'equipment_failure_reporting_access': true,
        'equipment_failure_reporting_create': true,
        'equipment_failure_reporting_update': true,
        'equipment_failure_reporting_delete': true,
        'overhead_line_inspection_access': true,
        'overhead_line_inspection_create': true,
        'overhead_line_inspection_update': true,
        'overhead_line_inspection_delete': true,
        'substation_inspection_access': true,
        'substation_inspection_create': true,
        'substation_inspection_update': true,
        'substation_inspection_delete': true,
        'substation_status_access': true,
        'substation_status_create': true,
        'substation_status_update': true,
        'substation_status_delete': true,
        'load_monitoring_access': true,
        'load_monitoring_create': true,
        'load_monitoring_update': true,
        'load_monitoring_delete': true
      }
    };

    const permissionKey = `${feature}_${action}`;
    const rolePermissions = fallbackPermissions[userRole];
    
    if (rolePermissions && rolePermissions[permissionKey]) {
      console.log(`[DynamicPermissions] ✅ Fallback permission granted: ${userRole} -> ${permissionKey}`);
      return true;
    }
    
    console.log(`[DynamicPermissions] ❌ Fallback permission denied: ${userRole} -> ${permissionKey}`);
    return false;
  }

  // Middleware functions
  requireAccess(feature) {
    return async (req, res, next) => {
      try {
        const userRole = req.user?.role;
        if (!userRole) {
          return res.status(401).json({ error: 'User role not found' });
        }

        const hasAccess = await this.canPerformAction(userRole, feature, 'access');
        if (hasAccess) {
          next();
        } else {
          res.status(403).json({ error: `Access denied to ${feature}` });
        }
      } catch (error) {
        console.error(`[DynamicPermissions] Error checking access for ${feature}:`, error);
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  requireCreate(feature) {
    return async (req, res, next) => {
      try {
        const userRole = req.user?.role;
        if (!userRole) {
          return res.status(401).json({ error: 'User role not found' });
        }

        const canCreate = await this.canPerformAction(userRole, feature, 'create');
        if (canCreate) {
          next();
        } else {
          res.status(403).json({ error: `Create permission denied for ${feature}` });
        }
      } catch (error) {
        console.error(`[DynamicPermissions] Error checking create permission for ${feature}:`, error);
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  requireUpdate(feature) {
    return async (req, res, next) => {
      try {
        const userRole = req.user?.role;
        if (!userRole) {
          return res.status(401).json({ error: 'User role not found' });
        }

        const canUpdate = await this.canPerformAction(userRole, feature, 'update');
        if (canUpdate) {
          next();
        } else {
          res.status(403).json({ error: `Update permission denied for ${feature}` });
        }
      } catch (error) {
        console.error(`[DynamicPermissions] Error checking update permission for ${feature}:`, error);
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  requireDelete(feature) {
    return async (req, res, next) => {
      try {
        const userRole = req.user?.role;
        if (!userRole) {
          return res.status(401).json({ error: 'User role not found' });
        }

        const canDelete = await this.canPerformAction(userRole, feature, 'delete');
        if (canDelete) {
          next();
        } else {
          res.status(403).json({ error: `Delete permission denied for ${feature}` });
        }
      } catch (error) {
        console.error(`[DynamicPermissions] Error checking delete permission for ${feature}:`, error);
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }
}

// Create singleton instance
const dynamicPermissions = new DynamicPermissionsMiddleware();

module.exports = dynamicPermissions;
