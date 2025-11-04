// Performance monitoring utility
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, { startTime: number; endTime?: number; duration?: number }> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(name: string): void {
    this.metrics.set(name, { startTime: performance.now() });
    console.log(`[Performance] Started timer: ${name}`);
  }

  endTimer(name: string): number | undefined {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`[Performance] Timer ${name} not found`);
      return undefined;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    console.log(`[Performance] ${name}: ${metric.duration.toFixed(2)}ms`);
    
    // Log slow operations
    if (metric.duration > 5000) {
      console.warn(`[Performance] Slow operation detected: ${name} took ${metric.duration.toFixed(2)}ms`);
    }
    
    return metric.duration;
  }

  getTimer(name: string): number | undefined {
    const metric = this.metrics.get(name);
    return metric?.duration;
  }

  getAllMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((metric, name) => {
      if (metric.duration !== undefined) {
        result[name] = metric.duration;
      }
    });
    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Performance tracking hooks
export const usePerformanceTracking = () => {
  const monitor = PerformanceMonitor.getInstance();

  const trackOperation = async <T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<T> => {
    monitor.startTimer(name);
    try {
      const result = await operation();
      monitor.endTimer(name);
      return result;
    } catch (error) {
      monitor.endTimer(name);
      throw error;
    }
  };

  const trackSyncOperation = <T>(
    name: string, 
    operation: () => T
  ): T => {
    monitor.startTimer(name);
    try {
      const result = operation();
      monitor.endTimer(name);
      return result;
    } catch (error) {
      monitor.endTimer(name);
      throw error;
    }
  };

  return { trackOperation, trackSyncOperation };
};

// Performance monitoring for API calls
export const trackApiCall = async <T>(
  endpoint: string,
  apiCall: () => Promise<T>
): Promise<T> => {
  const monitor = PerformanceMonitor.getInstance();
  const timerName = `API:${endpoint}`;
  
  monitor.startTimer(timerName);
  try {
    const result = await apiCall();
    monitor.endTimer(timerName);
    return result;
  } catch (error) {
    monitor.endTimer(timerName);
    throw error;
  }
};

// Performance monitoring for authentication
export const trackAuthOperation = async <T>(
  operation: string,
  authCall: () => Promise<T>
): Promise<T> => {
  const monitor = PerformanceMonitor.getInstance();
  const timerName = `Auth:${operation}`;
  
  monitor.startTimer(timerName);
  try {
    const result = await authCall();
    monitor.endTimer(timerName);
    return result;
  } catch (error) {
    monitor.endTimer(timerName);
    throw error;
  }
}; 