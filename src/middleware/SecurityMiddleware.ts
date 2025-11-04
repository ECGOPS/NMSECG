import React from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';

export interface SecurityMiddlewareProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermissions?: string[];
}

export const SecurityMiddleware: React.FC<SecurityMiddlewareProps> = ({
  children,
  requiredRole,
  requiredPermissions = []
}) => {
  const { user, isAuthenticated, isLoading } = useAzureADAuth();

  // Show loading state while authentication is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access this resource.</p>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-600">
            You don't have the required role ({requiredRole}) to access this resource.
          </p>
        </div>
      </div>
    );
  }

  // Check permission-based access
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      user.permissions?.includes(permission)
    );

    if (!hasAllPermissions) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-gray-600">
              You don't have the required permissions to access this resource.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}; 