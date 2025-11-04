export interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  imageUrl?: string;
  videoUrl?: string; // YouTube or Vimeo embed link
  createdAt: string; // ISO string or Timestamp
  active: boolean;
  startDate?: string; // Optional: ISO string for scheduled start
  endDate?: string; // Optional: ISO string for scheduled end
  targetRoles?: string[]; // Optional: array of role IDs for targeting
  targetRegions?: string[]; // Optional: array of region IDs for targeting
}

export interface BroadcastMessageFormData {
  title: string;
  message: string;
  imageUrl?: string;
  videoUrl?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  targetRoles?: string[];
  targetRegions?: string[];
}

export interface SeenBroadcast {
  broadcastId: string;
  seenAt: string;
}

