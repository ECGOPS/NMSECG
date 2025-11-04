# 🌍 Region-Based Access Control System

## Overview

The Region-Based Access Control system allows you to create roles that have access to specific geographic areas (regions and districts) while maintaining granular permission control over features and pages.

## 🎯 Key Concepts

### 1. **Access Levels**
- **Global**: Access to all regions and districts (e.g., system_admin, global_engineer)
- **Regional**: Access to specific regions only
- **District**: Access to specific districts only

### 2. **Dual-Layer Security**
- **Location Access**: Can the user access this region/district?
- **Feature Permissions**: Does the user have permission for this feature?

**Both must be true for access to be granted.**

## 🏗️ How It Works

### Step 1: Create a Role with Region/District Access
```typescript
const northRegionManager = {
  name: 'north_region_manager',
  displayName: 'North Region Manager',
  description: 'Manages operations in North Region only',
  priority: 75,
  permissions: ['asset_management', 'user_management', 'basic_reports'],
  allowedRegions: ['north_region_id'],
  allowedDistricts: [], // Empty for regional roles
  accessLevel: 'regional',
  isActive: true
};
```

### Step 2: Assign Permissions
```typescript
// The role has these permissions:
permissions: [
  'asset_management',    // Can manage assets
  'user_management',     // Can manage users
  'basic_reports'        // Can view basic reports
]
```

### Step 3: Set Geographic Access
```typescript
// Regional role - can access North Region
allowedRegions: ['north_region_id'],
accessLevel: 'regional'

// District role - can access specific districts
allowedDistricts: ['north_district_1', 'north_district_2'],
accessLevel: 'district'
```

## 📋 Example Role Scenarios

### Scenario 1: North Region Asset Manager
```typescript
{
  name: 'north_region_asset_manager',
  displayName: 'North Region Asset Manager',
  description: 'Manages assets in North Region only',
  priority: 75,
  permissions: [
    'asset_management',
    'asset_viewing', 
    'asset_editing',
    'basic_reports'
  ],
  allowedRegions: ['north_region_id'],
  allowedDistricts: [],
  accessLevel: 'regional'
}
```

**What this role can do:**
- ✅ Access asset management features
- ✅ View and edit assets
- ✅ Generate basic reports
- ✅ Access data in North Region only
- ❌ Cannot access data in other regions
- ❌ Cannot access features not in permissions list

### Scenario 2: South District Inspector
```typescript
{
  name: 'south_district_inspector',
  displayName: 'South District Inspector',
  description: 'Conducts inspections in South District only',
  priority: 60,
  permissions: [
    'vit_inspection',
    'inspection_viewing',
    'basic_reports'
  ],
  allowedRegions: ['south_region_id'],
  allowedDistricts: ['south_district_id'],
  accessLevel: 'district'
}
```

**What this role can do:**
- ✅ Conduct VIT inspections
- ✅ View inspection data
- ✅ Generate basic reports
- ✅ Access data in South District only
- ❌ Cannot access data in other districts
- ❌ Cannot access asset management features

### Scenario 3: Multi-Region Technician
```typescript
{
  name: 'multi_region_technician',
  displayName: 'Multi-Region Technician',
  description: 'Technician working across multiple regions',
  priority: 65,
  permissions: [
    'basic_maintenance',
    'asset_viewing',
    'fault_reporting'
  ],
  allowedRegions: ['north_region_id', 'south_region_id'],
  allowedDistricts: ['north_district_1', 'south_district_1'],
  accessLevel: 'regional'
}
```

**What this role can do:**
- ✅ Perform basic maintenance
- ✅ View assets
- ✅ Report faults
- ✅ Access data in North and South regions
- ❌ Cannot access data in other regions
- ❌ Cannot access features not in permissions list

## 🔧 Implementation Steps

### 1. **Update Your Backend**
The backend routes (`/api/roles`) now support the new fields:
- `allowedRegions`: Array of region IDs
- `allowedDistricts`: Array of district IDs  
- `accessLevel`: 'global', 'regional', or 'district'

### 2. **Use the New Permission Methods**
```typescript
import { PermissionService } from '@/services/PermissionService';

const permissionService = PermissionService.getInstance();

// Check region access
const canAccessRegion = permissionService.canAccessRegion(userRole, regionId);

// Check district access
const canAccessDistrict = permissionService.canAccessDistrict(userRole, districtId);

// Check feature access in specific region
const canAccessFeatureInRegion = await permissionService.canAccessFeatureInRegion(
  userRole, 
  'asset_management', 
  regionId
);

// Check feature access in specific district
const canAccessFeatureInDistrict = await permissionService.canAccessFeatureInDistrict(
  userRole, 
  'asset_management', 
  districtId
);
```

### 3. **Filter Data Based on Access**
```typescript
// In your data fetching logic
const userAccessibleRegions = permissionService.getUserAccessibleRegions(userRole);
const userAccessibleDistricts = permissionService.getUserAccessibleDistricts(userRole);

// Filter data accordingly
const filteredData = data.filter(item => {
  // Check region access
  if (item.regionId && !permissionService.canAccessRegion(userRole, item.regionId)) {
    return false;
  }
  
  // Check district access
  if (item.districtId && !permissionService.canAccessDistrict(userRole, item.districtId)) {
    return false;
  }
  
  return true;
});
```

## 🎨 UI Components

### 1. **Role Management Page**
- Create/edit roles with region/district assignments
- Set access levels (Global, Regional, District)
- Assign specific permissions
- Visual indicators for access scope

### 2. **Region-Based Access Demo**
- Test different role configurations
- See real-time access control results
- Understand how the system works

## 🚀 Getting Started

### 1. **Create Your First Region-Based Role**
```bash
# Run the example script
node scripts/create-region-based-role-example.cjs
```

### 2. **Update Region/District IDs**
Replace placeholder IDs with actual IDs from your database:
```bash
# Get actual region IDs
GET /api/regions

# Get actual district IDs  
GET /api/districts
```

### 3. **Test the System**
1. Go to **System Admin > Role Management**
2. Create a new role with regional/district access
3. Use **Region-Based Access Demo** to test access control
4. Assign the role to a user and verify access restrictions

## 🔒 Security Features

### 1. **No Privilege Escalation**
- High priority alone doesn't grant access
- Must have explicit permission AND location access
- Dual-layer validation prevents security bypass

### 2. **Granular Control**
- Region-level access control
- District-level access control
- Feature-level permissions
- Priority-based restrictions

### 3. **Audit Trail**
- All access attempts are logged
- Role changes are tracked
- Permission modifications are recorded

## 📊 Best Practices

### 1. **Role Design**
- Keep roles focused on specific responsibilities
- Use descriptive names and descriptions
- Set appropriate priority levels
- Limit permissions to minimum required

### 2. **Region Assignment**
- Assign regions based on operational needs
- Consider geographic proximity
- Plan for future expansion
- Document region boundaries

### 3. **Testing**
- Test all access scenarios
- Verify data isolation
- Check permission inheritance
- Validate audit logging

## 🐛 Troubleshooting

### Common Issues

#### 1. **"Access Denied" Errors**
- Check if user has the required role
- Verify region/district assignments
- Confirm feature permissions
- Check priority requirements

#### 2. **Data Not Loading**
- Verify region/district access
- Check feature permissions
- Review data filtering logic
- Check console for errors

#### 3. **Role Not Working**
- Confirm role is active
- Check access level settings
- Verify region/district IDs
- Review permission assignments

### Debug Commands
```typescript
// Check user's accessible regions
console.log('Accessible regions:', permissionService.getUserAccessibleRegions(userRole));

// Check specific access
console.log('Can access region:', permissionService.canAccessRegion(userRole, regionId));
console.log('Can access feature:', await permissionService.canAccessFeature(userRole, featureName));
```

## 🔮 Future Enhancements

### Planned Features
- **Time-based access**: Access only during specific hours
- **Conditional permissions**: Permissions based on data state
- **Role inheritance**: Hierarchical role structure
- **Dynamic boundaries**: Geographic boundaries that change over time

### Customization Options
- **Custom access rules**: Business logic-based access control
- **Integration hooks**: Connect with external systems
- **Advanced analytics**: Access pattern analysis
- **Compliance reporting**: Audit and compliance features

## 📞 Support

For questions or issues:
1. Check the **Region-Based Access Demo** page
2. Review console logs for error details
3. Test with different role configurations
4. Verify database connections and permissions

---

**Remember**: Region-based access control is a powerful security feature. Always test thoroughly and document your role configurations! 🛡️✨
