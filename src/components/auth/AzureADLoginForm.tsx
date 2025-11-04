import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Loader2, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const AzureADLoginForm: React.FC = () => {
  const { login, loading } = useAzureADAuth();
  const location = useLocation();
  const [forceReLogin, setForceReLogin] = useState(false);

  useEffect(() => {
    // Check if we're returning from logout and should force re-login
    const urlParams = new URLSearchParams(location.search);
    const shouldForceReLogin = urlParams.get('forceReLogin') === 'true';
    const isLogout = urlParams.get('logout') === 'true';
    
    if (shouldForceReLogin || isLogout) {
      setForceReLogin(true);
      console.log('[LoginForm] Force re-login enabled due to logout');
    }
  }, [location.search]);

  const handleLogin = async () => {
    try {
      await login(forceReLogin);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img 
              src="/ecg-images/ecg-logo.png" 
              alt="ECG Logo" 
              className="h-16 w-auto"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to ECG Network Management System
          </CardTitle>
          <CardDescription className="text-center">
            {forceReLogin && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                🔒 Re-authentication required for security
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                {forceReLogin ? 'Sign in (Re-authentication Required)' : 'Sign in with ECG Account'}
              </>
            )}
          </Button>
          
          <div className="text-center text-sm text-gray-600">
            <p>
              This application uses Azure Active Directory for secure authentication.
            </p>
            <p className="mt-2">
              Contact your system administrator if you need access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AzureADLoginForm; 