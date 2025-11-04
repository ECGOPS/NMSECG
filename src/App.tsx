import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AzureADAuthProvider } from '@/contexts/AzureADAuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { AudioProvider } from '@/contexts/AudioContext';
import { OfflineProvider } from '@/contexts/OfflineContext';
import { LoadMonitoringOfflineProvider } from '@/contexts/LoadMonitoringOfflineContext';

import ProtectedRoute from '@/components/access-control/ProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { lazyLoadRoute } from './utils/routeUtils';
import PWAInstallPrompt from '@/components/common/PWAInstallPrompt';
import OfflineStatus from '@/components/common/OfflineStatus';
import { swUpdateHandler } from '@/utils/serviceWorkerUpdate';

// Lazy load all pages for better performance
const HomePage = lazyLoadRoute(() => import("./pages/HomePage"), "Loading home page...");
const LoginPage = lazyLoadRoute(() => import("./pages/LoginPage"), "Loading login page...");
const SignupPage = lazyLoadRoute(() => import("./pages/SignupPage"), "Loading password recovery...");
const ForgotPasswordPage = lazyLoadRoute(() => import("./pages/ForgotPasswordPage"), "Loading password recovery...");
const DashboardPage = lazyLoadRoute(() => import("./pages/DashboardPage"), "Loading dashboard...");
const ReportFaultPage = lazyLoadRoute(() => import("./pages/ReportFaultPage"), "Loading fault reporting...");
const AnalyticsPage = lazyLoadRoute(() => import("./pages/AnalyticsPage"), "Loading analytics...");
const ControlSystemAnalyticsPage = lazyLoadRoute(() => import("./pages/ControlSystemAnalyticsPage"), "Loading control system analytics...");
const UserManagementPage = lazyLoadRoute(() => import("./pages/UserManagementPage"), "Loading user management...");
const StaffIdManagementPage = lazyLoadRoute(() => import("./components/user-management/StaffIdManagement").then(module => ({ default: module.StaffIdManagement })), "Loading staff ID management...");
const LoadMonitoringPage = lazyLoadRoute(() => import("./pages/asset-management/LoadMonitoringPage"), "Loading load monitoring...");
const SubstationInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/SubstationInspectionPage"), "Loading substation inspection...");
const InspectionManagementPage = lazyLoadRoute(() => import("./pages/asset-management/InspectionManagementPage"), "Loading inspection management...");
const InspectionDetailsPage = lazyLoadRoute(() => import("./pages/asset-management/InspectionDetailsPage"), "Loading inspection details...");
const EditInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/EditInspectionPage"), "Loading edit inspection...");
const VITInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionPage"), "Loading VIT inspection...");
const VITInspectionManagementPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionManagementPage"), "Loading VIT inspection management...");
const VITInspectionDetailsPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionDetailsPage"), "Loading VIT inspection details...");
const EditVITInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/EditVITInspectionPage"), "Loading edit VIT inspection...");
const VITInspectionFormPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionFormPage"), "Loading VIT inspection form...");
const OverheadLineInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/OverheadLineInspectionPage"), "Loading overhead line inspection...");
const EquipmentFailureReportingPage = lazyLoadRoute(() => import("./pages/asset-management/EquipmentFailureReportingPage"), "Loading equipment failure reporting...");
const NotFound = lazyLoadRoute(() => import("./pages/NotFound"), "Loading page...");
const UnauthorizedPage = lazyLoadRoute(() => import("./pages/UnauthorizedPage"), "Loading unauthorized page...");
const CreateLoadMonitoringPage = lazyLoadRoute(() => import("./pages/asset-management/CreateLoadMonitoringPage"), "Loading create load monitoring...");
const EditLoadMonitoringPage = lazyLoadRoute(() => import("./pages/asset-management/EditLoadMonitoringPage"), "Loading edit load monitoring...");
const LoadMonitoringDetailsPage = lazyLoadRoute(() => import("./pages/asset-management/LoadMonitoringDetailsPage"), "Loading load monitoring details...");
const EditOP5FaultPage = lazyLoadRoute(() => import("@/pages/EditOP5FaultPage"), "Loading edit OP5 fault...");
const ControlSystemOutagePage = lazyLoadRoute(() => import("./pages/ControlSystemOutagePage"), "Loading control system outage...");
const EditControlOutagePage = lazyLoadRoute(() => import("@/pages/EditControlOutagePage"), "Loading edit control outage...");
const PermissionManagementPage = lazyLoadRoute(() => import('./pages/system-admin/PermissionManagementPage'), "Loading permission management...");
const RoleManagementPage = lazyLoadRoute(() => import('./pages/system-admin/RoleManagementPage'), "Loading role management...");
const RegionBasedAccessDemo = lazyLoadRoute(() => import('./pages/system-admin/RegionBasedAccessDemo'), "Loading region-based access demo...");
const SecurityMonitoringPage = lazyLoadRoute(() => import('./pages/system-admin/SecurityMonitoringPage'), "Loading security monitoring...");
const SecurityTestPage = lazyLoadRoute(() => import('./pages/system-admin/SecurityTestPage'), "Loading security test...");
const BroadcastManager = lazyLoadRoute(() => import('./pages/system-admin/BroadcastManager'), "Loading broadcast manager...");
const DistrictPopulationPage = lazyLoadRoute(() => import('./pages/DistrictPopulationPage'), "Loading district population...");
const UserProfilePage = lazyLoadRoute(() => import("./pages/UserProfilePage"), "Loading user profile...");
const EditVITAssetPage = lazyLoadRoute(() => import("./pages/asset-management/EditVITAssetPage"), "Loading edit VIT asset...");
const UserLogsPage = lazyLoadRoute(() => import("@/pages/UserLogsPage"), "Loading user logs...");
const SecondarySubstationInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/SecondarySubstationInspectionPage"), "Loading secondary substation inspection...");
const PendingApprovalPage = lazyLoadRoute(() => import("./pages/PendingApprovalPage"), "Loading pending approval...");
const MusicManagementPage = lazyLoadRoute(() => import("@/pages/admin/MusicManagementPage"), "Loading music management...");
const LoginBackgroundSettingsPage = lazyLoadRoute(() => import("@/pages/LoginBackgroundSettingsPage"), "Loading login background settings...");
const FeederOfflineTestPage = lazyLoadRoute(() => import("./pages/test/FeederOfflineTestPage"), "Loading feeder offline test...");
const DataDebugPage = lazyLoadRoute(() => import("./pages/test/DataDebugPage"), "Loading data debug page...");
const VITTestPage = lazyLoadRoute(() => import("./pages/test/VITTestPage"), "Loading VIT test page...");
const OfflineTestPage = lazyLoadRoute(() => import("./components/test/OfflineTestComponent"), "Loading offline test...");
const SubstationStatusPage = lazyLoadRoute(() => import("./pages/fault-management/SubstationStatusPage"), "Loading substation status...");
const TargetManagementPage = lazyLoadRoute(() => import("./pages/performance/TargetManagementPage"), "Loading target management...");
const RegionalPerformancePage = lazyLoadRoute(() => import("./pages/performance/RegionalPerformancePage"), "Loading regional performance...");
const DistrictPerformancePage = lazyLoadRoute(() => import("./pages/performance/DistrictPerformancePage"), "Loading district performance...");
const ReportsPage = lazyLoadRoute(() => import("./pages/ReportsPage"), "Loading reports...");

// OfflineStatus component is now imported from @/components/common/OfflineStatus

function App() {
  // Initialize service worker update handler
  useEffect(() => {
    // The service worker update handler is already initialized in its constructor
    console.log('[App] Service worker update handler initialized');
  }, []);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <AzureADAuthProvider>
            <DataProvider>
              <AudioProvider>
                <OfflineProvider>
                  <LoadMonitoringOfflineProvider>
                    <BrowserRouter>
                    <ErrorBoundary>
                      <OfflineStatus />
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<HomePage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignupPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/unauthorized" element={<UnauthorizedPage />} />

                      {/* Protected Routes */}
                      <Route path="/dashboard" element={
                        <ProtectedRoute>
                          <DashboardPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/report-fault" element={
                        <ProtectedRoute requiredFeature="fault_reporting">
                          <ReportFaultPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/control-system-outage" element={
                        <ProtectedRoute requiredFeature="fault_reporting">
                          <ControlSystemOutagePage />
                        </ProtectedRoute>
                      } />

                      <Route path="/analytics" element={
                        <ProtectedRoute requiredFeature="analytics">
                          <AnalyticsPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/control-system-analytics" element={
                        <ProtectedRoute requiredFeature="control_system_analytics">
                          <ControlSystemAnalyticsPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/user-profile" element={
                        <ProtectedRoute>
                          <UserProfilePage />
                        </ProtectedRoute>
                      } />

                      <Route path="/user-management" element={
                        <ProtectedRoute requiredFeature="user_management">
                          <UserManagementPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/staff-id-management" element={
                        <ProtectedRoute requiredFeature="staff_ids_management">
                          <StaffIdManagementPage />
                        </ProtectedRoute>
                      } />

                      {/* Asset Management Routes */}
                      {/* Redirect old URL pattern to new one for backward compatibility */}
                      <Route path="/asset-management/create-load-monitoring" element={
                        <Navigate to="/asset-management/load-monitoring/create" replace />
                      } />
                      
                      <Route path="/asset-management/load-monitoring" element={
                        <ProtectedRoute requiredFeature="load_monitoring">
                          <LoadMonitoringPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/load-monitoring/create" element={
                        <ProtectedRoute requiredFeature="load_monitoring">
                          <CreateLoadMonitoringPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/load-monitoring/edit/:id" element={
                        <ProtectedRoute requiredFeature="load_monitoring">
                          <EditLoadMonitoringPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/load-monitoring/details/:id" element={
                        <ProtectedRoute requiredFeature="load_monitoring">
                          <LoadMonitoringDetailsPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/inspection-management" element={
                        <ProtectedRoute requiredFeature="inspection_management">
                          <InspectionManagementPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/inspection-details/:id" element={
                        <ProtectedRoute requiredFeature="inspection_management">
                          <InspectionDetailsPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/substation-inspection" element={
                        <ProtectedRoute requiredFeature="substation_inspection">
                          <SubstationInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/secondary-substation-inspection" element={
                        <ProtectedRoute requiredFeature="substation_inspection">
                          <SecondarySubstationInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/secondary-substation-inspection/:id" element={
                        <ProtectedRoute requiredFeature="substation_inspection">
                          <SecondarySubstationInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/edit-inspection/:id" element={
                        <ProtectedRoute requiredFeature="inspection_management_update">
                          <EditInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/vit-inspection" element={
                        <ProtectedRoute requiredFeature="vit_inspection">
                          <VITInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/vit-inspection-management" element={
                        <ProtectedRoute requiredFeature="vit_inspection">
                          <VITInspectionManagementPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/vit-inspection-details/:id" element={
                        <ProtectedRoute requiredFeature="vit_inspection">
                          <VITInspectionDetailsPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/edit-vit-inspection/:id" element={
                        <ProtectedRoute requiredFeature="vit_inspection_update">
                          <EditVITInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/edit-vit-asset/:id" element={
                        <ProtectedRoute requiredFeature="vit_inspection_update">
                          <EditVITAssetPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/vit-inspection-form/:id" element={
                        <ProtectedRoute requiredFeature="vit_inspection">
                          <VITInspectionFormPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/overhead-line" element={
                        <ProtectedRoute requiredFeature="overhead_line_inspection">
                          <OverheadLineInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/overhead-line/details/:id" element={
                        <ProtectedRoute requiredFeature="overhead_line_inspection">
                          <InspectionDetailsPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/edit-overhead-line/:id" element={
                        <ProtectedRoute requiredFeature="overhead_line_inspection_update">
                          <EditInspectionPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/asset-management/equipment-failure-reporting" element={
                        <ProtectedRoute requiredFeature="equipment_failure_reporting">
                          <EquipmentFailureReportingPage />
                        </ProtectedRoute>
                      } />

                      {/* Fault Management Routes */}
                      <Route path="/fault-management/substation-status" element={
                        <ProtectedRoute requiredFeature="substation_inspection">
                          <SubstationStatusPage />
                        </ProtectedRoute>
                      } />

                      {/* System Admin Routes */}
                      {/* Redirect old URL pattern to new one for backward compatibility */}
                      <Route path="/system-admin/permissions" element={
                        <Navigate to="/system-admin/permission-management" replace />
                      } />
                      
                      {/* Redirect generic security route to security monitoring */}
                      <Route path="/system-admin/security" element={
                        <Navigate to="/system-admin/security-monitoring" replace />
                      } />
                      
                      <Route path="/system-admin/permission-management" element={
                        <ProtectedRoute requiredFeature="permission_management">
                          <PermissionManagementPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/system-admin/role-management" element={
                        <ProtectedRoute requiredFeature="role_management">
                          <RoleManagementPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/system-admin/security-monitoring" element={
                        <ProtectedRoute requiredFeature="security_monitoring">
                          <SecurityMonitoringPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/system-admin/security-test" element={
                        <ProtectedRoute requiredFeature="security_monitoring">
                          <SecurityTestPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/system-admin/region-based-access-demo" element={
                        <ProtectedRoute requiredFeature="region_based_access_demo">
                          <RegionBasedAccessDemo />
                        </ProtectedRoute>
                      } />

                      <Route path="/system-admin/broadcast-manager" element={
                        <ProtectedRoute>
                          <BroadcastManager />
                        </ProtectedRoute>
                      } />

                      {/* Performance & Target Management Routes */}
                      <Route path="/performance/targets" element={
                        <ProtectedRoute requiredRoles={['system_admin']}>
                          <TargetManagementPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/performance/regional" element={
                        <ProtectedRoute requiredRoles={['system_admin', 'global_engineer', 'regional_engineer', 'regional_general_manager']}>
                          <RegionalPerformancePage />
                        </ProtectedRoute>
                      } />

                      <Route path="/performance/district" element={
                        <ProtectedRoute requiredRoles={['system_admin', 'global_engineer', 'district_engineer', 'district_manager', 'technician']}>
                          <DistrictPerformancePage />
                        </ProtectedRoute>
                      } />

                      {/* Reports Routes */}
                      <Route path="/reports" element={
                        <ProtectedRoute>
                          <ReportsPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/system-admin/login-background" element={
                        <ProtectedRoute>
                          <LoginBackgroundSettingsPage />
                        </ProtectedRoute>
                      } />

                      {/* Other Routes */}
                      <Route path="/pending-approval" element={
                        <PendingApprovalPage />
                      } />
                      
                      <Route path="/district-population" element={
                        <ProtectedRoute requiredFeature="district_population">
                          <DistrictPopulationPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/user-logs" element={
                        <ProtectedRoute requiredFeature="user_logs">
                          <UserLogsPage />
                        </ProtectedRoute>
                      } />

                      {/* Redirect old URL pattern to new one for backward compatibility */}
                      <Route path="/admin/music" element={
                        <Navigate to="/admin/music-management" replace />
                      } />
                      
                      <Route path="/admin/music-management" element={
                        <ProtectedRoute requiredFeature="music_management">
                          <MusicManagementPage />
                        </ProtectedRoute>
                      } />

                      {/* Test Routes */}
                      <Route path="/test/feeder-offline" element={
                        <ProtectedRoute>
                          <FeederOfflineTestPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/test/data-debug" element={
                        <ProtectedRoute>
                          <DataDebugPage />
                        </ProtectedRoute>
                      } />

                                              <Route path="/test/vit" element={
                          <ProtectedRoute>
                            <VITTestPage />
                          </ProtectedRoute>
                        } />
                        
                      <Route path="/test/offline" element={
                        <ProtectedRoute>
                          <OfflineTestPage />
                        </ProtectedRoute>
                      } />

                      {/* Fault Management Routes */}
                      <Route path="/edit-op5-fault/:id" element={
                        <ProtectedRoute requiredFeature="fault_reporting">
                          <EditOP5FaultPage />
                        </ProtectedRoute>
                      } />

                      <Route path="/edit-control-outage/:id" element={
                        <ProtectedRoute requiredFeature="fault_reporting">
                          <EditControlOutagePage />
                        </ProtectedRoute>
                      } />

                        {/* Redirect old URL pattern to new one for backward compatibility */}
                        <Route path="/test/security" element={
                          <Navigate to="/system-admin/security-test" replace />
                        } />

                      {/* 404 Route */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </ErrorBoundary>
                  <Toaster />
                  <Sonner />
                  <PWAInstallPrompt />
                </BrowserRouter>
                  </LoadMonitoringOfflineProvider>
                </OfflineProvider>
              </AudioProvider>
            </DataProvider>
          </AzureADAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
