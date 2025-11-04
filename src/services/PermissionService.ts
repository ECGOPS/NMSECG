// PermissionService now handles frontend role/feature checks and backend communication
import { DynamicRoleService } from './DynamicRoleService';

export class PermissionService {
  private static instance: PermissionService;
  private dynamicRoleService: DynamicRoleService;
  private permissionsCache: Map<string, any> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;
  private permissionChangeListeners: Array<() => void> = [];
  private roles: any[] = []; // Add roles property
  private isRefreshing: boolean = false; // Prevent concurrent refreshes

  private constructor() {
    this.dynamicRoleService = DynamicRoleService.getInstance();
  }

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  // Add permission change listener
  public addPermissionChangeListener(listener: () => void): () => void {
    this.permissionChangeListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.permissionChangeListeners.indexOf(listener);
      if (index > -1) {
        this.permissionChangeListeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of permission changes
  private notifyPermissionChangeListeners(): void {
    this.permissionChangeListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in permission change listener:', error);
      }
    });
  }

  // Check if user has access to a specific feature
  public async canAccessFeature(userRole: string, feature: string): Promise<boolean> {
    try {
      // SIMPLE FIX: Always allow admin roles
      if (userRole === 'system_admin' || userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN') {
        console.log(`[PermissionService] ✅ Admin access granted for ${feature}`);
        return true;
      }

      // NEW: Check priority requirements for sensitive features
      const priorityRequirements = this.getFeaturePriorityRequirements();
      const requiredPriority = priorityRequirements[feature];
      
      if (requiredPriority !== undefined) {
        const userPriority = this.getRolePriority(userRole);
        if (userPriority < requiredPriority) {
          console.log(`[PermissionService] ❌ Priority too low for ${feature}: ${userRole} (${userPriority}) < ${requiredPriority}`);
          return false;
        }
      }
      
      console.log(`[PermissionService] Checking access for role: ${userRole}, feature: ${feature}`);
      
      // First check if we have cached permissions
      if (this.isCacheValid()) {
        const rolePermissions = this.permissionsCache.get(userRole);
        console.log(`[PermissionService] Cache valid, role permissions:`, rolePermissions);
        if (rolePermissions && rolePermissions[feature]) {
          console.log(`[PermissionService] ✅ Access granted from cache`);
          return true;
        }
        // If cache is valid but feature not found, use fallback immediately
        console.log(`[PermissionService] ⚠️ Feature '${feature}' not found in cache, using fallback`);
        return this.fallbackCanAccessFeature(userRole, feature);
      }

      console.log(`[PermissionService] Cache invalid or expired, refreshing...`);
      // Only refresh if cache is actually invalid
      await this.refreshPermissionsCache();
      
      const rolePermissions = this.permissionsCache.get(userRole);
      console.log(`[PermissionService] After refresh, role permissions:`, rolePermissions);
      if (rolePermissions && rolePermissions[feature]) {
        console.log(`[PermissionService] ✅ Access granted after refresh`);
        return true;
      }
      
      // If still not found, use fallback
      console.log(`[PermissionService] ⚠️ Feature '${feature}' still not found after refresh, using fallback`);
      return this.fallbackCanAccessFeature(userRole, feature);
    } catch (error) {
      console.error('Error checking feature access:', error);
      console.log(`[PermissionService] Falling back to hardcoded permissions for role: ${userRole}, feature: ${feature}`);
      // Fallback to hardcoded permissions if dynamic system fails
      const fallbackResult = this.fallbackCanAccessFeature(userRole, feature);
      console.log(`[PermissionService] Fallback result: ${fallbackResult}`);
      return fallbackResult;
    }
  }

  // Check if user can update a specific feature
  public async canUpdateFeature(userRole: string, feature: string): Promise<boolean> {
    try {
      if (this.isCacheValid()) {
        const rolePermissions = this.permissionsCache.get(userRole);
        if (rolePermissions && rolePermissions[`${feature}_update`]) {
          return true;
        }
      }

      await this.refreshPermissionsCache();
      
      const rolePermissions = this.permissionsCache.get(userRole);
      return rolePermissions && rolePermissions[`${feature}_update`] ? true : false;
    } catch (error) {
      console.error('Error checking update permission:', error);
      return this.fallbackCanUpdateFeature(userRole, feature);
    }
  }

  // Check if user can delete a specific feature
  public async canDeleteFeature(userRole: string, feature: string): Promise<boolean> {
    try {
      if (this.isCacheValid()) {
        const rolePermissions = this.permissionsCache.get(userRole);
        if (rolePermissions && rolePermissions[`${feature}_delete`]) {
          return true;
        }
      }

      await this.refreshPermissionsCache();
      
      const rolePermissions = this.permissionsCache.get(userRole);
      return rolePermissions && rolePermissions[`${feature}_delete`] ? true : false;
    } catch (error) {
      console.error('Error checking delete permission:', error);
      return this.fallbackCanDeleteFeature(userRole, feature);
    }
  }

  // Check if user can view a specific asset
  public canViewAsset(userRole: string, userRegion: string, userDistrict: string, assetRegion: string, assetDistrict: string): boolean {
    // System admin and global engineers can view all assets
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      return true;
    }
    
    // Regional engineers can view assets in their region
    if (userRole === 'regional_engineer') {
      return userRegion === assetRegion;
    }
    
    // District engineers and district managers can view assets in their district
    if (userRole === 'district_engineer' || userRole === 'district_manager') {
      return userRegion === assetRegion && userDistrict === assetDistrict;
    }
    
    // Other roles can view assets in their district
    return userRegion === assetRegion && userDistrict === assetDistrict;
  }

  // Check if user can view a specific inspection
  public canViewInspection(userRole: string, userRegion: string, userDistrict: string, inspectionRegion: string, inspectionDistrict: string): boolean {
    // System admin and global engineers can view all inspections
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      return true;
    }
    
    // Regional engineers can view inspections in their region
    if (userRole === 'regional_engineer') {
      return userRegion === inspectionRegion;
    }
    
    // District engineers and district managers can view inspections in their district
    if (userRole === 'district_engineer' || userRole === 'district_manager') {
      return userRegion === inspectionRegion && userDistrict === inspectionDistrict;
    }
    
    // Other roles can view inspections in their district
    return userRegion === inspectionRegion && userDistrict === inspectionDistrict;
  }

  // Check if user can reset district population
  public canResetDistrictPopulation(userRole: string): boolean {
    // Only system admin and global engineers can reset district population
    return userRole === 'system_admin' || userRole === 'global_engineer';
  }

  // Get all feature permissions (for admin pages)
  public getFeaturePermissions(): any {
    return this.permissionsCache;
  }

  // Check if user can edit a specific asset
  public canEditAsset(userRole: string, userRegion: string, userDistrict: string, assetRegion: string, assetDistrict: string): boolean {
    // System admin and global engineers can edit all assets
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      return true;
    }
    
    // Regional engineers can edit assets in their region
    if (userRole === 'regional_engineer') {
      return userRegion === assetRegion;
    }
    
    // District engineers and district managers can edit assets in their district
    if (userRole === 'district_engineer' || userRole === 'district_manager') {
      return userRegion === assetRegion && userDistrict === assetDistrict;
    }
    
    // Other roles can edit assets in their district
    return userRegion === assetRegion && userDistrict === assetDistrict;
  }

  // Check if user can delete a specific asset
  public canDeleteAsset(userRole: string, userRegion: string, userDistrict: string, assetRegion: string, assetDistrict: string): boolean {
    // System admin and global engineers can delete all assets
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      return true;
    }
    
    // Regional engineers can delete assets in their region
    if (userRole === 'regional_engineer') {
      return userRegion === assetRegion;
    }
    
    // District engineers and district managers can delete assets in their district
    if (userRole === 'district_engineer' || userRole === 'district_manager') {
      return userRegion === assetRegion && userDistrict === assetDistrict;
    }
    
    // Other roles cannot delete assets
    return false;
  }

  // Check if user can manage staff IDs
  public canManageStaffIds(userRole: string): boolean {
    return userRole === 'system_admin' || userRole === 'global_engineer';
  }

  // Check if user can manage district population
  public canManageDistrictPopulation(userRole: string): boolean {
    return userRole === 'system_admin' || userRole === 'global_engineer';
  }

  // Initialize the permission service (for backward compatibility)
  public async initialize(): Promise<void> {
    await this.refreshPermissionsCache();
  }

  // Listen to permission changes (for backward compatibility)
  public listenToPermissions(callback: () => void): () => void {
    return this.addPermissionChangeListener(callback);
  }

  // Update all permissions (for admin pages)
  public async updateAllPermissions(permissions: any): Promise<void> {
    // This would typically update the database
    // For now, just refresh the cache
    await this.refreshPermissionsCache();
  }

  // Reset permissions to defaults (for admin pages)
  public async resetToDefaults(): Promise<void> {
    // This would typically reset to default permissions
    // For now, just refresh the cache
    await this.refreshPermissionsCache();
  }

  // Add a new feature (for admin pages)
  public async addFeature(feature: any, permissions: string[]): Promise<void> {
    // This would typically add a feature to the database
    // For now, just refresh the cache
    await this.refreshPermissionsCache();
  }

  // Remove a feature (for admin pages)
  public async removeFeature(feature: any): Promise<void> {
    // This would typically remove a feature from the database
    // For now, just refresh the cache
    await this.refreshPermissionsCache();
  }

  // Check if user has required role
  public hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
    return requiredRoles.includes(userRole);
  }

  // NEW: Check if user has required priority level
  public hasRequiredPriority(userRole: string, requiredPriority: number): boolean {
    try {
      const rolePriority = this.getRolePriority(userRole);
      return rolePriority >= requiredPriority;
    } catch (error) {
      console.error('Error checking priority:', error);
      return false;
    }
  }

  // NEW: Get role priority level
  public getRolePriority(userRole: string): number {
    const roleHierarchy = {
      'system_admin': 100,
      'admin': 95,
      'global_engineer': 90,
      'regional_general_manager': 80,
      'regional_engineer': 70,
      'project_engineer': 70,
      'ashsubt': 70,
      'accsubt': 70,
      'district_manager': 60,
      'district_engineer': 60,
      'senior_technician': 50,
      'technician': 40,
      'assistant_technician': 30,
      'supervisor': 25,
      'operator': 20,
      'viewer': 10,
      'ict': 80,
      'load_monitoring_edit': 50,
      'load_monitoring_delete': 60
    };

    return roleHierarchy[userRole] || 0;
  }

  // NEW: Get feature priority requirements
  private getFeaturePriorityRequirements(): { [key: string]: number } {
    return {
      // System-level features require high priority
      'system_admin': 100,
      'role_management': 80,
      'feature_management': 80,
      'user_management': 70,
      'staff_id_management': 70,
      
      // Sensitive operations require medium-high priority
      'load_monitoring_delete': 60,
      'overhead_line_inspection_delete': 60,
      'substation_inspection_delete': 60,
      'vit_inspection_delete': 60,
      'equipment_failure_reporting_delete': 60,
      'fault_management_delete': 60,
      'broadcast_messages_delete': 60,
      'chat_delete': 60,
      
      // Update operations require medium priority
      'load_monitoring_update': 50,
      'overhead_line_inspection_update': 50,
      'substation_inspection_update': 50,
      'vit_inspection_update': 50,
      'equipment_failure_reporting_update': 50,
      'fault_management_update': 50,
      'broadcast_messages_update': 50,
      'chat_update': 50,
      
      // Basic features have no priority requirement
      'asset_management': 0,
      'overhead_line_inspection': 0,
      'substation_inspection': 0,
      'vit_inspection': 0,
      'equipment_failure_reporting': 0,
      'load_monitoring': 0,
      'fault_management': 0,
      'analytics': 0,
      'control_system_analytics': 0,
      'broadcast_messages': 0,
      'chat': 0,
      'user_logs': 0
    };
  }

  // NEW: Check access with priority requirements
  public async canAccessFeatureWithPriority(userRole: string, feature: string, requiredPriority: number = 0): Promise<boolean> {
    try {
      // First check basic feature access
      const hasFeatureAccess = await this.canAccessFeature(userRole, feature);
      if (!hasFeatureAccess) {
        console.log(`[PermissionService] ❌ Feature access denied for ${feature}`);
        return false;
      }

      // Then check priority requirement
      const hasPriority = this.hasRequiredPriority(userRole, requiredPriority);
      if (!hasPriority) {
        console.log(`[PermissionService] ❌ Priority requirement not met: ${userRole} (${this.getRolePriority(userRole)}) < ${requiredPriority}`);
        return false;
      }

      console.log(`[PermissionService] ✅ Access granted with priority: ${userRole} (${this.getRolePriority(userRole)}) >= ${requiredPriority}`);
      return true;
    } catch (error) {
      console.error('Error checking feature access with priority:', error);
      return false;
    }
  }

  // Get all permissions for a role
  public async getRolePermissions(roleName: string): Promise<any> {
    try {
      if (this.isCacheValid()) {
        return this.permissionsCache.get(roleName) || {};
      }

      await this.refreshPermissionsCache();
      return this.permissionsCache.get(roleName) || {};
    } catch (error) {
      console.error('Error getting role permissions:', error);
      return {};
    }
  }

  // Manually refresh permissions cache and notify listeners
  public async refreshPermissions(): Promise<void> {
    await this.refreshPermissionsCache();
  }

  // Refresh the permissions cache from the database
  private async refreshPermissionsCache(): Promise<void> {
    // Prevent multiple simultaneous refreshes
    if (this.isRefreshing) {
      console.log('[PermissionService] 🔄 Refresh already in progress, skipping...');
      return;
    }
    
    this.isRefreshing = true;
    try {
      console.log('[PermissionService] 🔄 Refreshing permissions cache...');
      console.log('[PermissionService] 🔍 Calling dynamicRoleService.getRoles()...');
      const roles = await this.dynamicRoleService.getRoles();
      console.log('[PermissionService] ✅ Roles loaded, count:', roles.length);
      
      console.log('[PermissionService] 🔍 Calling dynamicRoleService.getFeatures()...');
      let features = await this.dynamicRoleService.getFeatures();
      console.log('[PermissionService] ✅ Features loaded, count:', features.length);
      
      // If features are empty, force refresh and try again
      if (features.length === 0) {
        console.log('[PermissionService] 🚨 Features empty, forcing refresh...');
        this.dynamicRoleService.clearCache();
        features = await this.dynamicRoleService.getFeatures(true);
        console.log('[PermissionService] 🔄 After force refresh, features count:', features.length);
      }
      
      console.log('[PermissionService] 📋 Loaded roles:', roles.map(r => ({ name: r.name, permissions: r.permissions, assignedFeatures: r.assignedFeatures })));
      console.log('[PermissionService] 🎯 Loaded features:', features.map(f => f.name));
      
      // Store roles for region/district access methods
      this.roles = roles;
      
      // Clear existing cache
      this.permissionsCache.clear();
      
      // Build permissions cache
      for (const role of roles) {
        const rolePermissions: any = {};
        
        // Handle both 'permissions' and 'assignedFeatures' fields for backward compatibility
        const roleFeatures = role.permissions || role.assignedFeatures || [];
        
        // Add basic feature access
        for (const feature of features) {
          // Check multiple ways to match features with role permissions
          const featureMatches = 
            roleFeatures.includes(feature.name) || 
            roleFeatures.includes(feature.id) ||
            roleFeatures.includes('*') ||
            // Check if any role permission contains the feature name (case-insensitive)
            roleFeatures.some(permission => 
              permission.toLowerCase().includes(feature.name.toLowerCase()) ||
              feature.name.toLowerCase().includes(permission.toLowerCase())
            ) ||
            // Check specific mappings for inspection management
            (feature.name === 'Inspection Management' && (
              roleFeatures.includes('overheadLineInspections') ||
              roleFeatures.includes('substationInspections') ||
              roleFeatures.includes('vitInspections')
            )) ||
            // Check specific mappings for asset management (Load Monitoring)
            (feature.name === 'asset_management' && (
              roleFeatures.includes('loadMonitoring') ||
              roleFeatures.includes('Load Monitoring (View)') ||
              roleFeatures.includes('Load Monitoring (Edit)')
            ));
            
          if (featureMatches) {
            rolePermissions[feature.name] = true;
            rolePermissions[`${feature.name}_update`] = true;
            rolePermissions[`${feature.name}_delete`] = true;
          }
        }
        
        // Special handling for wildcard permissions
        if (roleFeatures.includes('*')) {
          for (const feature of features) {
            rolePermissions[feature.name] = true;
            rolePermissions[`${feature.name}_update`] = true;
            rolePermissions[`${feature.name}_delete`] = true;
          }
        }
        
        console.log(`[PermissionService] 🔑 Built permissions for role ${role.name}:`, rolePermissions);
        console.log(`[PermissionService] 🔍 Role ${role.name} has permissions:`, roleFeatures);
        this.permissionsCache.set(role.name, rolePermissions);
      }
      
      console.log('[PermissionService] 📊 Final permissions cache:', Object.fromEntries(this.permissionsCache));
      
      this.lastCacheUpdate = Date.now();
      this.notifyPermissionChangeListeners(); // Notify listeners after cache refresh
    } catch (error) {
      console.error('Error refreshing permissions cache:', error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  // Check if cache is still valid
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  // Fallback methods using hardcoded permissions
  private fallbackCanAccessFeature(userRole: string, feature: string): boolean {
    console.log(`[PermissionService] 🔄 Using fallback permissions for role: ${userRole}, feature: ${feature}`);
    
    // SIMPLE FIX: Always allow admin roles
    if (userRole === 'system_admin' || userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN') {
      console.log(`[PermissionService] ✅ Admin access granted via fallback for ${feature}`);
      return true;
    }
    
    const roleHierarchy = {
      'system_admin': 10,
      'admin': 10,
      'Admin': 10,
      'ADMIN': 10,
      'global_engineer': 9,
      'regional_engineer': 8,
      'ashsubt': 8,
      'accsubt': 8,
      'district_engineer': 7,
      'district_manager': 7, // Same priority as district_engineer
      'senior_technician': 6,
      'technician': 5,
      'assistant_technician': 4,
      'supervisor': 3,
      'operator': 2,
      'viewer': 1
    };

    const defaultFeaturePermissions: { [key: string]: string[] } = {
      'dashboard': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician', 'supervisor', 'operator', 'viewer'],
      'inspection_management': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'inspection_management_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'inspection_management_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'overhead_line_inspection': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'overhead_line_inspection_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'overhead_line_inspection_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'substation_inspection': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'substation_inspection_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'substation_inspection_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'vit_inspection': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'vit_inspection_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'vit_inspection_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'equipment_failure_reporting': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'equipment_failure_reporting_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'equipment_failure_reporting_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'load_monitoring': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'load_monitoring_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'load_monitoring_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'fault_management': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'fault_management_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'fault_management_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'fault_reporting': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician'],
      'fault_reporting_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'fault_reporting_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'fault_edit': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'fault_edit_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'fault_edit_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'analytics': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician', 'supervisor'],
      'control_system_analytics': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_engineer', 'senior_technician', 'technician', 'assistant_technician', 'supervisor'],
      'broadcast_messages': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician', 'supervisor'],
      'broadcast_messages_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'broadcast_messages_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'chat': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician', 'supervisor', 'operator'],
      'chat_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'chat_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager'],
      'user_management': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer'],
      'user_management_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer'],
      'user_management_delete': ['system_admin', 'admin', 'Admin', 'ADMIN'],
      'staff_id_management': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer'],
      'staff_id_management_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer'],
      'staff_id_management_delete': ['system_admin', 'admin', 'Admin', 'ADMIN'],
      'system_admin': ['system_admin', 'admin', 'Admin', 'ADMIN'],
      'role_management': ['system_admin', 'admin', 'Admin', 'ADMIN'],
      'feature_management': ['system_admin', 'admin', 'Admin', 'ADMIN'],
      'user_logs': ['system_admin', 'admin', 'Admin', 'ADMIN', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer'],
      'permissions': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer'],
      'permissions_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer'],
      'permissions_delete': ['system_admin', 'admin', 'Admin', 'ADMIN'],
      'district_population': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician','assistant_technician', 'supervisor'],
      'asset_management': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician', 'assistant_technician', 'supervisor'],
      'asset_management_update': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'regional_general_manager', 'project_engineer', 'district_engineer', 'district_manager', 'senior_technician', 'technician'],
      'asset_management_delete': ['system_admin', 'admin', 'Admin', 'ADMIN', 'global_engineer', 'regional_engineer', 'ashsubt', 'accsubt', 'district_engineer', 'district_manager']
    };

    const allowedRoles = defaultFeaturePermissions[feature] || [];
    console.log(`[PermissionService] 📋 Feature '${feature}' allows roles:`, allowedRoles);
    console.log(`[PermissionService] 👤 User role '${userRole}' in allowed roles:`, allowedRoles.includes(userRole));
    
    const result = allowedRoles.includes(userRole);
    console.log(`[PermissionService] 🎯 Fallback result: ${result}`);
    return result;
  }

  private fallbackCanUpdateFeature(userRole: string, feature: string): boolean {
    return this.fallbackCanAccessFeature(userRole, `${feature}_update`);
  }

  private fallbackCanDeleteFeature(userRole: string, feature: string): boolean {
    return this.fallbackCanAccessFeature(userRole, `${feature}_delete`);
  }

  // Check if user can access a specific region
  public canAccessRegion(userRole: string, targetRegionId: string): boolean {
    // System admin and global engineers can access all regions
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      return true;
    }
    
    // For dynamic roles, check region access
    const role = this.roles.find(r => r.name === userRole);
    if (role && role.allowedRegions) {
      return role.allowedRegions.includes(targetRegionId);
    }
    
    // Fallback to existing logic for hardcoded roles
    return false;
  }

  // Check if user can access a specific district
  public canAccessDistrict(userRole: string, targetDistrictId: string): boolean {
    // System admin and global engineers can access all districts
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      return true;
    }
    
    // For dynamic roles, check district access
    const role = this.roles.find(r => r.name === userRole);
    if (role && role.allowedDistricts) {
      return role.allowedDistricts.includes(targetDistrictId);
    }
    
    // Fallback to existing logic for hardcoded roles
    return false;
  }

  // Check if user can access a feature in a specific region
  public async canAccessFeatureInRegion(userRole: string, feature: string, regionId: string): Promise<boolean> {
    // First check if user can access the region
    if (!this.canAccessRegion(userRole, regionId)) {
      return false;
    }
    
    // Then check if user can access the feature
    return await this.canAccessFeature(userRole, feature);
  }

  // Check if user can access a feature in a specific district
  public async canAccessFeatureInDistrict(userRole: string, feature: string, districtId: string): Promise<boolean> {
    // First check if user can access the district
    if (!this.canAccessDistrict(userRole, districtId)) {
      return false;
    }
    
    // Then check if user can access the feature
    return await this.canAccessFeature(userRole, feature);
  }

  // Get user's accessible regions
  public getUserAccessibleRegions(userRole: string): string[] {
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      // Return all regions (will be handled by the caller)
      return [];
    }
    
    const role = this.roles.find(r => r.name === userRole);
    return role?.allowedRegions || [];
  }

  // Get user's accessible districts
  public getUserAccessibleDistricts(userRole: string): string[] {
    if (userRole === 'system_admin' || userRole === 'global_engineer') {
      // Return all districts (will be handled by the caller)
      return [];
    }
    
    const role = this.roles.find(r => r.name === userRole);
    return role?.allowedDistricts || [];
  }

  // Filter Control Permissions
  public async canChangeRegionFilter(userRole: string): Promise<boolean> {
    try {
      return await this.canAccessFeature(userRole, 'filter_controls_change_region_filter');
    } catch (error) {
      console.error('[PermissionService] Error checking region filter permission:', error);
      // Fallback to hardcoded permissions
      return userRole === 'system_admin' || userRole === 'admin' || userRole === 'global_engineer';
    }
  }

  public async canChangeDistrictFilter(userRole: string): Promise<boolean> {
    try {
      return await this.canAccessFeature(userRole, 'filter_controls_change_district_filter');
    } catch (error) {
      console.error('[PermissionService] Error checking district filter permission:', error);
      // Fallback to hardcoded permissions
      return userRole === 'system_admin' || userRole === 'admin' || userRole === 'global_engineer' || 
             userRole === 'regional_engineer' || userRole === 'project_engineer' || userRole === 'regional_general_manager' ||
             userRole === 'ashsubt' || userRole === 'accsubt';
    }
  }

  public async canViewAllRegions(userRole: string): Promise<boolean> {
    try {
      return await this.canAccessFeature(userRole, 'filter_controls_view_all_regions');
    } catch (error) {
      console.error('[PermissionService] Error checking view all regions permission:', error);
      // Fallback to hardcoded permissions
      return userRole === 'system_admin' || userRole === 'admin' || userRole === 'global_engineer';
    }
  }

  public async canViewAllDistricts(userRole: string): Promise<boolean> {
    try {
      return await this.canAccessFeature(userRole, 'filter_controls_view_all_districts');
    } catch (error) {
      console.error('[PermissionService] Error checking view all districts permission:', error);
      // Fallback to hardcoded permissions
      return userRole === 'system_admin' || userRole === 'admin' || userRole === 'global_engineer' || 
             userRole === 'regional_engineer' || userRole === 'project_engineer' || userRole === 'regional_general_manager' ||
             userRole === 'ashsubt' || userRole === 'accsubt';
    }
  }
} 