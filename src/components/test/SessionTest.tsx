import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clearAllSessionData, getSessionStatus, isSessionCleared } from '@/utils/sessionUtils';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Badge } from '@/components/ui/badge';
import { SafeText } from '@/components/ui/safe-display';

export function SessionTest() {
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [isClearing, setIsClearing] = useState(false);
  const { user, logout } = useAzureADAuth();

  const checkSessionStatus = () => {
    const status = getSessionStatus();
    setSessionStatus(status);
    console.log('[SessionTest] Session status:', status);
  };

  const handleClearSession = async () => {
    setIsClearing(true);
    try {
      await clearAllSessionData();
      console.log('[SessionTest] Session cleared successfully');
      checkSessionStatus();
    } catch (error) {
      console.error('[SessionTest] Error clearing session:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('[SessionTest] Logout error:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Management Test</CardTitle>
          <CardDescription>
            Test session clearing functionality for multi-user device support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={checkSessionStatus} variant="outline">
              Check Session Status
            </Button>
            <Button onClick={handleClearSession} disabled={isClearing} variant="destructive">
              {isClearing ? 'Clearing...' : 'Clear All Session Data'}
            </Button>
            <Button onClick={handleLogout} variant="outline">
              Test Logout
            </Button>
            <Button 
              onClick={() => window.location.href = '/login?forceReLogin=true'} 
              variant="outline"
            >
              Force Re-Login
            </Button>
          </div>

          {sessionStatus && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Session Status:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>localStorage items: {sessionStatus.localStorageSize}</div>
                <div>sessionStorage items: {sessionStatus.sessionStorageSize}</div>
                <div>MSAL keys: {sessionStatus.msalKeysCount}</div>
                <div>Cookies: {sessionStatus.cookiesCount}</div>
              </div>
              <div className="mt-2">
                <strong>Session Cleared:</strong> {isSessionCleared() ? '✅ Yes' : '❌ No'}
              </div>
            </div>
          )}

          {user && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">Current User:</h3>
              <div className="text-sm">
                <div>Name: <SafeText content={user.name} /></div>
                <div>Email: <SafeText content={user.email} /></div>
                <div>Role: <SafeText content={user.role} /></div>
                <div>Status: <SafeText content={user.status} /></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SessionTest; 