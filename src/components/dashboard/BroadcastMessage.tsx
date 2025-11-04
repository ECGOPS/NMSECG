import React, { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { BroadcastMessage as BroadcastMessageType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import webSocketService from '@/services/WebSocketServiceEnhanced';
import { LoggingService } from '@/services/LoggingService';
import { Trash2, Edit, Eye, AlertCircle, Bell, Info, X, Wifi, WifiOff } from 'lucide-react';

interface BroadcastMessage {
  id: string;
  message: string;
  createdAt?: string | { _seconds: number; _nanoseconds: number };
  timestamp?: string; // Add timestamp field that comes from WebSocket
  createdBy?: string;
  targetRegions?: string;
  priority: "low" | "medium" | "high";
}

export function BroadcastMessage() {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const { user } = useAzureADAuth(); // Changed from useAuth to useAzureADAuth

  useEffect(() => {
    // Load messages from localStorage as fallback
    const loadMessagesFromStorage = () => {
      try {
        const stored = localStorage.getItem('broadcast_messages');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            console.log(`💾 Loaded ${parsed.length} broadcast messages from localStorage`);
          }
        }
      } catch (error) {
        console.error('Error loading broadcast messages from localStorage:', error);
      }
    };

    // Load messages from localStorage first
    loadMessagesFromStorage();
    
    // Limit stored messages to prevent localStorage from growing too large
    const limitStoredMessages = (messages: BroadcastMessage[]) => {
      const MAX_STORED_MESSAGES = 50; // Keep only last 50 broadcast messages
      if (messages.length > MAX_STORED_MESSAGES) {
        return messages.slice(-MAX_STORED_MESSAGES);
      }
      return messages;
    };
    
    const handleConnected = () => {
      setWsConnected(true);
      console.log('🔗 WebSocket connected for broadcasts');
      
      // Request initial broadcast messages
      webSocketService.requestInitialBroadcasts();
    };
    
    const handleDisconnected = () => {
      setWsConnected(false);
      console.log('🔌 WebSocket disconnected from broadcasts');
    };
    
    const handleBroadcastMessage = (message: BroadcastMessage) => {
      // Check if message already exists to prevent duplicates
      setMessages(prev => {
        const exists = prev.some(existing => {
          if (existing.id === message.id) return true;
          
          // Check if it's the same message content from the same user
          const existingCreator = existing.createdBy || existing.targetRegions || 'Unknown';
          const messageCreator = message.createdBy || message.targetRegions || 'Unknown';
          if (existing.message === message.message && existingCreator === messageCreator) {
            // Try to compare timestamps, handling different formats
            try {
              const existingTime = existing.timestamp || existing.createdAt;
              const messageTime = message.timestamp || message.createdAt;
              
              if (existingTime && messageTime) {
                let existingDate: Date;
                let messageDate: Date;
                
                // Handle Firebase timestamp format
                if (typeof existingTime === 'object' && existingTime._seconds) {
                  existingDate = new Date(existingTime._seconds * 1000);
                } else {
                  existingDate = new Date(existingTime as string);
                }
                
                if (typeof messageTime === 'object' && messageTime._seconds) {
                  messageDate = new Date(messageTime._seconds * 1000);
                } else {
                  messageDate = new Date(messageTime as string);
                }
                
                // Check if timestamps are within 5 seconds
                return Math.abs(existingDate.getTime() - messageDate.getTime()) < 5000;
              }
            } catch (error) {
              console.log('📢 Error comparing timestamps for duplicate check:', error);
            }
          }
          
          return false;
        });
        
        if (exists) {
          console.log('📢 Broadcast message already exists, skipping duplicate:', message.id);
          return prev;
        }
        
        console.log('📢 Adding new broadcast message:', message.id);
        const updated = [message, ...prev];
        
        // Save to localStorage as backup
        try {
          const limitedMessages = limitStoredMessages(updated);
          localStorage.setItem('broadcast_messages', JSON.stringify(limitedMessages));
        } catch (error) {
          console.error('Error saving broadcast messages to localStorage:', error);
        }
        
        return updated;
      });
      toast.success(`New broadcast: ${message.message}`);
    };
    
    const handleInitialBroadcasts = (data: { messages: BroadcastMessage[] }) => {
      if (data.messages && Array.isArray(data.messages)) {
        console.log('📢 Received initial broadcasts from WebSocket:', data.messages);
        setMessages(data.messages);
        console.log(`📢 Loaded ${data.messages.length} initial broadcast messages`);
        
        // Save to localStorage as backup
        try {
          const limitedMessages = limitStoredMessages(data.messages);
          localStorage.setItem('broadcast_messages', JSON.stringify(limitedMessages));
          console.log('💾 Saved initial broadcast messages to localStorage');
        } catch (error) {
          console.error('Error saving broadcast messages to localStorage:', error);
        }
      }
    };
    
    const handleBroadcastMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => {
        const updated = prev.filter(msg => msg.id !== data.messageId);
        // Update localStorage
        try {
          const limitedMessages = limitStoredMessages(updated);
          localStorage.setItem('broadcast_messages', JSON.stringify(limitedMessages));
        } catch (error) {
          console.error('Error updating localStorage after deletion:', error);
        }
        return updated;
      });
      console.log(`🗑️ Removed deleted broadcast message: ${data.messageId}`);
    };
    
    // Only set up WebSocket connection for real-time updates
    if (user?.id) {
      // No initial API call - WebSocket will provide all messages
      
      // Set up WebSocket connection for real-time updates
      webSocketService.connect(user.id, user.region, user.district);
      
      // Listen for WebSocket events
      webSocketService.on('connected', handleConnected);
      webSocketService.on('disconnected', handleDisconnected);
      webSocketService.on('broadcast_message', handleBroadcastMessage);
      webSocketService.on('initial_broadcasts', handleInitialBroadcasts);
      webSocketService.on('broadcast_message_deleted', handleBroadcastMessageDeleted);
    }
    
    // Remove fallback polling - WebSocket handles real-time updates
    
    return () => {
      // Properly remove event listeners using the stored references
      webSocketService.off('connected', handleConnected);
      webSocketService.off('disconnected', handleDisconnected);
      webSocketService.off('broadcast_message', handleBroadcastMessage);
      webSocketService.off('initial_broadcasts', handleInitialBroadcasts);
      webSocketService.off('broadcast_message_deleted', handleBroadcastMessageDeleted);
    };
  }, [user]);

  // Remove the loadMessages function - WebSocket handles all message loading

  const deleteMessage = async (messageId: string) => {
    try {
      // Find the message to log deletion details
      const messageToDelete = messages.find(msg => msg.id === messageId);
      
      // Log the delete action before deleting
      if (messageToDelete) {
        await LoggingService.getInstance().logDeleteAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'broadcast_message',
          messageId,
          messageToDelete, // deleted data
          `Deleted broadcast message: ${messageToDelete.message.substring(0, 50)}${messageToDelete.message.length > 50 ? '...' : ''}`,
          user?.region,
          user?.district
        );
      }

      await webSocketService.deleteBroadcastMessage(messageId);
      toast.success('Message deleted successfully');
      // Reload messages - WebSocket will handle this
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const formatTimestamp = (message: BroadcastMessage) => {
    try {
      // Prioritize timestamp from WebSocket, fallback to createdAt
      const timestamp = message.timestamp || message.createdAt;
      
      console.log('🔍 Formatting timestamp for message:', message.id);
      console.log('🔍 Timestamp value:', timestamp, 'Type:', typeof timestamp);
      
      let date: Date;
      
      // Handle Firebase Timestamp format
      if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
        date = new Date(timestamp._seconds * 1000);
        console.log('📅 Firebase timestamp converted to:', date);
      } else if (typeof timestamp === 'string') {
        // Handle ISO string format
        date = new Date(timestamp);
        console.log('📅 String timestamp converted to:', date);
      } else if (timestamp instanceof Date) {
        date = timestamp;
        console.log('📅 Already a Date object:', date);
      } else if (typeof timestamp === 'number') {
        // Handle numeric timestamp (milliseconds since epoch)
        date = new Date(timestamp);
        console.log('📅 Numeric timestamp converted to:', date);
      } else {
        console.error("❌ Invalid timestamp format:", timestamp);
        return "Invalid time";
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.error("❌ Invalid date object:", date);
        return "Invalid time";
      }
      
      const formatted = format(date, "MMM d, yyyy 'at' h:mm a");
      console.log('✅ Formatted timestamp:', formatted);
      return formatted;
    } catch (error) {
      console.error("❌ Error formatting timestamp:", error, "Message:", message);
      return "Invalid time";
    }
  };

  const getPriorityIcon = (priority: "low" | "medium" | "high") => {
    switch (priority) {
      case "high":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "medium":
        return <Bell className="h-5 w-5 text-yellow-500" />;
      case "low":
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="relative overflow-hidden mb-6 h-[120px]">
      <style>
        {`
          @keyframes scroll {
            0% {
              transform: translateX(100%);
            }
            100% {
              transform: translateX(-100%);
            }
          }
          .scrolling-message {
            animation: scroll 20s linear infinite;
            white-space: nowrap;
          }
          .scrolling-message:hover {
            animation-play-state: paused;
          }
        `}
      </style>
      <div className="scrolling-message absolute top-0 left-0 w-full">
        <div className="flex space-x-4">
          {messages.map((message) => (
            <Card 
              key={message.id}
              className={`flex-shrink-0 shadow-sm transition-all duration-200 hover:shadow-md ${
                message.priority === "high" 
                  ? "border-l-4 border-red-500 bg-white dark:bg-gray-900" 
                  : message.priority === "medium"
                  ? "border-l-4 border-yellow-500 bg-white dark:bg-gray-900"
                  : "border-l-4 border-blue-500 bg-white dark:bg-gray-900"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getPriorityIcon(message.priority)}
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                        {message.message}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{message.createdBy || message.targetRegions || 'Unknown'}</span>
                        <span>•</span>
                        <span>{formatTimestamp(message)}</span>
                        <span>•</span>
                        <span className="capitalize">{message.priority} priority</span>
                      </div>
                    </div>
                  </div>
                  {(user?.role === "system_admin" || user?.role === "global_engineer") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      onClick={() => deleteMessage(message.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
} 