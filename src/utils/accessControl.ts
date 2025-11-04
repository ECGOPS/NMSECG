import { User } from '@/lib/types';

// Role hierarchy levels
const ROLE_HIERARCHY = {
  system_admin: 5,
  global_engineer: 4,
  regional_engineer: 3,
  regional_general_manager: 3,
  ashsubt: 3,
  accsubt: 3,
  district_engineer: 2,
  district_manager: 2,
  technician: 1
};

// Check if user has required role level
export const hasRoleAccess = (userRole: string, requiredRole: string): boolean => {
  return ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] >= 
         ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY];
};

// Check if user has access to a region
export const hasRegionAccess = (user: User, targetRegionId: string): boolean => {
  if (!user) return false;
  
  // Helper function to check if a region is in the allowed list
  const isRegionAllowed = (role: string, targetId: string): boolean => {
    // Define allowed regions for each role
    const ashsubtRegions = ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south']; // SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
    const accsubtRegions = ['subtransmission-accra', 'accra-east', 'accra-west']; // SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
    
    if (role === 'ashsubt') {
      return ashsubtRegions.includes(targetId);
    }
    if (role === 'accsubt') {
      return accsubtRegions.includes(targetId);
    }
    return false;
  };
  
  return user.role === 'system_admin' || 
         user.role === 'global_engineer' || 
         (user.role === 'regional_engineer' && user.regionId === targetRegionId) ||
         (user.role === 'regional_general_manager' && user.regionId === targetRegionId) ||
         (user.role === 'district_engineer' && user.regionId === targetRegionId) ||
         (user.role === 'district_manager' && user.regionId === targetRegionId) ||
         (user.role === 'technician' && user.regionId === targetRegionId) ||
         isRegionAllowed(user.role || '', targetRegionId);
};

// Check if user has access to a district
export const hasDistrictAccess = (user: User, targetDistrictId: string, districts?: any[]): boolean => {
  if (!user) return false;
  
  // Helper function to check if a district is in the allowed regions
    const isDistrictInAllowedRegions = (role: string, targetDistrictId: string): boolean => {
      if (!districts) return false;
      
      const ashsubtRegionIds = ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south']; // SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
      const accsubtRegionIds = ['subtransmission-accra', 'accra-east', 'accra-west']; // SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
      
      const targetDistrict = districts.find(d => d.id === targetDistrictId);
      if (!targetDistrict) return false;
      
      if (role === 'ashsubt') {
        return ashsubtRegionIds.includes(targetDistrict.regionId);
      }
      if (role === 'accsubt') {
        return accsubtRegionIds.includes(targetDistrict.regionId);
      }
      return false;
    };
  
  return user.role === 'system_admin' || 
         user.role === 'global_engineer' || 
         (user.role === 'district_engineer' && user.districtId === targetDistrictId) ||
         (user.role === 'district_manager' && user.districtId === targetDistrictId) ||
         (user.role === 'technician' && user.districtId === targetDistrictId) ||
         isDistrictInAllowedRegions(user.role || '', targetDistrictId);
};

// Check if user can read data
export const canReadData = (user: User, data: any): boolean => {
  if (!user) return false;

  if (user.role === 'system_admin' || user.role === 'global_engineer') {
    return true;
  }

  if (data.regionId && !hasRegionAccess(user, data.regionId)) {
    return false;
  }

  if (data.districtId && !hasDistrictAccess(user, data.districtId)) {
    return false;
  }

  return true;
};

// Check if user can create data
export const canCreateData = (user: User, data: any): boolean => {
  if (!user) return false;

  if (user.role === 'system_admin' || user.role === 'global_engineer') {
    return true;
  }

  if (data.regionId && !hasRegionAccess(user, data.regionId)) {
    return false;
  }

  if (data.districtId && !hasDistrictAccess(user, data.districtId)) {
    return false;
  }

  return true;
};

// Check if user can update data
export const canUpdateData = (user: User, data: any): boolean => {
  if (!user) return false;

  if (user.role === 'system_admin' || user.role === 'global_engineer') {
    return true;
  }

  if (data.regionId && !hasRegionAccess(user, data.regionId)) {
    return false;
  }

  if (data.districtId && !hasDistrictAccess(user, data.districtId)) {
    return false;
  }

  return true;
};

// Check if user can delete data
export const canDeleteData = (user: User, data: any): boolean => {
  if (!user) return false;

  if (user.role === 'system_admin' || user.role === 'global_engineer') {
    return true;
  }

  if (user.role === 'regional_engineer' && data.regionId && hasRegionAccess(user, data.regionId)) {
    return true;
  }

  return false;
};

// Filter data based on user's access
export const filterDataByAccess = (user: User, data: any[]): any[] => {
  if (!user) return [];

  if (user.role === 'system_admin' || user.role === 'global_engineer') {
    return data;
  }

  return data.filter(item => {
    if (item.regionId && !hasRegionAccess(user, item.regionId)) {
      return false;
    }
    if (item.districtId && !hasDistrictAccess(user, item.districtId)) {
      return false;
    }
    return true;
  });
}; 