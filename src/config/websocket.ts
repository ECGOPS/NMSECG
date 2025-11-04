// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
  // Development (localhost)
  development: {
    url: 'ws://localhost:3001',
    secure: false
  },
  // Production (Azure)
  production: {
    url: 'wss://ecgops-d3d7b2h9cub0csgh.canadacentral-01.azurewebsites.net',
    secure: true
  }
};

// Force production mode for testing (set to true to test Azure WebSocket from localhost)
const FORCE_PRODUCTION = true;

// Get current environment
export const getWebSocketUrl = (): string => {
  // Force production mode for testing
  if (FORCE_PRODUCTION) {
    return WEBSOCKET_CONFIG.production.url;
  }
  
  const isProduction = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1' &&
                      !window.location.hostname.includes('localhost');
  
  return isProduction ? WEBSOCKET_CONFIG.production.url : WEBSOCKET_CONFIG.development.url;
};

// Check if we're in production
export const isProduction = (): boolean => {
  // Force production mode for testing
  if (FORCE_PRODUCTION) {
    return true;
  }
  
  return window.location.hostname !== 'localhost' && 
         window.location.hostname !== '127.0.0.1' &&
         !window.location.hostname.includes('localhost');
};
