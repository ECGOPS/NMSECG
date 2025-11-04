import { apiRequest } from '@/lib/api';

export interface ChatMessage {
  id: string;
  text?: string;
  sender: string;
  senderId: string;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  senderRegion?: string;
  senderDistrict?: string;
}

export class ChatService {
  private static instance: ChatService;

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async sendMessage(message: Partial<ChatMessage>): Promise<void> {
    await apiRequest('/api/chat_messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async getMessages(): Promise<ChatMessage[]> {
    return apiRequest('/api/chat_messages');
  }

  async deleteMessage(messageId: string): Promise<void> {
    await apiRequest(`/api/chat_messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async updateMessage(messageId: string, newText: string): Promise<void> {
    await apiRequest(`/api/chat_messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ text: newText }),
    });
  }

  // File upload: TODO - Implement backend endpoint for file uploads if needed
  async uploadFile(file: File, senderId: string): Promise<{ url: string; name: string; type: string }> {
    // TODO: Implement file upload to backend
    throw new Error('File upload not implemented. Backend support required.');
  }
}

 