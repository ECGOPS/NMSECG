import React, { useState, useEffect, useCallback } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';
import { Edit, Trash2, Eye, User as UserIcon, Clock } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { EditIcon, PlusCircle, Copy, KeyRound, Search, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateUserRoleAssignment, getFilteredRegionsAndDistricts } from "@/utils/user-utils";
import { hashPassword } from "@/utils/security";
import LoggingService from "@/services/LoggingService";
import { SafeText } from '@/components/ui/safe-display';

export function UsersList() {
  const { user: currentUser, users, setUsers, addUser, updateUser, deleteUser, toggleUserStatus } = useAzureADAuth();
  const { regions, districts } = useData();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkStatusDialogOpen, setIsBulkStatusDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // New user form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newStaffId, setNewStaffId] = useState("");
  const [newRole, setNewRole] = useState<User["role"]>(null);
  const [newRegion, setNewRegion] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [tempPassword, setTempPassword] = useState<string>("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [showTempPasswordDialog, setShowTempPasswordDialog] = useState(false);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ tempPassword: string; email: string } | null>(null);
  const [userStatus, setUserStatus] = useState<"pre_registered" | "active" | "inactive">("pre_registered");
  const [bulkStatus, setBulkStatus] = useState<"pre_registered" | "active" | "inactive">("active");
  const [selectedUsersForBulkUpdate, setSelectedUsersForBulkUpdate] = useState<string[]>([]);
  const [bulkStatusFilter, setBulkStatusFilter] = useState<"pre_registered" | "active" | "inactive" | null>(null);
  const [bulkRegionFilter, setBulkRegionFilter] = useState<string | null>(null);
  const [bulkDistrictFilter, setBulkDistrictFilter] = useState<string | null>(null);
  
  // Check if current user is system admin, global engineer, or ICT
  const isSystemAdmin = currentUser?.role === "system_admin";
  const isGlobalEngineer = currentUser?.role === "global_engineer";
  const isICT = currentUser?.role === "ict";
  const canManageUsers = isSystemAdmin || isGlobalEngineer || isICT;
  
  const [filteredUsers, setFilteredUsers] = useState<User[]>(users);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<User["role"] | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<User["status"] | "all">("all");
  
  // Add roles state for dynamic role fetching
  const [roles, setRoles] = useState<Array<{id: string, name: string, displayName: string, isActive: boolean}>>([]);
  
  const getRoleBadgeColor = (role: User["role"]) => {
    // First try to find the role in the dynamic roles array
    const dynamicRole = roles.find(r => r.id === role);
    if (dynamicRole) {
      // Use a consistent color scheme for dynamic roles
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    }
    
    // Fallback to hardcoded colors for backward compatibility
    switch (role) {
      case "district_engineer":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "district_manager":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "regional_engineer":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "regional_general_manager":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "global_engineer":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "system_admin":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "technician":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "ict":
        return "bg-cyan-100 text-cyan-800 hover:bg-cyan-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };
  
  const getRoleLabel = (role: User["role"]) => {
    // First try to find the role in the dynamic roles array
    const dynamicRole = roles.find(r => r.id === role);
    if (dynamicRole) {
      return dynamicRole.displayName || dynamicRole.name;
    }
    
    // Fallback to hardcoded labels for backward compatibility
    switch (role) {
      case "district_engineer":
        return "District Engineer";
      case "district_manager":
        return "District Manager";
      case "regional_engineer":
        return "Regional Engineer";
      case "regional_general_manager":
        return "Regional General Manager";
      case "global_engineer":
        return "Global Engineer";
      case "system_admin":
        return "System Administrator";
      case "technician":
        return "Technician";
      case "ict":
        return "ICT";
      case "project_engineer":
        return "Project Engineer";
      default:
        return role || "Unknown Role";
    }
  };

  const getStatusBadgeColor = (status: User["status"]) => {
    switch (status) {
      case "pre_registered":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "active":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "inactive":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getStatusLabel = (status: User["status"]) => {
    switch (status) {
      case "pre_registered":
        return "Pre-registered";
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      default:
        return "Unknown";
    }
  };
  
  // Function to generate a random temporary password
  const generateTempPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    return password;
  };
  
  const handleAddUser = async () => {
    if (!newName || !newEmail || !newRole) {
      toast.error("Please fill all required fields");
      return;
    }
    
    // For ICT users, automatically set region to their assigned region
    let userRegion = newRegion;
    let userDistrict = newDistrict;
    
    if (isICT && currentUser?.region) {
      userRegion = currentUser.region;
      // If ICT user has a district, also set the district
      if (currentUser.district) {
        userDistrict = currentUser.district;
      }
    }
    
    // For system admin and global engineer, skip region/district validation
    if (newRole !== "system_admin" && newRole !== "global_engineer") {
      const validation = validateUserRoleAssignment(newRole, userRegion, userDistrict, regions, districts);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }
    }

    // Generate temporary password
    const tempPass = generateTempPassword();
    setTempPassword(tempPass);
    
    try {
      // Find region and district IDs
      const region = regions.find(r => r.name === userRegion);
      const district = districts.find(d => d.name === userDistrict && d.regionId === region?.id);
      const hashedPassword = await hashPassword(tempPass);
      const newUserData: Omit<User, "id"> = {
        uid: '',
        displayName: newName,
        name: newName,
        email: newEmail,
        staffId: newStaffId,
        role: newRole,
        region: (newRole !== "system_admin" && newRole !== "global_engineer") ? userRegion : undefined,
        regionId: (newRole !== "system_admin" && newRole !== "global_engineer") ? region?.id : undefined,
        district: (newRole === "district_engineer" || newRole === "technician") ? userDistrict : undefined,
        districtId: (newRole === "district_engineer" || newRole === "technician") ? district?.id : undefined,
        tempPassword: tempPass,
        mustChangePassword: true,
        password: hashedPassword,
        status: userStatus, // Add status field
        disabled: userStatus === "inactive"
      };
    
      // Add user to Firestore via AuthContext function
      await addUser(newUserData);
      // Log action
      await LoggingService.getInstance().logAction(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        "add",
        "user",
        newUserData.email,
        `Added user: ${newUserData.email}`,
        newUserData.region,
        newUserData.district
      );
    
    resetForm();
    setIsAddDialogOpen(false);
    setShowCredentials(true);
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };
  
  const handleEditUser = async () => {
    if (!selectedUser) return;
    
    if (!newName || !newEmail || !newRole) {
      toast.error("Please fill all required fields");
      return;
    }
    
    // For ICT users, automatically set region to their assigned region
    let userRegion = newRegion;
    let userDistrict = newDistrict;
    
    if (isICT && currentUser?.region) {
      userRegion = currentUser.region;
      // If ICT user has a district, also set the district
      if (currentUser.district) {
        userDistrict = currentUser.district;
      }
    }
    
    // For system admin and global engineer, skip region/district validation
    if (newRole !== "system_admin" && newRole !== "global_engineer") {
      const validation = validateUserRoleAssignment(newRole, userRegion, userDistrict, regions, districts);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }
    }
    
    try {
      // Find region and district IDs
      let regionId = '';
      let districtId = '';
      
      if (userRegion) {
        const region = regions.find(r => r.name === userRegion);
        if (region) {
          regionId = region.id;
        }
      }
      
      if (userDistrict && regionId) {
        const district = districts.find(d => d.name === userDistrict && d.regionId === regionId);
        if (district) {
          districtId = district.id;
        }
      }
      
      // Prepare update data, filtering out undefined values
      const updateData: Partial<User> = {
        name: newName,
        email: newEmail,
        staffId: newStaffId,
        role: newRole,
        status: userStatus,
      };

      // Only add region/district fields if they have values
      if (newRole !== "system_admin" && newRole !== "global_engineer") {
        if (userRegion) updateData.region = userRegion;
        if (regionId) updateData.regionId = regionId;
      }

              if (newRole === "district_engineer" || newRole === "district_manager" || newRole === "technician") {
          if (userDistrict) updateData.district = userDistrict;
          if (districtId) updateData.districtId = districtId;
        }

      console.log('Updating user with data:', updateData);
      
      // Log the edit action with before/after values
      await LoggingService.getInstance().logEditAction(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        "user",
        selectedUser.id,
        selectedUser, // old values
        { ...selectedUser, ...updateData }, // new values
        `Edited user: ${selectedUser.email}`,
        newRegion,
        newDistrict
      );

      // Update user in Firestore via AuthContext function
      await updateUser(selectedUser.id, updateData);
    
      resetForm();
      setIsEditDialogOpen(false);
      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedUsersForBulkUpdate.length === 0) {
      toast.error("Please select at least one user to update");
      return;
    }

    try {
      const updatePromises = selectedUsersForBulkUpdate.map(async (userId) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const updateData: Partial<User> = {
          status: bulkStatus,
        };

        // Log the bulk status update action
        await LoggingService.getInstance().logEditAction(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          "user",
          userId,
          user, // old values
          { ...user, ...updateData }, // new values
          `Bulk status update: ${user.email} to ${bulkStatus}`,
          user.region,
          user.district
        );

        // Update user status via AuthContext function
        await updateUser(userId, updateData);
      });

      await Promise.all(updatePromises);
      
      // Reset the bulk update state
      setSelectedUsersForBulkUpdate([]);
      setIsBulkStatusDialogOpen(false);
      
      toast.success(`Successfully updated status for ${selectedUsersForBulkUpdate.length} user(s) to ${bulkStatus}`);
    } catch (error) {
      console.error("Error updating user statuses:", error);
      toast.error("Failed to update user statuses");
    }
  };
  
  const handleDeleteUser = async () => {
    if (!selectedUser || !isSystemAdmin) return;
    
    try {
      // Log the delete action with the deleted user data
      await LoggingService.getInstance().logDeleteAction(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        "user",
        selectedUser.id,
        selectedUser, // deleted data
        `Deleted user: ${selectedUser.email}`,
        selectedUser.region,
        selectedUser.district
      );

      // Delete user from Firestore via AuthContext function
      await deleteUser(selectedUser.id);
      
    setSelectedUser(null);
    setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };
  
  const handleDisableUser = async (user: User) => {
    if (!user || (!isSystemAdmin && !isICT)) return;
    
    // For ICT users, check if they can disable this user (same region)
    if (isICT && currentUser?.region) {
      if (user.region !== currentUser.region) {
        toast.error("You can only disable users in your assigned region");
        return;
      }
      // If ICT user has a district, also check district restriction
      if (currentUser.district && user.district !== currentUser.district) {
        toast.error("You can only disable users in your assigned district");
        return;
      }
    }
    
    try {
      // Log the status change action with before/after values
      await LoggingService.getInstance().logEditAction(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        "user",
        user.id,
        { ...user }, // old values
        { ...user, disabled: !user.disabled }, // new values
        `Changed user status: ${user.disabled ? 'enabled' : 'disabled'} ${user.email}`,
        user.region,
        user.district
      );

      // Toggle user status in Firestore via AuthContext function
      await toggleUserStatus(user.id, !user.disabled);
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };
  
  const handleResetPassword = async (userId: string) => {
    // Find the user to check region restrictions
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // For ICT users, check if they can reset password for this user (same region)
    if (isICT && currentUser?.region) {
      if (user.region !== currentUser.region) {
        toast.error("You can only reset passwords for users in your assigned region");
        return;
      }
      // If ICT user has a district, also check district restriction
      if (currentUser.district && user.district !== currentUser.district) {
        toast.error("You can only reset passwords for users in your assigned district");
        return;
      }
    }
    
    try {
      // TODO: Implement password reset functionality when available
      console.log("Password reset requested for user:", userId);
      toast.error("Password reset functionality not yet implemented");
    } catch (error) {
      console.error("Error resetting password:", error);
    }
  };
  
  const openEditDialog = (user: User) => {
    // For ICT users, check if they can edit this user (same region)
    if (isICT && currentUser?.region) {
      if (user.region !== currentUser.region) {
        toast.error("You can only edit users in your assigned region");
        return;
      }
      // If ICT user has a district, also check district restriction
      if (currentUser.district && user.district !== currentUser.district) {
        toast.error("You can only edit users in your assigned district");
        return;
      }
    }
    
    setSelectedUser(user);
    setNewName(user.name);
    setNewEmail(user.email);
    setNewStaffId(user.staffId || "");
    setNewRole(user.role);
    setNewRegion(user.region || "");
    setNewDistrict(user.district || "");
    setUserStatus(user.status || "pre_registered");
    setIsEditDialogOpen(true);
  };
  
  const openDeleteDialog = (user: User) => {
    // For ICT users, check if they can delete this user (same region)
    if (isICT && currentUser?.region) {
      if (user.region !== currentUser.region) {
        toast.error("You can only delete users in your assigned region");
        return;
      }
      // If ICT user has a district, also check district restriction
      if (currentUser.district && user.district !== currentUser.district) {
        toast.error("You can only delete users in your assigned district");
        return;
      }
    }
    
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };
  
  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewStaffId("");
    setNewRole(null);
    // For ICT users, don't reset region and district - keep them set to their assigned values
    if (!isICT) {
      setNewRegion("");
      setNewDistrict("");
    } else {
      // Set region and district to ICT user's assigned values
      if (currentUser?.region) {
        setNewRegion(currentUser.region);
      }
      if (currentUser?.district) {
        setNewDistrict(currentUser.district);
      }
    }
    setUserStatus("pre_registered");
    setSelectedUser(null);
  };
  
  // Get filtered regions and districts based on user role
  const { filteredRegions, filteredDistricts } = getFilteredRegionsAndDistricts(
    currentUser,
    regions,
    districts,
    newRegion ? regions.find(r => r.name === newRegion)?.id : undefined
  );

  // Simplified district filtering - just get districts for the selected region
  const availableDistricts = newRegion
    ? districts.filter(d => {
        const selectedRegion = regions.find(r => r.name === newRegion);
        return d.regionId === selectedRegion?.id;
      })
    : [];
  
  // Function to manually fetch users data
  const fetchUsersManually = useCallback(async () => {
    setIsLoading(true);
    console.log("UsersList: Manual fetch initiated");
    try {
      // Force reload users from API - get all users with pagination
      const countResponse = await apiRequest('/api/users?countOnly=true');
      const totalUsers = countResponse.count || 0;
      console.log("UsersList: Total users count from API:", totalUsers);
      
      let usersList;
      if (totalUsers <= 100) {
        // If 100 or fewer users, get them all in one request
        usersList = await apiRequest('/api/users?limit=100');
      } else {
        // If more than 100 users, get them in batches
        usersList = [];
        let offset = 0;
        const batchSize = 100;
        
        while (offset < totalUsers) {
          const batch = await apiRequest(`/api/users?limit=${batchSize}&offset=${offset}`);
          usersList.push(...batch);
          offset += batchSize;
        }
      }
      
      console.log("UsersList: Raw users from API:", {
        totalLoaded: usersList.length,
        users: usersList.map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, role: u.role }))
      });
      
      // Check for pending users specifically
      const pendingUsers = usersList.filter(u => u.status === 'pre_registered' || u.role === 'pending');
      console.log("UsersList: Pending users found:", {
        count: pendingUsers.length,
        pendingUsers: pendingUsers.map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, role: u.role }))
      });
      
      setUsers(usersList);
      console.log("UsersList: Users loaded successfully:", usersList.length);
    } catch (error) {
      console.error("UsersList: Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [setUsers]);
  
  // When region changes, only reset district if the region actually changed from the user's current region
  useEffect(() => {
    if (isEditDialogOpen && selectedUser) {
      if (newRegion !== (selectedUser.region || "")) {
        setNewDistrict("");
      }
    } else {
      setNewDistrict("");
    }
  }, [newRegion, isEditDialogOpen, selectedUser]);

  // Auto-set region and district for ICT users when opening add user dialog
  useEffect(() => {
    if (isAddDialogOpen && isICT && currentUser) {
      if (currentUser.region) {
        setNewRegion(currentUser.region);
      }
      if (currentUser.district) {
        setNewDistrict(currentUser.district);
      }
    }
  }, [isAddDialogOpen, isICT, currentUser]);
  
  // Fetch users when component mounts
  useEffect(() => {
    console.log("UsersList: Component mounted, fetching users data");
    fetchUsersManually();
  }, []); // Only run once on mount
  
  // Fetch roles when component mounts
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        console.log("UsersList: Fetching roles data");
        const response = await apiRequest('/api/roles');
        if (response && Array.isArray(response)) {
          const activeRoles = response.filter(role => role.isActive !== false);
          setRoles(activeRoles);
          console.log("UsersList: Roles loaded successfully", activeRoles.length);
        }
      } catch (error) {
        console.error("UsersList: Error loading roles:", error);
        toast.error("Failed to load roles");
      }
    };
    
    fetchRoles();
  }, []); // Only run once on mount
  
  // Monitor users array and update loading state
  useEffect(() => {
    if (users && users.length >= 0) {
      setIsLoading(false);
    }
  }, [users]);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  
  // Recalculate filtered users when search term or original users list changes
  useEffect(() => {
    let filtered = users;
    
    // Debug logging to see what users are being processed
    console.log('[UsersList] Processing users for filtering:', {
      totalUsers: users.length,
      pendingUsers: users.filter(u => u.status === 'pre_registered' || u.role === 'pending').length,
      isICT,
      currentUserRegion: currentUser?.region,
      currentUserDistrict: currentUser?.district
    });
    
    if (isICT) {
      // Hide system_admin and global_engineer from ICT users
      const globalRoles = ["system_admin", "global_engineer"];
      filtered = filtered.filter(user => !globalRoles.includes(user.role));
      
      // Apply region/district filtering for ICT users (including pending users)
      if (currentUser?.district) {
        filtered = filtered.filter(user => user.district === currentUser.district);
      } else if (currentUser?.region) {
        filtered = filtered.filter(user => user.region === currentUser.region);
      }
      
      console.log('[UsersList] ICT filtering applied:', {
        regionFilteredCount: filtered.length,
        currentUserRegion: currentUser?.region,
        currentUserDistrict: currentUser?.district
      });
    }
    
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        (user.name && user.name.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (user.email && user.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (user.staffId && user.staffId.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (user.region && user.region.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (user.district && user.district.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    if (regionFilter !== "all") {
      filtered = filtered.filter(user => user.region === regionFilter);
    }
    if (districtFilter !== "all") {
      filtered = filtered.filter(user => user.district === districtFilter);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(user => user.status === statusFilter);
    }
    
    console.log('[UsersList] Final filtered users:', {
      totalFiltered: filtered.length,
      pendingInFiltered: filtered.filter(u => u.status === 'pre_registered' || u.role === 'pending').length
    });
    
    setFilteredUsers(filtered);
  }, [users, searchTerm, isICT, currentUser, roleFilter, regionFilter, districtFilter, statusFilter]);

  // Reset district filter when region changes
  useEffect(() => {
    setDistrictFilter("all");
  }, [regionFilter]);

  // Auto-set region filter for ICT users to their assigned region
  useEffect(() => {
    if (isICT && currentUser?.region) {
      setRegionFilter(currentUser.region);
    }
  }, [isICT, currentUser?.region]);

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setRoleFilter("all");
    // ICT users cannot reset region filter - it's locked to their assigned region
    if (!isICT) {
      setRegionFilter("all");
    }
    setDistrictFilter("all");
    setStatusFilter("all");
  };
  
  return (
    <div className="space-y-6">
      {/* ICT Region Restriction Notice */}
      {isICT && currentUser?.region && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <p className="text-sm text-blue-800">
              <strong>Region Restriction:</strong> As an ICT user, you can only view and manage users from your assigned region: <strong>{currentUser.region}</strong>
            </p>
          </div>
        </div>
      )}
      
      {/* Search and Add User Section */}
      <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-md">
         <div className="flex flex-col gap-3">
           <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
               placeholder="Search by name, email, staff ID, region, or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full bg-background h-9 text-sm"
            />
          </div>
           <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={fetchUsersManually}
              disabled={isLoading}
              variant="outline"
              className="w-full sm:w-auto h-9 text-sm px-3"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
              ) : (
                <Users size={15} className="mr-2" />
              )}
              Refresh
            </Button>
            {canManageUsers && (
              <Button 
                onClick={() => setIsAddDialogOpen(true)} 
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 h-9 text-sm px-3"
              >
                <PlusCircle size={15} className="mr-2" />
                Add New User
              </Button>
            )}
             {(isSystemAdmin || isICT) && (
               <Button 
                 variant="outline"
                 onClick={() => {
                   setIsBulkStatusDialogOpen(true);
                   setBulkStatusFilter(null);
                   setBulkRegionFilter(null);
                   setBulkDistrictFilter(null);
                   setSelectedUsersForBulkUpdate([]);
                 }} 
                 className="w-full sm:w-auto h-9 text-sm px-3"
               >
                 <Clock size={15} className="mr-2" />
                 Bulk Update Status
              </Button>
            )}
          </div>
        </div>
        {/* Filter Section */}
         <div className="flex flex-col gap-3 mt-2">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
             <div className="w-full">
               <Label className="text-xs sm:text-sm">Filter by Role</Label>
            <Select value={roleFilter} onValueChange={v => setRoleFilter(v as User["role"] | "all")}> 
                 <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.displayName || role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
             <div className="w-full">
               <Label className="text-xs sm:text-sm">Filter by Region</Label>
            <Select value={regionFilter} onValueChange={v => setRegionFilter(v)} disabled={isICT}>
                 <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map(region => (
                  <SelectItem key={region.id} value={region.name}>{region.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
             <div className="w-full">
               <Label className="text-xs sm:text-sm">Filter by District/Section</Label>
            <Select value={districtFilter} onValueChange={v => setDistrictFilter(v)} disabled={regionFilter === "all"}>
                 <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                {districts.filter(d => regionFilter === "all" || d.regionId === regions.find(r => r.name === regionFilter)?.id).map(district => (
                  <SelectItem key={district.id} value={district.name}>{district.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
             <div className="w-full">
               <Label className="text-xs sm:text-sm">Filter by Status</Label>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as User["status"] | "all")}>
                 <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pre_registered">Pending Approval</SelectItem>
              </SelectContent>
            </Select>
          </div>
           </div>
           <div className="flex justify-center sm:justify-end">
             <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto h-9 text-sm">Reset Filters</Button>
          </div>
        </div>
      </div>
      
      {/* Pending Users Section */}
      {(() => {
        // Filter for pending users: status is 'pre_registered' OR role is 'pending'
        const pendingUsers = users?.filter(user => {
          const isPending = user.status === 'pre_registered' || user.role === 'pending';
          return isPending;
        }) || [];
        
        console.log('[UsersList] Pending users section:', {
          totalUsers: users?.length || 0,
          pendingUsersCount: pendingUsers.length,
          pendingUsers: pendingUsers.map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, role: u.role })),
          allUsersStatusRole: users?.map(u => ({ id: u.id, status: u.status, role: u.role })) || []
        });
        
        return pendingUsers.length > 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-800">Pending User Approvals</h3>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                {pendingUsers.length} pending
              </Badge>
            </div>
            <p className="text-sm text-yellow-700 mb-3">
              The following users have registered but require administrator approval to access the system.
            </p>
            <div className="space-y-2">
              {pendingUsers
                .slice(0, 3) // Show first 3 pending users
                .map(user => (
                   <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white rounded p-2 gap-2">
                     <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                       <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                        <AvatarImage src={user.photoURL} />
                         <AvatarFallback className="text-xs sm:text-sm">{user.name?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                       <div className="min-w-0 flex-1">
                         <span className="font-medium text-sm truncate block"><SafeText content={user.name} /></span>
                         <span className="text-xs text-gray-500 truncate block">
                           {user.email && user.email.trim() ? <SafeText content={user.email} /> : <span className="text-gray-400 italic">No email available</span>}
                         </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openEditDialog(user)}
                       className="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-auto text-xs sm:text-sm"
                    >
                      Review
                    </Button>
                  </div>
                ))}
              {pendingUsers.length > 3 && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatusFilter('pre_registered')}
                     className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 w-full sm:w-auto"
                  >
                    View All Pending Users
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm text-blue-800">
                <strong>No Pending Users:</strong> All users have been approved or there are no new registrations.
              </p>
            </div>
          </div>
        );
      })()}
      
      {/* User Stats Dashboard */}
      <div className="flex justify-center mb-4">
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
           <div className="bg-primary/10 rounded-md px-3 py-2 text-center">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-muted-foreground">Active Users</span>
               <span className="text-base sm:text-lg font-bold text-primary">
                {users?.filter(user => !user.disabled).length || 0}
              </span>
            </div>
          </div>
           <div className="bg-destructive/10 rounded-md px-3 py-2 text-center">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-muted-foreground">Disabled Users</span>
               <span className="text-base sm:text-lg font-bold text-destructive">
                {users?.filter(user => user.disabled).length || 0}
              </span>
            </div>
          </div>
           <div className="bg-yellow-100 rounded-md px-3 py-2 text-center">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-muted-foreground">Pending Approval</span>
               <span className="text-base sm:text-lg font-bold text-yellow-700">
                {users?.filter(user => user.status === 'pre_registered' || user.role === 'pending').length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Users Table Section */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading user data...</p>
        </div>
      ) : users && users.length > 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableCaption className="mt-4">Total users: {filteredUsers.length}</TableCaption>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                     <TableHead className="whitespace-nowrap font-semibold min-w-[200px]">User Details</TableHead>
                     <TableHead className="whitespace-nowrap font-semibold min-w-[140px]">Role & Status</TableHead>
                     <TableHead className="whitespace-nowrap font-semibold min-w-[120px] text-right sticky right-0 bg-muted/50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <TableRow key={user.id} className="group">
                        <TableCell>
                           <div className="flex items-center space-x-2 sm:space-x-3">
                             <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                              <AvatarImage src={user.photoURL} />
                               <AvatarFallback className="text-xs sm:text-sm">{user.name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                             <div className="min-w-0 flex-1">
                               <span className="font-semibold text-sm sm:text-base truncate block"><SafeText content={user.name} /></span>
                               <span className="text-xs sm:text-sm text-muted-foreground truncate block">
                                 {user.email && user.email.trim() ? <SafeText content={user.email} /> : <span className="text-gray-400 italic">No email available</span>}
                               </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col gap-1 sm:gap-2">
                             <Badge className={`${getRoleBadgeColor(user.role)} px-1.5 sm:px-2 py-0.5 w-fit text-xs`}>
                              <SafeText content={getRoleLabel(user.role)} />
                            </Badge>
                            <Badge 
                              variant={user.disabled ? "destructive" : "default"} 
                               className="w-fit text-xs"
                            >
                              <SafeText content={user.disabled ? "Disabled" : "Active"} />
                            </Badge>
                            {user.status && (
                               <Badge className={`${getStatusBadgeColor(user.status)} w-fit text-xs`}>
                                <SafeText content={getStatusLabel(user.status)} />
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-0 sticky right-0 bg-background">
                           <div className="flex justify-end items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-1 bg-background">
                            {(canManageUsers || isICT) && (
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDialog(user);
                                  }}
                                   className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-muted"
                                  title="Edit user"
                                >
                                   <EditIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetPassword(user.id);
                                  }}
                                   className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-muted"
                                  title="Reset password"
                                >
                                   <KeyRound className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                </Button>
                                {(isSystemAdmin || isICT) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteDialog(user);
                                    }}
                                     className="h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    title="Delete user"
                                  >
                                     <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                            {(isSystemAdmin || isICT) && (
                              <Button
                                variant={user.disabled ? "outline" : "ghost"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDisableUser(user);
                                }}
                                 className={`h-6 sm:h-7 px-1.5 sm:px-2 text-xs min-w-[40px] sm:min-w-[50px] ${
                                  user.disabled ? 'hover:bg-primary/10 hover:text-primary' : 'hover:bg-destructive/10 hover:text-destructive'
                                }`}
                              >
                                {user.disabled ? "Enable" : "Disable"}
                              </Button>
                            )}
                             {(isSystemAdmin || isICT) && (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   openEditDialog(user);
                                 }}
                                 className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs min-w-[40px] sm:min-w-[50px] hover:bg-primary/10 hover:text-primary"
                                 title="Update Status"
                               >
                                 <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Users className="h-8 w-8 mb-2" />
                          {searchTerm ? 'No users match your search.' : 'No users found.'}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-10 border rounded-lg bg-muted/10">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No users found</p>
          <p className="text-sm mt-2 text-muted-foreground">Create a new user by clicking the "Add User" button above</p>
        </div>
      )}
      
      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
         <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
             <DialogTitle className="text-lg sm:text-xl font-semibold">Add New User</DialogTitle>
             <DialogDescription className="text-muted-foreground text-sm">
              Fill in the details to create a new user account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                 <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                   className="w-full h-9 text-sm"
                />
              </div>
              
              <div className="space-y-2">
                 <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                   className="w-full h-9 text-sm"
                />
              </div>
              
              <div className="space-y-2">
                 <Label htmlFor="staffId" className="text-sm font-medium">Staff ID</Label>
                <Input
                  id="staffId"
                  placeholder="Enter staff ID"
                  value={newStaffId}
                  onChange={(e) => setNewStaffId(e.target.value)}
                   className="w-full h-9 text-sm"
                />
              </div>
              
              <div className="space-y-2">
                 <Label htmlFor="role" className="text-sm font-medium">Role</Label>
                <Select value={newRole || ""} onValueChange={(value) => setNewRole(value as User["role"])}>
                   <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.displayName || role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {(newRole === "regional_engineer" || newRole === "project_engineer" || newRole === "regional_general_manager" || newRole === "district_engineer" || newRole === "district_manager" || newRole === "technician") ||
                (newRole === "ict" && (isSystemAdmin || isGlobalEngineer)) ? (
                <div className="space-y-2">
                   <Label htmlFor="region" className="text-sm font-medium">Region</Label>
                  {isICT && currentUser?.region ? (
                     <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Input
                        value={currentUser.region}
                        disabled
                         className="w-full bg-muted h-9 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Your assigned region
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={newRegion}
                      onValueChange={setNewRegion}
                    >
                       <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map(region => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}
              
              {(newRole === "district_engineer" || newRole === "district_manager" || newRole === "technician") && (newRegion || (isICT && currentUser?.region)) && (
                <div className="space-y-2">
                   <Label htmlFor="district" className="text-sm font-medium">District/Section</Label>
                  {isICT && currentUser?.district ? (
                     <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Input
                        value={currentUser.district}
                        disabled
                         className="w-full bg-muted h-9 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Your assigned district
                      </p>
                    </div>
                  ) : (
                    <Select value={newDistrict} onValueChange={setNewDistrict}>
                       <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDistricts.map(district => (
                          <SelectItem key={district.id} value={district.name}>
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                 <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                <Select value={userStatus} onValueChange={(value: "pre_registered" | "active" | "inactive") => setUserStatus(value)}>
                   <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_registered">Pre-registered (Not in Azure AD yet)</SelectItem>
                    <SelectItem value="active">Active (Can log in)</SelectItem>
                    <SelectItem value="inactive">Inactive (Disabled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(false);
              }}
               className="w-full sm:w-auto h-9 text-sm"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddUser}
               className="w-full sm:w-auto h-9 text-sm"
            >
              Add User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Credentials Dialog */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New User Credentials</DialogTitle>
            <DialogDescription>
              Please provide these credentials to the new user. They will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <div className="flex items-center space-x-2">
                <Input value={newEmail} readOnly />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newEmail)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Temporary Password</Label>
              <div className="flex items-center space-x-2">
                <Input value={tempPassword} readOnly />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(tempPassword)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCredentials(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Temporary Password Dialog */}
      <Dialog open={showTempPasswordDialog} onOpenChange={setShowTempPasswordDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Temporary Password</DialogTitle>
            <DialogDescription>
              Please provide these credentials to the user. They will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          {tempPasswordInfo && (
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <div className="flex items-center space-x-2">
                  <Input value={tempPasswordInfo.email} readOnly />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(tempPasswordInfo.email)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Temporary Password</Label>
                <div className="flex items-center space-x-2">
                  <Input value={tempPasswordInfo.tempPassword} readOnly />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(tempPasswordInfo.tempPassword)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowTempPasswordDialog(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="john@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-staffId">Staff ID</Label>
              <Input
                id="edit-staffId"
                placeholder="Enter staff ID"
                value={newStaffId}
                onChange={(e) => setNewStaffId(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={newRole || ""} onValueChange={(value) => setNewRole(value as User["role"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName || role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {((newRole === "regional_engineer" || newRole === "project_engineer" || newRole === "regional_general_manager" || newRole === "district_engineer" || newRole === "district_manager" || newRole === "technician" || newRole === "ashsubt" || newRole === "accsubt") ||
              (newRole === "ict" && (isSystemAdmin || isGlobalEngineer))) && (
              <div className="space-y-2">
                <Label htmlFor="edit-region">Region</Label>
                <Select value={newRegion} onValueChange={setNewRegion} disabled={isICT && !(isSystemAdmin || isGlobalEngineer)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {((newRole === "district_engineer" || newRole === "district_manager" || newRole === "technician") ||
              (newRole === "ict" && (isSystemAdmin || isGlobalEngineer))) && newRegion && (
              <div className="space-y-2">
                <Label htmlFor="edit-district">District/Section</Label>
                <Select value={newDistrict} onValueChange={setNewDistrict} disabled={false}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts
                      .filter(d => d.regionId === regions.find(r => r.name === newRegion)?.id)
                      .map(district => (
                        <SelectItem key={district.id} value={district.name}>
                          {district.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={userStatus} onValueChange={(value: "pre_registered" | "active" | "inactive") => setUserStatus(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_registered">Pre-registered (Not in Azure AD yet)</SelectItem>
                  <SelectItem value="active">Active (Can log in)</SelectItem>
                  <SelectItem value="inactive">Inactive (Disabled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm();
                setIsEditDialogOpen(false);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditUser}
              className="w-full sm:w-auto"
            >
              Update User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete User</DialogTitle>
            <DialogDescription className="text-destructive/90">
              Warning: This action cannot be undone. Deleting a user will permanently remove their account and all associated data.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="py-4 space-y-3 border rounded-lg bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                <h4 className="font-semibold">User Details to be Deleted</h4>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> <SafeText content={selectedUser.name} /></p>
                <p><span className="font-medium">Email:</span> <SafeText content={selectedUser.email} /></p>
                <p><span className="font-medium">Role:</span> <SafeText content={getRoleLabel(selectedUser.role)} /></p>
                {selectedUser.region && <p><span className="font-medium">Region:</span> <SafeText content={selectedUser.region} /></p>}
                {selectedUser.district && <p><span className="font-medium">District:</span> <SafeText content={selectedUser.district} /></p>}
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedUser(null);
                setIsDeleteDialogOpen(false);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              className="w-full sm:w-auto"
            >
              Delete User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
             {/* Bulk Status Update Dialog */}
       <Dialog open={isBulkStatusDialogOpen} onOpenChange={setIsBulkStatusDialogOpen}>
         <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle className="text-lg sm:text-xl">Bulk Update User Status</DialogTitle>
             <DialogDescription className="text-sm">
               Select users and update their status in bulk
             </DialogDescription>
           </DialogHeader>
          
                     <div className="space-y-4 py-2">
             <div className="space-y-2">
               <Label className="text-sm font-medium">Select New Status</Label>
               <Select value={bulkStatus} onValueChange={(value: "pre_registered" | "active" | "inactive") => setBulkStatus(value)}>
                 <SelectTrigger className="h-9 text-sm">
                   <SelectValue placeholder="Select status" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="pre_registered">Pre-registered (Not in Azure AD yet)</SelectItem>
                   <SelectItem value="active">Active (Can log in)</SelectItem>
                   <SelectItem value="inactive">Inactive (Disabled)</SelectItem>
                 </SelectContent>
               </Select>
             </div>
            
                         <div className="space-y-2">
               <Label className="text-sm font-medium">Filter by Current Status (Optional)</Label>
               <div className="flex gap-2">
                 <Select 
                   value={bulkStatusFilter || "all"} 
                   onValueChange={(value) => setBulkStatusFilter(value === "all" ? null : value as "pre_registered" | "active" | "inactive")}
                 >
                   <SelectTrigger className="h-9 text-sm">
                     <SelectValue placeholder="All statuses" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Statuses</SelectItem>
                     <SelectItem value="pre_registered">Pre-registered</SelectItem>
                     <SelectItem value="active">Active</SelectItem>
                     <SelectItem value="inactive">Inactive</SelectItem>
                   </SelectContent>
                 </Select>
                 {bulkStatusFilter && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => setBulkStatusFilter(null)}
                     className="h-7 px-2 text-xs"
                   >
                     Clear
                   </Button>
                 )}
               </div>
             </div>
            
                         <div className="space-y-2">
               <Label className="text-sm font-medium">Filter by Region (Optional)</Label>
               <div className="flex gap-2">
                 <Select 
                   value={bulkRegionFilter || "all"} 
                   onValueChange={(value) => {
                     setBulkRegionFilter(value === "all" ? null : value);
                     setBulkDistrictFilter(null); // Reset district when region changes
                   }}
                   disabled={isICT && !!currentUser?.region} // ICT users can't change region filter
                 >
                   <SelectTrigger className="h-9 text-sm">
                     <SelectValue placeholder={isICT && currentUser?.region ? currentUser.region : "All regions"} />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Regions</SelectItem>
                     {regions.map(region => (
                       <SelectItem key={region.id} value={region.name}>
                         {region.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 {bulkRegionFilter && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => {
                       setBulkRegionFilter(null);
                       setBulkDistrictFilter(null);
                     }}
                     className="h-7 px-2 text-xs"
                   >
                     Clear
                   </Button>
                 )}
               </div>
             </div>
            
                         <div className="space-y-2">
               <Label className="text-sm font-medium">Filter by District/Section (Optional)</Label>
               <div className="flex gap-2">
                 <Select 
                   value={bulkDistrictFilter || "all"} 
                   onValueChange={(value) => setBulkDistrictFilter(value === "all" ? null : value)}
                   disabled={!bulkRegionFilter && !(isICT && currentUser?.region)} // Disable if no region selected
                 >
                   <SelectTrigger className="h-9 text-sm">
                     <SelectValue placeholder="All districts/sections" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Districts/Sections</SelectItem>
                     {districts
                       .filter(d => {
                         if (isICT && currentUser?.region) {
                           return d.regionId === regions.find(r => r.name === currentUser.region)?.id;
                         }
                         if (bulkRegionFilter) {
                           return d.regionId === regions.find(r => r.name === bulkRegionFilter)?.id;
                         }
                         return true;
                         })
                       .map(district => (
                         <SelectItem key={district.id} value={district.name}>
                           {district.name}
                         </SelectItem>
                       ))}
                   </SelectContent>
                 </Select>
                 {bulkDistrictFilter && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => setBulkDistrictFilter(null)}
                     className="h-7 px-2 text-xs"
                   >
                     Clear
                   </Button>
                   )}
               </div>
             </div>
            
                         <div className="space-y-2">
               <Label className="text-sm font-medium">Select Users to Update</Label>
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                 <div className="flex flex-wrap gap-2">
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => {
                       const filteredUsersForBulk = filteredUsers.filter(user => {
                         // Apply status filter
                         if (bulkStatusFilter && user.status !== bulkStatusFilter) return false;
                         
                         // Apply region filter
                         if (bulkRegionFilter && user.region !== bulkRegionFilter) return false;
                         
                         // Apply district filter
                         if (bulkDistrictFilter && user.district !== bulkDistrictFilter) return false;
                         
                         return true;
                       });
                       if (selectedUsersForBulkUpdate.length === filteredUsersForBulk.length) {
                         setSelectedUsersForBulkUpdate([]);
                       } else {
                         setSelectedUsersForBulkUpdate(filteredUsersForBulk.map(u => u.id));
                       }
                     }}
                     className="h-7 px-2 text-xs"
                   >
                     {(() => {
                       const filteredUsersForBulk = filteredUsers.filter(user => {
                         // Apply status filter
                         if (bulkStatusFilter && user.status !== bulkStatusFilter) return false;
                         
                         // Apply region filter
                         if (bulkRegionFilter && user.region !== bulkRegionFilter) return false;
                         
                         // Apply district filter
                         if (bulkDistrictFilter && user.district !== bulkDistrictFilter) return false;
                         
                         return true;
                       });
                       return selectedUsersForBulkUpdate.length === filteredUsersForBulk.length ? 'Deselect All' : 'Select All';
                     })()}
                   </Button>
                   {(bulkStatusFilter || bulkRegionFilter || bulkDistrictFilter) && (
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => {
                         setBulkStatusFilter(null);
                         setBulkRegionFilter(null);
                         setBulkDistrictFilter(null);
                         setSelectedUsersForBulkUpdate([]);
                       }}
                       className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                     >
                       Clear All Filters
                     </Button>
                   )}
                 </div>
                 <span className="text-xs text-muted-foreground">
                   {(() => {
                     const filteredUsersForBulk = filteredUsers.filter(user => {
                       // Apply status filter
                       if (bulkStatusFilter && user.status !== bulkStatusFilter) return false;
                       
                       // Apply region filter
                       if (bulkRegionFilter && user.region !== bulkRegionFilter) return false;
                       
                       // Apply district filter
                       if (bulkDistrictFilter && user.district !== bulkDistrictFilter) return false;
                       
                       return true;
                     });
                     return `${selectedUsersForBulkUpdate.length} of ${filteredUsersForBulk.length} selected`;
                   })()}
                 </span>
               </div>
              <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                {filteredUsers
                  .filter(user => {
                    // Apply status filter
                    if (bulkStatusFilter && user.status !== bulkStatusFilter) return false;
                    
                    // Apply region filter
                    if (bulkRegionFilter && user.region !== bulkRegionFilter) return false;
                    
                    // Apply district filter
                    if (bulkDistrictFilter && user.district !== bulkDistrictFilter) return false;
                    
                    return true;
                  })
                  .map(user => (
                    <div key={user.id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        id={`user-${user.id}`}
                        checked={selectedUsersForBulkUpdate.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsersForBulkUpdate(prev => [...prev, user.id]);
                          } else {
                            setSelectedUsersForBulkUpdate(prev => prev.filter(id => id !== user.id));
                          }
                        }}
                        className="rounded"
                      />
                      <label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer">
                        <SafeText content={user.name} /> ({<SafeText content={user.email} />})
                        <span className="ml-2 text-xs text-muted-foreground">
                          Current: {user.status || 'N/A'}
                        </span>
                      </label>
                    </div>
                  ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{selectedUsersForBulkUpdate.length} user(s) selected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUsersForBulkUpdate([])}
                className="h-7 px-2 text-xs"
              >
                Clear Selection
              </Button>
            </div>
            
            {(bulkStatusFilter || bulkRegionFilter || bulkDistrictFilter) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-800">
                  <Search className="h-4 w-4" />
                  <span className="text-sm font-medium">Active Filters</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {bulkStatusFilter && (
                    <Badge variant="secondary" className="text-xs">
                      Status: {bulkStatusFilter}
                    </Badge>
                  )}
                  {bulkRegionFilter && (
                    <Badge variant="secondary" className="text-xs">
                      Region: {bulkRegionFilter}
                    </Badge>
                  )}
                  {bulkDistrictFilter && (
                    <Badge variant="secondary" className="text-xs">
                      District: {bulkDistrictFilter}
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            {selectedUsersForBulkUpdate.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Update Summary</span>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  {selectedUsersForBulkUpdate.length} user(s) will be updated from their current status to <strong>{bulkStatus}</strong>
                </p>
              </div>
            )}
          </div>
          
                     <div className="flex flex-col sm:flex-row justify-end gap-2">
             <Button 
               variant="outline" 
               onClick={() => {
                 setIsBulkStatusDialogOpen(false);
                 setBulkStatusFilter(null);
                 setBulkRegionFilter(null);
                 setBulkDistrictFilter(null);
                 setSelectedUsersForBulkUpdate([]);
               }}
               className="w-full sm:w-auto h-9 text-sm"
             >
               Cancel
             </Button>
             <Button 
               onClick={handleBulkStatusUpdate}
               disabled={selectedUsersForBulkUpdate.length === 0}
               className="w-full sm:w-auto h-9 text-sm"
             >
               Update {selectedUsersForBulkUpdate.length} User(s) to {bulkStatus}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
