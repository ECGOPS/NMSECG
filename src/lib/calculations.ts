export interface AffectedPopulation {
  rural: number;
  urban: number;
  metro: number;
}

export interface ReliabilityIndices {
  saidi: number;
  saifi: number;
  caidi: number;
}

export function calculateMTTR(repairDate: string, repairEndDate: string): number {
  const repair = new Date(repairDate);
  const repairEnd = new Date(repairEndDate);
  const diffInHours = (repairEnd.getTime() - repair.getTime()) / (1000 * 60 * 60);
  return Number(diffInHours.toFixed(2));
}

export function calculateOutageDuration(occurrenceDate: string, restorationDate: string): number {
  const occurrence = new Date(occurrenceDate);
  const restoration = new Date(restorationDate);
  const diffInHours = (restoration.getTime() - occurrence.getTime()) / (1000 * 60 * 60);
  return Number(diffInHours.toFixed(2));
}

export function calculateCustomerLostHours(outageDuration: number, affectedPopulation: AffectedPopulation): number {
  const totalAffected = affectedPopulation.rural + affectedPopulation.urban + affectedPopulation.metro;
  return Number((outageDuration * totalAffected).toFixed(2));
}

export function calculateReliabilityIndicesByType(
  outageDuration: number,
  affectedPopulation: AffectedPopulation,
  totalPopulation: number
): ReliabilityIndices {
  if (totalPopulation === 0) return { saidi: 0, saifi: 0, caidi: 0 };

  // Calculate total affected customers
  const totalAffected = affectedPopulation.rural + affectedPopulation.urban + affectedPopulation.metro;
  
  // Calculate customer hours lost (duration in hours × affected customers)
  const customerHours = outageDuration * totalAffected;
  
  // SAIDI = Total Customer Hours Lost / Total Number of Customers
  // Standard formula: Σ (ri × Ni) / Nt
  const saidi = Number((customerHours / totalPopulation).toFixed(3));
  
  // SAIFI = Total Customers Affected / Total Number of Customers
  // Standard formula: Σ Ni / Nt
  const saifi = Number((totalAffected / totalPopulation).toFixed(3));
  
  // CAIDI = SAIDI / SAIFI
  // Standard formula: Σ (ri × Ni) / Σ Ni
  const caidi = saifi === 0 ? 0 : Number((saidi / saifi).toFixed(3));

  return { saidi, saifi, caidi };
} 