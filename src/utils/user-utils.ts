import { User, UserRole } from "@/lib/types";
import { Region, District } from "@/lib/types";

export function getUserRegionAndDistrict(
  user: User | null,
  regions: Region[],
  districts: District[]
): { regionId: string | null; districtId: string | null } {
  if (!user) return { regionId: null, districtId: null };

  let regionId: string | null = null;
  let districtId: string | null = null;

  // For global engineers and system admins, default to the first region and first district in that region
  if (user.role === "global_engineer" || user.role === "system_admin") {
    if (regions.length > 0) {
      regionId = regions[0].id;
      const districtsInRegion = districts.filter(d => d.regionId === regionId);
      if (districtsInRegion.length > 0) {
        districtId = districtsInRegion[0].id;
      }
    }
    return { regionId, districtId };
  }

  // For district engineers, district managers and technicians, find both region and district
  if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
    const userRegion = regions.find(r => r.name === user.region);
    if (userRegion) {
      regionId = userRegion.id;
      const userDistrict = districts.find(d => d.name === user.district && d.regionId === userRegion.id);
      if (userDistrict) {
        districtId = userDistrict.id;
      }
    }
  }
  // For regional engineers and regional general managers, find only region
  else if ((user.role === "regional_engineer" || user.role === "regional_general_manager") && user.region) {
    const userRegion = regions.find(r => r.name === user.region);
    if (userRegion) {
      regionId = userRegion.id;
    }
  }
  // For ashsubt - return first allowed Ashanti region
  else if (user.role === "ashsubt") {
    const ashsubtRegionIds = ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'];
    const ashsubtRegions = regions.filter(r => ashsubtRegionIds.includes(r.id));
    if (ashsubtRegions.length > 0) {
      regionId = ashsubtRegions[0].id; // Return first region as default
    }
  }
  // For accsubt - return first allowed Accra region
  else if (user.role === "accsubt") {
    const accsubtRegionIds = ['subtransmission-accra', 'accra-east', 'accra-west'];
    const accsubtRegions = regions.filter(r => accsubtRegionIds.includes(r.id));
    if (accsubtRegions.length > 0) {
      regionId = accsubtRegions[0].id; // Return first region as default
    }
  }

  return { regionId, districtId };
}

export function validateUserRoleAssignment(
  role: UserRole,
  region: string | undefined,
  district: string | undefined,
  regions: Region[],
  districts: District[]
): { isValid: boolean; error?: string } {
  // For global engineers and system admins, no region/district needed
  if (role === "global_engineer" || role === "system_admin") {
    return { isValid: true };
  }

  // For regional engineers, regional general managers, ashsubt, accsubt, technicians, and district engineers, region is required
  if (role === "regional_engineer" || role === "regional_general_manager" || role === "ashsubt" || role === "accsubt" || role === "technician" || role === "district_engineer" || role === "district_manager") {
    if (!region) {
      return { isValid: false, error: "Region is required" };
    }
  }

  // Validate region exists
  const selectedRegion = regions.find(r => r.name === region);
  if (!selectedRegion) {
    return { isValid: false, error: "Invalid region selected" };
  }

  // For district engineers, district managers and technicians, district is required
  if (role === "district_engineer" || role === "district_manager" || role === "technician") {
    if (!district) {
      return { isValid: false, error: "District is required for District Engineers, District Managers and Technicians" };
    }

    // Validate district exists and belongs to selected region
    const selectedDistrict = districts.find(d => 
      d.name === district && d.regionId === selectedRegion.id
    );
    if (!selectedDistrict) {
      return { isValid: false, error: "Selected district does not belong to the selected region" };
    }
  }

  return { isValid: true };
}

export function getFilteredRegionsAndDistricts(
  user: User | null,
  regions: Region[],
  districts: District[],
  selectedRegionId?: string
): { filteredRegions: Region[]; filteredDistricts: District[] } {
  // For global engineers and system admins, show all regions
  const filteredRegions = (user?.role === "global_engineer" || user?.role === "system_admin")
    ? regions
    : regions.filter(r => user?.region ? r.name === user.region : true);

  // Show districts only for the selected region
  const filteredDistricts = selectedRegionId
    ? districts.filter(d => d.regionId === selectedRegionId)
    : [];

  return { filteredRegions, filteredDistricts };
} 