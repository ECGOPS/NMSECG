import React from 'react';

// Offline detection and handling utilities

export interface OfflineState {
  isOffline: boolean;
  lastOnline: Date | null;
  lastOffline: Date | null;
  connectionType: string | null;
  effectiveType: string | null;
}

class OfflineManager {
  private static instance: OfflineManager;
  private listeners: Set<(state: OfflineState) => void> = new Set();
  private state: OfflineState = {
    isOffline: !navigator.onLine,
    lastOnline: null,
    lastOffline: null,
    connectionType: null,
    effectiveType: null
  };

  private constructor() {
    this.initialize();
  }

  public static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private initialize() {
    // Set initial state
    this.updateConnectionInfo();
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Listen for connection changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', this.updateConnectionInfo.bind(this));
    }
  }

  private handleOnline() {
    this.state.isOffline = false;
    this.state.lastOnline = new Date();
    this.updateConnectionInfo();
    this.notifyListeners();
  }

  private handleOffline() {
    this.state.isOffline = true;
    this.state.lastOffline = new Date();
    this.notifyListeners();
  }

  private updateConnectionInfo() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.state.connectionType = connection.effectiveType || connection.type || null;
      this.state.effectiveType = connection.effectiveType || null;
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in offline state listener:', error);
      }
    });
  }

  public getState(): OfflineState {
    return { ...this.state };
  }

  public subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isOffline(): boolean {
    return this.state.isOffline;
  }

  public getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'unknown' {
    if (!this.state.effectiveType) return 'unknown';
    
    switch (this.state.effectiveType) {
      case '4g':
        return 'excellent';
      case '3g':
        return 'good';
      case '2g':
      case 'slow-2g':
        return 'poor';
      default:
        return 'unknown';
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  public destroy() {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.removeEventListener('change', this.updateConnectionInfo.bind(this));
    }
    
    this.listeners.clear();
  }
}

// React hook for offline state
export function useOfflineState(): OfflineState {
  const [state, setState] = React.useState<OfflineState>(() => {
    const manager = OfflineManager.getInstance();
    return manager.getState();
  });

  React.useEffect(() => {
    const manager = OfflineManager.getInstance();
    const unsubscribe = manager.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}

// Utility functions
export function isOffline(): boolean {
  return OfflineManager.getInstance().isOffline();
}

export function getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'unknown' {
  return OfflineManager.getInstance().getConnectionQuality();
}

export async function testConnection(): Promise<boolean> {
  return OfflineManager.getInstance().testConnection();
}

// Export the manager instance
export const offlineManager = OfflineManager.getInstance();
