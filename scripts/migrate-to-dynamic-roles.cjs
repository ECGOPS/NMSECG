const { CosmosClient } = require('@azure/cosmos');

// Configuration
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;

if (!endpoint || !key || !databaseId) {
  console.error('❌ Missing required environment variables:');
  console.error('   - COSMOS_DB_ENDPOINT');
  console.error('   - COSMOS_DB_KEY');
  console.error('   - COSMOS_DB_DATABASE');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

// Existing roles to migrate
const existingRoles = [
  {
    name: 'system_admin',
    displayName: 'System Administrator',
    description: 'Full system access and control with all permissions',
    priority: 100,
    permissions: ['*'], // All permissions
    isActive: true
  },
  {
    name: 'global_engineer',
    displayName: 'Global Engineer',
    description: 'System-wide engineering access across all regions',
    priority: 90,
    permissions: [
      'asset_management', 'asset_management_update', 'asset_management_delete',
      'analytics_dashboard', 'analytics_page', 'fault_analytics',
      'control_system_analytics', 'control_outage_management',
      'load_monitoring', 'load_monitoring_update', 'load_monitoring_delete',
      'vit_inspection', 'vit_inspection_update', 'vit_inspection_delete',
      'overhead_line_inspection', 'overhead_line_inspection_update', 'overhead_line_inspection_delete',
      'substation_inspection', 'substation_inspection_update', 'substation_inspection_delete',
      'equipment_failure_reporting', 'equipment_failure_reporting_update', 'equipment_failure_reporting_delete',
      'fault_reporting', 'fault_reporting_update', 'fault_reporting_delete',
      'op5_fault_management', 'op5_fault_management_update', 'op5_fault_management_delete',
      'feeder_management', 'feeder_management_update', 'feeder_management_delete',
      'user_management', 'user_management_update', 'user_management_delete',
      'staff_ids_management', 'staff_ids_management_update', 'staff_ids_management_delete',
      'district_population', 'district_population_update', 'district_population_delete',
      'broadcast_messages', 'broadcast_messages_update', 'broadcast_messages_delete',
      'chat_messages', 'chat_messages_update', 'chat_messages_delete',
      'sms_notification', 'sms_notification_update', 'sms_notification_delete',
      'music_management', 'music_management_update', 'music_management_delete',
      'user_logs', 'user_logs_update', 'user_logs_delete', 'user_logs_delete_all'
    ],
    isActive: true
  },
  {
    name: 'regional_general_manager',
    displayName: 'Regional General Manager',
    description: 'Regional management with oversight of multiple districts',
    priority: 80,
    permissions: [
      'asset_management', 'asset_management_update',
      'analytics_dashboard', 'analytics_page',
      'fault_analytics', 'control_system_analytics',
      'load_monitoring', 'load_monitoring_update',
      'vit_inspection', 'vit_inspection_update',
      'overhead_line_inspection', 'overhead_line_inspection_update',
      'substation_inspection', 'substation_inspection_update',
      'equipment_failure_reporting', 'equipment_failure_reporting_update',
      'fault_reporting', 'fault_reporting_update',
      'op5_fault_management', 'op5_fault_management_update',
      'feeder_management', 'feeder_management_update',
      'user_management', 'user_management_update',
      'staff_ids_management', 'staff_ids_management_update',
      'district_population', 'district_population_update',
      'broadcast_messages', 'broadcast_messages_update',
      'chat_messages', 'chat_messages_update',
      'sms_notification', 'sms_notification_update'
    ],
    isActive: true
  },
  {
    name: 'regional_engineer',
    displayName: 'Regional Engineer',
    description: 'Regional engineering with district oversight',
    priority: 70,
    permissions: [
      'asset_management', 'asset_management_update',
      'analytics_dashboard', 'analytics_page',
      'fault_analytics', 'control_system_analytics',
      'load_monitoring', 'load_monitoring_update',
      'vit_inspection', 'vit_inspection_update',
      'overhead_line_inspection', 'overhead_line_inspection_update',
      'substation_inspection', 'substation_inspection_update',
      'equipment_failure_reporting', 'equipment_failure_reporting_update',
      'fault_reporting', 'fault_reporting_update',
      'op5_fault_management', 'op5_fault_management_update',
      'feeder_management', 'feeder_management_update',
      'user_management', 'user_management_update',
      'staff_ids_management', 'staff_ids_management_update',
      'district_population', 'district_population_update',
      'broadcast_messages', 'broadcast_messages_update',
      'chat_messages', 'chat_messages_update',
      'sms_notification', 'sms_notification_update'
    ],
    isActive: true
  },
  {
    name: 'project_engineer',
    displayName: 'Project Engineer',
    description: 'Project-specific engineering with regional access',
    priority: 65,
    permissions: [
      'asset_management', 'asset_management_update',
      'analytics_dashboard', 'analytics_page',
      'fault_analytics', 'control_system_analytics',
      'load_monitoring', 'load_monitoring_update',
      'vit_inspection', 'vit_inspection_update',
      'overhead_line_inspection', 'overhead_line_inspection_update',
      'substation_inspection', 'substation_inspection_update',
      'equipment_failure_reporting', 'equipment_failure_reporting_update',
      'fault_reporting', 'fault_reporting_update',
      'op5_fault_management', 'op5_fault_management_update',
      'feeder_management', 'feeder_management_update',
      'user_management', 'user_management_update',
      'staff_ids_management', 'staff_ids_management_update',
      'district_population', 'district_population_update',
      'broadcast_messages', 'broadcast_messages_update',
      'chat_messages', 'chat_messages_update',
      'sms_notification', 'sms_notification_update'
    ],
    isActive: true
  },
  {
    name: 'district_manager',
    displayName: 'District Manager',
    description: 'District-level management and oversight',
    priority: 60,
    permissions: [
      'asset_management', 'asset_management_update',
      'analytics_dashboard', 'analytics_page',
      'load_monitoring', 'load_monitoring_update',
      'vit_inspection', 'vit_inspection_update',
      'overhead_line_inspection', 'overhead_line_inspection_update',
      'substation_inspection', 'substation_inspection_update',
      'equipment_failure_reporting', 'equipment_failure_reporting_update',
      'fault_reporting', 'fault_reporting_update',
      'op5_fault_management', 'op5_fault_management_update',
      'feeder_management', 'feeder_management_update',
      'user_management', 'user_management_update',
      'staff_ids_management', 'staff_ids_management_update',
      'district_population', 'district_population_update',
      'broadcast_messages', 'broadcast_messages_update',
      'chat_messages', 'chat_messages_update',
      'sms_notification', 'sms_notification_update'
    ],
    isActive: true
  },
  {
    name: 'district_engineer',
    displayName: 'District Engineer',
    description: 'District-level engineering and operations',
    priority: 50,
    permissions: [
      'asset_management', 'asset_management_update',
      'analytics_dashboard', 'analytics_page',
      'load_monitoring', 'load_monitoring_update',
      'vit_inspection', 'vit_inspection_update',
      'overhead_line_inspection', 'overhead_line_inspection_update',
      'substation_inspection', 'substation_inspection_update',
      'equipment_failure_reporting', 'equipment_failure_reporting_update',
      'fault_reporting', 'fault_reporting_update',
      'op5_fault_management', 'op5_fault_management_update',
      'feeder_management', 'feeder_management_update',
      'user_management', 'user_management_update',
      'staff_ids_management', 'staff_ids_management_update',
      'district_population', 'district_population_update',
      'broadcast_messages', 'broadcast_messages_update',
      'chat_messages', 'chat_messages_update',
      'sms_notification', 'sms_notification_update'
    ],
    isActive: true
  },
  {
    name: 'technician',
    displayName: 'Technician',
    description: 'Field operations and basic system access',
    priority: 40,
    permissions: [
      'asset_management',
      'analytics_dashboard',
      'load_monitoring', 'load_monitoring_update',
      'vit_inspection', 'vit_inspection_update',
      'overhead_line_inspection', 'overhead_line_inspection_update',
      'substation_inspection', 'substation_inspection_update',
      'equipment_failure_reporting', 'equipment_failure_reporting_update',
      'fault_reporting', 'fault_reporting_update',
      'op5_fault_management', 'op5_fault_management_update',
      'feeder_management', 'feeder_management_update',
      'user_management', 'user_management_update',
      'staff_ids_management', 'staff_ids_management_update',
      'district_population', 'district_population_update',
      'broadcast_messages', 'broadcast_messages_update',
      'chat_messages', 'chat_messages_update',
      'sms_notification', 'sms_notification_update'
    ],
    isActive: true
  },
  {
    name: 'ict',
    displayName: 'ICT Specialist',
    description: 'Information and Communication Technology specialist',
    priority: 75,
    permissions: [
      'asset_management', 'asset_management_update', 'asset_management_delete',
      'analytics_dashboard', 'analytics_page',
      'fault_analytics', 'control_system_analytics',
      'load_monitoring', 'load_monitoring_update', 'load_monitoring_delete',
      'vit_inspection', 'vit_inspection_update', 'vit_inspection_delete',
      'overhead_line_inspection', 'overhead_line_inspection_update', 'overhead_line_inspection_delete',
      'substation_inspection', 'substation_inspection_update', 'substation_inspection_delete',
      'equipment_failure_reporting', 'equipment_failure_reporting_update', 'equipment_failure_reporting_delete',
      'fault_reporting', 'fault_reporting_update', 'fault_reporting_delete',
      'op5_fault_management', 'op5_fault_management_update', 'op5_fault_management_delete',
      'feeder_management', 'feeder_management_update', 'feeder_management_delete',
      'user_management', 'user_management_update', 'user_management_delete',
      'staff_ids_management', 'staff_ids_management_update', 'staff_ids_management_delete',
      'district_population', 'district_population_update', 'district_population_delete',
      'broadcast_messages', 'broadcast_messages_update', 'broadcast_messages_delete',
      'chat_messages', 'chat_messages_update', 'chat_messages_delete',
      'sms_notification', 'sms_notification_update', 'sms_notification_delete',
      'music_management', 'music_management_update', 'music_management_delete',
      'user_logs', 'user_logs_update', 'user_logs_delete', 'user_logs_delete_all'
    ],
    isActive: true
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'General administrative access',
    priority: 85,
    permissions: [
      'asset_management', 'asset_management_update', 'asset_management_delete',
      'analytics_dashboard', 'analytics_page',
      'fault_analytics', 'control_system_analytics',
      'load_monitoring', 'load_monitoring_update', 'load_monitoring_delete',
      'vit_inspection', 'vit_inspection_update', 'vit_inspection_delete',
      'overhead_line_inspection', 'overhead_line_inspection_update', 'overhead_line_inspection_delete',
      'substation_inspection', 'substation_inspection_update', 'substation_inspection_delete',
      'equipment_failure_reporting', 'equipment_failure_reporting_update', 'equipment_failure_reporting_delete',
      'fault_reporting', 'fault_reporting_update', 'fault_reporting_delete',
      'op5_fault_management', 'op5_fault_management_update', 'op5_fault_management_delete',
      'feeder_management', 'feeder_management_update', 'feeder_management_delete',
      'user_management', 'user_management_update', 'user_management_delete',
      'staff_ids_management', 'staff_ids_management_update', 'staff_ids_management_delete',
      'district_population', 'district_population_update', 'district_population_delete',
      'broadcast_messages', 'broadcast_messages_update', 'broadcast_messages_delete',
      'chat_messages', 'chat_messages_update', 'chat_messages_delete',
      'sms_notification', 'sms_notification_update', 'sms_notification_delete',
      'music_management', 'music_management_update', 'music_management_delete',
      'user_logs', 'user_logs_update', 'user_logs_delete', 'user_logs_delete_all'
    ],
    isActive: true
  },
  {
    name: 'pending',
    displayName: 'Pending Approval',
    description: 'User awaiting role assignment and approval',
    priority: 0,
    permissions: [],
    isActive: false
  }
];

// Existing features to migrate
const existingFeatures = [
  // Asset Management
  { name: 'asset_management', displayName: 'Asset Management', description: 'Access to asset management features', category: 'asset_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'asset_management_update', displayName: 'Asset Management Update', description: 'Update asset management data', category: 'asset_management', permissions: ['update'], isActive: true },
  { name: 'asset_management_delete', displayName: 'Asset Management Delete', description: 'Delete asset management data', category: 'asset_management', permissions: ['delete'], isActive: true },
  
  // User Management
  { name: 'user_management', displayName: 'User Management', description: 'Manage system users', category: 'user_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'user_management_update', displayName: 'User Management Update', description: 'Update user data', category: 'user_management', permissions: ['update'], isActive: true },
  { name: 'user_management_delete', displayName: 'User Management Delete', description: 'Delete users', category: 'user_management', permissions: ['delete'], isActive: true },
  
  // Staff ID Management
  { name: 'staff_ids_management', displayName: 'Staff ID Management', description: 'Manage staff identification', category: 'user_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'staff_ids_management_update', displayName: 'Staff ID Update', description: 'Update staff ID data', category: 'user_management', permissions: ['update'], isActive: true },
  { name: 'staff_ids_management_delete', displayName: 'Staff ID Delete', description: 'Delete staff ID data', category: 'user_management', permissions: ['delete'], isActive: true },
  
  // District Population
  { name: 'district_population', displayName: 'District Population', description: 'Access district population data', category: 'analytics', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'district_population_update', displayName: 'District Population Update', description: 'Update district population data', category: 'analytics', permissions: ['update'], isActive: true },
  { name: 'district_population_delete', displayName: 'District Population Delete', description: 'Delete district population data', category: 'analytics', permissions: ['delete'], isActive: true },
  
  // Load Monitoring
  { name: 'load_monitoring', displayName: 'Load Monitoring', description: 'Access load monitoring features', category: 'asset_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'load_monitoring_update', displayName: 'Load Monitoring Update', description: 'Update load monitoring data', category: 'asset_management', permissions: ['update'], isActive: true },
  { name: 'load_monitoring_delete', displayName: 'Load Monitoring Delete', description: 'Delete load monitoring data', category: 'asset_management', permissions: ['delete'], isActive: true },
  
  // VIT Inspection
  { name: 'vit_inspection', displayName: 'VIT Inspection', description: 'Access VIT inspection features', category: 'asset_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'vit_inspection_update', displayName: 'VIT Inspection Update', description: 'Update VIT inspection data', category: 'asset_management', permissions: ['update'], isActive: true },
  { name: 'vit_inspection_delete', displayName: 'VIT Inspection Delete', description: 'Delete VIT inspection data', category: 'asset_management', permissions: ['delete'], isActive: true },
  
  // Overhead Line Inspection
  { name: 'overhead_line_inspection', displayName: 'Overhead Line Inspection', description: 'Access overhead line inspection features', category: 'asset_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'overhead_line_inspection_update', displayName: 'Overhead Line Inspection Update', description: 'Update overhead line inspection data', category: 'asset_management', permissions: ['update'], isActive: true },
  { name: 'overhead_line_inspection_delete', displayName: 'Overhead Line Inspection Delete', description: 'Delete overhead line inspection data', category: 'asset_management', permissions: ['delete'], isActive: true },
  
  // Substation Inspection
  { name: 'substation_inspection', displayName: 'Substation Inspection', description: 'Access substation inspection features', category: 'asset_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'substation_inspection_update', displayName: 'Substation Inspection Update', description: 'Update substation inspection data', category: 'asset_management', permissions: ['update'], isActive: true },
  { name: 'substation_inspection_delete', displayName: 'Substation Inspection Delete', description: 'Delete substation inspection data', category: 'asset_management', permissions: ['delete'], isActive: true },
  
  // Equipment Failure Reporting
  { name: 'equipment_failure_reporting', displayName: 'Equipment Failure Reporting', description: 'Access equipment failure reporting features', category: 'asset_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'equipment_failure_reporting_update', displayName: 'Equipment Failure Reporting Update', description: 'Update equipment failure reports', category: 'asset_management', permissions: ['update'], isActive: true },
  { name: 'equipment_failure_reporting_delete', description: 'Delete equipment failure reports', category: 'asset_management', permissions: ['delete'], isActive: true },
  
  // Fault Management
  { name: 'fault_reporting', displayName: 'Fault Reporting', description: 'Access fault reporting features', category: 'fault_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'fault_reporting_update', displayName: 'Fault Reporting Update', description: 'Update fault reports', category: 'fault_management', permissions: ['update'], isActive: true },
  { name: 'fault_reporting_delete', displayName: 'Fault Reporting Delete', description: 'Delete fault reports', category: 'fault_management', permissions: ['delete'], isActive: true },
  
  // Analytics
  { name: 'analytics_dashboard', displayName: 'Analytics Dashboard', description: 'Access analytics dashboard', category: 'analytics', permissions: ['read'], isActive: true },
  { name: 'analytics_page', displayName: 'Analytics Page', description: 'Access analytics page', category: 'analytics', permissions: ['read'], isActive: true },
  { name: 'fault_analytics', displayName: 'Fault Analytics', description: 'Access fault analytics', category: 'analytics', permissions: ['read'], isActive: true },
  { name: 'control_system_analytics', displayName: 'Control System Analytics', description: 'Access control system analytics', category: 'analytics', permissions: ['read'], isActive: true },
  
  // Control Outage Management
  { name: 'control_outage_management', displayName: 'Control Outage Management', description: 'Access control outage management', category: 'fault_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'control_outage_management_update', displayName: 'Control Outage Update', description: 'Update control outage data', category: 'fault_management', permissions: ['update'], isActive: true },
  { name: 'control_outage_management_delete', displayName: 'Control Outage Delete', description: 'Delete control outage data', category: 'fault_management', permissions: ['delete'], isActive: true },
  
  // OP5 Fault Management
  { name: 'op5_fault_management', displayName: 'OP5 Fault Management', description: 'Access OP5 fault management', category: 'fault_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'op5_fault_management_update', displayName: 'OP5 Fault Update', description: 'Update OP5 fault data', category: 'fault_management', permissions: ['update'], isActive: true },
  { name: 'op5_fault_management_delete', displayName: 'OP5 Fault Delete', description: 'Delete OP5 fault data', category: 'fault_management', permissions: ['delete'], isActive: true },
  
  // Feeder Management
  { name: 'feeder_management', displayName: 'Feeder Management', description: 'Access feeder management features', category: 'asset_management', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'feeder_management_update', displayName: 'Feeder Management Update', description: 'Update feeder data', category: 'asset_management', permissions: ['update'], isActive: true },
  { name: 'feeder_management_delete', displayName: 'Feeder Management Delete', description: 'Delete feeder data', category: 'asset_management', permissions: ['delete'], isActive: true },
  
  // Communication
  { name: 'broadcast_messages', displayName: 'Broadcast Messages', description: 'Access broadcast message features', category: 'communication', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'broadcast_messages_update', displayName: 'Broadcast Messages Update', description: 'Update broadcast messages', category: 'communication', permissions: ['update'], isActive: true },
  { name: 'broadcast_messages_delete', displayName: 'Broadcast Messages Delete', description: 'Delete broadcast messages', category: 'communication', permissions: ['delete'], isActive: true },
  
  { name: 'chat_messages', displayName: 'Chat Messages', description: 'Access chat message features', category: 'communication', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'chat_messages_update', displayName: 'Chat Messages Update', description: 'Update chat messages', category: 'communication', permissions: ['update'], isActive: true },
  { name: 'chat_messages_delete', displayName: 'Chat Messages Delete', description: 'Delete chat messages', category: 'communication', permissions: ['delete'], isActive: true },
  
  { name: 'sms_notification', displayName: 'SMS Notification', description: 'Access SMS notification features', category: 'communication', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'sms_notification_update', displayName: 'SMS Notification Update', description: 'Update SMS notifications', category: 'communication', permissions: ['update'], isActive: true },
  { name: 'sms_notification_delete', displayName: 'SMS Notification Delete', description: 'Delete SMS notifications', category: 'communication', permissions: ['delete'], isActive: true },
  
  // System
  { name: 'user_logs', displayName: 'User Logs', description: 'Access user activity logs', category: 'system', permissions: ['read'], isActive: true },
  { name: 'user_logs_update', displayName: 'User Logs Update', description: 'Update user logs', category: 'system', permissions: ['update'], isActive: true },
  { name: 'user_logs_delete', displayName: 'User Logs Delete', description: 'Delete user logs', category: 'system', permissions: ['delete'], isActive: true },
  { name: 'user_logs_delete_all', displayName: 'User Logs Delete All', description: 'Delete all user logs', category: 'system', permissions: ['delete'], isActive: true },
  
  // Admin
  { name: 'music_management', displayName: 'Music Management', description: 'Access music management features', category: 'admin', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'music_management_update', displayName: 'Music Management Update', description: 'Update music data', category: 'admin', permissions: ['update'], isActive: true },
  { name: 'music_management_delete', displayName: 'Music Management Delete', description: 'Delete music data', category: 'admin', permissions: ['delete'], isActive: true },
  
  // Role Management (new)
  { name: 'role_management', displayName: 'Role Management', description: 'Manage dynamic roles and permissions', category: 'system', permissions: ['create', 'read', 'update', 'delete'], isActive: true },
  { name: 'feature_management', displayName: 'Feature Management', description: 'Manage system features', category: 'system', permissions: ['create', 'read', 'update', 'delete'], isActive: true }
];

async function migrateToDynamicRoles() {
  try {
    console.log('🚀 Starting migration to dynamic roles system...');
    
    // Create containers if they don't exist
    const rolesContainer = database.container('roles');
    const featuresContainer = database.container('features');
    
    console.log('📦 Migrating features...');
    let featuresMigrated = 0;
    let featuresSkipped = 0;
    
    for (const feature of existingFeatures) {
      try {
        const featureData = {
          id: feature.name,
          ...feature,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'migration_script',
          updatedBy: 'migration_script'
        };
        
        await featuresContainer.items.create(featureData);
        console.log(`✅ Feature migrated: ${feature.name}`);
        featuresMigrated++;
      } catch (error) {
        if (error.code === 409) { // Conflict - already exists
          console.log(`⏭️  Feature already exists: ${feature.name}`);
          featuresSkipped++;
        } else {
          console.error(`❌ Failed to migrate feature ${feature.name}:`, error.message);
        }
      }
    }
    
    console.log(`\n📊 Features migration summary:`);
    console.log(`   ✅ Migrated: ${featuresMigrated}`);
    console.log(`   ⏭️  Skipped: ${featuresSkipped}`);
    console.log(`   📝 Total: ${existingFeatures.length}`);
    
    console.log('\n👥 Migrating roles...');
    let rolesMigrated = 0;
    let rolesSkipped = 0;
    
    for (const role of existingRoles) {
      try {
        const roleData = {
          id: role.name,
          ...role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'migration_script',
          updatedBy: 'migration_script'
        };
        
        await rolesContainer.items.create(roleData);
        console.log(`✅ Role migrated: ${role.name}`);
        rolesMigrated++;
      } catch (error) {
        if (error.code === 409) { // Conflict - already exists
          console.log(`⏭️  Role already exists: ${role.name}`);
          rolesSkipped++;
        } else {
          console.error(`❌ Failed to migrate role ${role.name}:`, error.message);
        }
      }
    }
    
    console.log(`\n📊 Roles migration summary:`);
    console.log(`   ✅ Migrated: ${rolesMigrated}`);
    console.log(`   ⏭️  Skipped: ${rolesSkipped}`);
    console.log(`   📝 Total: ${existingRoles.length}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Access the Role Management page at /system-admin/role-management');
    console.log('   3. Review and adjust permissions as needed');
    console.log('   4. Update your PermissionService to use the new dynamic system');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToDynamicRoles();
