const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();

// Example script to create a region-based role
async function createRegionBasedRoleExample() {
  const endpoint = process.env.COSMOS_DB_ENDPOINT;
  const key = process.env.COSMOS_DB_KEY;
  const databaseId = process.env.COSMOS_DB_DATABASE;
  
  if (!endpoint || !key || !databaseId) {
    console.error('❌ Missing required environment variables');
    console.error('Please check your .env file for:');
    console.error('- COSMOS_DB_ENDPOINT');
    console.error('- COSMOS_DB_KEY');
    console.error('- COSMOS_DB_DATABASE');
    return;
  }

  const client = new CosmosClient({ endpoint, key });
  const database = client.database(databaseId);
  const rolesContainer = database.container('roles');

  try {
    console.log('🚀 Creating region-based role example...');
    
    // Example 1: North Region Asset Manager
    const northRegionAssetManager = {
      id: 'north_region_asset_manager',
      name: 'north_region_asset_manager',
      displayName: 'North Region Asset Manager',
      description: 'Manages assets in North Region only. Can view, edit, and manage assets but only within the North Region.',
      priority: 75,
      permissions: [
        'asset_management',
        'asset_viewing', 
        'asset_editing',
        'basic_reports',
        'inspection_viewing'
      ],
      allowedRegions: ['north_region_id'], // You'll need to replace with actual region ID
      allowedDistricts: [], // Empty for regional roles
      accessLevel: 'regional',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      updatedBy: 'system'
    };

    // Example 2: South District Inspector
    const southDistrictInspector = {
      id: 'south_district_inspector',
      name: 'south_district_inspector',
      displayName: 'South District Inspector',
      description: 'Conducts inspections in South District only. Limited to inspection activities within the South District.',
      priority: 60,
      permissions: [
        'vit_inspection',
        'inspection_viewing',
        'basic_reports',
        'asset_viewing'
      ],
      allowedRegions: ['south_region_id'], // You'll need to replace with actual region ID
      allowedDistricts: ['south_district_id'], // You'll need to replace with actual district ID
      accessLevel: 'district',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      updatedBy: 'system'
    };

    // Example 3: Multi-Region Technician
    const multiRegionTechnician = {
      id: 'multi_region_technician',
      name: 'multi_region_technician',
      displayName: 'Multi-Region Technician',
      description: 'Technician working across multiple regions. Has access to basic maintenance and viewing features in specified regions.',
      priority: 65,
      permissions: [
        'basic_maintenance',
        'asset_viewing',
        'fault_reporting',
        'inspection_viewing'
      ],
      allowedRegions: ['north_region_id', 'south_region_id'], // Multiple regions
      allowedDistricts: ['north_district_1', 'south_district_1'], // Multiple districts
      accessLevel: 'regional',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      updatedBy: 'system'
    };

    console.log('📝 Creating North Region Asset Manager...');
    await rolesContainer.items.create(northRegionAssetManager);
    console.log('✅ North Region Asset Manager created successfully');

    console.log('📝 Creating South District Inspector...');
    await rolesContainer.items.create(southDistrictInspector);
    console.log('✅ South District Inspector created successfully');

    console.log('📝 Creating Multi-Region Technician...');
    await rolesContainer.items.create(multiRegionTechnician);
    console.log('✅ Multi-Region Technician created successfully');

    console.log('\n🎉 All region-based roles created successfully!');
    console.log('\n📋 Summary of created roles:');
    console.log('1. North Region Asset Manager - Regional access with asset management permissions');
    console.log('2. South District Inspector - District access with inspection permissions');
    console.log('3. Multi-Region Technician - Multi-regional access with basic permissions');
    
    console.log('\n⚠️  IMPORTANT: You need to update the region and district IDs in the roles above');
    console.log('   with actual IDs from your regions and districts collections.');
    console.log('\n   To get the actual IDs, run:');
    console.log('   - GET /api/regions to see all regions');
    console.log('   - GET /api/districts to see all districts');
    
    console.log('\n🔧 Next steps:');
    console.log('1. Update the region and district IDs in the roles above');
    console.log('2. Assign these roles to users in the user management system');
    console.log('3. Test the access control using the Region-Based Access Demo page');
    console.log('4. Verify that users can only access data in their assigned regions/districts');

  } catch (error) {
    console.error('❌ Error creating region-based roles:', error);
    if (error.code === 409) {
      console.error('   This usually means the role already exists. You can:');
      console.error('   - Delete the existing role first, or');
      console.error('   - Use a different role name');
    }
  }
}

// Example function to show how to use the new permission methods
function demonstratePermissionUsage() {
  console.log('\n🔐 How to use the new permission methods:');
  console.log('\n// Check if user can access a specific region');
  console.log('const canAccessRegion = permissionService.canAccessRegion(userRole, regionId);');
  
  console.log('\n// Check if user can access a specific district');
  console.log('const canAccessDistrict = permissionService.canAccessDistrict(userRole, districtId);');
  
  console.log('\n// Check if user can access a feature in a specific region');
  console.log('const canAccessFeatureInRegion = await permissionService.canAccessFeatureInRegion(userRole, feature, regionId);');
  
  console.log('\n// Check if user can access a feature in a specific district');
  console.log('const canAccessFeatureInDistrict = await permissionService.canAccessFeatureInDistrict(userRole, feature, districtId);');
  
  console.log('\n// Get user\'s accessible regions');
  console.log('const accessibleRegions = permissionService.getUserAccessibleRegions(userRole);');
  
  console.log('\n// Get user\'s accessible districts');
  console.log('const accessibleDistricts = permissionService.getUserAccessibleDistricts(userRole);');
}

// Run the example
if (require.main === module) {
  createRegionBasedRoleExample()
    .then(() => {
      demonstratePermissionUsage();
      console.log('\n✨ Script completed successfully!');
    })
    .catch(console.error);
}

module.exports = { createRegionBasedRoleExample };
