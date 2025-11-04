import { getWebSocketUrl, isProduction } from '../config/websocket';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, Function[]> = new Map();
  private isConnecting = false;
  private userId: string | null = null;
  private region: string | null = null;
  private district: string | null = null;

  constructor() {
    this.setupReconnection();
  }

  connect(userId: string, region?: string, district?: string) {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.userId = userId;
    this.region = region || null;
    this.district = district || null;
    this.isConnecting = true;

    // Log connection attempt
    console.log(`🔗 Attempting WebSocket connection for user: ${userId} (${region}/${district})`);

    try {
      const params = new URLSearchParams({ userId });
      if (region) params.append('region', region);
      if (district) params.append('district', district);

      // Use configuration to determine WebSocket URL
      const wsUrl = `${getWebSocketUrl()}?${params}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const backend = isProduction() ? 'Azure' : 'Local';
        console.log(`🔗 WebSocket connected to ${backend} backend`);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected', { userId, region, district });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        if (event.code !== 1000) { // Not a normal closure
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        if (this.userId) {
          this.connect(this.userId, this.region, this.district);
        }
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('reconnect_failed', { attempts: this.reconnectAttempts });
    }
  }

  private setupReconnection() {
    // Reconnect when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.userId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        console.log('🔄 Page became visible, attempting reconnection');
        this.connect(this.userId, this.region, this.district);
      }
    });

    // Reconnect when network comes back online
    window.addEventListener('online', () => {
      if (this.userId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        console.log('🔄 Network came online, attempting reconnection');
        this.connect(this.userId, this.region, this.district);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
    }
    this.userId = null;
    this.region = null;
    this.district = null;
    this.reconnectAttempts = 0;
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message');
      return false;
    }
  }

  sendChatMessage(text: string, sender: string, region?: string, district?: string) {
    return this.send({
      type: 'chat_message',
      text,
      sender,
      region,
      district
    });
  }

  sendBroadcastMessage(title: string, message: string, priority: string, createdBy: string, targetRegions?: string[], targetDistricts?: string[]) {
    return this.send({
      type: 'broadcast_message',
      title,
      message,
      priority,
      createdBy,
      targetRegions,
      targetDistricts
    });
  }

  // Request initial messages when WebSocket connects
  requestInitialMessages() {
    return this.send({
      type: 'request_initial_messages'
    });
  }

  // Request initial broadcast messages
  requestInitialBroadcasts() {
    return this.send({
      type: 'request_initial_broadcasts'
    });
  }

  // Delete broadcast message
  deleteBroadcastMessage(messageId: string) {
    return this.send({
      type: 'delete_broadcast_message',
      messageId
    });
  }

  deleteChatMessage(messageId: string) {
    return this.send({
      type: 'delete_chat_message',
      messageId
    });
  }

  private handleMessage(data: any) {
    console.log('📨 Received WebSocket message:', data.type);
    this.emit(data.type, data);
  }

  // Event handling
  on(event: string, handler: Function) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Utility methods
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
      connected: this.isConnected(),
      state: this.getConnectionState(),
      reconnectAttempts: this.reconnectAttempts,
      userId: this.userId,
      region: this.region,
      district: this.district
    };
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();
export default webSocketService;
