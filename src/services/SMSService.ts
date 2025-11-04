import { apiRequest } from '@/lib/api';

export interface SMSNotification {
  to: string;
  message: string;
  priority?: 'low' | 'medium' | 'high';
  scheduledFor?: string;
  metadata?: Record<string, any>;
}

export class SMSService {
  private static instance: SMSService;
  private smsEndpoint: string;

  private constructor() {
    this.smsEndpoint = import.meta.env.VITE_SMS_ENDPOINT || '/api/sms_notifications';
  }

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  public async sendNotification(notification: SMSNotification): Promise<void> {
    try {
      await apiRequest(this.smsEndpoint, {
        method: 'POST',
        body: JSON.stringify(notification),
      });
    } catch (error) {
      console.error('Error sending SMS notification:', error);
      throw new Error('Failed to send SMS notification');
    }
  }

  public async getNotificationHistory(limit: number = 50): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
      
      return await apiRequest(`${this.smsEndpoint}?${params.toString()}`);
    } catch (error) {
      console.error('Error fetching SMS notification history:', error);
      throw new Error('Failed to fetch SMS notification history');
    }
  }

  public async deleteNotification(id: string): Promise<void> {
    try {
      await apiRequest(`${this.smsEndpoint}/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting SMS notification:', error);
      throw new Error('Failed to delete SMS notification');
    }
  }
}

export const smsService = SMSService.getInstance(); 