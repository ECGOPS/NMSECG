import { type ClassValue } from "clsx";
import { LoadMonitoringData, SubstationInspection } from "./asset-types";
import { DateRange } from "react-day-picker";
import { BaseRecord } from '../utils/db';

export type UserRole = 
  | "district_engineer" 
  | "district_manager"
  | "regional_engineer" 
  | "regional_general_manager"
  | "global_engineer" 
  | "technician" 
  | "system_admin"
  | "ict"
  | "load_monitoring_edit"
  | "load_monitoring_delete"
  | "admin"
  | "project_engineer"
  | "ashsubt"
  | "accsubt"
  | "pending"
  | null;

export interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  name: string;
  role: UserRole;
  region?: string;
  regionId?: string;
  district?: string;
  districtId?: string;
  tempPassword?: string;
  mustChangePassword?: boolean;
  password?: string;
  staffId?: string;
  disabled?: boolean;
  photoURL?: string;
  status?: "pre_registered" | "active" | "inactive";
  createdAt?: any;
  updatedAt?: any;
}

export type RegionPopulation = {
  rural: number | null;
  urban: number | null;
  metro: number | null;
};

export type Region = {
  id: string;
  name: string;
  code: string;
  districts?: District[];
};

export type District = {
  id: string;
  regionId: string;
  name: string;
  population: RegionPopulation;
  lastPopulationReset?: string; // Date when population was last reset
  populationHistory?: {
    rural: number;
    urban: number;
    metro: number;
    updatedBy: string;
    updatedAt: string;
  }[];
};

export type FaultType = "Planned" | "Unplanned" | "Emergency" | "ECG Load Shedding" | "GridCo Outages";

export type GridCoOutageType =
  | "TRANSMISSION LINE FAULT"
  | "SUBSTATION EQUIPMENT FAILURE"
  | "PLANNED MAINTENANCE"
  | "SYSTEM DISTURBANCE"
  | "GENERATION SHORTFALL"
  | "TRANSMISSION CONSTRAINT"
  | "PROTECTION SYSTEM OPERATION"
  | "WEATHER RELATED"
  | "THIRD PARTY DAMAGE"
  | "OTHER";

export type UnplannedFaultType = 
  | "UNDER INVESTIGATION"
  | "JUMPER CUT"
  | "CONDUCTOR CUT"
  | "MERGED CONDUCTOR"
  | "HV/LV LINE CONTACT"
  | "VEGETATION"
  | "CABLE FAULT"
  | "TERMINATION FAILURE"
  | "BROKEN POLES"
  | "BURNT POLE"
  | "FAULTY ARRESTER/INSULATOR"
  | "EQIPMENT FAILURE"
  | "PUNCTURED CABLE"
  | "ANIMAL INTERRUPTION"
  | "BAD WEATHER"
  | "TRANSIENT FAULTS"
  | "OTHERS";

export type EmergencyFaultType =
  | "UNDER INVESTIGATION"
  | "MEND CABLE"
  | "WORK ON EQUIPMENT"
  | "FIRE"
  | "IMPROVE HV"
  | "JUMPER REPLACEMENT"
  | "MEND BROKEN"
  | "MEND JUMPER"
  | "MEND TERMINATION"
  | "BROKEN POLE"
  | "BURNT POLE"
  | "ANIMAL CONTACT"
  | "VEGETATION SAFETY"
  | "TRANSFER/RESTORE"
  | "TROUBLE SHOOTING"
  | "MEND LOOSE"
  | "MAINTENANCE"
  | "REPLACE FUSE"
  | "OTHERS";

export type StatsOverviewProps = {
  op5Faults: OP5Fault[];
  controlOutages: ControlSystemOutage[];
};

export interface FilterBarProps {
  setFilterRegion: (region: string | undefined) => void;
  setFilterDistrict: (district: string | undefined) => void;
  setFilterStatus: (status: "all" | "pending" | "resolved") => void;
  filterStatus: "all" | "pending" | "resolved";
  onRefresh: () => void;
  isRefreshing: boolean;
  // Advanced filter props
  setFilterFaultType: (type: string) => void;
  setDateRange: (range: DateRange) => void;
  setSelectedDay: (day: Date | undefined) => void;
  setSelectedMonth: (month: number | undefined) => void;
  setSelectedMonthYear: (year: number | undefined) => void;
  setSelectedYear: (year: number | undefined) => void;
  setDateFilterType: (type: "range" | "day" | "month" | "year") => void;
  // Current values
  filterFaultType: string;
  dateRange: DateRange;
  selectedDay: Date | undefined;
  selectedMonth: number | undefined;
  selectedMonthYear: number | undefined;
  selectedYear: number | undefined;
  dateFilterType: "range" | "day" | "month" | "year";
}

export interface BaseAsset {
  id: string;
  createdAt: string;
  createdBy: string;
}

export interface OP5Fault {
  id: string;
  faultType: FaultType;
  outageType: string;
  specificFaultType: UnplannedFaultType | EmergencyFaultType | string; // Allow string for custom fault types
  substationName: string;
  substationNo: string;
  feeder: string;
  voltageLevel: string;
  occurrenceDate: string;
  restorationDate: string | null;
  repairDate: string | null;
  repairEndDate: string | null;
  estimatedResolutionTime: string | null;
  description: string;
  remarks: string;
  status: 'pending' | 'resolved';
  mttr?: number;
  regionId: string;
  region: string;
  districtId: string;
  district: string;
  areasAffected: string;
  affectedPopulation: AffectedPopulation;
  materialsUsed: MaterialUsed[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  fuseCircuit?: string;
  fusePhase?: string;
  otherFaultType?: string;
  customerPhoneNumber?: string;
  alternativePhoneNumber?: string;
  transformerRating?: number;
}

export interface ControlSystemOutage {
  id: string;
  date: string;
  region: string;
  district: string;
  description: string;
  duration: number;
  regionId: string;
  districtId: string;
  occurrenceDate: string;
  restorationDate: string | null;
  faultType: FaultType;
  specificFaultType?: UnplannedFaultType | EmergencyFaultType;
  status: "pending" | "resolved";
  loadMW: number;
  unservedEnergyMWh: number;
  reason: string;
  controlPanelIndications: string;
  areaAffected: string;
  customersAffected: {
    rural: number;
    urban: number;
    metro: number;
  };
  estimatedResolutionTime: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isOffline: boolean;
  // New fields
  voltageLevel: string;
  repairStartDate: string | null;
  repairEndDate: string | null;
  feederType: string;
  feederName: string;
  bspPss: string;
  customerInterruptions: {
    metro: number;
    urban: number;
    rural: number;
  };
  feederCustomers: {
    metro: number;
    urban: number;
    rural: number;
  };
  groundCondition: string;
}

// VIT Asset Types
export type VoltageLevel = "11KV" | "33KV";

export type VITStatus = "Operational" | "Under Maintenance" | "Faulty" | "Decommissioned";

export type YesNoOption = "Yes" | "No";

export type GoodBadOption = "Good" | "Bad";

export type ConditionStatus = "good" | "bad" | "";

export type VITAsset = {
  id: string;
  type: 'VIT';
  region: string;
  district: string;
  feederName: string;
  voltageLevel: VoltageLevel;
  typeOfUnit: string;
  serialNumber: string;
  location: string;
  gpsCoordinates: string;
  status: VITStatus;
  protection: string;
  photoUrl?: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  originalOfflineId?: string; // Added for offline tracking
  syncStatus?: 'pending' | 'synced' | 'deleted' | 'created' | 'updated'; // Added for offline sync
};

export interface VITInspectionChecklist {
  id: string;
  vitAssetId: string;
  region: string;
  district: string;
  feederName?: string;
  feederAlias?: string;
  inspectionDate: string;
  inspectedBy: string;
  remarks: string;
  photoUrls: string[];
  rodentTermiteEncroachment: YesNoOption;
  cleanDustFree: YesNoOption;
  protectionButtonEnabled: YesNoOption;
  recloserButtonEnabled: YesNoOption;
  groundEarthButtonEnabled: YesNoOption;
  acPowerOn: YesNoOption;
  batteryPowerLow: YesNoOption;
  handleLockOn: YesNoOption;
  remoteButtonEnabled: YesNoOption;
  gasLevelLow: YesNoOption;
  earthingArrangementAdequate: YesNoOption;
  noFusesBlown: YesNoOption;
  noDamageToBushings: YesNoOption;
  noDamageToHVConnections: YesNoOption;
  insulatorsClean: YesNoOption;
  paintworkAdequate: YesNoOption;
  ptFuseLinkIntact: YesNoOption;
  noCorrosion: YesNoOption;
  silicaGelCondition: GoodBadOption;
  correctLabelling: YesNoOption;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Updated to match with asset-types
export interface InspectionItem {
  id: string;
  category: string;
  name: string;
  status: string | undefined;
  remarks?: string;
}

export interface InspectionCategory {
  category: string;
  items: InspectionItem[];
}

export interface DataContextType {
  regions: Region[];
  districts: District[];
  isLoadingRegions: boolean;
  isLoadingDistricts: boolean;
  regionsError: string | null;
  districtsError: string | null;
  retryRegionsAndDistricts: () => Promise<void>;
  op5Faults: OP5Fault[];
  controlSystemOutages: ControlSystemOutage[];
  addOP5Fault: (fault: Omit<OP5Fault, "id">) => Promise<string>;
  updateOP5Fault: (id: string, data: Partial<OP5Fault>) => Promise<void>;
  deleteOP5Fault: (id: string) => Promise<void>;
  addControlSystemOutage: (outage: Omit<ControlSystemOutage, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => Promise<string>;
  updateControlSystemOutage: (id: string, data: Partial<ControlSystemOutage>) => Promise<void>;
  deleteControlSystemOutage: (id: string) => Promise<void>;
  canResolveFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  getFilteredFaults: (regionId?: string, districtId?: string) => { op5Faults: OP5Fault[]; controlOutages: ControlSystemOutage[] };
  resolveFault: (id: string, isOP5: boolean, restorationDate: string) => Promise<void>;
  deleteFault: (id: string, isOP5: boolean) => Promise<void>;
  canEditFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  canEditOutage: (outage: ControlSystemOutage) => boolean;
  canEditAsset: (asset: VITAsset) => boolean;
  canEditInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  canDeleteFault: (fault: OP5Fault) => boolean;
  canDeleteOutage: (outage: ControlSystemOutage) => boolean;
  canDeleteAsset: (asset: VITAsset) => boolean;
  canDeleteInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  canAddAsset: (regionId: string, districtId: string) => boolean;
  canAddInspection: (assetId?: string, region?: string, district?: string) => boolean;
  addControlOutage: (outage: Omit<ControlSystemOutage, "id" | "status">) => void;
  deleteControlOutage: (id: string) => void;
  addVITAsset: (asset: Omit<VITAsset, "id" | "createdAt" | "updatedAt">) => void;
  updateVITAsset: (id: string, updates: Partial<VITAsset>) => void;
  deleteVITAsset: (id: string) => void;
  addVITInspection: (inspection: Omit<VITInspectionChecklist, "id">) => Promise<string>;
  updateVITInspection: (id: string, inspection: Partial<VITInspectionChecklist>) => void;
  deleteVITInspection: (id: string) => void;
  updateDistrict: (id: string, updates: Partial<District>) => void;
  saveInspection: (data: Omit<SubstationInspection, "id">) => string;
  getSavedInspection: (id: string) => SubstationInspection | undefined;
  updateSubstationInspection: (id: string, data: Partial<SubstationInspection>) => void;
  deleteInspection: (id: string) => void;
  saveLoadMonitoringRecord: (data: Omit<LoadMonitoringData, "id">) => string;
  getLoadMonitoringRecord: (id: string) => LoadMonitoringData | undefined;
  updateLoadMonitoringRecord: (id: string, data: Partial<LoadMonitoringData>) => void;
  deleteLoadMonitoringRecord: (id: string) => void;
  canEditLoadMonitoring: boolean;
  canDeleteLoadMonitoring: boolean;
}

// Exported for use elsewhere
export interface ReliabilityIndices {
  saidi: number;
  saifi: number;
  caidi: number;
}

// Exported for use elsewhere
export interface AffectedPopulation {
  rural: number | null;
  urban: number | null;
  metro: number | null;
}

// Type for materials used
export interface MaterialUsed {
  id: string; // Use UUID for unique key in lists
  type: 'Fuse' | 'Conductor' | 'Others' | string;
  rating?: string;      // For Fuse
  quantity?: number;    // For Fuse and Others
  conductorType?: string; // For Conductor
  length?: number;      // For Conductor (e.g., in meters)
  description?: string; // For Others
}

export type PoleHeight = "8m" | "9m" | "10m" | "11m" | "14m" | "others";

export type PoleType = "CP" | "WP" | "SP" | "ST"; // CP - Concrete, WP - Wood, SP - Steel Tubular, ST - Steel Tower

// Rename interface and all references
export interface NetworkInspection {
  id: string;
  originalOfflineId?: string;
  createdAt: string;
  updatedAt: string;
  
  // Offline properties
  isOffline?: boolean;
  offlineId?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  date?: string;
  time?: string;
  region: string;
  district: string;
  feederName: string;
  feederAlias?: string;
  voltageLevel: string;
  referencePole: string;
  latitude: number;
  longitude: number;
  location?: string;
  status: "pending" | "in-progress" | "completed" | "rejected";
  inspector: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  // Pole Information
  poleId: string;
  poleHeight: "8m" | "9m" | "10m" | "11m" | "14m" | "others";
  poleType: "CP" | "WP" | "SP" | "ST";
  groundCondition: string;
  items: InspectionItem[];
  
  // Head Gears Information
  poleCondition: {
    tilted: boolean;
    broken: boolean;
    rotten: boolean;
    burnt: boolean;
    substandard: boolean;
    conflictWithLV: boolean;
    notes: string;
  };
  
  stayCondition: {
    requiredButNotAvailable: boolean;
    cut: boolean;
    misaligned: boolean;
    defectiveStay: boolean;
    notes: string;
  };
  
  crossArmCondition: {
    misaligned: boolean;
    bend: boolean;
    corroded: boolean;
    substandard: boolean;
    others: boolean;
    notes: string;
  };
  
  insulatorCondition: {
    insulatorType?: string;
    brokenOrCracked: boolean;
    burntOrFlashOver: boolean;
    shattered: boolean;
    defectiveBinding: boolean;
    notes: string;
  };
  
  conductorCondition: {
    looseConnectors: boolean;
    weakJumpers: boolean;
    burntLugs: boolean;
    saggedLine: boolean;
    brokenConductor: boolean;
    undersized: boolean;
    notes: string;
  };
  
  lightningArresterCondition: {
    brokenOrCracked: boolean;
    flashOver: boolean;
    noEarthing: boolean;
    bypassed: boolean;
    noArrester: boolean;
    notes: string;
  };
  
  dropOutFuseCondition: {
    brokenOrCracked: boolean;
    flashOver: boolean;
    insufficientClearance: boolean;
    looseOrNoEarthing: boolean;
    corroded: boolean;
    linkedHVFuses: boolean;
    others: boolean;
    notes: string;
  };
  
  transformerCondition: {
    leakingOil: boolean;
    lowOilLevel: boolean;
    missingEarthLeads: boolean;
    linkedHVFuses: boolean;
    rustedTank: boolean;
    crackedBushing: boolean;
    others: boolean;
    notes: string;
  };
  
  recloserCondition: {
    lowGasLevel: boolean;
    lowBatteryLevel: boolean;
    burntVoltageTransformers: boolean;
    protectionDisabled: boolean;
    bypassed: boolean;
    others: boolean;
    notes: string;
  };
  
  vegetationConflicts: {
    climbers: boolean;
    trees: boolean;
    others: boolean;
    notes: string;
  };
  
  additionalNotes: string;
  images: string[];
  afterImages: string[];
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  eventType: string;
  details: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "investigating" | "resolved" | "dismissed";
  userId?: string;
  metadata?: Record<string, any>;
}

// Add missing type definitions
export interface FeederInfo {
  id: string;
  name: string;
  alias?: string;
  bsp: string;
  bspPss: string;
  regionId: string;
  districtId: string;
  region?: string;
  district?: string;
  voltageLevel?: string;
  feederType?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BroadcastMessage {
  id: string;
  message: string;
  priority: "low" | "medium" | "high";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffIdEntry {
  id: string;
  customId: string;
  name: string;
  email: string;
  role: string;
  region: string;
  district: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsData {
  id: string;
  date: string;
  region: string;
  district: string;
  metric: string;
  value: number;
  unit: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubstationStatus {
  id: string;
  originalOfflineId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  
  // Offline properties
  isOffline?: boolean;
  offlineId?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  
  // Basic Information
  date: string;
  time: string;
  region: string;
  district: string;
  regionId: string;
  districtId: string;
  latitude: number;
  longitude: number;
  location?: string;
  status: "pending" | "in-progress" | "completed" | "rejected";
  inspector: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  
  // Substation Information
  substationNumber: string;
  substationName: string;
  rating: string;
  transformerType: "PMT" | "GMT";
  
  // Transformer Conditions
  transformerConditions: {
    namePlate: boolean;
    oilLeakage: "yes" | "no";
    bushing: "broken" | "cracked" | "leaking_oil" | "intact";
    notes: string;
    photos?: string[]; // Dedicated photos for transformer conditions
    namePlatePhotos?: string[]; // Dedicated photos for name plate
  };
  
  // Fuse Conditions
  fuseConditions: {
    fuseType: "linked" | "intact";
    fuseHolder: "loose" | "intact" | "burnt";
    notes: string;
    photos?: string[]; // Dedicated photos for fuse conditions
  };
  
  // Earthing Conditions
  earthingConditions: {
    earthingStatus: "cut" | "intact";
    notes: string;
    photos?: string[]; // Dedicated photos for earthing conditions
  };
  
  // General Notes
  generalNotes: string;
  
  // Photos - Maintain backward compatibility
  images: string[];
  afterImages: string[];
}
