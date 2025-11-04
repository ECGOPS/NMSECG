import { apiRequest } from '@/lib/api';

export interface MusicFile {
  id: string;
  name: string;
  path: string;
  url: string;
  isPlaying?: boolean;
}

export class MusicService {
  private static instance: MusicService;

  private constructor() {}

  public static getInstance(): MusicService {
    if (!MusicService.instance) {
      MusicService.instance = new MusicService();
    }
    return MusicService.instance;
  }

  async uploadMusic(file: File): Promise<MusicFile> {
    // TODO: Implement file upload to backend
    throw new Error('File upload not implemented. Backend support required.');
  }

  async deleteMusic(id: string): Promise<void> {
    await apiRequest(`/api/music_files/${id}`, {
      method: 'DELETE',
    });
  }

  async getAllMusic(): Promise<MusicFile[]> {
    return apiRequest('/api/music_files');
  }
} 