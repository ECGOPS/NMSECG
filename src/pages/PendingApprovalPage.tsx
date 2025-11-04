import React from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, User, Mail, Building } from 'lucide-react';

export function PendingApprovalPage() {
  const { user, logout } = useAzureADAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Account Pending Approval
          </CardTitle>
          <CardDescription className="text-gray-600">
            Your account has been created but requires administrator approval
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* User Information */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                <strong>Name:</strong> {user?.displayName || user?.name || 'N/A'}
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                <strong>Email:</strong> {user?.email || 'N/A'}
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <Building className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                <strong>Status:</strong> Pending Approval
              </span>
            </div>
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your account will be reviewed by an administrator</li>
              <li>• You'll receive access once approved</li>
              <li>• You may be contacted for additional information</li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Need help?</h3>
            <p className="text-sm text-gray-600">
              Contact your system administrator or IT support team for assistance.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-3">
            <Button 
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
            
            <Button 
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Check Approval Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PendingApprovalPage; 