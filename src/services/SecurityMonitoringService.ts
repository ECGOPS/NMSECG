import { apiRequest } from '@/lib/api';
import { SecurityEvent } from '@/lib/types';

export const EVENT_TYPES = {
  LOGIN_ATTEMPT: 'login_attempt',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  PASSWORD_CHANGE: 'password_change',
  ROLE_CHANGE: 'role_change',
  USER_DISABLED: 'user_disabled',
  USER_ENABLED: 'user_enabled'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;

  private constructor() {}

  private async fetchIpAddress(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Error fetching IP address:', error);
      return 'unknown';
    }
  }

  async getEvents(limitCount: number = 100): Promise<SecurityEvent[]> {
    return apiRequest(`/api/securityEvents?limit=${limitCount}`);
  }

  async logEvent(event: Omit<SecurityEvent, 'id'> & { eventType: EventType }) {
    const ipAddress = await this.fetchIpAddress();
    const eventData = {
      ...event,
      ipAddress,
      userAgent: window.navigator.userAgent,
      recordedAt: new Date().toISOString(),
    };
    return apiRequest('/api/securityEvents', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async updateEventStatus(eventId: string, status: SecurityEvent['status'], resolution?: string) {
    return apiRequest(`/api/securityEvents/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, resolution }),
    });
  }

  async deleteEvent(eventId: string) {
    return apiRequest(`/api/securityEvents/${eventId}`, {
      method: 'DELETE',
    });
  }

  async deleteEvents(eventIds: string[]) {
    return Promise.all(eventIds.map(id => this.deleteEvent(id)));
  }

  async cleanupOldEvents(retentionDays: number = 90) {
    return apiRequest(`/api/securityEvents/cleanup`, {
      method: 'POST',
      body: JSON.stringify({ retentionDays }),
    });
  }

  public static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }
}

export const securityMonitoringService = SecurityMonitoringService.getInstance(); 