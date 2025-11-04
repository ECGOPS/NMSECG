import React, { useState, useEffect } from 'react';
import { Layout } from "@/components/layout/Layout";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings, IdCard } from "lucide-react";
import { UsersList } from "@/components/user-management/UsersList";
import { DistrictPopulationForm } from "@/components/user-management/DistrictPopulationForm";
import { StaffIdManagement } from "@/components/user-management/StaffIdManagement";
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PermissionService } from "@/services/PermissionService";

export default function UserManagementPage() {
  const { isAuthenticated, user } = useAzureADAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const permissionService = PermissionService.getInstance();
  const isDistrictPopulationRoute = location.pathname === "/district-population";
  const isStaffIdsRoute = location.pathname === "/staff-ids";
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    
    // District engineers can only update their district population
    if (user?.role === "district_engineer") {
      if (!isDistrictPopulationRoute) {
        navigate("/district-population");
      }
    } else if (user?.role === "regional_engineer") {
      if (!isDistrictPopulationRoute) {
        navigate("/dashboard");
      }
    } else if (user?.role !== "system_admin" && user?.role !== "global_engineer" && user?.role !== "ict") {
      navigate("/dashboard");
    }

    // Redirect non-system admins from staff IDs page
    if (isStaffIdsRoute && user?.role !== "system_admin") {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate, isDistrictPopulationRoute, isStaffIdsRoute]);
  
  if (!isAuthenticated) {
    return null;
  }

  // Set default tab based on user role
  const defaultTab = user?.role === "district_engineer" ? "district-population" : "users";

  const isSystemAdmin = user?.role === "system_admin";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col space-y-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 rounded-lg border">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
              <p className="text-muted-foreground mt-1">Manage system users, roles, and permissions</p>
            </div>
            {isSystemAdmin && (
              <Button 
                onClick={() => navigate('/system-admin/permissions')}
                className="bg-primary/10 hover:bg-primary/20 text-primary"
              >
                <Settings className="mr-2 h-4 w-4" />
                Manage Permissions
              </Button>
            )}
          </div>
          
          {/* Main Content */}
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="w-full flex h-auto rounded-lg bg-primary/10 p-1 gap-1">
                  <TabsTrigger 
                    value="users" 
                    className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 rounded-md hover:bg-primary/20 transition-colors"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span className="font-medium">Users</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="staff-ids" 
                    className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 rounded-md hover:bg-primary/20 transition-colors"
                  >
                    <IdCard className="mr-2 h-4 w-4" />
                    <span className="font-medium">Staff IDs</span>
                  </TabsTrigger>
                </TabsList>
                
                <div className="p-4">
                  <TabsContent value="users" className="mt-0">
                    {permissionService.canAccessFeature(user?.role || '', 'user_management') ? (
                      <UsersList />
                    ) : (
                      <div className="text-center text-destructive font-semibold">You don't have permission to access this page.</div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="staff-ids" className="mt-0">
                    {permissionService.canAccessFeature(user?.role || '', 'staff_ids_management') ? (
                      <StaffIdManagement />
                    ) : (
                      <div className="text-center text-destructive font-semibold">You don't have permission to access this page.</div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
