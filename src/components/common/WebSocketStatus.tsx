import React from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import webSocketService from '@/services/WebSocketServiceEnhanced';
import { isProduction, getWebSocketUrl } from '@/config/websocket';

interface WebSocketStatusProps {
  showDetails?: boolean;
}

export function WebSocketStatus({ showDetails = false }: WebSocketStatusProps) {
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectionState, setConnectionState] = React.useState('disconnected');
  const [stats, setStats] = React.useState<any>(null);

  React.useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setConnectionState('connected');
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setConnectionState('disconnected');
    };

    const handleReconnectFailed = () => {
      setConnectionState('failed');
    };

    // Set initial state
    setIsConnected(webSocketService.isConnected());
    setConnectionState(webSocketService.getConnectionState());

    // Listen for events
    webSocketService.on('connected', handleConnected);
    webSocketService.on('disconnected', handleDisconnected);
    webSocketService.on('reconnect_failed', handleReconnectFailed);

    // Update stats periodically
    const interval = setInterval(() => {
      setStats(webSocketService.getStats());
    }, 1000);

    return () => {
      webSocketService.off('connected', handleConnected);
      webSocketService.off('disconnected', handleDisconnected);
      webSocketService.off('reconnect_failed', handleReconnectFailed);
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    if (isConnected) {
      return <Wifi className="h-4 w-4 text-green-500" />;
    } else if (connectionState === 'connecting') {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    } else {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  if (!showDetails) {
    return (
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <Badge variant={isConnected ? 'default' : 'secondary'}>
          {isProduction() ? 'Azure' : 'Local'}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center space-x-2">
          {getStatusIcon()}
          <span>WebSocket Status</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Backend:</span>
          <Badge variant={isProduction() ? 'default' : 'secondary'}>
            {isProduction() ? 'Azure' : 'Local'}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Status:</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">URL:</span>
          <span className="text-xs text-muted-foreground font-mono">
            {getWebSocketUrl().replace('wss://', '').replace('ws://', '')}
          </span>
        </div>

        {stats && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              <div>Reconnect attempts: {stats.reconnectAttempts}</div>
              <div>Max attempts: {stats.maxReconnectAttempts}</div>
              <div>Connection time: {stats.connectionTime || 'N/A'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
