import { lazy } from 'react';
import { Loader2 } from 'lucide-react';

// Loading component for dynamic imports
export const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

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

// UI component dynamic imports
export const Dialog = lazy(() => import('@/components/ui/dialog'));
export const Select = lazy(() => import('@/components/ui/select'));
export const DropdownMenu = lazy(() => import('@/components/ui/dropdown-menu'));
export const Tabs = lazy(() => import('@/components/ui/tabs'));
export const Accordion = lazy(() => import('@/components/ui/accordion'));
export const Table = lazy(() => import('@/components/ui/table'));
export const Card = lazy(() => import('@/components/ui/card'));
export const Button = lazy(() => import('@/components/ui/button'));
export const Input = lazy(() => import('@/components/ui/input'));
export const Textarea = lazy(() => import('@/components/ui/textarea'));
export const Checkbox = lazy(() => import('@/components/ui/checkbox'));
export const RadioGroup = lazy(() => import('@/components/ui/radio-group'));
export const Avatar = lazy(() => import('@/components/ui/avatar'));
export const Badge = lazy(() => import('@/components/ui/badge'));
export const Label = lazy(() => import('@/components/ui/label'));
export const Alert = lazy(() => import('@/components/ui/alert'));
export const ScrollArea = lazy(() => import('@/components/ui/scroll-area'));
export const Pagination = lazy(() => import('@/components/ui/pagination')); 