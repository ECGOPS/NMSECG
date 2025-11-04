import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, Wifi, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface NetworkStatus {
  isOnline: boolean;
  isSlow: boolean;
  lastCheck: Date;
  connectionType?: string;
}

export const OfflineStatus: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlow: false,
    lastCheck: new Date(),
  });
  const [isTesting, setIsTesting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Test network connection quality
  const testConnection = useCallback(async () => {
    setIsTesting(true);
    const startTime = Date.now();
    
    try {
      // Test multiple endpoints for better accuracy
      const endpoints = [
        '/manifest.json',
        'https://httpbin.org/status/200',
        'https://www.google.com/favicon.ico'
      ];
      
      const results = await Promise.allSettled(
        endpoints.map(endpoint => 
          fetch(endpoint, { 
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          })
        )
      );
      
      const successfulRequests = results.filter(result => 
        result.status === 'fulfilled' && result.value.ok
      ).length;
      
      const responseTime = Date.now() - startTime;
      const isSlow = responseTime > 3000; // Consider slow if > 3 seconds
      
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: successfulRequests > 0,
        isSlow: isSlow,
        lastCheck: new Date(),
      }));
      
      if (successfulRequests > 0) {
        // Connection restored
        setShowModal(false);
        setIsDismissed(false);
        // Force page refresh to update all components
        setTimeout(() => window.location.reload(), 1000);
      }
      
    } catch (error) {
      console.error('Connection test failed:', error);
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        lastCheck: new Date(),
      }));
    } finally {
      setIsTesting(false);
    }
  }, []);

  // Check network status periodically
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const response = await fetch('/manifest.json', { 
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          setNetworkStatus(prev => ({
            ...prev,
            isOnline: true,
            isSlow: false,
            lastCheck: new Date(),
          }));
          setShowModal(false);
          setIsDismissed(false);
        }
      } catch (error) {
        setNetworkStatus(prev => ({
          ...prev,
          isOnline: false,
          lastCheck: new Date(),
        }));
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkNetwork, 30000);
    
    // Initial check
    checkNetwork();
    
    return () => clearInterval(interval);
  }, []);

  // Listen for browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: true,
        isSlow: false,
        lastCheck: new Date(),
      }));
      setShowModal(false);
      setIsDismissed(false);
      document.body.classList.remove('offline');
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        lastCheck: new Date(),
      }));
      // Only show modal if not previously dismissed
      if (!isDismissed) {
        setShowModal(true);
      }
      document.body.classList.add('offline');
    };

    // Set initial state
    if (navigator.onLine) {
      document.body.classList.remove('offline');
    } else {
      document.body.classList.add('offline');
      // Only show modal if not previously dismissed
      if (!isDismissed) {
        setShowModal(true);
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.body.classList.remove('offline');
    };
  }, [isDismissed]);

  const handleDismiss = () => {
    setShowModal(false);
    setIsDismissed(true);
    // Store dismissal in localStorage to remember user preference
    localStorage.setItem('offline-modal-dismissed', Date.now().toString());
  };

  const handleClose = () => {
    setShowModal(false);
  };

  // Check if user previously dismissed the modal
  useEffect(() => {
    const dismissedTime = localStorage.getItem('offline-modal-dismissed');
    if (dismissedTime) {
      const timeSinceDismissed = Date.now() - parseInt(dismissedTime);
      // Show modal again after 1 hour (3600000 ms)
      if (timeSinceDismissed < 3600000) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem('offline-modal-dismissed');
      }
    }
  }, []);

  // Don't show anything if online
  if (networkStatus.isOnline && !showModal) return null;

  return (
    <>
      {/* Top banner for immediate visibility - always shown when offline */}
      <div className="offline-banner">
        <div className="flex items-center justify-center gap-2">
          {networkStatus.isSlow ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          <span>
            {networkStatus.isSlow 
              ? 'Slow connection detected. Some features may be slow.'
              : 'You\'re currently offline. Some features may not work properly.'
            }
          </span>
          <Wifi className="h-4 w-4" />
        </div>
      </div>
      
      {/* Main offline notification modal - non-blocking */}
      {showModal && (
        <div className="offline-modal">
          <Card className="offline-card">
            <CardHeader className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-yellow-100"
              >
                <X className="h-4 w-4" />
              </Button>
              <CardTitle className="flex items-center gap-2 text-yellow-800 pr-8">
                {networkStatus.isSlow ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <WifiOff className="h-5 w-5" />
                )}
                {networkStatus.isSlow ? 'Slow Connection' : 'You\'re currently offline'}
              </CardTitle>
              <CardDescription className="text-yellow-700">
                Last checked: {networkStatus.lastCheck.toLocaleTimeString()}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-yellow-700 text-sm">
                  {networkStatus.isSlow 
                    ? 'Your internet connection appears to be slow. This may affect app performance.'
                    : 'Some features may not work properly. Please check your internet connection.'
                  }
                </p>
                <p className="text-yellow-600 text-sm">
                  The app will automatically detect when your connection improves.
                </p>
                <p className="text-yellow-500 text-xs font-medium">
                  💡 You can continue using the app offline - your data will sync when connection returns.
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleDismiss}
                  className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                >
                  Don't Show Again
                </Button>
                <Button
                  onClick={testConnection}
                  disabled={isTesting}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {isTesting ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <WifiOff className="h-4 w-4 mr-2" />
                  )}
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default OfflineStatus;
