import { apiRequest } from "@/lib/api";
import { BroadcastMessage, SeenBroadcast } from "@/lib/types/broadcast";

export class BroadcastService {
  private static instance: BroadcastService;
  private readonly baseUrl = "/api/broadcastMessages";

  private constructor() {}

  public static getInstance(): BroadcastService {
    if (!BroadcastService.instance) {
      BroadcastService.instance = new BroadcastService();
    }
    return BroadcastService.instance;
  }

  /**
   * Get all broadcast messages (with pagination support)
   */
  async getAllMessages(page?: number, pageSize?: number): Promise<BroadcastMessage[]> {
    try {
      let url = this.baseUrl;
      if (page !== undefined && pageSize !== undefined) {
        const offset = (page - 1) * pageSize;
        url = `${this.baseUrl}?limit=${pageSize}&offset=${offset}`;
      }
      const messages = await apiRequest(url);
      return Array.isArray(messages) ? messages : [];
    } catch (error) {
      console.error("[BroadcastService] Error fetching messages:", error);
      return [];
    }
  }

  /**
   * Get total count of broadcast messages
   */
  async getTotalCount(): Promise<number> {
    try {
      const countData = await apiRequest(`${this.baseUrl}?countOnly=true`);
      return countData?.total || 0;
    } catch (error) {
      console.error("[BroadcastService] Error fetching count:", error);
      return 0;
    }
  }

  /**
   * Get the currently active broadcast message
   */
  async getActiveMessage(): Promise<BroadcastMessage | null> {
    try {
      const messages = await apiRequest(`${this.baseUrl}?active=true`);
      const activeMessages = Array.isArray(messages) ? messages : [];
      
      // Find the most recently created active message
      const sorted = activeMessages
        .filter((msg: BroadcastMessage) => msg.active)
        .sort((a: BroadcastMessage, b: BroadcastMessage) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
      
      return sorted.length > 0 ? sorted[0] : null;
    } catch (error) {
      console.error("[BroadcastService] Error fetching active message:", error);
      return null;
    }
  }

  /**
   * Create a new broadcast message
   */
  async createMessage(data: Omit<BroadcastMessage, "id" | "createdAt">): Promise<BroadcastMessage> {
    try {
      // If activating this message, deactivate all others first
      if (data.active) {
        await this.deactivateAllMessages();
      }

      const message = await apiRequest(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          createdAt: new Date().toISOString(),
        }),
      });

      return message;
    } catch (error) {
      console.error("[BroadcastService] Error creating message:", error);
      throw error;
    }
  }

  /**
   * Update a broadcast message
   */
  async updateMessage(id: string, data: Partial<BroadcastMessage>): Promise<BroadcastMessage> {
    try {
      // If activating this message, deactivate all others first
      if (data.active) {
        await this.deactivateAllMessages();
      }

      const message = await apiRequest(`${this.baseUrl}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      return message;
    } catch (error) {
      console.error("[BroadcastService] Error updating message:", error);
      throw error;
    }
  }

  /**
   * Delete a broadcast message
   */
  async deleteMessage(id: string): Promise<void> {
    try {
      await apiRequest(`${this.baseUrl}/${id}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("[BroadcastService] Error deleting message:", error);
      throw error;
    }
  }

  /**
   * Deactivate all messages (helper function)
   */
  private async deactivateAllMessages(): Promise<void> {
    try {
      const messages = await this.getAllMessages();
      const activeMessages = messages.filter((msg) => msg.active);

      // Deactivate all active messages in parallel
      await Promise.all(
        activeMessages.map((msg) =>
          this.updateMessage(msg.id, { active: false })
        )
      );
    } catch (error) {
      console.error("[BroadcastService] Error deactivating messages:", error);
    }
  }

  /**
   * Mark a broadcast as seen by a user (using localStorage)
   */
  markAsSeen(broadcastId: string): void {
    try {
      const seenBroadcasts = this.getSeenBroadcasts();
      const seen: SeenBroadcast = {
        broadcastId,
        seenAt: new Date().toISOString(),
      };
      
      // Add or update the seen record
      const existingIndex = seenBroadcasts.findIndex(
        (s) => s.broadcastId === broadcastId
      );
      
      if (existingIndex >= 0) {
        seenBroadcasts[existingIndex] = seen;
      } else {
        seenBroadcasts.push(seen);
      }

      localStorage.setItem("seenBroadcasts", JSON.stringify(seenBroadcasts));
    } catch (error) {
      console.error("[BroadcastService] Error marking as seen:", error);
    }
  }

  /**
   * Check if a broadcast has been seen by the user
   */
  hasBeenSeen(broadcastId: string): boolean {
    try {
      const seenBroadcasts = this.getSeenBroadcasts();
      return seenBroadcasts.some((s) => s.broadcastId === broadcastId);
    } catch (error) {
      console.error("[BroadcastService] Error checking seen status:", error);
      return false;
    }
  }

  /**
   * Get all seen broadcasts from localStorage
   */
  private getSeenBroadcasts(): SeenBroadcast[] {
    try {
      const stored = localStorage.getItem("seenBroadcasts");
      if (!stored) return [];
      return JSON.parse(stored) as SeenBroadcast[];
    } catch (error) {
      console.error("[BroadcastService] Error reading seen broadcasts:", error);
      return [];
    }
  }

  /**
   * Clear seen broadcasts (useful for testing or admin actions)
   */
  clearSeenBroadcasts(): void {
    try {
      localStorage.removeItem("seenBroadcasts");
    } catch (error) {
      console.error("[BroadcastService] Error clearing seen broadcasts:", error);
    }
  }

  /**
   * Extract YouTube video ID from URL
   */
  extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract Vimeo video ID from URL
   */
  extractVimeoId(url: string): string | null {
    const patterns = [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}

export const broadcastService = BroadcastService.getInstance();

