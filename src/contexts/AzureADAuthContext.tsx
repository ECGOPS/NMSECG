import React, { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { 
  msalInstance, 
  login as msalLogin, 
  logout as msalLogout, 
  getAccount,
  acquireToken,
  NAME_MAPPING_CONFIG
} from "@/config/azure-ad";
import { azureADApiService } from "@/services/AzureADApiService";
import { StaffIdEntry } from "@/components/user-management/StaffIdManagement";
import { trackAuthOperation } from "@/utils/performance";
import { clearAllSessionData } from "@/utils/sessionUtils";

// Export the interface
export interface AzureADAuthContextType {
  user: User | null;
  loading: boolean;
  login: (forceReLogin?: boolean) => Promise<void>;
  logout: (navigateToLogin?: () => void) => void;
  isAuthenticated: boolean;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  addUser: (user: Omit<User, "id">) => Promise<string>;
  updateUser: (id: string, userData: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserStatus: (id: string, disabled: boolean) => Promise<void>;
  verifyStaffId: (staffId: string) => { isValid: boolean; staffInfo?: { name: string; role: UserRole; region?: string; district?: string } };
  staffIds: StaffIdEntry[];
  setStaffIds: React.Dispatch<React.SetStateAction<StaffIdEntry[]>>;
  addStaffId: (entry: Omit<StaffIdEntry, "id"> & { customId?: string }) => Promise<string>;
  updateStaffId: (id: string, entry: Omit<StaffIdEntry, "id">) => void;
  deleteStaffId: (id: string) => void;

}

const AzureADAuthContext = createContext<AzureADAuthContextType | undefined>(undefined);

export { AzureADAuthContext };

export const AzureADAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [staffIds, setStaffIds] = useState<StaffIdEntry[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Initialize MSAL and check for existing session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        console.log('[Auth] Starting authentication initialization...');
        
        // Add overall timeout to prevent hanging
        const overallTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication initialization timeout')), 8000)
        );
        
        // Track overall authentication initialization with timeout protection
        await Promise.race([
          trackAuthOperation('initialize', async () => {
            // Initialize MSAL instance with timeout
            const msalInitPromise = msalInstance.initialize();
            const msalTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('MSAL initialization timeout')), 10000)
            );
            
            await Promise.race([msalInitPromise, msalTimeout]);
            console.log('[Auth] MSAL initialized successfully');
            
            // Check if we're returning from a logout redirect
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('logout') === 'true') {
              console.log('[Auth] Returning from logout redirect');
              
              // Clear any remaining state
              setUser(null);
              setUsers([]);
              setUsersLoaded(false);
              
              // Clear any remaining MSAL cache
              try {
                await msalInstance.clearCache();
              } catch (error) {
                console.warn('[Auth] Failed to clear MSAL cache:', error);
              }
              
              // Load only staff IDs for login form, skip user loading
              try {
                await loadStaffIds();
              } catch (error) {
                console.warn('[Auth] Failed to load staff IDs:', error);
              }
              
              // Clear the logout parameter from URL to prevent issues on subsequent logins
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('logout');
              newUrl.searchParams.delete('forceReLogin');
              window.history.replaceState({}, '', newUrl.toString());
              
              // Don't redirect again - just stay on the login page
              return;
            }
            
            // Handle redirect response if any
            const response = await msalInstance.handleRedirectPromise();
            console.log('MSAL redirect response:', response);
            
            let hasAccount = false;
            
            if (response) {
              // User just completed login via redirect
              console.log('User completed login via redirect');
              await handleUserLogin(response.account);
              hasAccount = true;
              toast.success("Login successful");
              
              // Navigate to dashboard after successful login
              console.log('Navigating to dashboard');
              window.location.href = '/dashboard';
            } else {
              // Check if user is already signed in
              const account = getAccount();
              console.log('Existing account found:', account);
              if (account) {
                // Verify the account is still valid by trying to acquire a token
                try {
                  const token = await acquireToken();
                  if (token) {
                    console.log('[Auth] Valid token found, restoring user session');
                    await handleUserLogin(account);
                    hasAccount = true;
                  } else {
                    // Token acquisition failed, clear the account
                    console.log('[Auth] Token acquisition failed, clearing stale account');
                    await msalInstance.clearCache();
                    setUser(null);
                  }
                } catch (error) {
                  console.error('[Auth] Error verifying account:', error);
                  // Clear stale account data
                  await msalInstance.clearCache();
                  setUser(null);
                }
              } else {
                // No existing account, check if we have a valid JWT token in storage
                console.log('[Auth] No MSAL account found, checking for existing JWT token');
                try {
                  // Try to make a test API call to see if we have a valid session
                  const testResponse = await azureADApiService.getCurrentUser();
                  if (testResponse && testResponse.id) {
                    console.log('[Auth] Valid JWT session found, restoring user data');
                    setUser(testResponse);
                    hasAccount = true;
                  }
                } catch (jwtError) {
                  console.log('[Auth] No valid JWT session found');
                }
              }
            }
            
            // Load staff IDs and users in parallel if authenticated
            if (hasAccount) {
              console.log('[Auth] Loading staff IDs and users in parallel...');
              await Promise.all([
                loadStaffIds(),
                loadUsers()
              ]);
            } else {
              // Only load staff IDs if not authenticated (for login form)
              console.log('[Auth] Loading staff IDs only...');
              await loadStaffIds();
            }
            
            console.log('[Auth] Authentication initialization completed');
          }),
          overallTimeout
        ]);
        
      } catch (error) {
        console.error('Error initializing auth:', error);
        
        // Only show error toasts for actual failures, not expected scenarios
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('timeout')) {
          console.log('[Auth] Timeout occurred - this is normal for new users');
          // Don't show error toast for timeouts
        } else if (errorMessage.includes('NetworkError')) {
          toast.error("Network error during authentication");
        } else {
          toast.error("Error initializing authentication");
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Load users when user state changes (backup mechanism)
  useEffect(() => {
    if (user && !usersLoaded) {
      loadUsers();
    }
  }, [user, usersLoaded]);

  const handleUserLogin = async (account: any) => {
    try {
      console.log('Handling user login for account:', account);
      
      await trackAuthOperation('handleUserLogin', async () => {
        // Get user info from Azure AD with timeout
        const tokenPromise = acquireToken();
        const tokenTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Token acquisition timeout')), 15000)
        );
        
        const token = await Promise.race([tokenPromise, tokenTimeout]);
        if (!token) {
          throw new Error('Failed to acquire token');
        }

        // Decode JWT token to get user info
        const payload = JSON.parse(atob((token as string).split('.')[1]));
        
        // Only log token payload in development, not production
        if (process.env.NODE_ENV !== 'production') {
          console.log('Token payload:', payload);
        }
        
        // Create initial user object from Azure AD data
        const azureUser: User = {
          id: account.localAccountId || account.homeAccountId,
          uid: account.localAccountId || account.homeAccountId,
          email: payload.email || account.username,
          name: payload.name || payload.preferred_username || account.username,
          displayName: payload.name || payload.preferred_username || account.username,
          role: 'pending' as UserRole, // Default to pending, will be updated by backend on first API call
          status: 'pre_registered',
          region: '',
          district: '',
          staffId: '',
          disabled: false,
          createdAt: new Date().toISOString(),
        };

        console.log('Created initial user from Azure AD:', azureUser);
        
        // Set the initial user state
        setUser(azureUser);
        
        // Fetch actual user data from backend to get proper role and status
        try {
          console.log('Fetching actual user data from backend...');
          const backendUser = await azureADApiService.getCurrentUser();
          console.log('Backend user data:', backendUser);
          
          // Update user with actual backend data
          const updatedUser: User = {
            ...azureUser,
            id: backendUser.id || azureUser.id,
            uid: backendUser.uid || azureUser.uid,
            email: backendUser.email || azureUser.email,
            name: backendUser.name || azureUser.name,
            displayName: backendUser.displayName || azureUser.displayName,
            role: backendUser.role || azureUser.role,
            status: backendUser.status || azureUser.status,
            region: backendUser.region || azureUser.region,
            district: backendUser.district || azureUser.district,
            staffId: backendUser.staffId || azureUser.staffId,
            disabled: backendUser.disabled || azureUser.disabled,
            createdAt: backendUser.createdAt || azureUser.createdAt,
          };
          
          console.log('Updated user with backend data:', updatedUser);
          setUser(updatedUser);
        } catch (backendError) {
          console.error('Error fetching user data from backend:', backendError);
          console.log('Using Azure AD data only');
        }
      });

    } catch (error) {
      console.error('Error handling user login:', error);
      toast.error("Error during login");
    }
  };

  const loadStaffIds = async () => {
    try {
      console.log('[Auth] Loading staff IDs...');
      await trackAuthOperation('loadStaffIds', async () => {
        const staffIdsList = await azureADApiService.getStaffIds();
        setStaffIds(staffIdsList);
        console.log('[Auth] Staff IDs loaded:', staffIdsList.length);
      });
    } catch (error) {
      console.error('Error loading staff IDs:', error);
      // Removed toast error to prevent user-facing error messages
    }
  };

  const loadUsers = async () => {
    try {
      console.log('[Auth] Loading users...');
      await trackAuthOperation('loadUsers', async () => {
        const usersList = await azureADApiService.getUsers();
        setUsers(usersList);
        setUsersLoaded(true);
        console.log('[Auth] Users loaded:', usersList.length);
      });
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error("Error loading users");
      setUsersLoaded(true); // Set to true even on error to prevent infinite retries
    }
  };

  const login = async (forceReLogin?: boolean) => {
    try {
      setLoading(true);
      console.log('[Auth] Starting login redirect...', { forceReLogin });
      
      // Check if we need to force re-authentication
      const urlParams = new URLSearchParams(window.location.search);
      const shouldForceReLogin = forceReLogin || urlParams.get('forceReLogin') === 'true';
      
      if (shouldForceReLogin) {
        console.log('[Auth] Force re-authentication requested');
        // Clear any existing session data before login
        await clearAllSessionData();
      }
      
      await msalLogin(shouldForceReLogin);
      // The redirect will happen automatically
    } catch (error) {
      console.error('[Auth] Login error:', error);
      toast.error("Login failed");
      setLoading(false);
    }
  };

  const logout = async (navigateToLogin?: () => void) => {
    try {
      console.log('[Auth] Starting logout process...');
      
      // Clear user state first
      setUser(null);
      setUsers([]);
      setUsersLoaded(false);
      setStaffIds([]);
      
      // Clear MSAL cache and logout
      try {
        await msalInstance.clearCache();
        await msalInstance.logoutRedirect({
          postLogoutRedirectUri: `${window.location.origin}/login?logout=true&forceReLogin=true`
        });
      } catch (msalError) {
        console.warn('[Auth] MSAL logout failed, clearing cache only:', msalError);
        await msalInstance.clearCache();
      }
      
      // Clear all session data
      try {
        await clearAllSessionData();
        console.log('[Auth] Session data cleared successfully');
      } catch (clearError) {
        console.warn('[Auth] Failed to clear some session data:', clearError);
      }
      
      // Navigate to login if callback provided
      if (navigateToLogin) {
        navigateToLogin();
      }
      
      console.log('[Auth] Logout completed successfully');
    } catch (error) {
      console.error('[Auth] Error during logout:', error);
      // Force redirect to login even if logout fails
      window.location.href = '/login?logout=true&forceReLogin=true';
    }
  };

  const verifyStaffId = (staffId: string) => {
    const staffIdEntry = staffIds.find(id => id.customId === staffId);
    if (staffIdEntry) {
      return {
        isValid: true,
        staffInfo: {
          name: staffIdEntry.name,
          role: staffIdEntry.role as UserRole,
          region: staffIdEntry.region,
          district: staffIdEntry.district,
        },
      };
    }
    return { isValid: false };
  };

  const addStaffId = async (entry: Omit<StaffIdEntry, "id"> & { customId?: string }) => {
    try {
      const newStaffId = await azureADApiService.createStaffId(entry);
      setStaffIds(prev => [...prev, newStaffId]);
      toast.success("Staff ID added successfully");
      return newStaffId.id;
    } catch (error) {
      console.error('Error adding staff ID:', error);
      toast.error("Error adding staff ID");
      throw error;
    }
  };

  const updateStaffId = async (id: string, entry: Omit<StaffIdEntry, "id">) => {
    try {
      await azureADApiService.updateStaffId(id, entry);
      setStaffIds(prev => prev.map(staffId => 
        staffId.id === id ? { ...staffId, ...entry } : staffId
      ));
      toast.success("Staff ID updated successfully");
    } catch (error) {
      console.error('Error updating staff ID:', error);
      toast.error("Error updating staff ID");
      throw error;
    }
  };

  const deleteStaffId = async (id: string) => {
    try {
      await azureADApiService.deleteStaffId(id);
      setStaffIds(prev => prev.filter(staffId => staffId.id !== id));
      toast.success("Staff ID deleted successfully");
    } catch (error) {
      console.error('Error deleting staff ID:', error);
      toast.error("Error deleting staff ID");
      throw error;
    }
  };

  const addUser = async (userData: Omit<User, "id">): Promise<string> => {
    try {
      const newUser = await azureADApiService.createUser(userData);
      setUsers(prev => [...prev, newUser]);
      toast.success("User added successfully");
      return newUser.id;
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error("Error adding user");
      throw error;
    }
  };

  const updateUser = async (id: string, userData: Partial<User>): Promise<void> => {
    try {
      await azureADApiService.updateUser(id, userData);
      setUsers(prev => prev.map(user => 
        user.id === id ? { ...user, ...userData } : user
      ));
      if (user?.id === id) {
        setUser(prev => prev ? { ...prev, ...userData } : null);
      }
      toast.success("User updated successfully");
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error("Error updating user");
      throw error;
    }
  };

  const deleteUser = async (id: string): Promise<void> => {
    try {
      await azureADApiService.deleteUser(id);
      setUsers(prev => prev.filter(user => user.id !== id));
      if (user?.id === id) {
        setUser(null);
      }
      toast.success("User deleted successfully");
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error("Error deleting user");
      throw error;
    }
  };

  const toggleUserStatus = async (id: string, disabled: boolean): Promise<void> => {
    try {
      await azureADApiService.updateUser(id, { disabled });
      setUsers(prev => prev.map(user => 
        user.id === id ? { ...user, disabled } : user
      ));
      if (user?.id === id) {
        setUser(prev => prev ? { ...prev, disabled } : null);
      }
      toast.success(`User ${disabled ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error("Error updating user status");
      throw error;
    }
  };

  // Add token refresh mechanism
  const refreshUserSession = async () => {
    try {
      console.log('[Auth] Refreshing user session...');
      const account = getAccount();
      if (account) {
        // Try to acquire a fresh token
        const token = await acquireToken();
        if (token) {
          console.log('[Auth] Fresh token acquired, updating user session');
          await handleUserLogin(account);
          return true;
        }
      }
      
      // If no MSAL account, try to restore from JWT
      try {
        const backendUser = await azureADApiService.getCurrentUser();
        if (backendUser && backendUser.id) {
          console.log('[Auth] Restored user session from JWT');
          setUser(backendUser);
          return true;
        }
      } catch (jwtError) {
        console.log('[Auth] JWT restoration failed:', jwtError);
      }
      
      return false;
    } catch (error) {
      console.error('[Auth] Error refreshing user session:', error);
      return false;
    }
  };

  // Add debugging for authentication state changes
  useEffect(() => {
    const currentAuthState = !!user || (() => {
      try {
        const account = getAccount();
        return !!account;
      } catch {
        return false;
      }
    })();
    
    console.log('[Auth] Authentication state changed:', {
      isAuthenticated: currentAuthState,
      hasUser: !!user,
      userRole: user?.role,
      userStatus: user?.status,
      loading,
      hasMSALAccount: !!getAccount()
    });
  }, [user, loading]);

  // Add effect to refresh session on mount if needed
  useEffect(() => {
    const isAuthenticated = !!user || (() => {
      try {
        const account = getAccount();
        return !!account;
      } catch {
        return false;
      }
    })();

    if (isAuthenticated && !user && !loading) {
      console.log('[Auth] Authenticated but no user data, attempting to refresh session');
      refreshUserSession();
    }
  }, [user, loading]);

  const value: AzureADAuthContextType = {
    user,
    loading,
    login,
    logout,
    // Fix: Check both user state and MSAL account for authentication status
    // This prevents redirects to pending page on page refresh
    isAuthenticated: !!user || (() => {
      try {
        const account = getAccount();
        return !!account;
      } catch {
        return false;
      }
    })(),
    users,
    setUsers,
    setUser,
    addUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    verifyStaffId,
    staffIds,
    setStaffIds,
    addStaffId,
    updateStaffId,
    deleteStaffId,
  };

  return (
    <AzureADAuthContext.Provider value={value}>
      {children}
    </AzureADAuthContext.Provider>
  );
};

export const useAzureADAuth = () => {
  const context = useContext(AzureADAuthContext);
  if (context === undefined) {
    throw new Error('useAzureADAuth must be used within an AzureADAuthProvider');
  }
  return context;
}; 