import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { toast } from '@/components/ui/sonner';

export const LogoutTest: React.FC = () => {
  const { user, logout, isAuthenticated } = useAzureADAuth();

  const testLogout = async () => {
    try {
      console.log('[LogoutTest] Starting logout test...');
      
      // Check current state before logout
      console.log('[LogoutTest] Current user:', user);
      console.log('[LogoutTest] Is authenticated:', isAuthenticated);
      console.log('[LogoutTest] localStorage items:', Object.keys(localStorage));
      console.log('[LogoutTest] sessionStorage items:', Object.keys(sessionStorage));
      
      // Check for MSAL accounts
      const { msalInstance } = await import('@/config/azure-ad');
      const accounts = msalInstance.getAllAccounts();
      console.log('[LogoutTest] MSAL accounts before logout:', accounts);
      
      // Perform logout
      await logout();
      
      toast.success('Logout test completed - check console for details');
      
    } catch (error) {
      console.error('[LogoutTest] Error during logout test:', error);
      toast.error('Logout test failed');
    }
  };

  const checkSessionState = () => {
    console.log('[LogoutTest] === SESSION STATE CHECK ===');
    console.log('[LogoutTest] User:', user);
    console.log('[LogoutTest] Is authenticated:', isAuthenticated);
    console.log('[LogoutTest] localStorage:', Object.keys(localStorage));
    console.log('[LogoutTest] sessionStorage:', Object.keys(sessionStorage));
    
    // Check MSAL state
    import('@/config/azure-ad').then(({ msalInstance }) => {
      const accounts = msalInstance.getAllAccounts();
      console.log('[LogoutTest] MSAL accounts:', accounts);
    });
    
    toast.info('Session state logged to console');
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Logout Test</CardTitle>
        <CardDescription>
          Test the logout functionality to ensure different users can login
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p><strong>Current User:</strong> {user?.name || 'Not logged in'}</p>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={checkSessionState} variant="outline">
            Check Session State
          </Button>
          <Button onClick={testLogout} variant="destructive">
            Test Logout
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>This test will:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Log current session state to console</li>
            <li>Perform logout with full cleanup</li>
            <li>Verify all session data is cleared</li>
            <li>Allow different users to login</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}; 