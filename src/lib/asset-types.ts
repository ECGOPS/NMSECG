import { InspectionItem } from './types';
import { BaseRecord } from '../utils/db';

export interface FeederLeg {
  id: string;
  redPhaseCurrent: number | '';
  yellowPhaseCurrent: number | '';
  bluePhaseCurrent: number | '';
  neutralCurrent: number | '';
}

export interface LoadMonitoringData extends BaseRecord {
  date: string;
  time: string;
  regionId: string;
  districtId: string;
  region: string;
  district: string;
  
  // Substation Information
  substationName: string;
  substationNumber: string;
  location: string;
  gpsLocation?: string;
  rating: number;
  peakLoadStatus: 'day' | 'night';
  ownership: 'public' | 'private';
  voltageLevel?: '11kV' | '33kV' | '69kV';
  
  // Feeder Information
  feederLegs: FeederLeg[];
  
  // Load Information (calculated values)
  ratedLoad: number;
  redPhaseBulkLoad: number;
  yellowPhaseBulkLoad: number;
  bluePhaseBulkLoad: number;
  averageCurrent: number;
  percentageLoad: number;
  tenPercentFullLoadNeutral: number;
  calculatedNeutral: number;
  
  // Warning Information (optional calculated values)
  neutralWarningLevel?: "normal" | "warning" | "critical";
  neutralWarningMessage?: string;
  imbalancePercentage?: number;
  imbalanceWarningLevel?: "normal" | "warning" | "critical";
  imbalanceWarningMessage?: string;
  maxPhaseCurrent?: number;
  minPhaseCurrent?: number;
  avgPhaseCurrent?: number;

  // User Information
  createdBy: {
    id: string;
    name: string;
  };

  // Sync Information
  originalOfflineId?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
  updatedBy?: {
    id: string;
    name: string;
  };

  // Offline Display Properties (added for UI)
  isOffline?: boolean;
  offlineAction?: 'create' | 'update' | 'delete';
  offlineTimestamp?: number;
}

export type ConditionStatus = 'good' | 'bad';
export type YesNoStatus = 'yes' | 'no';
export type GoodBadStatus = 'good' | 'bad';

export interface SubstationInspectionData {
  id: string;
  region: string;
  district: string;
  date: string;
  substationNo: string;
  substationName?: string;
  type: 'indoor' | 'outdoor';
  items: InspectionItem[];
  createdAt: string;
  createdBy: string;
}

export interface VITItem {
  id: string;
  name: string;
  status: YesNoStatus | GoodBadStatus;
  remarks: string;
}

export interface VITInspectionData {
  id: string;
  region: string;
  district: string;
  date: string;
  voltageLevel: '11KV' | '33KV';
  typeOfUnit: string;
  serialNumber: string;
  location: string;
  gpsLocation: string;
  status: string;
  protection: string;
  photoUrl?: string;
  items: VITItem[];
  createdAt: string;
  createdBy: string;
}

export interface SubstationInspection {
  id: string;
  firestoreId?: string;
  region: string;
  regionId: string;
  district: string;
  districtId: string;
  date: string;
  time?: string;
  inspectionDate?: string;
  substationNo: string;
  substationName?: string;
  type: "indoor" | "outdoor";
  substationType: "primary" | "secondary";
  items: InspectionItem[];
  generalBuilding: InspectionItem[];
  controlEquipment: InspectionItem[];
  powerTransformer: InspectionItem[];
  outdoorEquipment: InspectionItem[];
  siteCondition: InspectionItem[];
  basement: InspectionItem[];
  location?: string;
  gpsLocation?: string;
  voltageLevel?: string;
  status?: string;
  remarks?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  inspectedBy?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
  originalOfflineId?: string;
  cleanDustFree?: string;
  protectionButtonEnabled?: string;
  recloserButtonEnabled?: string;
  groundEarthButtonEnabled?: string;
  acPowerOn?: string;
  batteryPowerLow?: string;
  handleLockOn?: string;
  remoteButtonEnabled?: string;
  gasLevelLow?: string;
  earthingArrangementAdequate?: string;
  noFusesBlown?: string;
  noDamageToBushings?: string;
  noDamageToHVConnections?: string;
  insulatorsClean?: string;
  paintworkAdequate?: string;
  ptFuseLinkIntact?: string;
  noCorrosion?: string;
  silicaGelCondition?: string;
  correctLabelling?: string;
  images?: string[];
  afterImages?: string[];
}

export interface SecondarySubstationInspection {
  id: string;
  firestoreId?: string;
  region: string;
  regionId: string;
  district: string;
  districtId: string;
  date: string;
  time?: string;
  inspectionDate?: string;
  substationNo: string;
  substationName?: string;
  type: "secondary";
  location?: string;
  gpsLocation?: string;
  voltageLevel?: string;
  status?: string;
  remarks?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  inspectedBy?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
  originalOfflineId?: string;
  siteCondition: InspectionItem[];
  transformer: InspectionItem[];
  areaFuse: InspectionItem[];
  arrestors: InspectionItem[];
  switchgear: InspectionItem[];
  distributionEquipment: InspectionItem[];
  paintWork: InspectionItem[];
  images?: string[];
  afterImages?: string[];
}
