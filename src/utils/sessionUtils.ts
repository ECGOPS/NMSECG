import { msalInstance } from '@/config/azure-ad';
import { cache } from '@/utils/cache';

export interface SessionClearingOptions {
  clearBrowserStorage?: boolean;
  clearCookies?: boolean;
  clearMSALCache?: boolean;
  clearAppCache?: boolean;
  clearAll?: boolean;
}

export const clearAllSessionData = async (options: SessionClearingOptions = { clearAll: true }): Promise<void> => {
  try {
    console.log('[SessionUtils] Starting comprehensive session clearing...');
    
    const {
      clearBrowserStorage = options.clearAll ?? true,
      clearCookies = options.clearAll ?? true,
      clearMSALCache = options.clearAll ?? true,
      clearAppCache = options.clearAll ?? true
    } = options;

    // Clear all browser storage
    if (clearBrowserStorage) {
      try {
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear specific MSAL-related items that might persist
        const msalKeys = Object.keys(localStorage).filter(key => key.startsWith('msal.'));
        msalKeys.forEach(key => localStorage.removeItem(key));
        
        console.log('[SessionUtils] ✅ Cleared localStorage, sessionStorage, and MSAL keys');
      } catch (error) {
        console.warn('[SessionUtils] ⚠️ Failed to clear browser storage:', error);
      }
    }
    
    // Clear all cookies
    if (clearCookies) {
      try {
        document.cookie.split(';').forEach(cookie => {
          const name = cookie.split('=')[0].trim();
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
        });
        console.log('[SessionUtils] ✅ Cleared cookies');
      } catch (error) {
        console.warn('[SessionUtils] ⚠️ Failed to clear cookies:', error);
      }
    }
    
    // Clear MSAL cache
    if (clearMSALCache) {
      try {
        await msalInstance.clearCache();
        console.log('[SessionUtils] ✅ Cleared MSAL cache');
      } catch (error) {
        console.warn('[SessionUtils] ⚠️ Failed to clear MSAL cache:', error);
      }
    }
    
    // Clear application cache
    if (clearAppCache) {
      try {
        await cache.clear();
        console.log('[SessionUtils] ✅ Cleared application cache');
      } catch (error) {
        console.warn('[SessionUtils] ⚠️ Failed to clear application cache:', error);
      }
    }
    
    console.log('[SessionUtils] ✅ Session clearing completed');
  } catch (error) {
    console.error('[SessionUtils] ❌ Error clearing session data:', error);
    throw error;
  }
};

export const clearBrowserStorageOnly = async (): Promise<void> => {
  await clearAllSessionData({
    clearBrowserStorage: true,
    clearCookies: true,
    clearMSALCache: false,
    clearAppCache: false
  });
};

export const clearMSALCacheOnly = async (): Promise<void> => {
  await clearAllSessionData({
    clearBrowserStorage: false,
    clearCookies: false,
    clearMSALCache: true,
    clearAppCache: false
  });
};

export const clearAppCacheOnly = async (): Promise<void> => {
  await clearAllSessionData({
    clearBrowserStorage: false,
    clearCookies: false,
    clearMSALCache: false,
    clearAppCache: true
  });
};

export const isSessionCleared = (): boolean => {
  try {
    // Check if localStorage and sessionStorage are empty
    const localStorageEmpty = Object.keys(localStorage).length === 0;
    const sessionStorageEmpty = Object.keys(sessionStorage).length === 0;
    
    // Check if no MSAL-related items exist
    const msalKeys = Object.keys(localStorage).filter(key => key.startsWith('msal.'));
    const noMSALKeys = msalKeys.length === 0;
    
    return localStorageEmpty && sessionStorageEmpty && noMSALKeys;
  } catch (error) {
    console.warn('[SessionUtils] ⚠️ Error checking session status:', error);
    return false;
  }
};

export const getSessionStatus = (): {
  localStorageSize: number;
  sessionStorageSize: number;
  msalKeysCount: number;
  cookiesCount: number;
} => {
  try {
    const localStorageSize = Object.keys(localStorage).length;
    const sessionStorageSize = Object.keys(sessionStorage).length;
    const msalKeys = Object.keys(localStorage).filter(key => key.startsWith('msal.'));
    const cookiesCount = document.cookie.split(';').length;
    
    return {
      localStorageSize,
      sessionStorageSize,
      msalKeysCount: msalKeys.length,
      cookiesCount
    };
  } catch (error) {
    console.warn('[SessionUtils] ⚠️ Error getting session status:', error);
    return {
      localStorageSize: 0,
      sessionStorageSize: 0,
      msalKeysCount: 0,
      cookiesCount: 0
    };
  }
}; 