import { lazy } from 'react';

// Azure AD Components
export const AzureADLoginForm = lazy(() => import('@/components/auth/AzureADLoginForm'));

// API-based Components
export const VITAssetForm = lazy(() => import('@/components/vit/VITAssetForm'));
export const VITInspectionForm = lazy(() => import('@/components/vit/VITInspectionForm'));
export const ControlSystemOutageForm = lazy(() => import('@/components/faults/ControlSystemOutageForm'));
export const OverheadLineInspectionForm = lazy(() => import('@/components/overhead-line/OverheadLineInspectionForm'));

// Dashboard Components
export const BroadcastMessage = lazy(() => import('@/components/dashboard/BroadcastMessage'));
export const BroadcastMessageForm = lazy(() => import('@/components/dashboard/BroadcastMessageForm'));

// Analytics Components
export const FeederManagement = lazy(() => import('@/components/analytics/FeederManagement'));
export const AnalyticsCharts = lazy(() => import('@/components/analytics/AnalyticsCharts'));

// Admin Components
export const ActiveUsers = lazy(() => import('@/components/admin/ActiveUsers'));
export const DistrictPopulationReset = lazy(() => import('@/components/admin/DistrictPopulationReset'));

// User Management Components
export const UsersList = lazy(() => import('@/components/user-management/UsersList'));
export const StaffIdManagement = lazy(() => import('@/components/user-management/StaffIdManagement'));

// Asset Management Components
export const VITAssetsTable = lazy(() => import('@/components/vit/VITAssetsTable'));
export const AssetInfoCard = lazy(() => import('@/components/vit/AssetInfoCard')); 