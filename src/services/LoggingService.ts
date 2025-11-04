import { apiRequest } from '@/lib/api';

export interface LogEntry {
  id?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  region?: string;
  district?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changes?: Record<string, { old: any; new: any }>;
}

export class LoggingService {
  private static instance: LoggingService;
  private loggingEndpoint: string;

  private constructor() {
    this.loggingEndpoint = '/api/userLogs';
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  public async logAction(
    userId: string,
    userName: string,
    userRole: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    description?: string,
    region?: string,
    district?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const logEntry: LogEntry = {
        userId,
        userName,
        userRole,
        action,
        resourceType,
        resourceId,
        description: description || `${action} on ${resourceType}`,
        region,
        district,
        metadata,
        timestamp: new Date().toISOString(),
      };

      await apiRequest(this.loggingEndpoint, {
        method: 'POST',
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Error logging action:', error);
      // Don't throw error for logging failures to avoid breaking main functionality
    }
  }

  public async logEditAction(
    userId: string,
    userName: string,
    userRole: string,
    resourceType: string,
    resourceId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    description?: string,
    region?: string,
    district?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Calculate what actually changed
      const changes: Record<string, { old: any; new: any }> = {};
      const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
      
      allKeys.forEach(key => {
        if (oldValues[key] !== newValues[key]) {
          changes[key] = {
            old: oldValues[key],
            new: newValues[key]
          };
        }
      });

      const logEntry: LogEntry = {
        userId,
        userName,
        userRole,
        action: 'edit',
        resourceType,
        resourceId,
        description: description || `Edited ${resourceType} ${resourceId}`,
        region,
        district,
        metadata,
        timestamp: new Date().toISOString(),
        oldValues,
        newValues,
        changes
      };

      await apiRequest(this.loggingEndpoint, {
        method: 'POST',
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Error logging edit action:', error);
      // Don't throw error for logging failures to avoid breaking main functionality
    }
  }

  public async logDeleteAction(
    userId: string,
    userName: string,
    userRole: string,
    resourceType: string,
    resourceId: string,
    deletedData: Record<string, any>,
    description?: string,
    region?: string,
    district?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const logEntry: LogEntry = {
        userId,
        userName,
        userRole,
        action: 'delete',
        resourceType,
        resourceId,
        description: description || `Deleted ${resourceType} ${resourceId}`,
        region,
        district,
        metadata,
        timestamp: new Date().toISOString(),
        oldValues: deletedData,
        newValues: {},
        changes: { deleted: { old: deletedData, new: null } }
      };

      await apiRequest(this.loggingEndpoint, {
        method: 'POST',
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Error logging delete action:', error);
      // Don't throw error for logging failures to avoid breaking main functionality
    }
  }

  public async getLogs(
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      region?: string;
      district?: string;
      startDate?: string;
      endDate?: string;
    },
    pagination?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<LogEntry[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });
      }
      
      if (pagination) {
        if (pagination.limit) {
          params.append('limit', pagination.limit.toString());
        }
        if (pagination.offset) {
          params.append('offset', pagination.offset.toString());
        }
      }
      
      params.append('sort', 'timestamp');
      params.append('order', 'desc');
      
      return await apiRequest(`${this.loggingEndpoint}?${params.toString()}`);
    } catch (error) {
      console.error('Error fetching logs:', error);
      throw new Error('Failed to fetch logs');
    }
  }

  public async getLogsCount(
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      region?: string;
      district?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<number> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });
      }
      
      params.append('countOnly', 'true');
      
      const result = await apiRequest(`${this.loggingEndpoint}?${params.toString()}`);
      return result.count || 0;
    } catch (error) {
      console.error('Error fetching logs count:', error);
      throw new Error('Failed to fetch logs count');
    }
  }

  public async deleteLog(logId: string): Promise<void> {
    try {
      await apiRequest(`${this.loggingEndpoint}/${logId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting log:', error);
      throw new Error('Failed to delete log');
    }
  }

  public async clearLogs(olderThan?: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (olderThan) {
        params.append('olderThan', olderThan);
      }
      
      await apiRequest(`${this.loggingEndpoint}/clear?${params.toString()}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error clearing logs:', error);
      throw new Error('Failed to clear logs');
    }
  }
}

export default LoggingService; 