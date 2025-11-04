import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Minimize2, Maximize2, Edit, Trash2, Paperclip, Bell, Wifi, WifiOff } from "lucide-react";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { ChatService, ChatMessage } from "@/services/ChatService";
import webSocketService from '@/services/WebSocketServiceEnhanced';
import { LoggingService } from '@/services/LoggingService';
import { isProduction } from '@/config/websocket';
import { SafeText } from '@/components/ui/safe-display';
import { createSanitizedInputHandler, sanitizeFormData } from '@/utils/inputSanitization';
import { format } from 'date-fns';

// Helper function to parse timestamp into Date object
const parseTimestamp = (timestamp: any): Date | null => {
  try {
    if (!timestamp) {
      console.warn('[parseTimestamp] No timestamp provided');
      return null;
    }
    
    let date: Date;
    
    // Handle Firebase Timestamp format (with underscore prefix)
    if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
      date = new Date(timestamp._seconds * 1000);
    }
    // Handle standard Firestore timestamp format
    else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    }
    // Handle string timestamps (ISO format like "2024-01-15T14:30:00.000Z")
    else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
      // If parsing failed, try as number
      if (isNaN(date.getTime()) && !isNaN(Number(timestamp))) {
        const num = Number(timestamp);
        date = num < 10000000000 ? new Date(num * 1000) : new Date(num);
      }
    }
    // Handle numeric timestamps
    else if (typeof timestamp === 'number') {
      // Check if it's in seconds or milliseconds
      if (timestamp < 10000000000) { // Less than year 2286 in seconds
        date = new Date(timestamp * 1000); // Convert seconds to milliseconds
      } else {
        date = new Date(timestamp); // Already in milliseconds
      }
    }
    // Handle Date objects
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    else {
      // Try to convert to string first, then parse
      date = new Date(String(timestamp));
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('[parseTimestamp] Invalid date parsed from timestamp:', timestamp);
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('[parseTimestamp] Error parsing timestamp:', error, 'Input:', timestamp);
    return null;
  }
};

// Robust timestamp formatting function to handle Firebase timestamps (time only)
const formatChatTimestamp = (timestamp: any): string => {
  const date = parseTimestamp(timestamp);
  if (!date) return 'N/A';
  
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('[formatChatTimestamp] Error formatting timestamp:', error);
    return 'N/A';
  }
};

// Format timestamp with date and time
const formatChatDateTime = (timestamp: any): string => {
  const date = parseTimestamp(timestamp);
  if (!date) return 'N/A';
  
  try {
    // Always show full date with time including year: "Oct 9, 2024, 2:58 PM"
    return format(date, 'MMM d, yyyy, h:mm a');
  } catch (error) {
    console.error('[formatChatDateTime] Error formatting date/time:', error, 'Input:', timestamp);
    // Fallback: try to format directly
    try {
      const fallbackDate = new Date(timestamp);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate.toLocaleString([], { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      }
    } catch (e) {
      console.error('[formatChatDateTime] Fallback formatting also failed:', e);
    }
    return 'N/A';
  }
};

export function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAzureADAuth();
  const chatService = ChatService.getInstance();

  useEffect(() => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support desktop notification');
    } else {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Load messages on component mount and set up WebSocket
  useEffect(() => {
    // Load messages from localStorage as fallback
    const loadMessagesFromStorage = () => {
      try {
        const stored = localStorage.getItem('chat_messages');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            setIsLoading(false);
            console.log(`💾 Loaded ${parsed.length} chat messages from localStorage`);
          }
        }
      } catch (error) {
        console.error('Error loading messages from localStorage:', error);
      }
    };

    // Limit stored messages to prevent localStorage from growing too large
    const limitStoredMessages = (messages: ChatMessage[]) => {
      const MAX_STORED_MESSAGES = 100; // Keep only last 100 messages
      if (messages.length > MAX_STORED_MESSAGES) {
        return messages.slice(-MAX_STORED_MESSAGES);
      }
      return messages;
    };

    // Load messages from localStorage first
    loadMessagesFromStorage();
    
    // Store references to event handlers for proper cleanup
    const handleConnected = () => {
      setWsConnected(true);
      console.log('🔗 WebSocket connected for chat');
      
      // Request initial chat messages
      webSocketService.requestInitialMessages();
    };
    
    const handleDisconnected = () => {
      setWsConnected(false);
      console.log('🔌 WebSocket disconnected from chat');
    };
    
    const handleInitialMessages = (data: { messages: ChatMessage[] }) => {
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setIsLoading(false);
        console.log(`💬 Loaded ${data.messages.length} initial chat messages`);
        
        // Save to localStorage as backup
        try {
          const limitedMessages = limitStoredMessages(data.messages);
          localStorage.setItem('chat_messages', JSON.stringify(limitedMessages));
          console.log('💾 Saved initial messages to localStorage');
        } catch (error) {
          console.error('Error saving messages to localStorage:', error);
        }
      }
    };

    const handleChatMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => {
        const updated = prev.filter(msg => msg.id !== data.messageId);
        // Update localStorage
        try {
          const limitedMessages = limitStoredMessages(updated);
          localStorage.setItem('chat_messages', JSON.stringify(limitedMessages));
        } catch (error) {
          console.error('Error updating localStorage after deletion:', error);
        }
        return updated;
      });
      console.log(`🗑️ Removed deleted chat message: ${data.messageId}`);
    };
    
    const handleChatMessage = (message: ChatMessage) => {
      // Check if message already exists to prevent duplicates
      setMessages(prev => {
        const exists = prev.some(existing => {
          if (existing.id === message.id) return true;
          
          // Check if it's the same message content from the same user
          if (existing.text === message.text && existing.senderId === message.senderId) {
            // Try to compare timestamps, handling different formats
            try {
              const existingTime = existing.timestamp;
              const messageTime = message.timestamp;
              
              if (existingTime && messageTime) {
                const existingDate = new Date(existingTime);
                const messageDate = new Date(messageTime);
                
                // Check if timestamps are within 5 seconds
                return Math.abs(existingDate.getTime() - messageDate.getTime()) < 5000;
              }
            } catch (error) {
              console.log('💬 Error comparing timestamps for duplicate check:', error);
            }
          }
          
          return false;
        });
        
        if (exists) {
          console.log('💬 Message already exists, skipping duplicate:', message.id);
          return prev;
        }
        
        console.log('💬 Adding new chat message:', message.id);
        const updated = [...prev, message];
        
        // Save to localStorage as backup
        try {
          const limitedMessages = limitStoredMessages(updated);
          localStorage.setItem('chat_messages', JSON.stringify(limitedMessages));
        } catch (error) {
          console.error('Error saving messages to localStorage:', error);
        }
        
        return updated;
      });
      
      if (document.hidden || isMinimized) {
        setUnreadCount(prev => prev + 1);
        setHasNewMessages(true);
      }
    };
    
    // Only set up WebSocket connection
    if (user?.id) {
      webSocketService.connect(user.id, user.region, user.district);
      
      // Listen for WebSocket events
      webSocketService.on('connected', handleConnected);
      webSocketService.on('disconnected', handleDisconnected);
      webSocketService.on('chat_message', handleChatMessage);
      webSocketService.on('initial_messages', handleInitialMessages);
      webSocketService.on('chat_message_deleted', handleChatMessageDeleted);
    }
    
    return () => {
      // Properly remove event listeners using the stored references
      webSocketService.off('connected', handleConnected);
      webSocketService.off('disconnected', handleDisconnected);
      webSocketService.off('chat_message', handleChatMessage);
      webSocketService.off('initial_messages', handleInitialMessages);
      webSocketService.off('chat_message_deleted', handleChatMessageDeleted);
    };
  }, [user, isMinimized]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.hasFocus()) {
        setUnreadCount(0);
      }
    };

    window.addEventListener('focus', handleFocus);
    
    if (!isMinimized && unreadCount > 0) {
        setUnreadCount(0);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isMinimized, unreadCount]);

  useEffect(() => {
    if (scrollRef.current && !editingMessageId) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, editingMessageId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);

    try {
      console.log('Uploading file:', file.name);
      const fileDetails = await chatService.uploadFile(file, user.id);

      console.log('File uploaded, sending message with details:', fileDetails);
      await chatService.sendMessage({
        text: newMessage.trim() === '' ? undefined : newMessage.trim(),
        sender: user.name || 'Anonymous',
        senderId: user.id,
        fileUrl: fileDetails.url,
        fileName: fileDetails.name,
        fileType: fileDetails.type,
        senderRegion: user.region,
        senderDistrict: user.district,
        timestamp: new Date().toISOString()
      });

      setNewMessage('');
      console.log('Message with attachment sent.');

    } catch (error) {
      console.error('Error uploading file or sending message:', error);
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleAttachmentClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || isUploading) return;

    try {
      // Send message via WebSocket if connected, otherwise fallback to API
      if (wsConnected) {
        webSocketService.sendChatMessage(
          newMessage.trim(),
          user.name || 'Anonymous',
          user.region,
          user.district
        );
        
        // Don't add message to local state immediately - WebSocket will send it back
        // This prevents duplicate messages
      } else {
        // Fallback to API
        await chatService.sendMessage({
          text: newMessage.trim(),
          sender: user.name || 'Anonymous',
          senderId: user.id,
          senderRegion: user.region,
          senderDistrict: user.district,
          timestamp: new Date().toISOString()
        });
      }
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isUploading) {
        if (editingMessageId) {
          handleSaveEdit();
        } else {
          if (newMessage.trim()) {
            handleSendMessage();
          }
        }
      }
    }
  };

  const handleEditClick = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.text);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingMessageText.trim()) {
        console.log("Save edit aborted: No message selected or text is empty.");
        return;
    }

    try {
      // Find the original message to log the changes
      const originalMessage = messages.find(msg => msg.id === editingMessageId);
      
      if (originalMessage) {
        // Log the edit action before updating
        await LoggingService.getInstance().logEditAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'chat_message',
          editingMessageId,
          originalMessage, // old values
          { ...originalMessage, message: editingMessageText }, // new values
          `Edited chat message: ${editingMessageText.substring(0, 50)}${editingMessageText.length > 50 ? '...' : ''}`,
          user?.region,
          user?.district
        );
      }

      console.log(`Attempting to update message ${editingMessageId} with text: ${editingMessageText}`);
      await chatService.updateMessage(editingMessageId, editingMessageText);
      console.log("Message updated successfully.");
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };

  const handleDeleteClick = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      // Find the message to log deletion details
      const messageToDelete = messages.find(msg => msg.id === messageId);
      
      if (messageToDelete) {
        // Log the delete action before deleting
        await LoggingService.getInstance().logDeleteAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'chat_message',
          messageId,
          messageToDelete, // deleted data
          `Deleted chat message: ${messageToDelete.message.substring(0, 50)}${messageToDelete.message.length > 50 ? '...' : ''}`,
          user?.region,
          user?.district
        );
      }

      console.log(`Attempting to delete message with ID: ${messageId}`);
      // Use WebSocket service instead of API
      webSocketService.deleteChatMessage(messageId);
      console.log(`Message ${messageId} deletion request sent via WebSocket.`);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .blinking-text {
          animation: blink 1s linear infinite;
        }
      `}</style>
      <Card className={`w-80 shadow-lg transition-all duration-300 ${isMinimized ? 'h-12 bg-blue-500 text-primary-foreground' : 'h-96'}`}>
        <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMinimized ? 'py-2' : 'pb-2'} px-4 relative`}>
          <div className="flex items-center space-x-2">
            <CardTitle className={`text-base font-semibold truncate ${isMinimized ? 'text-primary-foreground' : ''}`}>Team Chat</CardTitle>
            {!isMinimized && (
              <div className="flex items-center space-x-1">
                {wsConnected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs px-2 py-1 rounded-full ${
                  isProduction() 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {isProduction() ? 'Azure' : 'Local'}
                </span>
              </div>
            )}
          </div>
          
          {isMinimized && (
             <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                   <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                   </span>
                )}
                {unreadCount > 0 && (
                  <span className="ml-1 text-xs font-bold text-primary-foreground">{unreadCount}</span>
                )}
                 <Bell className={`h-4 w-4 ${isMinimized ? 'text-primary-foreground' : ''}`} />
             </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className={`flex-shrink-0 w-8 h-8 ${isMinimized ? 'text-primary-foreground hover:bg-blue-600' : ''}`}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {!isMinimized && (
          <CardContent 
            className="flex flex-col h-[calc(100%-3rem)] p-4"
            style={{
              backgroundImage: "url('/images/gina.png')",
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          >
            <ScrollArea ref={scrollRef} className="flex-1 pr-4">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center text-sm text-muted-foreground">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      {editingMessageId === message.id ? (
                        <div className="flex flex-col w-full">
                          <Input
                            value={editingMessageText}
                            onChange={createSanitizedInputHandler(setEditingMessageText)}
                            onKeyPress={handleKeyPress}
                            className="mb-2"
                            autoFocus
                          />
                          <div className="flex justify-end space-x-2 text-xs">
                            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                            <Button variant="default" size="sm" onClick={handleSaveEdit} disabled={!editingMessageText.trim()}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`flex flex-col max-w-[80%] group relative ${
                            message.senderId === user?.id
                              ? 'bg-primary text-primary-foreground rounded-lg rounded-br-none'
                              : 'bg-muted rounded-lg rounded-tl-none'
                          } px-3 py-2 text-sm`}
                        >
                          <div className={`text-xs opacity-80 mb-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                            <SafeText content={message.sender} />
                          </div>
                          {(message.senderRegion || message.senderDistrict) && (
                            <div className={`text-[10px] mt-0.5 mb-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}
                              style={{ lineHeight: 1 }}
                            >
                              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-600 text-white font-medium border border-blue-700 shadow-sm blinking-text">
                                <SafeText content={message.senderRegion ? message.senderRegion : ''} />
                                {message.senderRegion && message.senderDistrict ? ', ' : ''}
                                <SafeText content={message.senderDistrict ? message.senderDistrict : ''} />
                              </span>
                            </div>
                          )}
                          {message.text && <p className="break-words"><SafeText content={message.text} /></p>}
                          {message.fileUrl && message.fileName && (
                            <a
                              href={message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline break-words"
                            >
                              <SafeText content={message.fileName} />
                            </a>
                          )}
                          <div className={`text-xs opacity-60 mt-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                            {formatChatDateTime(message.timestamp)}
                          </div>
                          {message.senderId === user?.id && (
                            <div className={`absolute ${message.senderId === user?.id ? '-left-12' : '-right-12'} top-1/2 transform -translate-y-1/2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity items-center`}>
                              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handleEditClick(message)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-6 h-6 text-red-500 hover:text-red-700" onClick={() => handleDeleteClick(message.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center space-x-2 mt-auto pt-3 border-t">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAttachmentClick}
                className="flex-shrink-0"
                disabled={isUploading}
              >
                {isUploading ? (
                  <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z"></path></svg>
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Input
                value={newMessage}
                onChange={createSanitizedInputHandler(setNewMessage)}
                onKeyPress={handleKeyPress}
                placeholder={isUploading ? "Uploading..." : "Type a message..."}
                className="flex-grow"
                disabled={isUploading}
              />
              <Button type="submit" onClick={handleSendMessage} size="icon" disabled={!newMessage.trim() || isUploading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
}