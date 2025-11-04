import { apiRequest } from '@/lib/api';

// Types for dynamic role management
export interface DynamicRole {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priority: number;
  permissions: string[];
  assignedFeatures?: string[]; // Backward compatibility with existing roles
  
  // NEW: Region and District Access Control
  allowedRegions: string[];        // Array of region IDs this role can access
  allowedDistricts: string[];      // Array of district IDs this role can access
  accessLevel: 'global' | 'regional' | 'district'; // Access scope
  
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface DynamicFeature {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  permissions: {
    access: string[];
    create: string[];
    update: string[];
    delete: string[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface RolePermissionMapping {
  roleId: string;
  permissions: string[];
}

export class DynamicRoleService {
  private static instance: DynamicRoleService;
  private rolesCache: DynamicRole[] = [];
  private featuresCache: DynamicFeature[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): DynamicRoleService {
    if (!DynamicRoleService.instance) {
      DynamicRoleService.instance = new DynamicRoleService();
    }
    return DynamicRoleService.instance;
  }

  // Role Management Methods
  async getRoles(forceRefresh: boolean = false): Promise<DynamicRole[]> {
    if (!forceRefresh && this.isCacheValid()) {
      return this.rolesCache;
    }

    try {
      // Use public endpoint that any authenticated user can access
      const roles = await apiRequest('/api/roles/public', { method: 'GET' });
      this.rolesCache = roles;
      this.lastFetch = Date.now();
      return roles;
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error;
    }
  }

  async getRoleById(roleId: string): Promise<DynamicRole> {
    try {
      return await apiRequest(`/api/roles/${roleId}`, { method: 'GET' });
    } catch (error) {
      console.error('Error fetching role:', error);
      throw error;
    }
  }

  async createRole(roleData: Partial<DynamicRole>): Promise<DynamicRole> {
    try {
      const newRole = await apiRequest('/api/roles', { 
        method: 'POST', 
        body: JSON.stringify(roleData) 
      });
      // Invalidate cache
      this.lastFetch = 0;
      return newRole;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  async updateRole(roleId: string, roleData: Partial<DynamicRole>): Promise<DynamicRole> {
    try {
      const updatedRole = await apiRequest(`/api/roles/${roleId}`, { 
        method: 'PUT', 
        body: JSON.stringify(roleData) 
      });
      // Invalidate cache
      this.lastFetch = 0;
      return updatedRole;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  async deleteRole(roleId: string): Promise<void> {
    try {
      await apiRequest(`/api/roles/${roleId}`, { method: 'DELETE' });
      // Invalidate cache
      this.lastFetch = 0;
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  async getRolePermissions(roleId: string): Promise<string[]> {
    try {
      const response = await apiRequest(`/api/roles/${roleId}/permissions`, { method: 'GET' });
      return response.permissions || [];
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      throw error;
    }
  }

  async updateRolePermissions(roleId: string, permissions: string[]): Promise<string[]> {
    try {
      const response = await apiRequest(`/api/roles/${roleId}/permissions`, { 
        method: 'PUT', 
        body: JSON.stringify({ permissions }) 
      });
      // Invalidate cache
      this.lastFetch = 0;
      return response.permissions || [];
    } catch (error) {
      console.error('Error updating role permissions:', error);
      throw error;
    }
  }

  // Feature Management Methods
  async getFeatures(forceRefresh: boolean = false): Promise<DynamicFeature[]> {
    console.log('[DynamicRoleService] 🔍 getFeatures called, forceRefresh:', forceRefresh);
    
    // Force refresh if cache is empty or invalid
    if (!forceRefresh && this.isCacheValid() && this.featuresCache.length > 0) {
      console.log('[DynamicRoleService] ✅ Using cached features, count:', this.featuresCache.length);
      return this.featuresCache;
    }

    try {
      console.log('[DynamicRoleService] 🔄 Fetching features from /api/features/public');
      // Use the public endpoint to avoid role restrictions
      const features = await apiRequest('/api/features/public', { method: 'GET' });
      console.log('[DynamicRoleService] ✅ Features fetched successfully, count:', features.length);
      console.log('[DynamicRoleService] 📋 Sample features:', features.slice(0, 3).map(f => ({ id: f.id, name: f.name, category: f.category })));
      
      this.featuresCache = features;
      this.lastFetch = Date.now();
      return features;
    } catch (error) {
      console.error('[DynamicRoleService] ❌ Error fetching features:', error);
      throw error;
    }
  }

  async getFeatureById(featureId: string): Promise<DynamicFeature> {
    try {
      // Use the public endpoint to avoid role restrictions
      return await apiRequest(`/api/features/public/${featureId}`, { method: 'GET' });
    } catch (error) {
      console.error('Error fetching feature:', error);
      throw error;
    }
  }

  async createFeature(featureData: Omit<DynamicFeature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<DynamicFeature> {
    try {
      const newFeature = await apiRequest('/api/features', { 
        method: 'POST', 
        body: JSON.stringify(featureData) 
      });
      // Invalidate cache
      this.lastFetch = 0;
      return newFeature;
    } catch (error) {
      console.error('Error creating feature:', error);
      throw error;
    }
  }

  async updateFeature(featureId: string, featureData: Partial<DynamicFeature>): Promise<DynamicFeature> {
    try {
      const updatedFeature = await apiRequest(`/api/features/${featureId}`, { 
        method: 'PUT', 
        body: JSON.stringify(featureData) 
      });
      // Invalidate cache
      this.lastFetch = 0;
      return updatedFeature;
    } catch (error) {
      console.error('Error updating feature:', error);
      throw error;
    }
  }

  async deleteFeature(featureId: string): Promise<void> {
    try {
      await apiRequest(`/api/features/${featureId}`, { method: 'DELETE' });
      // Invalidate cache
      this.lastFetch = 0;
    } catch (error) {
      console.error('Error deleting feature:', error);
      throw error;
    }
  }

  async getFeaturesByCategory(category: string): Promise<DynamicFeature[]> {
    try {
      // Use the public endpoint to avoid role restrictions
      return await apiRequest(`/api/features/public/category/${category}`, { method: 'GET' });
    } catch (error) {
      console.error('Error fetching features by category:', error);
      throw error;
    }
  }

  async getFeatureCategories(): Promise<string[]> {
    try {
      // Use the public endpoint to avoid role restrictions
      return await apiRequest('/api/features/public/categories/list', { method: 'GET' });
    } catch (error) {
      console.error('Error fetching feature categories:', error);
      throw error;
    }
  }

  // Permission Checking Methods
  async hasPermission(roleName: string, featureName: string): Promise<boolean> {
    try {
      const roles = await this.getRoles();
      const role = roles.find(r => r.name === roleName && r.isActive);
      
      if (!role) {
        return false;
      }

      return role.permissions.includes(featureName);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  async getRolePermissionsForFeatures(roleName: string, featureNames: string[]): Promise<{ [key: string]: boolean }> {
    try {
      const roles = await this.getRoles();
      const role = roles.find(r => r.name === roleName && r.isActive);
      
      if (!role) {
        return featureNames.reduce((acc, feature) => ({ ...acc, [feature]: false }), {});
      }

      return featureNames.reduce((acc, feature) => ({
        ...acc,
        [feature]: role.permissions.includes(feature)
      }), {});
    } catch (error) {
      console.error('Error checking role permissions for features:', error);
      return featureNames.reduce((acc, feature) => ({ ...acc, [feature]: false }), {});
    }
  }

  // Utility Methods
  private isCacheValid(): boolean {
    return Date.now() - this.lastFetch < this.CACHE_DURATION;
  }

  clearCache(): void {
    this.rolesCache = [];
    this.featuresCache = [];
    this.lastFetch = 0;
  }

  // Migration Helper Methods
  async migrateExistingRoles(): Promise<void> {
    try {
      // This method will help migrate existing hardcoded roles to the dynamic system
      const existingRoles = [
        {
          name: 'system_admin',
          displayName: 'System Administrator',
          description: 'Full system access and control',
          priority: 100,
          permissions: ['*'], // All permissions
          isActive: true
        },
        {
          name: 'global_engineer',
          displayName: 'Global Engineer',
          description: 'System-wide engineering access',
          priority: 90,
          permissions: ['asset_management', 'analytics_dashboard', 'fault_analytics'],
          isActive: true
        },
        // Add more existing roles here
      ];

      for (const roleData of existingRoles) {
        try {
          await this.createRole(roleData);
          console.log(`Migrated role: ${roleData.name}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`Role ${roleData.name} already exists, skipping...`);
          } else {
            console.error(`Failed to migrate role ${roleData.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error during role migration:', error);
      throw error;
    }
  }

  async migrateExistingFeatures(): Promise<void> {
    try {
      // This method will help migrate existing hardcoded features to the dynamic system
      const existingFeatures = [
        {
          name: 'asset_management',
          displayName: 'Asset Management',
          description: 'Manage system assets and equipment',
          category: 'asset_management',
          permissions: {
            access: ['read', 'update'],
            create: ['create'],
            update: ['update'],
            delete: ['delete']
          },
          isActive: true
        },
        {
          name: 'user_logs',
          displayName: 'User Logs',
          description: 'View and manage user activity logs',
          category: 'system',
          permissions: {
            access: ['read'],
            create: [],
            update: [],
            delete: ['delete']
          },
          isActive: true
        },
        // Add more existing features here
      ];

      for (const featureData of existingFeatures) {
        try {
          await this.createFeature(featureData);
          console.log(`Migrated feature: ${featureData.name}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`Feature ${featureData.name} already exists, skipping...`);
          } else {
            console.error(`Failed to migrate feature ${featureData.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error during feature migration:', error);
      throw error;
    }
  }
}
