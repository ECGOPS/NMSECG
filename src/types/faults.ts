export interface Material {
  id: string;
  type: 'Fuse' | 'Conductor' | 'Others';
  rating?: string;
  conductorType?: string;
  description?: string;
  quantity?: number;
  length?: number;
}

export interface OP5Fault {
  id: string;
  date: string;
  region: string;
  district: string;
  description: string;
  materialsUsed: {
    id: string;
    type: string;
    details: {
      rating?: string;
      type?: string;
      description?: string;
    };
  }[];
}

export interface ControlSystemOutage {
  id: string;
  date: string;
  region: string;
  district: string;
  description: string;
  duration: number;
} 