export const COLLECTIONS = {
  OP5_FAULTS: 'op5Faults',
  CONTROL_OUTAGES: 'controlOutages',
  LOAD_MONITORING: 'loadMonitoring',
  VIT_ASSETS: 'vitAssets',
  VIT_INSPECTIONS: 'vitInspections',
  SUBSTATION_INSPECTIONS: 'substationInspections',
  OVERHEAD_LINE_INSPECTIONS: 'overheadLineInspections',
  REGIONS: 'regions',
  DISTRICTS: 'districts'
} as const;

// Type for collection names to ensure type safety
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS]; 