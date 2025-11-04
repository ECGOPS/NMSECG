import { z } from "zod";

// OP5 Fault Form Schema
export const op5FormSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  districtId: z.string().min(1, "District is required"),
  outageType: z.string().min(1, "Outage type is required"),
  outageDescription: z.string().min(1, "Outage description is required"),
  areasAffected: z.string().min(1, "Areas affected is required"),
  substationNo: z.string().min(1, "Substation number is required"),
  occurrenceDate: z.string().min(1, "Occurrence date is required"),
  repairDate: z.string().optional(),
  repairEndDate: z.string().optional(),
  restorationDate: z.string().optional(),
  ruralAffected: z.number().min(0, "Rural affected must be 0 or greater").nullable(),
  urbanAffected: z.number().min(0, "Urban affected must be 0 or greater").nullable(),
  metroAffected: z.number().min(0, "Metro affected must be 0 or greater").nullable(),
  specificFaultType: z.enum([
    "REPLACE FUSE",
    "REPLACE CABLE",
    "REPLACE TRANSFORMER",
    "REPLACE SWITCH",
    "REPLACE INSULATOR",
    "REPLACE POLE",
    "REPLACE METER",
    "REPLACE PROTECTION",
    "REPLACE CONTROL",
    "REPLACE COMMUNICATION",
    "REPLACE MONITORING",
    "REPLACE SCADA",
    "REPLACE AUTOMATION",
    "REPLACE RELAY",
    "REPLACE CIRCUIT BREAKER",
    "REPLACE DISCONNECTOR",
    "REPLACE EARTH SWITCH",
    "REPLACE CURRENT TRANSFORMER",
    "REPLACE VOLTAGE TRANSFORMER",
    "REPLACE SURGE ARRESTER",
    "REPLACE CAPACITOR BANK",
    "REPLACE REACTOR",
    "REPLACE FILTER",
    "REPLACE HARMONIC FILTER",
    "REPLACE POWER FACTOR CORRECTION",
    "REPLACE ENERGY METER",
    "REPLACE DEMAND METER",
    "REPLACE MAXIMUM DEMAND METER",
    "REPLACE KWH METER",
    "REPLACE KVARH METER",
    "REPLACE POWER METER",
    "REPLACE VOLTAGE METER",
    "REPLACE CURRENT METER",
    "REPLACE FREQUENCY METER",
    "REPLACE POWER FACTOR METER",
    "REPLACE PHASE ANGLE METER",
    "REPLACE SYNCHRONISCOPE",
    "REPLACE TACHOMETER",
    "REPLACE SPEED GOVERNOR",
    "REPLACE EXCITATION SYSTEM",
    "REPLACE GOVERNOR SYSTEM",
    "REPLACE TURBINE CONTROL",
    "REPLACE BOILER CONTROL",
    "REPLACE FEEDWATER CONTROL",
    "REPLACE STEAM CONTROL",
    "REPLACE AIR CONTROL",
    "REPLACE FUEL CONTROL",
    "REPLACE COMBUSTION CONTROL",
    "REPLACE EMISSION CONTROL",
    "REPLACE NOISE CONTROL",
    "REPLACE VIBRATION CONTROL",
    "REPLACE TEMPERATURE CONTROL",
    "REPLACE PRESSURE CONTROL",
    "REPLACE FLOW CONTROL",
    "REPLACE LEVEL CONTROL",
    "REPLACE PH CONTROL",
    "REPLACE CONDUCTIVITY CONTROL",
    "REPLACE TURBIDITY CONTROL",
    "REPLACE COLOR CONTROL",
    "REPLACE ODOR CONTROL",
    "REPLACE TASTE CONTROL",
    "REPLACE TEXTURE CONTROL",
    "REPLACE CONSISTENCY CONTROL",
    "REPLACE VISCOSITY CONTROL",
    "REPLACE DENSITY CONTROL",
    "REPLACE SPECIFIC GRAVITY CONTROL",
    "REPLACE MOISTURE CONTROL",
    "REPLACE ASH CONTROL",
    "REPLACE SULFUR CONTROL",
    "REPLACE NITROGEN CONTROL",
    "REPLACE CARBON CONTROL",
    "REPLACE HYDROGEN CONTROL",
    "REPLACE OXYGEN CONTROL",
    "REPLACE CHLORINE CONTROL",
    "REPLACE FLUORINE CONTROL",
    "REPLACE BROMINE CONTROL",
    "REPLACE IODINE CONTROL",
    "REPLACE ARSENIC CONTROL",
    "REPLACE CADMIUM CONTROL",
    "REPLACE CHROMIUM CONTROL",
    "REPLACE COPPER CONTROL",
    "REPLACE LEAD CONTROL",
    "REPLACE MERCURY CONTROL",
    "REPLACE NICKEL CONTROL",
    "REPLACE SELENIUM CONTROL",
    "REPLACE SILVER CONTROL",
    "REPLACE THALLIUM CONTROL",
    "REPLACE ZINC CONTROL",
    "REPLACE ALUMINUM CONTROL",
    "REPLACE BARIUM CONTROL",
    "REPLACE BERYLLIUM CONTROL",
    "REPLACE BORON CONTROL",
    "REPLACE CALCIUM CONTROL",
    "REPLACE COBALT CONTROL",
    "REPLACE IRON CONTROL",
    "REPLACE LITHIUM CONTROL",
    "REPLACE MAGNESIUM CONTROL",
    "REPLACE MANGANESE CONTROL",
    "REPLACE MOLYBDENUM CONTROL",
    "REPLACE PHOSPHORUS CONTROL",
    "REPLACE POTASSIUM CONTROL",
    "REPLACE SODIUM CONTROL",
    "REPLACE STRONTIUM CONTROL",
    "REPLACE TITANIUM CONTROL",
    "REPLACE VANADIUM CONTROL",
    "REPLACE TUNGSTEN CONTROL",
    "REPLACE URANIUM CONTROL",
    "REPLACE PLUTONIUM CONTROL",
    "REPLACE AMERICIUM CONTROL",
    "REPLACE CURIUM CONTROL",
    "REPLACE BERKELIUM CONTROL",
    "REPLACE CALIFORNIUM CONTROL",
    "REPLACE EINSTEINIUM CONTROL",
    "REPLACE FERMIUM CONTROL",
    "REPLACE MENDELEVIUM CONTROL",
    "REPLACE NOBELIUM CONTROL",
    "REPLACE LAWRENCIUM CONTROL",
    "REPLACE RUTHERFORDIUM CONTROL",
    "REPLACE DUBNIUM CONTROL",
    "REPLACE SEABORGIUM CONTROL",
    "REPLACE BOHRIUM CONTROL",
    "REPLACE HASSIUM CONTROL",
    "REPLACE MEITNERIUM CONTROL",
    "REPLACE DARMSTADTIUM CONTROL",
    "REPLACE ROENTGENIUM CONTROL",
    "REPLACE COPERNICIUM CONTROL",
    "REPLACE NIHONIUM CONTROL",
    "REPLACE FLEROVIUM CONTROL",
    "REPLACE MOSCOVIUM CONTROL",
    "REPLACE LIVERMORIUM CONTROL",
    "REPLACE TENNESSINE CONTROL",
    "REPLACE OGANNESSON CONTROL",
    "OTHERS"
  ]).optional(),
  fuseCircuit: z.string().optional(),
  fusePhase: z.string().optional(),
  otherFaultType: z.string().optional(),
  customerPhoneNumber: z.string().optional(),
  alternativePhoneNumber: z.string().optional(),
  feeder: z.string().optional(),
  voltageLevel: z.string().optional(),
}).refine((data) => {
  // At least one affected population field must be filled
  return data.ruralAffected !== null || data.urbanAffected !== null || data.metroAffected !== null;
}, {
  message: "At least one affected population field must be filled",
  path: ["ruralAffected"]
}).refine((data) => {
  // If specific fault type is "REPLACE FUSE", circuit and phase are required
  if (data.specificFaultType === "REPLACE FUSE") {
    return data.fuseCircuit && data.fusePhase;
  }
  return true;
}, {
  message: "Circuit and phase are required for Replace Fuse",
  path: ["fuseCircuit"]
}).refine((data) => {
  // If specific fault type is "OTHERS", otherFaultType is required
  if (data.specificFaultType === "OTHERS") {
    return data.otherFaultType && data.otherFaultType.trim().length > 0;
  }
  return true;
}, {
  message: "Please specify the fault type",
  path: ["otherFaultType"]
});

// Control System Outage Form Schema
export const controlSystemOutageSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  districtId: z.string().min(1, "District is required"),
  occurrenceDate: z.string().min(1, "Occurrence date is required"),
  restorationDate: z.string().optional(),
  faultType: z.string().min(1, "Fault type is required"),
  specificFaultType: z.string().optional(),
  loadMW: z.number().min(0, "Load MW must be 0 or greater"),
  reason: z.string().min(1, "Reason is required"),
  indications: z.string().min(1, "Indications are required"),
  areaAffected: z.string().min(1, "Area affected is required"),
  customersAffected: z.object({
    rural: z.number().min(0),
    urban: z.number().min(0),
    metro: z.number().min(0)
  }),
  estimatedResolutionTime: z.number().min(0).nullable(),
  voltageLevel: z.string().min(1, "Voltage level is required"),
  repairStartDate: z.string().optional(),
  repairEndDate: z.string().optional(),
  feederType: z.string().min(1, "Feeder type is required"),
}).refine((data) => {
  // At least one affected population field must be filled
  return data.customersAffected.rural > 0 || data.customersAffected.urban > 0 || data.customersAffected.metro > 0;
}, {
  message: "At least one affected population field must be filled",
  path: ["customersAffected"]
}).refine((data) => {
  // If repair dates are provided, they must be valid
  if (data.repairStartDate && data.repairEndDate) {
    return new Date(data.repairEndDate) > new Date(data.repairStartDate);
  }
  return true;
}, {
  message: "Repair end date must be after repair start date",
  path: ["repairEndDate"]
});

// Load Monitoring Form Schema
export const loadMonitoringSchema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  regionId: z.string().min(1, "Region is required"),
  districtId: z.string().min(1, "District is required"),
  region: z.string().min(1, "Region name is required"),
  district: z.string().min(1, "District name is required"),
  substationName: z.string().min(1, "Substation name is required"),
  substationNumber: z.string().min(1, "Substation number is required"),
  rating: z.number().min(0.1, "Rating must be greater than 0"),
  feederLegs: z.array(z.object({
    redPhaseCurrent: z.number().min(0, "Red phase current must be 0 or greater"),
    yellowPhaseCurrent: z.number().min(0, "Yellow phase current must be 0 or greater"),
    bluePhaseCurrent: z.number().min(0, "Blue phase current must be 0 or greater"),
    neutralCurrent: z.number().min(0, "Neutral current must be 0 or greater"),
  })).min(1, "At least one feeder leg is required"),
});

// GPS Coordinate validation schema
export const gpsCoordinatesSchema = z.string()
  .refine((value) => {
    if (!value || value.trim() === '') return true; // Allow empty for optional fields
    
    // Check format: should be "lat,lng" or "lat, lng"
    const coordinatePattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
    if (!coordinatePattern.test(value.trim())) {
      return false;
    }
    
    // Parse coordinates
    const [latStr, lngStr] = value.split(',').map(s => s.trim());
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    
    // Check if parsing was successful
    if (isNaN(lat) || isNaN(lng)) {
      return false;
    }
    
    // Check ranges
    if (lat < -90 || lat > 90) {
      return false;
    }
    if (lng < -180 || lng > 180) {
      return false;
    }
    
    // Check precision (max 6 decimal places)
    const latDecimalPlaces = (latStr.split('.')[1] || '').length;
    const lngDecimalPlaces = (lngStr.split('.')[1] || '').length;
    if (latDecimalPlaces > 6 || lngDecimalPlaces > 6) {
      return false;
    }
    
    return true;
  }, {
    message: "GPS coordinates must be in format 'latitude,longitude' (e.g., '5.603717, -0.186964'). Latitude must be between -90 and 90, longitude between -180 and 180, with max 6 decimal places."
  });

// VIT Asset Form Schema
export const vitAssetSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  districtId: z.string().min(1, "District is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  typeOfUnit: z.string().min(1, "Type of unit is required"),
  location: z.string().min(1, "Location is required"),
  voltageLevel: z.string().min(1, "Voltage level is required"),
  gpsCoordinates: gpsCoordinatesSchema.optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  installationDate: z.string().optional(),
  lastInspectionDate: z.string().optional(),
  nextInspectionDate: z.string().optional(),
  status: z.enum(["operational", "maintenance", "out_of_service", "testing"]).optional(),
  notes: z.string().optional(),
});

// Staff ID Management Schema
export const staffIdSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum([
    'district_engineer',
    'regional_engineer', 
    'global_engineer',
    'system_admin',
    'technician',
    'district_manager',
    'regional_general_manager',
    'ict',
    'project_engineer'
  ]),
  region: z.string().optional(),
  district: z.string().optional(),
  customId: z.string().optional(),
}).refine((data) => {
  // Region is required for most roles except global_engineer and system_admin
  if (data.role !== "global_engineer" && data.role !== "system_admin") {
    return data.region && data.region.trim().length > 0;
  }
  return true;
}, {
  message: "Region is required for this role",
  path: ["region"]
}).refine((data) => {
  // District is required for district-specific roles
  if (["district_engineer", "technician", "district_manager"].includes(data.role)) {
    return data.district && data.district.trim().length > 0;
  }
  return true;
}, {
  message: "District is required for this role",
  path: ["district"]
});

// User Authentication Schema
export const userAuthSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

// District Population Schema
export const districtPopulationSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  districtId: z.string().min(1, "District is required"),
  rural: z.number().min(0, "Rural population must be 0 or greater"),
  urban: z.number().min(0, "Urban population must be 0 or greater"),
  metro: z.number().min(0, "Metro population must be 0 or greater"),
  total: z.number().min(0, "Total population must be 0 or greater"),
});

// Export types for use in components
export type OP5FormData = z.infer<typeof op5FormSchema>;
export type ControlSystemOutageData = z.infer<typeof controlSystemOutageSchema>;
export type LoadMonitoringData = z.infer<typeof loadMonitoringSchema>;
export type VITAssetData = z.infer<typeof vitAssetSchema>;
export type StaffIdData = z.infer<typeof staffIdSchema>;
export type UserAuthData = z.infer<typeof userAuthSchema>;
export type DistrictPopulationData = z.infer<typeof districtPopulationSchema>;
