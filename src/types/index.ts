export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'system_admin' | 'global_engineer' | 'regional_engineer' | 'district_engineer' | 'technician';
  regionId?: string;
  districtId?: string;
  createdAt?: Date;
  updatedAt?: Date;
} 