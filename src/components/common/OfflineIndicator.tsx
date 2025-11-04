import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface OfflineIndicatorProps {
  showBanner?: boolean;
  showRetry?: boolean;
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  showBanner = true,
  showRetry = true,
  className = ''
}) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setLastError(null);
      if (showBanner) {
        toast.success('Connection restored!', {
          description: 'You are now back online.'
        });
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      if (showBanner) {
        toast.error('Connection lost', {
          description: 'You are currently offline. Some features may not work properly.'
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showBanner]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setLastError(null);

    try {
      // Test connection to the health endpoint
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        setIsOffline(false);
        toast.success('Connection test successful!');
      } else {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      setLastError(errorMessage);
      toast.error('Connection test failed', {
        description: errorMessage
      });
    } finally {
      setIsRetrying(false);
    }
  };

  if (!isOffline) {
    return null;
  }

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <WifiOff className="h-5 w-5 text-yellow-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                You're currently offline
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Some features may not work properly. Please check your internet connection.
              </p>
            </div>
            
            {showRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={isRetrying}
                className="ml-4 flex-shrink-0"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            )}
          </div>

          {lastError && (
            <div className="mt-3 p-2 bg-yellow-100 rounded border border-yellow-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  <strong>Last error:</strong> {lastError}
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-yellow-600">
            The app will automatically detect when you're back online.
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;
