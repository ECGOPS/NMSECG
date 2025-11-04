import { apiRequest } from '@/lib/api';

class AzureADApiService {
  // Cache for users to reduce API calls
  private static usersCache: { data: any[]; timestamp: number } = { data: [], timestamp: 0 };
  private static staffIdsCache: { data: any[]; timestamp: number } = { data: [], timestamp: 0 };
  
  // Initialize caches to ensure they're properly set up
  private static initializeCaches() {
    if (!AzureADApiService.usersCache) {
      AzureADApiService.usersCache = { data: [], timestamp: 0 };
    }
    if (!AzureADApiService.staffIdsCache) {
      AzureADApiService.staffIdsCache = { data: [], timestamp: 0 };
    }
  }
  
  // User management
  async getUsers(): Promise<any[]> {
    // Initialize caches
    AzureADApiService.initializeCaches();
    
    // Check cache first (5 minute cache)
    const now = Date.now();
    if (AzureADApiService.usersCache && AzureADApiService.usersCache.timestamp > 0 && (now - AzureADApiService.usersCache.timestamp) < 5 * 60 * 1000) {
      console.log('[AzureADApiService] Returning cached users');
      return AzureADApiService.usersCache.data;
    }
    
    // Get total count first
    const countResponse = await apiRequest('/api/users?countOnly=true');
    const totalUsers = countResponse.count || 0;
    
    let allUsers = [];
    
    if (totalUsers <= 100) {
      // If 100 or fewer users, get them all in one request
      allUsers = await apiRequest('/api/users?limit=100');
    } else {
      // If more than 100 users, get them in batches
      let offset = 0;
      const batchSize = 100;
      
      while (offset < totalUsers) {
        const batch = await apiRequest(`/api/users?limit=${batchSize}&offset=${offset}`);
        allUsers.push(...batch);
        offset += batchSize;
      }
    }
    
    // Update cache
    AzureADApiService.usersCache = { data: allUsers, timestamp: now };
    console.log('[AzureADApiService] Updated users cache with', allUsers.length, 'users');
    
    return allUsers;
  }

  async getUserById(id: string): Promise<any> {
    return apiRequest(`/api/users/${id}`);
  }

  async getCurrentUser(): Promise<any> {
    return apiRequest('/api/users/me');
  }

  async getUserByEmail(email: string): Promise<any> {
    return apiRequest(`/api/users?email=${encodeURIComponent(email)}`);
  }

  async createUser(userData: any): Promise<any> {
    const result = await apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    // Clear cache when user is created
    AzureADApiService.usersCache = { data: [], timestamp: 0 };
    return result;
  }

  async updateUser(id: string, userData: any): Promise<any> {
    const result = await apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    // Clear cache when user is updated
    AzureADApiService.usersCache = { data: [], timestamp: 0 };
    return result;
  }

  async deleteUser(id: string): Promise<void> {
    await apiRequest(`/api/users/${id}`, {
      method: 'DELETE',
    });
    // Clear cache when user is deleted
    AzureADApiService.usersCache = { data: [], timestamp: 0 };
  }

  // Staff ID management
  async getStaffIds(): Promise<any[]> {
    // Initialize caches
    AzureADApiService.initializeCaches();
    
    // Check cache first (10 minute cache for staff IDs)
    const now = Date.now();
    if (AzureADApiService.staffIdsCache && AzureADApiService.staffIdsCache.timestamp > 0 && (now - AzureADApiService.staffIdsCache.timestamp) < 10 * 60 * 1000) {
      console.log('[AzureADApiService] Returning cached staff IDs');
      return AzureADApiService.staffIdsCache.data;
    }
    
    const staffIds = await apiRequest('/api/staffIds');
    
    // Update cache
    AzureADApiService.staffIdsCache = { data: staffIds, timestamp: now };
    console.log('[AzureADApiService] Updated staff IDs cache with', staffIds.length, 'entries');
    
    return staffIds;
  }

  async createStaffId(staffIdData: any): Promise<any> {
    const result = await apiRequest('/api/staffIds', {
      method: 'POST',
      body: JSON.stringify(staffIdData),
    });
    // Clear cache when staff ID is created
    AzureADApiService.staffIdsCache = { data: [], timestamp: 0 };
    return result;
  }

  async updateStaffId(id: string, staffIdData: any): Promise<any> {
    const result = await apiRequest(`/api/staffIds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staffIdData),
    });
    // Clear cache when staff ID is updated
    AzureADApiService.staffIdsCache = { data: [], timestamp: 0 };
    return result;
  }

  async deleteStaffId(id: string): Promise<void> {
    await apiRequest(`/api/staffIds/${id}`, {
      method: 'DELETE',
    });
    // Clear cache when staff ID is deleted
    AzureADApiService.staffIdsCache = { data: [], timestamp: 0 };
  }

  // Fault management
  async getControlOutages(): Promise<any[]> {
    return apiRequest('/api/controlOutages');
  }

  async createControlOutage(outageData: any): Promise<any> {
    return apiRequest('/api/controlOutages', {
      method: 'POST',
      body: JSON.stringify(outageData),
    });
  }

  async updateControlOutage(id: string, outageData: any): Promise<any> {
    return apiRequest(`/api/controlOutages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(outageData),
    });
  }

  async deleteControlOutage(id: string): Promise<void> {
    return apiRequest(`/api/controlOutages/${id}`, {
      method: 'DELETE',
    });
  }

  // Asset management
  async getVitAssets(): Promise<any[]> {
    return apiRequest('/api/vitAssets');
  }

  async createVitAsset(assetData: any): Promise<any> {
    return apiRequest('/api/vitAssets', {
      method: 'POST',
      body: JSON.stringify(assetData),
    });
  }

  async updateVitAsset(id: string, assetData: any): Promise<any> {
    return apiRequest(`/api/vitAssets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assetData),
    });
  }

  async deleteVitAsset(id: string): Promise<void> {
    return apiRequest(`/api/vitAssets/${id}`, {
      method: 'DELETE',
    });
  }

  // Inspections
  async getVitInspections(): Promise<any[]> {
    return apiRequest('/api/vitInspections');
  }

  async createVitInspection(inspectionData: any): Promise<any> {
    return apiRequest('/api/vitInspections', {
      method: 'POST',
      body: JSON.stringify(inspectionData),
    });
  }

  async updateVitInspection(id: string, inspectionData: any): Promise<any> {
    return apiRequest(`/api/vitInspections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(inspectionData),
    });
  }

  async deleteVitInspection(id: string): Promise<void> {
    return apiRequest(`/api/vitInspections/${id}`, {
      method: 'DELETE',
    });
  }

  // Load monitoring
  async getLoadMonitoring(): Promise<any[]> {
    return apiRequest('/api/loadMonitoring');
  }

  async createLoadMonitoring(loadData: any): Promise<any> {
    return apiRequest('/api/loadMonitoring', {
      method: 'POST',
      body: JSON.stringify(loadData),
    });
  }

  async updateLoadMonitoring(id: string, loadData: any): Promise<any> {
    return apiRequest(`/api/loadMonitoring/${id}`, {
      method: 'PUT',
      body: JSON.stringify(loadData),
    });
  }

  async deleteLoadMonitoring(id: string): Promise<void> {
    return apiRequest(`/api/loadMonitoring/${id}`, {
      method: 'DELETE',
    });
  }

  // Chat messages
  async getChatMessages(): Promise<any[]> {
    return apiRequest('/api/chat_messages');
  }

  async createChatMessage(messageData: any): Promise<any> {
    return apiRequest('/api/chat_messages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  // Broadcast messages
  async getBroadcastMessages(): Promise<any[]> {
    return apiRequest('/api/broadcastMessages');
  }

  async createBroadcastMessage(messageData: any): Promise<any> {
    return apiRequest('/api/broadcastMessages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  // Districts and regions
  async getDistricts(): Promise<any[]> {
    return apiRequest('/api/districts');
  }

  async getRegions(): Promise<any[]> {
    return apiRequest('/api/regions');
  }

  // Security events
  async getSecurityEvents(): Promise<any[]> {
    return apiRequest('/api/securityEvents');
  }

  async createSecurityEvent(eventData: any): Promise<any> {
    return apiRequest('/api/securityEvents', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  // Music files
  async getMusicFiles(): Promise<any[]> {
    return apiRequest('/api/music_files');
  }

  async createMusicFile(musicData: any): Promise<any> {
    return apiRequest('/api/music_files', {
      method: 'POST',
      body: JSON.stringify(musicData),
    });
  }

  async updateMusicFile(id: string, musicData: any): Promise<any> {
    return apiRequest(`/api/music_files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(musicData),
    });
  }

  async deleteMusicFile(id: string): Promise<void> {
    return apiRequest(`/api/music_files/${id}`, {
      method: 'DELETE',
    });
  }
}

export const azureADApiService = new AzureADApiService();
export default azureADApiService; 