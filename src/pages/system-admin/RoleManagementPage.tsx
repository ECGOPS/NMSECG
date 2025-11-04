import React, { useState, useEffect } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/sonner';
import { Loader2, Plus, Edit, Trash2, Shield, Users, Settings, Save, X, Check, History, BarChart3, LayoutDashboard, Music, Database } from 'lucide-react';
import { DynamicRoleService, DynamicRole, DynamicFeature } from '@/services/DynamicRoleService';
import { PermissionService } from '@/services/PermissionService';
import { useData } from '@/contexts/DataContext';
import { Link } from 'react-router-dom';

export default function RoleManagementPage() {
  const { user } = useAzureADAuth();
  const { regions, districts } = useData();
  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [features, setFeatures] = useState<DynamicFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form states
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DynamicRole | null>(null);
  const [editingFeature, setEditingFeature] = useState<DynamicFeature | null>(null);
  
  // Role form
  const [roleForm, setRoleForm] = useState({
    name: '',
    displayName: '',
    description: '',
    priority: 50,
    permissions: [] as string[],
    allowedRegions: [] as string[],
    allowedDistricts: [] as string[],
    accessLevel: 'global' as 'global' | 'regional' | 'district',
    isActive: true
  });
  
  // Feature form
  const [featureForm, setFeatureForm] = useState({
    name: '',
    displayName: '',
    description: '',
    category: '',
    permissions: {
      access: [] as string[],
      create: [] as string[],
      update: [] as string[],
      delete: [] as string[]
    },
    isActive: true
  });
  
  const dynamicRoleService = DynamicRoleService.getInstance();
  const permissionService = PermissionService.getInstance();
  
  // Check permissions
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [canManageFeatures, setCanManageFeatures] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      if (user) {
        console.log(`[RoleManagementPage] 👤 User info:`, { id: user.id, role: user.role, name: user.name });
        console.log(`[RoleManagementPage] 🔍 Checking permissions for role: ${user.role}`);
        
        // Debug: Log user role
        console.log(`[RoleManagementPage] 🔍 User role: "${user.role}"`);
        
        const rolesPermission = await permissionService.canAccessFeature(user.role, 'role_management');
        const featuresPermission = await permissionService.canAccessFeature(user.role, 'feature_management');
        
        console.log(`[RoleManagementPage] 🎯 Role management permission: ${rolesPermission}`);
        console.log(`[RoleManagementPage] 🎯 Feature management permission: ${featuresPermission}`);
        
        setCanManageRoles(rolesPermission);
        setCanManageFeatures(featuresPermission);
      }
    };

    checkPermissions();
  }, [user, permissionService]);
  
  useEffect(() => {
    if (!canManageRoles && !canManageFeatures) {
      toast.error("You don't have permission to manage roles and features");
      return;
    }
    fetchData();
  }, [canManageRoles, canManageFeatures]);
  
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rolesData, featuresData] = await Promise.all([
        dynamicRoleService.getRoles(true),
        dynamicRoleService.getFeatures(true)
      ]);
      
      // Debug: Log the actual data structure
      console.log('🔧 [RoleManagementPage] Roles data received:', rolesData);
      console.log('🔧 [RoleManagementPage] Features data received:', featuresData);
      
      // Debug: Check filtered roles count
      const validRoles = rolesData.filter(role => role && role.id && role.name);
      console.log('🔧 [RoleManagementPage] Total roles:', rolesData.length);
      console.log('🔧 [RoleManagementPage] Valid roles (after filter):', validRoles.length);
      console.log('🔧 [RoleManagementPage] Invalid roles:', rolesData.length - validRoles.length);
      
      // Debug: Show which roles are being filtered out
      if (validRoles.length !== rolesData.length) {
        console.log('🔧 [RoleManagementPage] Roles being filtered out:');
        rolesData.forEach((role, index) => {
          const isValid = role && role.id && role.name;
          if (!isValid) {
            console.log(`   ${index + 1}. Role:`, role);
          }
        });
      }
      
      // Debug: Check if roles have permissions property
      if (rolesData && rolesData.length > 0) {
        console.log('🔧 [RoleManagementPage] First role structure:', {
          id: rolesData[0].id,
          name: rolesData[0].name,
          hasPermissions: 'permissions' in rolesData[0],
          permissionsType: typeof rolesData[0].permissions,
          permissionsValue: rolesData[0].permissions
        });
        
        // Debug: Check for null/undefined values in roles
        console.log('🔧 [RoleManagementPage] Checking for null values in roles:');
        rolesData.forEach((role, index) => {
          if (!role || !role.id || !role.name) {
            console.warn(`⚠️ [RoleManagementPage] Role at index ${index} has issues:`, role);
          }
        });
      }
      
      setRoles(rolesData);
      setFeatures(featuresData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch roles and features');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateRole = async () => {
    try {
      setIsCreating(true);
      const newRole = await dynamicRoleService.createRole(roleForm);
      setRoles(prev => [...prev, newRole]);
      
      // Refresh PermissionService cache so changes take effect immediately
      await permissionService.refreshPermissions();
      
      setIsRoleDialogOpen(false);
      resetRoleForm();
      toast.success('Role created successfully');
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error('Failed to create role');
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleUpdateRole = async () => {
    if (!editingRole) return;
    
    try {
      setIsUpdating(true);
      const updatedRole = await dynamicRoleService.updateRole(editingRole.id, roleForm);
      setRoles(prev => prev.map(r => r.id === editingRole.id ? updatedRole : r));
      
      // Refresh PermissionService cache so changes take effect immediately
      await permissionService.refreshPermissions();
      
      setIsRoleDialogOpen(false);
      setEditingRole(null);
      resetRoleForm();
      toast.success('Role updated successfully');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDeleteRole = async (roleId: string) => {
    try {
      setIsDeleting(true);
      await dynamicRoleService.deleteRole(roleId);
      setRoles(prev => prev.filter(r => r.id !== roleId));
      
      // Refresh PermissionService cache so changes take effect immediately
      await permissionService.refreshPermissions();
      
      toast.success('Role deleted successfully');
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleCreateFeature = async () => {
    try {
      setIsCreating(true);
      const newFeature = await dynamicRoleService.createFeature(featureForm);
      setFeatures(prev => [...prev, newFeature]);
      setIsFeatureDialogOpen(false);
      resetFeatureForm();
      toast.success('Feature created successfully');
    } catch (error) {
      console.error('Error creating feature:', error);
      toast.error('Failed to create feature');
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleUpdateFeature = async () => {
    if (!editingFeature) return;
    
    try {
      setIsUpdating(true);
      const updatedFeature = await dynamicRoleService.updateFeature(editingFeature.id, featureForm);
      setFeatures(prev => prev.map(f => f.id === editingFeature.id ? updatedFeature : f));
      setIsFeatureDialogOpen(false);
      setEditingFeature(null);
      resetFeatureForm();
      toast.success('Feature updated successfully');
    } catch (error) {
      console.error('Error updating feature:', error);
      toast.error('Failed to update feature');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDeleteFeature = async (featureId: string) => {
    try {
      setIsDeleting(true);
      await dynamicRoleService.deleteFeature(featureId);
      setFeatures(prev => prev.filter(f => f.id !== featureId));
      toast.success('Feature deleted successfully');
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Failed to delete feature');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const openRoleDialog = (role?: DynamicRole) => {
    if (role) {
      setEditingRole(role);
      // Handle both 'permissions' and 'assignedFeatures' fields for backward compatibility
      const rolePermissions = role.permissions || role.assignedFeatures || [];
      
      setRoleForm({
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        priority: role.priority,
        permissions: rolePermissions,
        allowedRegions: role.allowedRegions || [],
        allowedDistricts: role.allowedDistricts || [],
        accessLevel: role.accessLevel || 'global',
        isActive: role.isActive
      });
    } else {
      setEditingRole(null);
      resetRoleForm();
    }
    setIsRoleDialogOpen(true);
  };
  
  const openFeatureDialog = (feature?: DynamicFeature) => {
    if (feature) {
      setEditingFeature(feature);
      // Ensure permissions object has the correct structure
      const safePermissions = feature.permissions && typeof feature.permissions === 'object' 
        ? {
            access: Array.isArray(feature.permissions.access) ? feature.permissions.access : [],
            create: Array.isArray(feature.permissions.create) ? feature.permissions.create : [],
            update: Array.isArray(feature.permissions.update) ? feature.permissions.update : [],
            delete: Array.isArray(feature.permissions.delete) ? feature.permissions.delete : []
          }
        : {
            access: [] as string[],
            create: [] as string[],
            update: [] as string[],
            delete: [] as string[]
          };
      
      setFeatureForm({
        name: feature.name,
        displayName: feature.displayName,
        description: feature.description,
        category: feature.category,
        permissions: safePermissions,
        isActive: feature.isActive
      });
    } else {
      setEditingFeature(null);
      resetFeatureForm();
    }
    setIsFeatureDialogOpen(true);
  };
  
  const resetRoleForm = () => {
    setRoleForm({
      name: '',
      displayName: '',
      description: '',
      priority: 50,
      permissions: [],
      allowedRegions: [],
      allowedDistricts: [],
      accessLevel: 'global',
      isActive: true
    });
  };
  
  const resetFeatureForm = () => {
    setFeatureForm({
      name: '',
      displayName: '',
      description: '',
      category: '',
      permissions: {
        access: [] as string[],
        create: [] as string[],
        update: [] as string[],
        delete: [] as string[]
      },
      isActive: true
    });
  };
  
  const togglePermission = (permission: string, isRole: boolean = true) => {
    if (isRole) {
      setRoleForm(prev => ({
        ...prev,
        permissions: prev.permissions.includes(permission)
          ? prev.permissions.filter(p => p !== permission)
          : [...prev.permissions, permission]
      }));
    } else {
      // For features, we need to handle the new permissions structure
      // This function is called when toggling feature permissions
      // We'll add the permission to the access array by default
      setFeatureForm(prev => {
        // Ensure permissions object has the correct structure
        const safePermissions = prev.permissions && typeof prev.permissions === 'object'
          ? {
              access: Array.isArray(prev.permissions.access) ? prev.permissions.access : [],
              create: Array.isArray(prev.permissions.create) ? prev.permissions.create : [],
              update: Array.isArray(prev.permissions.update) ? prev.permissions.update : [],
              delete: Array.isArray(prev.permissions.delete) ? prev.permissions.delete : []
            }
          : {
              access: [] as string[],
              create: [] as string[],
              update: [] as string[],
              delete: [] as string[]
            };
        
        return {
          ...prev,
          permissions: {
            ...safePermissions,
            access: safePermissions.access.includes(permission)
              ? safePermissions.access.filter(p => p !== permission)
              : [...safePermissions.access, permission]
          }
        };
      });
    }
  };
  
  if (!canManageRoles && !canManageFeatures) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-slate-200">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to manage roles and features.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Role & Feature Management</h1>
                <p className="text-slate-600 mt-1 text-sm sm:text-base">Dynamically manage user roles and system features</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
              <Button
                onClick={() => openRoleDialog()}
                disabled={!canManageRoles}
                className="flex items-center space-x-2 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>New Role</span>
              </Button>
              <Button
                onClick={() => openFeatureDialog()}
                disabled={!canManageFeatures}
                variant="outline"
                className="flex items-center space-x-2 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>New Feature</span>
              </Button>
              <Button
                onClick={() => {
                  console.log('🔄 Force refreshing features...');
                  dynamicRoleService.clearCache();
                  window.location.reload();
                }}
                variant="outline"
                className="flex items-center space-x-2 w-full sm:w-auto"
              >
                <span>🔄 Force Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/system-admin/permissions" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Permission Management</span>
                </div>
                <span className="text-sm text-muted-foreground">Manage feature access permissions</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/user-management" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <span className="font-medium">User Management</span>
                </div>
                <span className="text-sm text-muted-foreground">Manage system users and assignments</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/system-admin/security" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-600" />
                  <span className="font-medium">Security Monitoring</span>
                </div>
                <span className="text-sm text-muted-foreground">Monitor system security status</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/user-logs" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-600" />
                  <span className="font-medium">User Activity Logs</span>
                </div>
                <span className="text-sm text-muted-foreground">View user activity and audit trails</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/district-population" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  <span className="font-medium">District Population</span>
                </div>
                <span className="text-sm text-muted-foreground">Manage district user assignments</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/analytics" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Analytics Dashboard</span>
                </div>
                <span className="text-sm text-muted-foreground">View system analytics and reports</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/dashboard" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 text-teal-600" />
                  <span className="font-medium">Main Dashboard</span>
                </div>
                <span className="text-sm text-muted-foreground">Return to main system dashboard</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/admin/music" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-pink-600" />
                  <span className="font-medium">Music Management</span>
                </div>
                <span className="text-sm text-muted-foreground">Manage background music settings</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-auto p-4 justify-start text-left"
            >
              <Link to="/test/feeder-offline" className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-gray-600" />
                  <span className="font-medium">Feeder Offline Test</span>
                </div>
                <span className="text-sm text-muted-foreground">Test feeder offline functionality</span>
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <Tabs defaultValue="roles" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="roles" className="flex items-center space-x-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Roles ({roles.filter(role => role && role.id && role.name).length})</span>
              <span className="sm:hidden">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center space-x-2 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Features ({features.length})</span>
              <span className="sm:hidden">Features</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span>System Roles</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block">
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role Name</TableHead>
                          <TableHead>Display Name</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Access Level</TableHead>
                          <TableHead>Permissions</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roles.filter(role => role && role.id && role.name).map((role) => (
                          <TableRow key={role.id}>
                            <TableCell className="font-mono text-sm">{role.name}</TableCell>
                            <TableCell className="font-medium">{role.displayName || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{role.priority || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant="outline" className="capitalize">
                                  {role.accessLevel || 'global'}
                                </Badge>
                                {role.accessLevel === 'regional' && role.allowedRegions && role.allowedRegions.length > 0 && (
                                  <div className="text-xs text-gray-600">
                                    Regions: {role.allowedRegions.length}
                                  </div>
                                )}
                                {role.accessLevel === 'district' && role.allowedDistricts && role.allowedDistricts.length > 0 && (
                                  <div className="text-xs text-gray-600">
                                    Districts: {role.allowedDistricts.length}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(role.permissions || role.assignedFeatures || []).slice(0, 3).map((perm) => (
                                  <Badge key={perm} variant="secondary" className="text-xs">
                                    {perm}
                                  </Badge>
                                ))}
                                {(role.permissions || role.assignedFeatures || []).length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{(role.permissions || role.assignedFeatures || []).length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={role.isActive ? "default" : "secondary"}>
                                {role.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRoleDialog(role)}
                                  disabled={!canManageRoles}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={!canManageRoles || role.name === 'system_admin'}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the role "{role.displayName || 'Unknown'}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteRole(role.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-3">
                      {roles.filter(role => role && role.id && role.name).map((role) => (
                        <div key={role.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="font-mono text-sm font-medium">{role.name}</h3>
                              <p className="font-medium text-sm">{role.displayName || 'N/A'}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={role.isActive ? "default" : "secondary"} className="text-xs">
                                {role.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{role.priority || 'N/A'}</Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600">Access:</span>
                              <Badge variant="outline" className="capitalize text-xs">
                                {role.accessLevel || 'global'}
                              </Badge>
                            </div>
                            
                            {role.accessLevel === 'regional' && role.allowedRegions && role.allowedRegions.length > 0 && (
                              <div className="text-xs text-gray-600">
                                Regions: {role.allowedRegions.length}
                              </div>
                            )}
                            {role.accessLevel === 'district' && role.allowedDistricts && role.allowedDistricts.length > 0 && (
                              <div className="text-xs text-gray-600">
                                Districts: {role.allowedDistricts.length}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <span className="text-xs text-gray-600">Permissions:</span>
                            <div className="flex flex-wrap gap-1">
                              {(role.permissions || role.assignedFeatures || []).slice(0, 3).map((perm) => (
                                <Badge key={perm} variant="secondary" className="text-xs">
                                  {perm}
                                </Badge>
                              ))}
                              {(role.permissions || role.assignedFeatures || []).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(role.permissions || role.assignedFeatures || []).length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex space-x-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRoleDialog(role)}
                              disabled={!canManageRoles}
                              className="flex-1"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={!canManageRoles || role.name === 'system_admin'}
                                  className="flex-1"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the role "{role.displayName || 'Unknown'}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteRole(role.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Features Tab */}
          <TabsContent value="features" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-green-600" />
                  <span>System Features</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block">
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Feature Name</TableHead>
                          <TableHead>Display Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Permissions</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {features.filter(feature => feature && feature.id && feature.name).map((feature) => (
                          <TableRow key={feature.id}>
                            <TableCell className="font-mono text-sm">{feature.name}</TableCell>
                            <TableCell className="font-medium">{feature.displayName || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{feature.category || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {feature.permissions && (
                                  <>
                                    {Object.entries(feature.permissions).slice(0, 3).map(([permType, roles]) => (
                                      <Badge key={permType} variant="secondary" className="text-xs">
                                        {permType}: {roles.length}
                                      </Badge>
                                    ))}
                                    {Object.keys(feature.permissions).length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{Object.keys(feature.permissions).length - 3} more
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={feature.isActive ? "default" : "secondary"}>
                                {feature.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openFeatureDialog(feature)}
                                  disabled={!canManageFeatures}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={!canManageFeatures}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Feature</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the feature "{feature.displayName || 'Unknown'}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteFeature(feature.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-3">
                      {features.filter(feature => feature && feature.id && feature.name).map((feature) => (
                        <div key={feature.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="font-mono text-sm font-medium">{feature.name}</h3>
                              <p className="font-medium text-sm">{feature.displayName || 'N/A'}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={feature.isActive ? "default" : "secondary"} className="text-xs">
                                {feature.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">{feature.category || 'N/A'}</Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-xs text-gray-600">Permissions:</span>
                            <div className="flex flex-wrap gap-1">
                              {feature.permissions && (
                                <>
                                  {Object.entries(feature.permissions).slice(0, 3).map(([permType, roles]) => (
                                    <Badge key={permType} variant="secondary" className="text-xs">
                                      {permType}: {roles.length}
                                    </Badge>
                                  ))}
                                  {Object.keys(feature.permissions).length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{Object.keys(feature.permissions).length - 3} more
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex space-x-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openFeatureDialog(feature)}
                              disabled={!canManageFeatures}
                              className="flex-1"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={!canManageFeatures}
                                  className="flex-1"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Feature</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the feature "{feature.displayName || 'Unknown'}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteFeature(feature.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Role Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {editingRole ? 'Modify the role details and permissions' : 'Create a new role with specific permissions'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name *</Label>
                  <Input
                    id="roleName"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., senior_engineer"
                    disabled={!!editingRole} // Can't change role name after creation
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rolePriority">Priority *</Label>
                  <Input
                    id="rolePriority"
                    type="number"
                    value={roleForm.priority}
                    onChange={(e) => setRoleForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    placeholder="50"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="roleDisplayName">Display Name *</Label>
                <Input
                  id="roleDisplayName"
                  value={roleForm.displayName}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g., Senior Engineer"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="roleDescription">Description</Label>
                <Textarea
                  id="roleDescription"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the role's responsibilities and access level"
                  rows={3}
                />
              </div>
              
              {/* NEW: Access Level and Region/District Control */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roleAccessLevel">Access Level *</Label>
                  <Select
                    value={roleForm.accessLevel}
                    onValueChange={(value: 'global' | 'regional' | 'district') => 
                      setRoleForm(prev => ({ ...prev, accessLevel: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select access level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (Access to all regions/districts)</SelectItem>
                      <SelectItem value="regional">Regional (Access to specific regions only)</SelectItem>
                      <SelectItem value="district">District (Access to specific districts only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {roleForm.accessLevel === 'regional' && (
                  <div className="space-y-2">
                    <Label>Allowed Regions *</Label>
                    <div className="flex flex-col sm:flex-row gap-2 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allRegionIds = regions?.map(r => r.id) || [];
                          setRoleForm(prev => ({
                            ...prev,
                            allowedRegions: allRegionIds
                          }));
                        }}
                        className="text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Check All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoleForm(prev => ({
                            ...prev,
                            allowedRegions: []
                          }));
                        }}
                        className="text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Uncheck All
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                      {regions?.map((region) => (
                        <div key={region.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`region-${region.id}`}
                            checked={roleForm.allowedRegions.includes(region.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRoleForm(prev => ({
                                  ...prev,
                                  allowedRegions: [...prev.allowedRegions, region.id]
                                }));
                              } else {
                                setRoleForm(prev => ({
                                  ...prev,
                                  allowedRegions: prev.allowedRegions.filter(id => id !== region.id)
                                }));
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`region-${region.id}`} className="text-sm cursor-pointer">
                            {region.name} (ID: {region.id})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {roleForm.accessLevel === 'district' && (
                  <div className="space-y-2">
                    <Label>Allowed Districts *</Label>
                    <div className="flex flex-col sm:flex-row gap-2 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allDistrictIds = districts?.map(d => d.id) || [];
                          setRoleForm(prev => ({
                            ...prev,
                            allowedDistricts: allDistrictIds
                          }));
                        }}
                        className="text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Check All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoleForm(prev => ({
                            ...prev,
                            allowedDistricts: []
                          }));
                        }}
                        className="text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Uncheck All
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                      {districts?.map((district) => (
                        <div key={district.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`district-${district.id}`}
                            checked={roleForm.allowedDistricts.includes(district.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRoleForm(prev => ({
                                  ...prev,
                                  allowedDistricts: [...prev.allowedDistricts, district.id]
                                }));
                              } else {
                                setRoleForm(prev => ({
                                  ...prev,
                                  allowedDistricts: prev.allowedDistricts.filter(id => id !== district.id)
                                }));
                              }
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`district-${district.id}`} className="text-sm cursor-pointer">
                            {district.name} (ID: {district.id})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allFeatureIds = features
                        .filter(f => f.isActive)
                        .map(f => f.id);
                      setRoleForm(prev => ({
                        ...prev,
                        permissions: allFeatureIds
                      }));
                    }}
                    className="text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Check All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRoleForm(prev => ({
                        ...prev,
                        permissions: []
                      }));
                    }}
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Uncheck All
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {features
                    .filter(f => f.isActive)
                    .map((feature) => (
                      <div key={feature.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`perm-${feature.id}`}
                          checked={roleForm.permissions.includes(feature.id)}
                          onChange={() => togglePermission(feature.id, true)}
                          className="rounded"
                        />
                        <Label htmlFor={`perm-${feature.id}`} className="text-sm cursor-pointer">
                          {feature.displayName}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="roleActive"
                  checked={roleForm.isActive}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="roleActive" className="cursor-pointer">Active</Label>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                disabled={isCreating || isUpdating || !roleForm.name || !roleForm.displayName}
                className="w-full sm:w-auto"
              >
                {isCreating || isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Feature Dialog */}
        <Dialog open={isFeatureDialogOpen} onOpenChange={setIsFeatureDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {editingFeature ? 'Edit Feature' : 'Create New Feature'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {editingFeature ? 'Modify the feature details' : 'Create a new system feature'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="featureName">Feature Name *</Label>
                  <Input
                    id="featureName"
                    value={featureForm.name}
                    onChange={(e) => setFeatureForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., advanced_analytics"
                    disabled={!!editingFeature} // Can't change feature name after creation
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="featureCategory">Category *</Label>
                  <Select
                    value={featureForm.category}
                    onValueChange={(value) => setFeatureForm(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset_management">Asset Management</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="fault_management">Fault Management</SelectItem>
                      <SelectItem value="user_management">User Management</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="featureDisplayName">Display Name *</Label>
                <Input
                  id="featureDisplayName"
                  value={featureForm.displayName}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g., Advanced Analytics"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="featureDescription">Description</Label>
                <Textarea
                  id="featureDescription"
                  value={featureForm.description}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this feature provides"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Available Permissions</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {['create', 'read', 'update', 'delete', 'export', 'import'].map((perm) => (
                    <div key={perm} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`feature-perm-${perm}`}
                        checked={featureForm.permissions?.access?.includes(perm) || false}
                        onChange={() => togglePermission(perm, false)}
                        className="rounded"
                      />
                      <Label htmlFor={`feature-perm-${perm}`} className="text-sm cursor-pointer capitalize">
                        {perm}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="featureActive"
                  checked={featureForm.isActive}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="featureActive" className="cursor-pointer">Active</Label>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsFeatureDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={editingFeature ? handleUpdateFeature : handleCreateFeature}
                disabled={isCreating || isUpdating || !featureForm.name || !featureForm.displayName || !featureForm.category}
                className="w-full sm:w-auto"
              >
                {isCreating || isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingFeature ? 'Update Feature' : 'Create Feature'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
