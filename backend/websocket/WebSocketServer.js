const WebSocket = require('ws');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // userId -> WebSocket
    this.userGroups = new Map(); // userId -> Set of groups
    this.groupMembers = new Map(); // groupName -> Set of userIds
    
    // Azure App Service optimization: Add connection persistence
    this.connectionPersistence = new Map(); // userId -> connection metadata
    this.reconnectAttempts = new Map(); // userId -> reconnect attempts
    
    // Azure-specific: Handle graceful shutdown
    this.isShuttingDown = false;
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    // Azure App Service: Handle graceful shutdown
    process.on('SIGTERM', () => {
      this.gracefulShutdown();
    });
    
    process.on('SIGINT', () => {
      this.gracefulShutdown();
    });
    
    console.log('✅ WebSocket server initialized with Azure App Service optimizations');
  }

  gracefulShutdown() {
    console.log('🔄 WebSocket server graceful shutdown initiated...');
    this.isShuttingDown = true;
    
    // Notify all clients about shutdown
    this.clients.forEach((ws, userId) => {
      try {
        ws.send(JSON.stringify({
          type: 'server_shutdown',
          message: 'Server is shutting down, please reconnect',
          timestamp: new Date().toISOString()
        }));
        ws.close(1001, 'Server shutdown');
      } catch (error) {
        console.error(`Error notifying user ${userId} of shutdown:`, error);
      }
    });
    
    // Close all connections
    this.wss.close(() => {
      console.log('✅ WebSocket server shutdown complete');
    });
  }

  handleConnection(ws, req) {
    const url = new URL(req.url, 'http://localhost');
    const userId = url.searchParams.get('userId');
    const region = url.searchParams.get('region');
    const district = url.searchParams.get('district');
    const clientId = url.searchParams.get('clientId') || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (userId) {
      console.log(`🔗 User ${userId} connected from ${region}/${district} (Client: ${clientId})`);
      
      // Store connection with metadata for Azure App Service persistence
      this.clients.set(userId, ws);
      this.connectionPersistence.set(userId, {
        clientId,
        region,
        district,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        reconnectCount: 0
      });
      
      this.addUserToGroups(userId, region, district);
      
      // Send connection confirmation with Azure-specific info
      ws.send(JSON.stringify({
        type: 'connected',
        userId,
        clientId,
        serverTime: new Date().toISOString(),
        azureInfo: {
          containerId: process.env.WEBSITE_INSTANCE_ID || 'unknown',
          region: process.env.WEBSITE_LOCATION || 'unknown',
          version: process.env.WEBSITE_SITE_NAME || 'nmsbackend'
        },
        timestamp: new Date().toISOString()
      }));
      
      // Azure optimization: Set connection keep-alive
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      ws.on('message', async (data) => {
        try {
          // Update last activity
          const persistence = this.connectionPersistence.get(userId);
          if (persistence) {
            persistence.lastActivity = new Date().toISOString();
          }
          
          const message = JSON.parse(data);
          await this.handleMessage(userId, message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });
      
      ws.on('close', (code, reason) => {
        console.log(`🔌 User ${userId} disconnected (Code: ${code}, Reason: ${reason})`);
        
        // Azure optimization: Handle reconnection attempts
        if (code !== 1000 && !this.isShuttingDown) {
          this.handleReconnectionAttempt(userId, region, district);
        }
        
        this.removeUser(userId);
      });
      
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for user ${userId}:`, error);
        this.removeUser(userId);
      });
      
      // Azure optimization: Handle ping/pong for connection health
      ws.on('ping', () => {
        ws.pong();
      });
      
    } else {
      console.warn('⚠️ WebSocket connection without userId, closing');
      ws.close(1008, 'Missing userId parameter');
    }
  }

  handleReconnectionAttempt(userId, region, district) {
    const persistence = this.connectionPersistence.get(userId);
    if (persistence) {
      persistence.reconnectCount++;
      persistence.lastDisconnect = new Date().toISOString();
      
      console.log(`🔄 User ${userId} reconnection attempt ${persistence.reconnectCount}`);
      
      // Store reconnection info for Azure App Service
      if (persistence.reconnectCount <= 5) { // Allow up to 5 reconnection attempts
        this.reconnectAttempts.set(userId, {
          userId,
          region,
          district,
          attemptCount: persistence.reconnectCount,
          lastAttempt: new Date().toISOString(),
          maxAttempts: 5
        });
      }
    }
  }

  // Azure optimization: Check connection health
  startHealthCheck() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('💀 Terminating inactive WebSocket connection');
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  // Azure optimization: Get connection statistics
  getConnectionStats() {
    return {
      totalConnections: this.clients.size,
      totalGroups: this.groupMembers.size,
      connectionPersistence: Array.from(this.connectionPersistence.entries()).map(([userId, data]) => ({
        userId,
        clientId: data.clientId,
        region: data.region,
        district: data.district,
        connectedAt: data.connectedAt,
        lastActivity: data.lastActivity,
        reconnectCount: data.reconnectCount
      })),
      reconnectAttempts: Array.from(this.reconnectAttempts.values()),
      isShuttingDown: this.isShuttingDown
    };
  }

  addUserToGroups(userId, region, district) {
    const groups = new Set();
    groups.add('global_chat');
    
    if (region) {
      groups.add(`chat_${region}`);
      groups.add(`broadcast_${region}`);
    }
    
    if (district) {
      groups.add(`chat_${region}_${district}`);
      groups.add(`broadcast_${region}_${district}`);
    }
    
    this.userGroups.set(userId, groups);
    
    groups.forEach(groupName => {
      if (!this.groupMembers.has(groupName)) {
        this.groupMembers.set(groupName, new Set());
      }
      this.groupMembers.get(groupName).add(userId);
    });
  }

  removeUser(userId) {
    this.clients.delete(userId);
    this.connectionPersistence.delete(userId);
    this.reconnectAttempts.delete(userId);
    
    const groups = this.userGroups.get(userId) || new Set();
    groups.forEach(groupName => {
      const group = this.groupMembers.get(groupName);
      if (group) {
        group.delete(userId);
        if (group.size === 0) {
          this.groupMembers.delete(groupName);
        }
      }
    });
    
    this.userGroups.delete(userId);
  }

  async handleMessage(userId, message) {
    console.log(`📨 Received message from ${userId}:`, message.type);
    
    switch (message.type) {
      case 'chat_message':
        await this.handleChatMessage(userId, message);
        break;
      case 'broadcast_message':
        await this.handleBroadcastMessage(userId, message);
        break;
      case 'request_initial_messages':
        await this.handleInitialMessagesRequest(userId, message);
        break;
      case 'request_initial_broadcasts':
        await this.handleInitialBroadcastsRequest(userId, message);
        break;
      case 'delete_broadcast_message':
        await this.handleDeleteBroadcastMessage(userId, message);
        break;
      case 'delete_chat_message':
        await this.handleDeleteChatMessage(userId, message);
        break;
      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  }

  async handleChatMessage(userId, message) {
    const chatMessage = {
      type: 'chat_message',
      id: message.id || Date.now().toString(),
      text: message.text,
      sender: message.sender,
      senderId: userId,
      timestamp: new Date().toISOString(),
      region: message.region,
      district: message.district
    };
    
    try {
      // Save message to database for persistence
      if (process.env.COSMOS_DB_ENDPOINT && !process.env.COSMOS_DB_ENDPOINT.includes('dev-cosmos-endpoint')) {
        const { CosmosClient } = require('@azure/cosmos');
        const endpoint = process.env.COSMOS_DB_ENDPOINT;
        const key = process.env.COSMOS_DB_KEY;
        const databaseId = process.env.COSMOS_DB_DATABASE;
        
        if (endpoint && key && databaseId) {
          const client = new CosmosClient({ endpoint, key });
          const database = client.database(databaseId);
          const container = database.container('chat_messages');
          
          // Prepare message for database storage
          const dbMessage = {
            id: chatMessage.id,
            text: chatMessage.text,
            sender: chatMessage.sender,
            senderId: chatMessage.senderId,
            timestamp: chatMessage.timestamp,
            region: chatMessage.region,
            district: chatMessage.district,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await container.items.create(dbMessage);
          console.log(`💾 Saved chat message ${chatMessage.id} to database`);
        }
      }
    } catch (error) {
      console.error('❌ Error saving chat message to database:', error);
      // Continue with broadcasting even if database save fails
    }
    
    // Broadcast message to appropriate groups
    if (message.region && message.district) {
      this.sendToGroup(`chat_${message.region}_${message.district}`, chatMessage);
    } else if (message.region) {
      this.sendToGroup(`chat_${message.region}`, chatMessage);
    } else {
      this.sendToGroup('global_chat', chatMessage);
    }
  }

  async handleBroadcastMessage(userId, message) {
    const broadcastMessage = {
      type: 'broadcast_message',
      id: message.id || Date.now().toString(),
      title: message.title,
      message: message.message,
      priority: message.priority,
      createdBy: message.createdBy,
      timestamp: new Date().toISOString(),
      targetRegions: message.targetRegions || [],
      targetDistricts: message.targetDistricts || []
    };
    
    try {
      // Save message to database for persistence
      if (process.env.COSMOS_DB_ENDPOINT && !process.env.COSMOS_DB_ENDPOINT.includes('dev-cosmos-endpoint')) {
        const { CosmosClient } = require('@azure/cosmos');
        const endpoint = process.env.COSMOS_DB_ENDPOINT;
        const key = process.env.COSMOS_DB_KEY;
        const databaseId = process.env.COSMOS_DB_DATABASE;
        
        if (endpoint && key && databaseId) {
          const client = new CosmosClient({ endpoint, key });
          const database = client.database(databaseId);
          const container = database.container('broadcastMessages');
          
          // Prepare message for database storage
          const dbMessage = {
            id: broadcastMessage.id,
            title: broadcastMessage.title,
            message: broadcastMessage.message,
            priority: broadcastMessage.priority,
            createdBy: broadcastMessage.createdBy,
            timestamp: broadcastMessage.timestamp,
            targetRegions: broadcastMessage.targetRegions,
            targetDistricts: broadcastMessage.targetDistricts,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true
          };
          
          await container.items.create(dbMessage);
          console.log(`💾 Saved broadcast message ${broadcastMessage.id} to database`);
        }
      }
    } catch (error) {
      console.error('❌ Error saving broadcast message to database:', error);
      // Continue with broadcasting even if database save fails
    }
    
    // Broadcast message to appropriate groups
    if (message.targetRegions && message.targetRegions.length > 0) {
      message.targetRegions.forEach(region => {
        this.sendToGroup(`broadcast_${region}`, broadcastMessage);
      });
    } else if (message.targetDistricts && message.targetDistricts.length > 0) {
      message.targetDistricts.forEach(district => {
        this.sendToGroup(`broadcast_${district}`, broadcastMessage);
      });
    } else {
      this.broadcast(broadcastMessage);
    }
  }

  async handleInitialMessagesRequest(userId, message) {
    try {
      // Use Cosmos DB client directly
      const { CosmosClient } = require('@azure/cosmos');
      const endpoint = process.env.COSMOS_DB_ENDPOINT;
      const key = process.env.COSMOS_DB_KEY;
      const databaseId = process.env.COSMOS_DB_DATABASE;
      
      if (!endpoint || endpoint.includes('dev-cosmos-endpoint')) {
        console.log('Development mode: returning empty chat messages array');
        this.sendToUser(userId, {
          type: 'initial_messages',
          messages: []
        });
        return;
      }
      
      const client = new CosmosClient({ endpoint, key });
      const database = client.database(databaseId);
      const container = database.container('chat_messages');
      
      // Get recent chat messages (limit to last 50)
      const { resources: messages } = await container.items.query('SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50').fetchAll();
      
      // Send initial messages to the user
      this.sendToUser(userId, {
        type: 'initial_messages',
        messages: messages
      });
      
      console.log(`📤 Sent ${messages.length} initial chat messages to user ${userId}`);
    } catch (error) {
      console.error('❌ Error fetching initial chat messages:', error);
      // Send empty messages array if there's an error
      this.sendToUser(userId, {
        type: 'initial_messages',
        messages: []
      });
    }
  }

  async handleInitialBroadcastsRequest(userId, message) {
    try {
      // Use Cosmos DB client directly
      const { CosmosClient } = require('@azure/cosmos');
      const endpoint = process.env.COSMOS_DB_ENDPOINT;
      const key = process.env.COSMOS_DB_KEY;
      const databaseId = process.env.COSMOS_DB_DATABASE;
      
      if (!endpoint || endpoint.includes('dev-cosmos-endpoint')) {
        console.log('Development mode: returning empty broadcast messages array');
        this.sendToUser(userId, {
          type: 'initial_broadcasts',
          messages: []
        });
        return;
      }
      
      const client = new CosmosClient({ endpoint, key });
      const database = client.database(databaseId);
      const container = database.container('broadcastMessages');
      
      // Get recent broadcast messages (limit to last 50)
      const { resources: messages } = await container.items.query('SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50').fetchAll();
      
      // Send initial broadcasts to the user
      this.sendToUser(userId, {
        type: 'initial_broadcasts',
        messages: messages
      });
      
      console.log(`📤 Sent ${messages.length} initial broadcast messages to user ${userId}`);
    } catch (error) {
      console.error('❌ Error fetching initial broadcast messages:', error);
      // Send empty messages array if there's an error
      this.sendToUser(userId, {
        type: 'initial_broadcasts',
        messages: []
      });
    }
  }

  async handleDeleteBroadcastMessage(userId, message) {
    try {
      // Use Cosmos DB client directly
      const { CosmosClient } = require('@azure/cosmos');
      const endpoint = process.env.COSMOS_DB_ENDPOINT;
      const key = process.env.COSMOS_DB_KEY;
      const databaseId = process.env.COSMOS_DB_DATABASE;
      
      if (!endpoint || endpoint.includes('dev-cosmos-endpoint')) {
        console.log('Development mode: cannot delete broadcast message');
        return;
      }
      
      const client = new CosmosClient({ endpoint, key });
      const database = client.database(databaseId);
      const container = database.container('broadcastMessages');
      
      // Delete the message
      await container.item(message.messageId, message.messageId).delete();
      
      // Broadcast the deletion to all users
      this.broadcast({
        type: 'broadcast_message_deleted',
        messageId: message.messageId
      });
      
      console.log(`🗑️ Deleted broadcast message ${message.messageId} by user ${userId}`);
    } catch (error) {
      console.error('❌ Error deleting broadcast message:', error);
    }
  }

  sendToUser(userId, data) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendToGroup(groupName, data) {
    const group = this.groupMembers.get(groupName);
    if (group) {
      let sentCount = 0;
      group.forEach(userId => {
        if (this.sendToUser(userId, data)) {
          sentCount++;
        }
      });
      console.log(`📤 Sent to group ${groupName}: ${sentCount} users`);
    }
  }

  broadcast(data) {
    let sentCount = 0;
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
        sentCount++;
      }
    });
    console.log(`📢 Broadcasted to ${sentCount} users`);
  }

  async handleDeleteChatMessage(userId, message) {
    try {
      // Use Cosmos DB client directly
      const { CosmosClient } = require('@azure/cosmos');
      const endpoint = process.env.COSMOS_DB_ENDPOINT;
      const key = process.env.COSMOS_DB_KEY;
      const databaseId = process.env.COSMOS_DB_DATABASE;
      
      if (!endpoint || endpoint.includes('dev-cosmos-endpoint')) {
        console.log('Development mode: cannot delete chat message');
        return;
      }
      
      const client = new CosmosClient({ endpoint, key });
      const database = client.database(databaseId);
      const container = database.container('chat_messages');
      
      // Delete the message
      await container.item(message.messageId, message.messageId).delete();
      
      // Broadcast the deletion to all users
      this.broadcast({
        type: 'chat_message_deleted',
        messageId: message.messageId
      });
      
      console.log(`🗑️ Deleted chat message ${message.messageId} by user ${userId}`);
    } catch (error) {
      console.error('❌ Error deleting chat message:', error);
    }
  }

  getStats() {
    return {
      totalConnections: this.clients.size,
      totalGroups: this.groupMembers.size,
      groups: Object.fromEntries(
        Array.from(this.groupMembers.entries()).map(([name, members]) => [name, members.size])
      )
    };
  }
}

module.exports = WebSocketServer;
