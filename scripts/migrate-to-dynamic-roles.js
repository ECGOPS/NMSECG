import { CosmosClient } from '@azure/cosmos';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../backend/.env') });

// Configuration
const COSMOS_ENDPOINT = process.env.COSMOS_DB_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_DB_KEY;
const COSMOS_DATABASE = process.env.COSMOS_DB_DATABASE_NAME || process.env.COSMOS_DB_DATABASE;

if (!COSMOS_ENDPOINT || !COSMOS_KEY || !COSMOS_DATABASE) {
  console.error('❌ Missing required environment variables:');
  console.error('   - COSMOS_DB_ENDPOINT');
  console.error('   - COSMOS_DB_KEY');
  console.error('   - COSMOS_DB_DATABASE_NAME or COSMOS_DB_DATABASE');
  process.exit(1);
}

const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const database = client.database(COSMOS_DATABASE);

// Existing roles to migrate
const existingRoles = [
  {
    name: 'system_admin',
    displayName: 'System Administrator',
    description: 'Full system access and control with all permissions',
    priority: 100,
    assignedFeatures: ['*'], // All permissions
    isActive: true
  },
  {
    name: 'global_engineer',
    displayName: 'Global Engineer',
    description: 'System-wide engineering access across all regions',
    priority: 90,
    assignedFeatures: [
      'asset_management', 'overhead_line_inspection', 'substation_inspection', 'vit_inspection',
      'equipment_failure_reporting', 'load_monitoring', 'fault_management', 'analytics',
      'control_system_analytics', 'broadcast_messages', 'chat', 'user_management',
      'staff_id_management', 'user_logs', 'role_management', 'feature_management'
    ],
    isActive: true
  },
  {
    name: 'regional_engineer',
    displayName: 'Regional Engineer',
    description: 'Regional engineering with district oversight',
    priority: 70,
    assignedFeatures: [
      'asset_management', 'overhead_line_inspection', 'substation_inspection', 'vit_inspection',
      'equipment_failure_reporting', 'load_monitoring', 'fault_management', 'analytics',
      'control_system_analytics', 'broadcast_messages', 'chat', 'user_logs'
    ],
    isActive: true
  },
  {
    name: 'district_engineer',
    displayName: 'District Engineer',
    description: 'District-level engineering and oversight',
    priority: 60,
    assignedFeatures: [
      'asset_management', 'overhead_line_inspection', 'substation_inspection', 'vit_inspection',
      'equipment_failure_reporting', 'load_monitoring', 'fault_management', 'analytics',
      'control_system_analytics', 'broadcast_messages', 'chat'
    ],
    isActive: true
  },
  {
    name: 'senior_technician',
    displayName: 'Senior Technician',
    description: 'Senior technical staff with broad access',
    priority: 50,
    assignedFeatures: [
      'asset_management', 'overhead_line_inspection', 'substation_inspection', 'vit_inspection',
      'equipment_failure_reporting', 'load_monitoring', 'fault_management', 'analytics',
      'control_system_analytics', 'broadcast_messages', 'chat'
    ],
    isActive: true
  },
  {
    name: 'technician',
    displayName: 'Technician',
    description: 'Technical staff with standard access',
    priority: 40,
    assignedFeatures: [
      'asset_management', 'overhead_line_inspection', 'substation_inspection', 'vit_inspection',
      'equipment_failure_reporting', 'load_monitoring', 'fault_management', 'analytics',
      'control_system_analytics', 'broadcast_messages', 'chat'
    ],
    isActive: true
  },
  {
    name: 'assistant_technician',
    displayName: 'Assistant Technician',
    description: 'Assistant technical staff with limited access',
    priority: 30,
    assignedFeatures: [
      'asset_management', 'overhead_line_inspection', 'substation_inspection', 'vit_inspection',
      'equipment_failure_reporting', 'load_monitoring', 'fault_management', 'analytics',
      'control_system_analytics', 'broadcast_messages', 'chat'
    ],
    isActive: true
  },
  {
    name: 'supervisor',
    displayName: 'Supervisor',
    description: 'Supervisory staff with oversight access',
    priority: 25,
    assignedFeatures: [
      'asset_management', 'analytics', 'control_system_analytics', 'broadcast_messages', 'chat'
    ],
    isActive: true
  },
  {
    name: 'operator',
    displayName: 'Operator',
    description: 'System operators with basic access',
    priority: 20,
    assignedFeatures: [
      'analytics', 'control_system_analytics', 'broadcast_messages', 'chat'
    ],
    isActive: true
  },
  {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to basic information',
    priority: 10,
    assignedFeatures: [
      'analytics', 'control_system_analytics'
    ],
    isActive: true
  }
];

// Existing features to migrate
const existingFeatures = [
  {
    name: 'asset_management',
    displayName: 'Asset Management',
    description: 'Access to asset management features including inspections and reporting',
    category: 'asset_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'overhead_line_inspection',
    displayName: 'Overhead Line Inspection',
    description: 'Manage overhead line inspection records',
    category: 'asset_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'substation_inspection',
    displayName: 'Substation Inspection',
    description: 'Manage substation inspection records',
    category: 'asset_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'vit_inspection',
    displayName: 'VIT Inspection',
    description: 'Manage VIT inspection records',
    category: 'asset_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'equipment_failure_reporting',
    displayName: 'Equipment Failure Reporting',
    description: 'Report and manage equipment failures',
    category: 'asset_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'load_monitoring',
    displayName: 'Load Monitoring',
    description: 'Monitor and manage load data',
    category: 'asset_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'fault_management',
    displayName: 'Fault Management',
    description: 'Manage system faults and issues',
    category: 'fault_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'analytics',
    displayName: 'Analytics',
    description: 'Access to analytics and reporting features',
    category: 'analytics',
    permissions: ['read'],
    isActive: true
  },
  {
    name: 'control_system_analytics',
    displayName: 'Control System Analytics',
    description: 'Access to control system analytics',
    category: 'analytics',
    permissions: ['read'],
    isActive: true
  },
  {
    name: 'broadcast_messages',
    displayName: 'Broadcast Messages',
    description: 'Send and manage broadcast messages',
    category: 'communication',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'chat',
    displayName: 'Chat',
    description: 'Access to chat functionality',
    category: 'communication',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'user_management',
    displayName: 'User Management',
    description: 'Manage user accounts and permissions',
    category: 'user_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'staff_id_management',
    displayName: 'Staff ID Management',
    description: 'Manage staff identification',
    category: 'user_management',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'user_logs',
    displayName: 'User Logs',
    description: 'Access to user activity logs',
    category: 'system',
    permissions: ['read'],
    isActive: true
  },
  {
    name: 'role_management',
    displayName: 'Role Management',
    description: 'Manage system roles and permissions',
    category: 'system',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  },
  {
    name: 'feature_management',
    displayName: 'Feature Management',
    description: 'Manage system features',
    category: 'system',
    permissions: ['create', 'read', 'update', 'delete'],
    isActive: true
  }
];

async function migrateRoles() {
  try {
    console.log('🔄 Starting roles migration...');
    
    // Get or create roles container
    let rolesContainer;
    try {
      rolesContainer = database.container('roles');
      await rolesContainer.read();
      console.log('✅ Roles container already exists');
    } catch (error) {
      if (error.code === 404) {
        console.log('📦 Creating roles container...');
        await database.containers.create({ id: 'roles' });
        rolesContainer = database.container('roles');
        console.log('✅ Roles container created');
      } else {
        throw error;
      }
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const role of existingRoles) {
      try {
        // Add timestamp and ID
        const roleData = {
          ...role,
          id: role.name, // Use name as ID for consistency
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await rolesContainer.items.create(roleData);
        console.log(`✅ Role migrated: ${role.displayName}`);
        migratedCount++;
      } catch (error) {
        if (error.code === 409) {
          console.log(`⏭️  Role already exists: ${role.displayName}`);
          skippedCount++;
        } else {
          console.error(`❌ Failed to migrate role ${role.displayName}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Roles migration summary:`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📦 Total: ${migratedCount + skippedCount}`);

  } catch (error) {
    console.error('❌ Roles migration failed:', error);
    throw error;
  }
}

async function migrateFeatures() {
  try {
    console.log('\n🔄 Starting features migration...');
    
    // Get or create features container
    let featuresContainer;
    try {
      featuresContainer = database.container('features');
      await featuresContainer.read();
      console.log('✅ Features container already exists');
    } catch (error) {
      if (error.code === 404) {
        console.log('📦 Creating features container...');
        await database.containers.create({ id: 'features' });
        featuresContainer = database.container('features');
        console.log('✅ Features container created');
      } else {
        throw error;
      }
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const feature of existingFeatures) {
      try {
        // Add timestamp and ID
        const featureData = {
          ...feature,
          id: feature.name, // Use name as ID for consistency
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await featuresContainer.items.create(featureData);
        console.log(`✅ Feature migrated: ${feature.displayName}`);
        migratedCount++;
      } catch (error) {
        if (error.code === 409) {
          console.log(`⏭️  Feature already exists: ${feature.displayName}`);
          skippedCount++;
        } else {
          console.error(`❌ Failed to migrate feature ${feature.displayName}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Features migration summary:`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📦 Total: ${migratedCount + skippedCount}`);

  } catch (error) {
    console.error('❌ Features migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting dynamic roles and features migration...\n');
    
    await migrateRoles();
    await migrateFeatures();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test the Role Management page');
    console.log('   3. Verify permissions are working correctly');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
main();
