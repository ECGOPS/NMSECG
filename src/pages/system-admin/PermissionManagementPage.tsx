import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { Shield, Users, Settings, Save, Plus, Trash2, Copy } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { DynamicRoleService } from '@/services/DynamicRoleService';

interface Permission {
  description: string;
  roles: string[];
}

interface Feature {
  description: string;
  permissions: {
    access: Permission;
    create: Permission;
    update: Permission;
    delete: Permission;
  };
}

interface Role {
  description: string;
  priority: number;
}

interface PermissionsConfig {
  features: { [key: string]: Feature };
  roles: { [key: string]: Role };
}

export default function PermissionManagementPage() {
  const [permissions, setPermissions] = useState<PermissionsConfig | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load permissions from backend
  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const dynamicRoleService = DynamicRoleService.getInstance();
      
      // Fetch permissions and roles in parallel
      const [permissionsResponse, dynamicRoles] = await Promise.all([
        apiRequest('/api/permissions').catch(() => null),
        dynamicRoleService.getRoles(true).catch(() => [])
      ]);
      
      // Start with permissions from backend if available, otherwise use empty structure
      let permissions: PermissionsConfig | null = permissionsResponse;
      
      // If permissions are loaded, merge in all dynamic roles
      if (permissions && dynamicRoles.length > 0) {
        // Add any missing roles from dynamic roles service
        const existingRoleKeys = Object.keys(permissions.roles || {});
        dynamicRoles.forEach(role => {
          const roleKey = role.name || role.id;
          if (!existingRoleKeys.includes(roleKey)) {
            permissions!.roles[roleKey] = {
              description: role.description || role.displayName || `Role: ${roleKey}`,
              priority: role.priority || 1
            };
          }
        });
      }
      
      // If permissions weren't loaded, we'll fall through to mock data
      if (permissions) {
        setPermissions(permissions);
        if (Object.keys(permissions.features).length > 0) {
          setSelectedFeature(Object.keys(permissions.features)[0]);
        }
        return;
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
    
    // Fallback: Try to get roles from dynamic service and use mock permissions data
    try {
      const dynamicRoleService = DynamicRoleService.getInstance();
      const dynamicRoles = await dynamicRoleService.getRoles(true).catch(() => []);
      
      // Fallback to mock data if backend fails
      const mockPermissions: PermissionsConfig = {
        features: {
          equipment_failure_reporting: {
            description: "Equipment Failure Reporting System",
            permissions: {
              access: {
                description: "Can view equipment failure reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new equipment failure reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing equipment failure reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete equipment failure reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          },
          overhead_line_inspection: {
            description: "Overhead Line Inspection System",
            permissions: {
              access: {
                description: "Can view overhead line inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new overhead line inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing overhead line inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete overhead line inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          },
          substation_inspection: {
            description: "Substation Inspection System",
            permissions: {
              access: {
                description: "Can view substation inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new substation inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing substation inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete substation inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          },
          load_monitoring: {
            description: "Load Monitoring System",
            permissions: {
              access: {
                description: "Can view load monitoring data",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new load monitoring records",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing load monitoring records",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete load monitoring records",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          },
          vit_inspection: {
            description: "VIT (Outdoor Switchgear) Inspection System",
            permissions: {
              access: {
                description: "Can view VIT inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new VIT inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing VIT inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete VIT inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          },
          control_system_outage: {
            description: "Control System Outage Management",
            permissions: {
              access: {
                description: "Can view control system outages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new control system outages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing control system outages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete control system outages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          },
          op5_faults: {
            description: "OP5 Fault Management System",
            permissions: {
              access: {
                description: "Can view OP5 faults",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new OP5 faults",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing OP5 faults",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete OP5 faults",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          },
          chat_messages: {
            description: "Chat & Messaging System",
            permissions: {
              access: {
                description: "Can view chat messages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can send chat messages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit chat messages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              delete: {
                description: "Can delete chat messages",
                roles: ["system_admin", "admin", "global_engineer"]
              }
            }
          },
          broadcast_messages: {
            description: "Broadcast Message System",
            permissions: {
              access: {
                description: "Can view broadcast messages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create broadcast messages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              update: {
                description: "Can edit broadcast messages",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              delete: {
                description: "Can delete broadcast messages",
                roles: ["system_admin", "admin", "global_engineer"]
              }
            }
          },
          music_management: {
            description: "Music & Audio Management",
            permissions: {
              access: {
                description: "Can access music files",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can upload music files",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              update: {
                description: "Can edit music metadata",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              delete: {
                description: "Can delete music files",
                roles: ["system_admin", "admin"]
              }
            }
          },
          photo_management: {
            description: "Photo & Image Management",
            permissions: {
              access: {
                description: "Can view photos and images",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can upload photos and images",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit photo metadata",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              delete: {
                description: "Can delete photos and images",
                roles: ["system_admin", "admin", "global_engineer"]
              }
            }
          },
          district_population: {
            description: "District Population Management",
            permissions: {
              access: {
                description: "Can view district population data",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              create: {
                description: "Can create district population records",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer"]
              },
              update: {
                description: "Can edit district population data",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer"]
              },
              delete: {
                description: "Can delete district population records",
                roles: ["system_admin", "admin"]
              }
            }
          },
          staff_management: {
            description: "Staff ID Management",
            permissions: {
              access: {
                description: "Can view staff information",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              create: {
                description: "Can create staff records",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              update: {
                description: "Can edit staff information",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              delete: {
                description: "Can delete staff records",
                roles: ["system_admin", "admin"]
              }
            }
          },
          security_monitoring: {
            description: "Security Event Monitoring",
            permissions: {
              access: {
                description: "Can view security events",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              create: {
                description: "Can create security event records",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              update: {
                description: "Can edit security events",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              delete: {
                description: "Can delete security events",
                roles: ["system_admin", "admin"]
              }
            }
          },
          user_management: {
            description: "User Management System",
            permissions: {
              access: {
                description: "Can view users",
                roles: ["system_admin", "admin", "global_engineer"]
              },
              create: {
                description: "Can create new users",
                roles: ["system_admin", "admin"]
              },
              update: {
                description: "Can edit existing users",
                roles: ["system_admin", "admin"]
              },
              delete: {
                description: "Can delete users",
                roles: ["system_admin"]
              }
            }
          },
          role_management: {
            description: "Role Management System",
            permissions: {
              access: {
                description: "Can view roles",
                roles: ["system_admin", "admin"]
              },
              create: {
                description: "Can create new roles",
                roles: ["system_admin"]
              },
              update: {
                description: "Can edit existing roles",
                roles: ["system_admin"]
              },
              delete: {
                description: "Can delete roles",
                roles: ["system_admin"]
              }
            }
          },
          fault_analytics: {
            description: "Fault Analytics & Reporting System",
            permissions: {
              access: {
                description: "Can view fault analytics and reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician"]
              },
              create: {
                description: "Can create fault analysis reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              update: {
                description: "Can edit fault analysis reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              delete: {
                description: "Can delete fault analysis reports",
                roles: ["system_admin", "admin"]
              }
            }
          },
          control_system_analytics: {
            description: "Control System Analytics & Performance",
            permissions: {
              access: {
                description: "Can view control system analytics",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician"]
              },
              create: {
                description: "Can create control system reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              update: {
                description: "Can edit control system reports",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              },
              delete: {
                description: "Can delete control system reports",
                roles: ["system_admin", "admin"]
              }
            }
          },
          substation_status: {
            description: "Substation Status Inspection System",
            permissions: {
              access: {
                description: "Can view substation status inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              create: {
                description: "Can create new substation status inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician", "assistant_technician"]
              },
              update: {
                description: "Can edit existing substation status inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer", "senior_technician", "technician"]
              },
              delete: {
                description: "Can delete substation status inspections",
                roles: ["system_admin", "admin", "global_engineer", "regional_engineer", "district_engineer"]
              }
            }
          }
        },
        roles: {
          system_admin: { description: "System Administrator - Full access to all features", priority: 10 },
          admin: { description: "Administrator - Full access to all features", priority: 9 },
          global_engineer: { description: "Global Engineer - Access to all regions and districts", priority: 8 },
          regional_general_manager: { description: "Regional General Manager - Access to specific region", priority: 7.5 },
          regional_engineer: { description: "Regional Engineer - Access to specific region", priority: 7 },
          project_engineer: { description: "Project Engineer - Access to specific region", priority: 6.5 },
          district_manager: { description: "District Manager - Access to specific district", priority: 6.2 },
          district_engineer: { description: "District Engineer - Access to specific district", priority: 6 },
          ashsubt: { description: "Ashanti Subtransmission Engineer - Access to Ashanti subtransmission regions", priority: 7 },
          accsubt: { description: "Accra Subtransmission Engineer - Access to Accra subtransmission regions", priority: 7 },
          ict: { description: "ICT - Information and Communication Technology", priority: 5.5 },
          senior_technician: { description: "Senior Technician - Limited access within district", priority: 5 },
          technician: { description: "Technician - Limited access within district", priority: 4 },
          assistant_technician: { description: "Assistant Technician - Limited access within district", priority: 3 }
        }
      };

      // Merge dynamic roles into mock roles
      if (dynamicRoles.length > 0) {
        dynamicRoles.forEach(role => {
          const roleKey = role.name || role.id;
          if (!mockPermissions.roles[roleKey]) {
            mockPermissions.roles[roleKey] = {
              description: role.description || role.displayName || `Role: ${roleKey}`,
              priority: role.priority || 1
            };
          }
        });
      }
      
      setPermissions(mockPermissions);
      if (Object.keys(mockPermissions.features).length > 0) {
        setSelectedFeature(Object.keys(mockPermissions.features)[0]);
      }
    } catch (fallbackError) {
      console.error('Error in fallback:', fallbackError);
      toast.error('Failed to load permissions from backend');
    }
  };

  const handlePermissionChange = (feature: string, action: string, role: string, checked: boolean) => {
    if (!permissions) return;

    setPermissions(prev => {
      if (!prev) return prev;

      const newPermissions = { ...prev };
      const featurePermissions = newPermissions.features[feature].permissions[action as 'access' | 'create' | 'update' | 'delete'];

      if (checked && !featurePermissions.roles.includes(role)) {
        featurePermissions.roles.push(role);
      } else if (!checked && featurePermissions.roles.includes(role)) {
        featurePermissions.roles = featurePermissions.roles.filter(r => r !== role);
      }

      setHasChanges(true);
      return newPermissions;
    });
  };

  const handleSavePermissions = async () => {
    try {
      // Save to backend API using apiRequest
      await apiRequest('/api/permissions', {
        method: 'PUT',
        body: JSON.stringify(permissions)
      });

      toast.success('Permissions saved successfully!');
      setHasChanges(false);
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to save permissions');
      console.error('Error saving permissions:', error);
    }
  };

  const addNewRole = () => {
    const roleName = prompt('Enter new role name:');
    if (roleName && permissions) {
      setPermissions(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          roles: {
            ...prev.roles,
            [roleName]: {
              description: `New role: ${roleName}`,
              priority: 1
            }
          }
        };
      });
      setHasChanges(true);
    }
  };

  if (!permissions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading permissions...</p>
        </div>
      </div>
    );
  }

  const features = Object.keys(permissions.features);
  const roles = Object.keys(permissions.roles);

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Permission Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Manage role-based access control for all system features
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {isEditing && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} size="sm" className="w-full sm:w-auto">
                Cancel
            </Button>
              <Button onClick={handleSavePermissions} disabled={!hasChanges} size="sm" className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          )}
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} size="sm" className="w-full sm:w-auto">
              <Settings className="h-4 w-4 mr-2" />
              Edit Permissions
            </Button>
          )}
            </div>
          </div>

      <Tabs defaultValue="feature-based" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feature-based" className="text-xs sm:text-sm">Feature-Based View</TabsTrigger>
          <TabsTrigger value="role-based" className="text-xs sm:text-sm">Role-Based View</TabsTrigger>
        </TabsList>

        <TabsContent value="feature-based" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Feature Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <Label htmlFor="feature-select" className="text-sm sm:text-base">Select Feature:</Label>
                  <Select value={selectedFeature} onValueChange={setSelectedFeature}>
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue placeholder="Choose a feature" />
                    </SelectTrigger>
                    <SelectContent>
                      {features.map(feature => (
                        <SelectItem key={feature} value={feature}>
                          {permissions.features[feature].description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
        </div>

                {selectedFeature && (
                  <div className="space-y-4">
                    <h3 className="text-base sm:text-lg font-semibold text-blue-600">
                      {permissions.features[selectedFeature].description}
                    </h3>
                    
                    {Object.entries(permissions.features[selectedFeature].permissions).map(([action, permission]) => (
                      <div key={action} className="border rounded-lg p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                          <div>
                            <h4 className="font-medium capitalize text-sm sm:text-base">{action}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground">{permission.description}</p>
              </div>
                          <Badge variant="outline" className="text-xs">{permission.roles.length} roles</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                          {roles.map(role => (
                            <div key={role} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${selectedFeature}-${action}-${role}`}
                                checked={permission.roles.includes(role)}
                                onCheckedChange={(checked) => 
                                  handlePermissionChange(selectedFeature, action, role, checked as boolean)
                                }
                                disabled={!isEditing}
                              />
                              <Label 
                                htmlFor={`${selectedFeature}-${action}-${role}`}
                                className="text-xs sm:text-sm cursor-pointer"
                              >
                                {role}
                              </Label>
                      </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="role-based" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                  Role Management
                </CardTitle>
                <Button onClick={addNewRole} variant="outline" size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
            </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roles.map(role => (
                  <div key={role} className="border rounded-lg p-3 sm:p-4">
                    <div className="mb-3">
                      <div>
                        <h4 className="font-medium text-sm sm:text-base">{role}</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {permissions.roles[role].description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Priority: {permissions.roles[role].priority}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                      {features.map(feature => (
                        <div key={feature} className="text-xs sm:text-sm">
                          <div className="font-medium text-blue-600 mb-2">
                            {permissions.features[feature].description}
                          </div>
                          <div className="space-y-1">
                            {Object.entries(permissions.features[feature].permissions).map(([action, permission]) => (
                              <div key={action} className="flex items-center space-x-2">
                        <Checkbox
                                  id={`${role}-${feature}-${action}`}
                                  checked={permission.roles.includes(role)}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(feature, action, role, checked as boolean)
                                  }
                                  disabled={!isEditing}
                                />
                                <Label 
                                  id={`${role}-${feature}-${action}`}
                                  className="text-xs cursor-pointer capitalize"
                                >
                                  {action}
                                </Label>
                              </div>
                            ))}
                      </div>
                      </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {hasChanges && (
        <div className="fixed bottom-3 sm:bottom-6 right-3 sm:right-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 shadow-lg max-w-[calc(100vw-1.5rem)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-xs sm:text-sm font-medium">You have unsaved changes</span>
              </div>
            </div>
      )}
      </div>
  );
} 
