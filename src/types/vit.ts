export interface VITAsset {
  id: string;
  name: string;
  description?: string;
  location?: string;
  status: 'active' | 'inactive' | 'maintenance';
  lastInspection?: Date;
  nextInspection?: Date;
  syncStatus: 'pending' | 'synced' | 'deleted' | 'created' | 'updated';
  createdAt?: Date;
  updatedAt?: Date;
} 