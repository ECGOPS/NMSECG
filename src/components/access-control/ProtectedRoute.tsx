import { ReactNode, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { UserRole } from '@/lib/types';
import { PermissionService } from '@/services/PermissionService';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[];
  allowedRegion?: string;
  allowedDistrict?: string;
  requiredFeature?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, allowedRegion, allowedDistrict, requiredFeature }) => {
  const { isAuthenticated, user, loading } = useAzureADAuth();
  const location = useLocation();
  const permissionService = PermissionService.getInstance();
  const [isInitialized, setIsInitialized] = useState(true); // PermissionService is already initialized as singleton
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated, 'user:', user, 'loading:', loading);
  console.log('ProtectedRoute - User role:', user?.role, 'User status:', user?.status);
  console.log('ProtectedRoute - User ID:', user?.id, 'User email:', user?.email);

  // Set timeout for loading state
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
      }, 30000); // 30 second timeout
      
      return () => clearTimeout(timeout);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading]);

  // Check feature-based access
  useEffect(() => {
    if (requiredFeature && user?.role) {
      const checkAccess = async () => {
        try {
          const access = await permissionService.canAccessFeature(user.role, requiredFeature);
          setHasAccess(access);
        } catch (error) {
          console.error('Error checking feature access:', error);
          setHasAccess(false);
        }
      };
      
      checkAccess();
    } else {
      // Reset access state when no feature is required
      setHasAccess(null);
    }
  }, [user?.role, requiredFeature]);

  // Show loading while authentication is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {loadingTimeout ? 'Loading is taking longer than expected...' : 'Loading authentication...'}
          </h2>
          <p className="text-gray-500 text-sm">
            {loadingTimeout 
              ? 'Please check your internet connection or try refreshing the page.'
              : 'Please wait while we verify your credentials.'
            }
          </p>
          {loadingTimeout && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          )}
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user is approved (not pending or pre_registered)
  // Only check this after we're sure the user is authenticated and user data is loaded
  if (user && (user.role === 'pending' || user.status === 'pre_registered')) {
    console.log('User not approved, redirecting to pending page');
    return <Navigate to="/pending-approval" replace />;
  }

  // If we're authenticated but still loading user data, show loading
  if (isAuthenticated && !user && !loading) {
    console.log('Authenticated but no user data, showing loading');
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading user data...</h2>
          <p className="text-gray-500 text-sm">Please wait while we load your profile.</p>
        </div>
      </div>
    );
  }

  // ICT role restriction - ICT users can ONLY access user management, staff ID management, and profile
  if (user?.role === 'ict') {
    console.log('ICT user detected, checking access to:', location.pathname);
    const allowedPaths = ['/user-management', '/staff-id-management', '/pending-approval', '/user-profile'];
    const isAllowedPath = allowedPaths.some(path => location.pathname.startsWith(path));
    
    if (!isAllowedPath) {
      console.log('ICT user accessing restricted path, redirecting to user management');
      return <Navigate to="/user-management" replace />;
    } else {
      console.log('ICT user accessing allowed path:', location.pathname);
    }
  }

  // ICT region-based restriction - ICT users can only see data from their assigned region
  if (user?.role === 'ict' && (location.pathname.startsWith('/user-management') || location.pathname.startsWith('/staff-id-management'))) {
    // ICT users are restricted to their assigned region only
    // This will be handled in the individual components to filter data by region
    console.log('ICT user accessing user/staff management - region restrictions will apply');
  }

  // Wait for permissions to be initialized
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading permissions...</h2>
        </div>
      </div>
    );
  }

  
  // Show loading while checking feature access
  if (requiredFeature && user?.role && hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Checking permissions...</h2>
        </div>
      </div>
    );
  }
  
  // Check if access is denied for required feature
  if (requiredFeature && user?.role && hasAccess === false) {
    console.log(`Access denied: User ${user.role} does not have access to feature ${requiredFeature}`);
    return <Navigate to="/unauthorized" replace />;
  }

  // Check role-based access
  if (requiredRole && user?.role) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.some(role => permissionService.hasRequiredRole(user.role, role))) {
      // Allow technicians to access asset management pages
      if (location.pathname.startsWith('/asset-management') && user.role === 'technician') {
        return <>{children}</>;
      }
      console.log(`Access denied: User ${user.role} does not have required role`);
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check region-based access
  if (allowedRegion && user?.role !== 'global_engineer' && user?.role !== 'system_admin') {
    if (user?.region !== allowedRegion) {
      console.log(`Access denied: User's region ${user?.region} does not match required region ${allowedRegion}`);
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check district-based access
  if (allowedDistrict && (user?.role === 'district_engineer' || user?.role === 'district_manager')) {
    if (user?.district !== allowedDistrict) {
      console.log(`Access denied: User's district ${user?.district} does not match required district ${allowedDistrict}`);
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute; 