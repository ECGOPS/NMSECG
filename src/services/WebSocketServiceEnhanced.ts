import { getWebSocketUrl, isProduction } from '@/config/websocket';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketEventHandlers {
  [event: string]: ((data: any) => void)[];
}

class WebSocketServiceEnhanced {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private region: string | null = null;
  private district: string | null = null;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // Start with 1 second
  private maxReconnectDelay: number = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private eventHandlers: WebSocketEventHandlers = {};
  private connectionStartTime: number = 0;
  private lastPingTime: number = 0;
  private clientId: string;

  constructor() {
    // Generate unique client ID for Azure App Service tracking
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Azure App Service: Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handlePageHidden();
      } else {
        this.handlePageVisible();
      }
    });

    // Azure App Service: Handle online/offline events
    window.addEventListener('online', () => {
      console.log('🌐 Network online, attempting reconnection...');
      this.scheduleReconnect();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Network offline, WebSocket will reconnect when online');
    });

    // Azure App Service: Handle beforeunload for graceful disconnection
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }

  private handlePageHidden() {
    console.log('📱 Page hidden, reducing WebSocket activity');
    // Reduce ping frequency when page is hidden
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handlePageVisible() {
    console.log('📱 Page visible, restoring WebSocket activity');
    // Restore ping frequency when page is visible
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.startPingTimer();
    }
  }

  connect(userId: string, region?: string, district?: string) {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.userId = userId;
    this.region = region || null;
    this.district = district || null;
    this.isConnecting = true;
    this.connectionStartTime = Date.now();

    console.log(`🔗 Attempting enhanced WebSocket connection for user: ${userId} (${region}/${district})`);

    try {
      const params = new URLSearchParams({ 
        userId,
        clientId: this.clientId
      });
      if (region) params.append('region', region);
      if (district) params.append('district', district);

      const wsUrl = `${getWebSocketUrl()}?${params}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const backend = isProduction() ? 'Azure' : 'Local';
        const connectionTime = Date.now() - this.connectionStartTime;
        console.log(`🔗 Enhanced WebSocket connected to ${backend} backend in ${connectionTime}ms`);
        console.log(`🆔 Client ID: ${this.clientId}`);
        
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset reconnect delay
        
        // Start ping timer for Azure App Service health monitoring
        this.startPingTimer();
        
        this.emit('connected', { userId, region, district, clientId: this.clientId });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle Azure App Service specific messages
          if (data.type === 'server_shutdown') {
            console.log('🔄 Server shutdown detected, will reconnect automatically');
            this.handleServerShutdown();
            return;
          }
          
          if (data.type === 'pong') {
            this.lastPingTime = Date.now();
            return;
          }
          
          this.handleMessage(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        const connectionDuration = Date.now() - this.connectionStartTime;
        console.log(`🔌 Enhanced WebSocket disconnected after ${connectionDuration}ms:`, event.code, event.reason);
        
        this.isConnecting = false;
        this.stopPingTimer();
        
        this.emit('disconnected', { 
          code: event.code, 
          reason: event.reason,
          duration: connectionDuration,
          clientId: this.clientId
        });
        
        // Azure App Service: Handle different close codes
        if (event.code === 1001) {
          // Server shutdown - wait longer before reconnecting
          console.log('🔄 Server shutdown detected, waiting 5 seconds before reconnection...');
          setTimeout(() => this.scheduleReconnect(), 5000);
        } else if (event.code !== 1000) {
          // Abnormal closure - attempt reconnection
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Enhanced WebSocket error:', error);
        this.isConnecting = false;
        this.stopPingTimer();
      };

    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private handleServerShutdown() {
    // Azure App Service: Handle graceful server shutdown
    console.log('🔄 Server is shutting down, will reconnect when available');
    this.emit('server_shutdown', { 
      message: 'Server is shutting down, please wait for reconnection',
      clientId: this.clientId
    });
    
    // Wait longer before reconnection attempt
    setTimeout(() => this.scheduleReconnect(), 10000);
  }

  private startPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    
    // Azure App Service: Send ping every 25 seconds to keep connection alive
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendPing();
      }
    }, 25000);
  }

  private stopPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString(),
          clientId: this.clientId
        }));
        this.lastPingTime = Date.now();
      } catch (error) {
        console.error('❌ Error sending ping:', error);
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('reconnect_failed', { 
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        clientId: this.clientId
      });
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.userId) {
        console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect(this.userId, this.region, this.district);
      }
    }, delay);
  }

  disconnect() {
    console.log('🔌 Disconnecting enhanced WebSocket...');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopPingTimer();
    
    if (this.ws) {
      // Normal closure
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  private handleMessage(data: WebSocketMessage) {
    // Emit the message to all registered handlers
    if (this.eventHandlers[data.type]) {
      this.eventHandlers[data.type].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in event handler for ${data.type}:`, error);
        }
      });
    }
  }

  // Event handling methods
  on(event: string, handler: (data: any) => void) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event: string, handler: (data: any) => void) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Message sending methods
  sendChatMessage(text: string, sender: string, region?: string, district?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'chat_message',
          text,
          sender,
          region,
          district,
          timestamp: new Date().toISOString(),
          clientId: this.clientId
        }));
      } catch (error) {
        console.error('❌ Error sending chat message:', error);
        this.emit('error', { type: 'send_failed', error: error.message });
      }
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send chat message');
      this.emit('error', { type: 'not_connected', message: 'WebSocket not connected' });
    }
  }

  sendBroadcastMessage(title: string, message: string, priority: string, targetRegions?: string[], targetDistricts?: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'broadcast_message',
          title,
          message,
          priority,
          targetRegions,
          targetDistricts,
          timestamp: new Date().toISOString(),
          clientId: this.clientId
        }));
      } catch (error) {
        console.error('❌ Error sending broadcast message:', error);
        this.emit('error', { type: 'send_failed', error: error.message });
      }
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send broadcast message');
      this.emit('error', { type: 'not_connected', message: 'WebSocket not connected' });
    }
  }

  requestInitialMessages() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'request_initial_messages',
          timestamp: new Date().toISOString(),
          clientId: this.clientId
        }));
      } catch (error) {
        console.error('❌ Error requesting initial messages:', error);
      }
    }
  }

  requestInitialBroadcasts() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'request_initial_broadcasts',
          timestamp: new Date().toISOString(),
          clientId: this.clientId
        }));
      } catch (error) {
        console.error('❌ Error requesting initial broadcasts:', error);
      }
    }
  }

  deleteBroadcastMessage(messageId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'delete_broadcast_message',
          messageId,
          timestamp: new Date().toISOString(),
          clientId: this.clientId
        }));
      } catch (error) {
        console.error('❌ Error deleting broadcast message:', error);
      }
    }
  }

  deleteChatMessage(messageId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'delete_chat_message',
          messageId,
          timestamp: new Date().toISOString(),
          clientId: this.clientId
        }));
      } catch (error) {
        console.error('❌ Error deleting chat message:', error);
      }
    }
  }

  // Status and utility methods
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  getStats() {
    return {
      isConnected: this.isConnected(),
      connectionState: this.getConnectionState(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      connectionDuration: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
      lastPingTime: this.lastPingTime,
      clientId: this.clientId,
      userId: this.userId,
      region: this.region,
      district: this.district
    };
  }

  // Azure App Service: Force reconnection (useful for testing)
  forceReconnect() {
    console.log('🔄 Force reconnection requested');
    this.disconnect();
    setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId, this.region, this.district);
      }
    }, 1000);
  }
}

// Export singleton instance
const webSocketServiceEnhanced = new WebSocketServiceEnhanced();
export default webSocketServiceEnhanced;
