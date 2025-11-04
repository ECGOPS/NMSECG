import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { checkBackendHealth } from '@/lib/api';
import { toast } from '@/components/ui/sonner';

interface ServiceStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function ServiceStatus({ className, showDetails = false }: ServiceStatusProps) {
  const [healthStatus, setHealthStatus] = useState<{
    isHealthy: boolean;
    status: string;
    responseTime: number;
    lastChecked: Date;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const status = await checkBackendHealth();
      setHealthStatus(status);
      
      if (!status.isHealthy) {
        toast.error(`Backend service is ${status.status}`);
      } else {
        toast.success('Backend service is healthy');
      }
    } catch (error) {
      console.error('[ServiceStatus] Health check failed:', error);
      toast.error('Failed to check backend health');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Check health every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!healthStatus) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="animate-pulse bg-gray-200 h-4 w-4 rounded-full"></div>
            <span className="text-sm text-gray-500">Checking...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    if (healthStatus.isHealthy) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (healthStatus.status.includes('503') || healthStatus.status.includes('unavailable')) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = () => {
    if (healthStatus.isHealthy) {
      return 'bg-green-100 text-green-800';
    } else if (healthStatus.status.includes('503') || healthStatus.status.includes('unavailable')) {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = () => {
    if (healthStatus.isHealthy) {
      return 'Healthy';
    } else if (healthStatus.status.includes('503')) {
      return 'Service Unavailable';
    } else if (healthStatus.status.includes('502')) {
      return 'Bad Gateway';
    } else if (healthStatus.status.includes('504')) {
      return 'Gateway Timeout';
    } else {
      return 'Unhealthy';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            {getStatusIcon()}
            Service Status
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={checkHealth}
            disabled={isChecking}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={getStatusColor()}>
            {getStatusText()}
          </Badge>
          <span className="text-xs text-gray-500">
            {healthStatus.responseTime}ms
          </span>
        </div>
        
        {showDetails && (
          <div className="text-xs text-gray-500 space-y-1">
            <div>Last checked: {healthStatus.lastChecked.toLocaleTimeString()}</div>
            <div>Status: {healthStatus.status}</div>
            {!healthStatus.isHealthy && (
              <div className="text-red-600 font-medium">
                Backend service may be experiencing issues. Some features may not work properly.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
