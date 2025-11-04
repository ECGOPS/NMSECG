import { apiRequest } from '@/lib/api';
import { OP5Fault, ControlSystemOutage } from '@/lib/types';
import LoggingService from './LoggingService';

export class FaultService {
  private static instance: FaultService;
  private loggingService: LoggingService;

  private constructor() {
    this.loggingService = LoggingService.getInstance();
  }

  public static getInstance(): FaultService {
    if (!FaultService.instance) {
      FaultService.instance = new FaultService();
    }
    return FaultService.instance;
  }

  private removeUndefinedFields(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  }

  public async createOP5Fault(fault: Omit<OP5Fault, 'id'>): Promise<string> {
    const cleanFault = this.removeUndefinedFields(fault);
    const result = await apiRequest('/api/op5Faults', {
      method: 'POST',
      body: JSON.stringify(cleanFault),
    });
    // Optionally log the action
    // await this.loggingService.logAction(...)
    return result.id;
  }

  public async createControlSystemOutage(outage: Omit<ControlSystemOutage, 'id'>): Promise<string> {
    const cleanOutage = this.removeUndefinedFields(outage);
    const result = await apiRequest('/api/controlOutages', {
      method: 'POST',
      body: JSON.stringify(cleanOutage),
    });
    // Optionally log the action
    // await this.loggingService.logAction(...)
    return result.id;
  }
} 