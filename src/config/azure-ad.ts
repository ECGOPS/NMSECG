import { PublicClientApplication, Configuration, AuthenticationResult, AccountInfo } from '@azure/msal-browser';

// Validate required environment variables
const requiredEnvVars = {
  VITE_AZURE_AD_CLIENT_ID: import.meta.env.VITE_AZURE_AD_CLIENT_ID,
  VITE_AZURE_AD_TENANT_ID: import.meta.env.VITE_AZURE_AD_TENANT_ID,
  VITE_AZURE_AD_API_SCOPE: import.meta.env.VITE_AZURE_AD_API_SCOPE,
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('[Azure AD Config] Missing required environment variables:', missingVars);
  console.error('[Azure AD Config] Please set the following variables in your .env file:');
  missingVars.forEach(varName => {
    console.error(`[Azure AD Config] - ${varName}`);
  });
}

// Azure AD Configuration
const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_AD_TENANT_ID || ''}`,
    redirectUri: import.meta.env.VITE_AZURE_AD_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_AZURE_AD_POST_LOGOUT_REDIRECT_URI || `${window.location.origin}/login`,
  },
  cache: {
    cacheLocation: 'sessionStorage', // Changed from localStorage to sessionStorage
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: any, message: string, containsPii: boolean) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0:
            console.error(message);
            return;
          case 1:
            console.warn(message);
            return;
          case 2:
            console.info(message);
            return;
          case 3:
            console.debug(message);
            return;
          default:
            console.log(message);
            return;
        }
      },
      logLevel: import.meta.env.DEV ? 3 : 0, // Info in dev, Error in prod
    },
  },
};

// Name mapping configuration
export const NAME_MAPPING_CONFIG = {
  // 'app_first': Always use app name if it exists, fallback to Azure AD
  // 'azure_first': Always use Azure AD name, fallback to app name
  // 'app_only': Only use app name, never use Azure AD name
  // 'azure_only': Only use Azure AD name, never use app name
  strategy: import.meta.env.VITE_NAME_MAPPING_STRATEGY || 'app_first',
  
  // Auto-correct names when they don't match
  autoCorrectNames: import.meta.env.VITE_AUTO_CORRECT_NAMES === 'true',
  
  // Show notifications when names are corrected
  showNameCorrectionNotifications: import.meta.env.VITE_SHOW_NAME_CORRECTIONS === 'true'
};

// Scopes for the application
export const loginRequest = {
  scopes: [
    import.meta.env.VITE_AZURE_AD_API_SCOPE || ''
  ],
};

// Force re-login configuration (prevents auto-login after logout)
export const forceLoginRequest = {
  ...loginRequest,
  prompt: 'login', // Forces credential entry, avoids auto-login
  loginHint: '', // Clear any login hints
};

// Popup configuration
export const popupRequest = {
  ...loginRequest,
  prompt: 'select_account'
};

// Popup window configuration
export const popupWindowConfig = {
  url: window.location.origin,
  title: 'Sign in',
  width: 600,
  height: 600,
  popup: true
};

// Initialize MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Helper functions
export const getAccount = (): AccountInfo | null => {
  const currentAccounts = msalInstance.getAllAccounts();
  if (currentAccounts.length === 0) {
    return null;
  }
  
  // If there are multiple accounts, you might want to implement account selection logic
  return currentAccounts[0];
};

export const acquireToken = async (): Promise<string | null> => {
  const account = getAccount();
  console.log('[acquireToken] Account found:', account ? 'Yes' : 'No');
  
  if (!account) {
    console.log('[acquireToken] No account found, returning null');
    return null;
  }

  try {
    console.log('[acquireToken] Attempting to acquire token silently...');
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: account,
    });
    console.log('[acquireToken] Token acquired successfully');
    return response.accessToken;
  } catch (error) {
    console.error('[acquireToken] Error acquiring token:', error);
    console.log('[acquireToken] Token acquisition failed, returning null');
    return null;
  }
};

export const login = async (forceReLogin: boolean = false): Promise<void> => {
  try {
    const request = forceReLogin ? forceLoginRequest : loginRequest;
    await msalInstance.loginRedirect(request);
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  const account = getAccount();
  if (account) {
    try {
      // Properly logout from Azure AD with redirect
      await msalInstance.logoutRedirect({
        account: account,
        postLogoutRedirectUri: `${import.meta.env.VITE_AZURE_AD_POST_LOGOUT_REDIRECT_URI || window.location.origin}/login?logout=true`
      });
    } catch (error) {
      console.error('Error during Azure AD logout:', error);
      // Fallback: clear cache locally
      await msalInstance.clearCache();
    }
  } else {
    // If no account, just clear cache
    await msalInstance.clearCache();
  }
};

export default msalInstance; 