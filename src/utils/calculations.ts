// Outage Duration Calculation (in hours)
export const calculateOutageDuration = (occurrenceDate: string, restorationDate: string): number => {
  const start = new Date(occurrenceDate).getTime();
  const end = new Date(restorationDate).getTime();
  const hours = (end - start) / (1000 * 60 * 60); // Convert milliseconds to hours
  return Number(hours.toFixed(2)); // Round to 2 decimal places
};

// MTTR (Mean Time To Repair) Calculation (in hours)
export const calculateMTTR = (repairStartDate: string, repairEndDate: string): number => {
  const start = new Date(repairStartDate).getTime();
  const end = new Date(repairEndDate).getTime();
  const hours = (end - start) / (1000 * 60 * 60); // Convert milliseconds to hours
  return Number(hours.toFixed(2)); // Round to 2 decimal places
};

// Calculate SAIDI (System Average Interruption Duration Index)
export const calculateSAIDI = (
  outages: { occurrenceDate: string; restorationDate: string; affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerMinutes = outages.reduce((sum, outage) => {
    const duration = calculateOutageDuration(outage.occurrenceDate, outage.restorationDate);
    return sum + (duration * outage.affectedCustomers);
  }, 0);
  
  return totalCustomerMinutes / totalCustomers;
};

// Calculate SAIFI (System Average Interruption Frequency Index)
export const calculateSAIFI = (
  outages: { affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerInterruptions = outages.reduce((sum, outage) => {
    return sum + outage.affectedCustomers;
  }, 0);
  
  return totalCustomerInterruptions / totalCustomers;
};

// Calculate CAIDI (Customer Average Interruption Duration Index) = SAIDI/SAIFI
export const calculateCAIDI = (saidi: number, saifi: number): number => {
  if (saifi === 0) return 0;
  return saidi / saifi;
};

// Calculate Unserved Energy (MWh)
// @param loadMW - Load in Megawatts (must be positive)
// @param durationHours - Duration in hours (must be positive)
// @returns Unserved Energy in Megawatt-hours (MWh)
export const calculateUnservedEnergy = (loadMW: number, durationHours: number): number => {
  // Validate inputs
  if (loadMW <= 0) {
    console.warn('Load must be positive');
    return 0;
  }
  
  if (durationHours <= 0) {
    console.warn('Duration must be positive');
    return 0;
  }
  
  // Calculate unserved energy and round to 2 decimal places
  const unservedEnergy = loadMW * durationHours;
  return Number(unservedEnergy.toFixed(2));
};

// Calculate Duration in Hours from dates
export const calculateDurationHours = (occurrenceDate: string, restorationDate: string): number => {
  const start = new Date(occurrenceDate).getTime();
  const end = new Date(restorationDate).getTime();
  return (end - start) / (1000 * 60 * 60); // Convert milliseconds to hours
};

// Format a date object to a readable string
export const formatDate = (timestamp: any, includeTime: boolean = false) => {
  if (!timestamp) return "Not available";
  
  try {
    // Handle Firestore timestamp
    if (timestamp?.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        ...(includeTime && {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        })
      });
    }
    
    // Handle string date
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) 
      ? date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          ...(includeTime && {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          })
        })
      : "Invalid date";
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

// Format duration in hours to a human-readable string
export const formatDuration = (hours: number): string => {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  return `${hours.toFixed(1)} hr`;
};

// Calculate Customer Lost Hours
export const calculateCustomerLostHours = (
  outrageDuration: number, // in hours
  affectedPopulation: { rural: number; urban: number; metro: number }
): number => {
  const totalAffectedCustomers = affectedPopulation.rural + affectedPopulation.urban + affectedPopulation.metro;
  const lostHours = outrageDuration * totalAffectedCustomers;
  return Number(lostHours.toFixed(2)); // Round to 2 decimal places
};

// Calculate SAIDI for specific population type
export const calculateSAIDIByType = (
  outages: { occurrenceDate: string; restorationDate: string; affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerMinutes = outages.reduce((sum, outage) => {
    const duration = calculateOutageDuration(outage.occurrenceDate, outage.restorationDate);
    return sum + (duration * outage.affectedCustomers);
  }, 0);
  
  return totalCustomerMinutes / totalCustomers;
};

// Calculate SAIFI for specific population type
export const calculateSAIFIByType = (
  outages: { affectedCustomers: number }[],
  totalCustomers: number
): number => {
  if (outages.length === 0 || totalCustomers === 0) return 0;
  
  const totalCustomerInterruptions = outages.reduce((sum, outage) => {
    return sum + outage.affectedCustomers;
  }, 0);
  
  return totalCustomerInterruptions / totalCustomers;
};

// Calculate reliability indices by population type
export const calculateReliabilityIndicesByType = (
  occurrenceDate: string,
  restorationDate: string,
  affected: { rural: number; urban: number; metro: number },
  total: { rural: number; urban: number; metro: number }
) => {
  const indices = {
    rural: { saidi: 0, saifi: 0, caidi: 0 },
    urban: { saidi: 0, saifi: 0, caidi: 0 },
    metro: { saidi: 0, saifi: 0, caidi: 0 }
  };

  // Calculate for rural population
  if (total.rural > 0) {
    indices.rural.saidi = calculateSAIDIByType(
      [{ occurrenceDate, restorationDate, affectedCustomers: affected.rural }],
      total.rural
    );
    indices.rural.saifi = calculateSAIFIByType(
      [{ affectedCustomers: affected.rural }],
      total.rural
    );
    indices.rural.caidi = calculateCAIDI(indices.rural.saidi, indices.rural.saifi);
  }

  // Calculate for urban population
  if (total.urban > 0) {
    indices.urban.saidi = calculateSAIDIByType(
      [{ occurrenceDate, restorationDate, affectedCustomers: affected.urban }],
      total.urban
    );
    indices.urban.saifi = calculateSAIFIByType(
      [{ affectedCustomers: affected.urban }],
      total.urban
    );
    indices.urban.caidi = calculateCAIDI(indices.urban.saidi, indices.urban.saifi);
  }

  // Calculate for metro population
  if (total.metro > 0) {
    indices.metro.saidi = calculateSAIDIByType(
      [{ occurrenceDate, restorationDate, affectedCustomers: affected.metro }],
      total.metro
    );
    indices.metro.saifi = calculateSAIFIByType(
      [{ affectedCustomers: affected.metro }],
      total.metro
    );
    indices.metro.caidi = calculateCAIDI(indices.metro.saidi, indices.metro.saifi);
  }

  return indices;
};

// Calculate reliability indices based on selected level (global, regional, or district)
export const calculateReliabilityIndicesByLevel = (
  faults: any[],
  districts: any[],
  selectedRegionId?: string,
  selectedDistrictId?: string
) => {
  const indices = {
    rural: { saidi: 0, saifi: 0, caidi: 0 },
    urban: { saidi: 0, saifi: 0, caidi: 0 },
    metro: { saidi: 0, saifi: 0, caidi: 0 },
    total: { saidi: 0, saifi: 0, caidi: 0 }
  };

  // Filter faults based on selected level
  let filteredFaults = faults;
  let totalPopulation = { rural: 0, urban: 0, metro: 0 };

  if (selectedDistrictId) {
    // District level
    filteredFaults = faults.filter(fault => fault.districtId === selectedDistrictId);
    const district = districts.find(d => d.id === selectedDistrictId);
    if (district?.population) {
      totalPopulation = district.population;
    }
  } else if (selectedRegionId) {
    // Regional level
    filteredFaults = faults.filter(fault => fault.regionId === selectedRegionId);
    const regionDistricts = districts.filter(d => d.regionId === selectedRegionId);
    totalPopulation = regionDistricts.reduce((acc, district) => ({
      rural: acc.rural + (district.population?.rural || 0),
      urban: acc.urban + (district.population?.urban || 0),
      metro: acc.metro + (district.population?.metro || 0)
    }), { rural: 0, urban: 0, metro: 0 });
  } else {
    // Global level
    totalPopulation = districts.reduce((acc, district) => ({
      rural: acc.rural + (district.population?.rural || 0),
      urban: acc.urban + (district.population?.urban || 0),
      metro: acc.metro + (district.population?.metro || 0)
    }), { rural: 0, urban: 0, metro: 0 });
  }

  // Calculate total affected customers and duration for each population type
  let totalAffected = { rural: 0, urban: 0, metro: 0 };
  let totalDuration = { rural: 0, urban: 0, metro: 0 };
  let totalFaults = { rural: 0, urban: 0, metro: 0 };

  filteredFaults.forEach(fault => {
    if (fault.affectedPopulation) {
      const { rural, urban, metro } = fault.affectedPopulation;
      const duration = fault.occurrenceDate && fault.restorationDate ? 
        calculateOutageDuration(fault.occurrenceDate, fault.restorationDate) : 0;

      // Calculate for each population type separately
      if (rural > 0) {
        totalAffected.rural += rural;
        totalDuration.rural += duration * rural;
        totalFaults.rural++;
      }
      if (urban > 0) {
        totalAffected.urban += urban;
        totalDuration.urban += duration * urban;
        totalFaults.urban++;
      }
      if (metro > 0) {
        totalAffected.metro += metro;
        totalDuration.metro += duration * metro;
        totalFaults.metro++;
      }
    }
  });

  // Calculate indices for each population type
  ['rural', 'urban', 'metro'].forEach(type => {
    const t = type as keyof typeof totalPopulation;
    if (totalPopulation[t] > 0) {
      // SAIDI = Total Customer Hours Lost / Total Number of Customers
      indices[t].saidi = Number((totalDuration[t] / totalPopulation[t]).toFixed(3));
      
      // SAIFI = Total Customers Affected / Total Number of Customers
      indices[t].saifi = Number((totalAffected[t] / totalPopulation[t]).toFixed(3));
      
      // CAIDI = SAIDI / SAIFI
      indices[t].caidi = indices[t].saifi > 0 ? 
        Number((indices[t].saidi / indices[t].saifi).toFixed(3)) : 0;
    }
  });

  // Calculate total indices
  const totalAffectedAll = totalAffected.rural + totalAffected.urban + totalAffected.metro;
  const totalDurationAll = totalDuration.rural + totalDuration.urban + totalDuration.metro;
  const totalPopulationAll = totalPopulation.rural + totalPopulation.urban + totalPopulation.metro;

  if (totalPopulationAll > 0) {
    indices.total.saidi = Number((totalDurationAll / totalPopulationAll).toFixed(3));
    indices.total.saifi = Number((totalAffectedAll / totalPopulationAll).toFixed(3));
    indices.total.caidi = indices.total.saifi > 0 ? 
      Number((indices.total.saidi / indices.total.saifi).toFixed(3)) : 0;
  }

  return indices;
};

// Haversine formula to calculate distance between two GPS coordinates (in meters)
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total feeder length for a given feeder name from NetworkInspection records
export function calculateFeederLengthForFeeder(
  inspections: { feederName: string; latitude: number; longitude: number; date?: string; time?: string }[],
  feederName: string
): number {
  // Filter inspections for the given feeder name and valid GPS
  const feederInspections = inspections
    .filter(i => i.feederName === feederName && typeof i.latitude === 'number' && typeof i.longitude === 'number')
    // Sort by date and time if available
    .sort((a, b) => {
      const dateA = new Date(`${a.date || ''}T${a.time || '00:00'}`).getTime();
      const dateB = new Date(`${b.date || ''}T${b.time || '00:00'}`).getTime();
      return dateA - dateB;
    });

  let totalLength = 0;
  for (let i = 1; i < feederInspections.length; i++) {
    const prev = feederInspections[i - 1];
    const curr = feederInspections[i];
    totalLength += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }
  return totalLength; // in meters
}
