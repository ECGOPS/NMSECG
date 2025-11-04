import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, InfoIcon, Users, MapPin, Calculator, FileText, Search, X } from "lucide-react";
import { FaultType, UnplannedFaultType, EmergencyFaultType, ControlSystemOutage } from "@/lib/types";
import { 
  calculateDurationHours,
  calculateUnservedEnergy
} from "@/utils/calculations";
import { toast } from "@/components/ui/sonner";
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { PermissionService } from "@/services/PermissionService";
import { OfflineStorageService } from "@/services/OfflineStorageService";
import { apiRequest } from "@/lib/api";
import LoggingService from "@/services/LoggingService";
import { FeederService } from "@/services/FeederService";
import { createSanitizedInputHandler, sanitizeFormData } from '@/utils/inputSanitization';

interface ControlSystemOutageFormProps {
  defaultRegionId?: string;
  defaultDistrictId?: string;
}

interface FeederInfo {
  id: string;
  name: string;
  alias?: string;
  bspPss: string;
  regionId: string;
  districtId: string;
}

export function ControlSystemOutageForm({ defaultRegionId = "", defaultDistrictId = "" }: ControlSystemOutageFormProps) {
  const { regions, districts, addControlSystemOutage } = useData();
  const { user } = useAzureADAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const feederService = FeederService.getInstance();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regionId, setRegionId] = useState<string>(defaultRegionId);
  const [districtId, setDistrictId] = useState<string>(defaultDistrictId);
  const [occurrenceDate, setOccurrenceDate] = useState<string>("");
  const [faultType, setFaultType] = useState<FaultType>("Unplanned");
  const [ruralAffected, setRuralAffected] = useState<number | null>(null);
  const [urbanAffected, setUrbanAffected] = useState<number | null>(null);
  const [metroAffected, setMetroAffected] = useState<number | null>(null);
  const [restorationDate, setRestorationDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [indications, setIndications] = useState<string>("");
  const [areaAffected, setAreaAffected] = useState<string>("");
  const [loadMW, setLoadMW] = useState<number | null>(null);
  const [estimatedResolutionTime, setEstimatedResolutionTime] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  
  // Derived values
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [unservedEnergyMWh, setUnservedEnergyMWh] = useState<number | null>(null);
  const [specificFaultType, setSpecificFaultType] = useState<UnplannedFaultType | EmergencyFaultType | undefined>("UNDER INVESTIGATION" as UnplannedFaultType);
  
  // New state variables for feeder/equipment details
  const [feederName, setFeederName] = useState<string>("");
  const [bspPss, setBspPss] = useState<string>("");
  const [voltageLevel, setVoltageLevel] = useState<string>("");
  const [repairStartDate, setRepairStartDate] = useState<string>("");
  const [repairEndDate, setRepairEndDate] = useState<string>("");
  const [feederType, setFeederType] = useState<string>("");
  const [customersAffected, setCustomersAffected] = useState<{
    metro: number;
    urban: number;
    rural: number;
  }>({
    metro: 0,
    urban: 0,
    rural: 0
  });
  
  // Customer interruption counts
  const [metroInterruptions, setMetroInterruptions] = useState<number | null>(null);
  const [urbanInterruptions, setUrbanInterruptions] = useState<number | null>(null);
  const [ruralInterruptions, setRuralInterruptions] = useState<number | null>(null);
  
  // Feeder customer counts
  const [metroFeederCustomers, setMetroFeederCustomers] = useState<number | null>(null);
  const [urbanFeederCustomers, setUrbanFeederCustomers] = useState<number | null>(null);
  const [ruralFeederCustomers, setRuralFeederCustomers] = useState<number | null>(null);
  
  // Feeder-related state
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedFeeder, setSelectedFeeder] = useState<string>("");
  const [feeders, setFeeders] = useState<FeederInfo[]>([]);
  const [feederSearch, setFeederSearch] = useState("");
  const [isFeederDropdownOpen, setIsFeederDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Handle search input focus
  const handleSearchFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isFeederDropdownOpen) {
      setIsFeederDropdownOpen(true);
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeederSearch(e.target.value);
  };

  // Handle search input keydown
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  // Add this effect to handle focus
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isFeederDropdownOpen && window.innerWidth > 768) { // Only auto-focus on desktop
      timeoutId = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isFeederDropdownOpen]);
  
  // Check if user has permission to report faults
  useEffect(() => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
  }, [user, navigate]);
  
  // Initialize region and district based on user's assigned values
  useEffect(() => {
    if (!user) return;

    console.log("[ControlSystemOutageForm] Initializing with user:", {
      role: user.role,
      region: user.region,
      district: user.district
    });

    // For district engineers, district managers and technicians
    if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.district) {
      const userDistrict = districts.find(d => d.name === user.district);
      console.log("[ControlSystemOutageForm] Found user district:", userDistrict);
      
      if (userDistrict) {
        setDistrictId(userDistrict.id);
        setRegionId(userDistrict.regionId);
        console.log("[ControlSystemOutageForm] Set district and region:", {
          districtId: userDistrict.id,
          regionId: userDistrict.regionId
        });
        return;
      }
    }
    
    // For regional engineers, project engineers, and regional general managers
    if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager" || user.role === "ashsubt" || user.role === "accsubt") && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      console.log("[ControlSystemOutageForm] Found user region:", userRegion);
      
      if (userRegion) {
        setRegionId(userRegion.id);
        console.log("[ControlSystemOutageForm] Set region:", userRegion.id);
        
        // Set the first available district in their region as default
        const userDistricts = districts.filter(d => d.regionId === userRegion.id);
        if (userDistricts.length > 0) {
          setDistrictId(userDistricts[0].id);
          console.log("[ControlSystemOutageForm] Set default district for regional user:", userDistricts[0].id);
        }
      }
    }
  }, [user, regions, districts]);
  
  // Update region and district when props change
  useEffect(() => {
    if (defaultRegionId) {
      setRegionId(defaultRegionId);
    }
    
    if (defaultDistrictId) {
      setDistrictId(defaultDistrictId);
    }
  }, [defaultRegionId, defaultDistrictId]);
  
  // Filter regions and districts based on user role
  const filteredRegions = regions.filter(region => {
    // Global engineers and system admins can see all regions
    if (user?.role === "global_engineer" || user?.role === "system_admin") return true;
      
    // Ashsubt users can see all Ashanti regions
    if (user?.role === "ashsubt") 
      return ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(region.id);
    
    // Accsubt users can see all Accra regions
    if (user?.role === "accsubt") 
      return ['subtransmission-accra', 'accra-east', 'accra-west'].includes(region.id);
    
    // Regional engineers, project engineers, and regional general managers can only see their assigned region
    if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager") 
      return region.name === user.region;
    
    // District engineers, district managers and technicians can only see their assigned region
    if (user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") {
      const userDistrict = districts.find(d => d.name === user.district);
      return userDistrict ? region.id === userDistrict.regionId : false;
    }
    
    return false;
  });

  const filteredDistricts = districts.filter(district => {
    if (!regionId) return false;
    
    // Global engineers and system admins can see all districts in the selected region
    if (user?.role === "global_engineer" || user?.role === "system_admin") 
      return district.regionId === regionId;
    
    // Regional engineers, project engineers, and regional general managers can see all districts in their region
    if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager" || user?.role === "ashsubt" || user?.role === "accsubt") 
      return district.regionId === regionId;
    
    // District engineers, district managers and technicians can only see their assigned district
    if (user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") 
      return district.name === user.district;
    
    return false;
  });
  
  // Calculate metrics when dates or load changes
  useEffect(() => {
    if (occurrenceDate) {
      // Validate estimated resolution time if it exists
      if (estimatedResolutionTime) {
        if (new Date(estimatedResolutionTime) <= new Date(occurrenceDate)) {
          toast.error("Estimated resolution time must be after occurrence date");
          setEstimatedResolutionTime("");
          setEstimatedDuration(null);
          return;
        }
        const duration = calculateDurationHours(occurrenceDate, estimatedResolutionTime);
        setEstimatedDuration(duration);
      } else {
        setEstimatedDuration(null);
      }

      // Validate restoration date if it exists
      if (restorationDate) {
        if (new Date(restorationDate) <= new Date(occurrenceDate)) {
          toast.error("Restoration date must be after occurrence date");
          setRestorationDate("");
          return;
        }

        // Calculate metrics only if dates are valid
        if (loadMW !== null && loadMW > 0) {
          const duration = calculateDurationHours(occurrenceDate, restorationDate);
          setDurationHours(duration);
          
          const unservedEnergy = calculateUnservedEnergy(loadMW, duration);
          setUnservedEnergyMWh(unservedEnergy);
        }
      }
    }
  }, [occurrenceDate, restorationDate, loadMW, estimatedResolutionTime]);
  
  // Add these helper functions before the handleSubmit function
  const getRegionName = (id: string) => regions.find(r => r.id === id)?.name || "Unknown";
  const getDistrictName = (id: string) => districts.find(d => d.id === id)?.name || "Unknown";
  
  const resetForm = () => {
    setRegionId(defaultRegionId);
    setDistrictId(defaultDistrictId);
    setOccurrenceDate("");
    setRestorationDate("");
    setFaultType(undefined);
    setSpecificFaultType(undefined);
    setLoadMW(null);
    setReason("");
    setIndications("");
    setAreaAffected("");
    setCustomersAffected({ rural: 0, urban: 0, metro: 0 });
    setEstimatedResolutionTime(null);
    setVoltageLevel("");
    setRepairStartDate("");
    setRepairEndDate("");
    setFeederType("");
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has permission to report faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
    
    // Collect all missing required fields
    const missingFields: string[] = [];
    
    if (!occurrenceDate) missingFields.push("Occurrence Date");
    if (!faultType) missingFields.push("Fault Type");
    if (!regionId) missingFields.push("Region");
    if (!districtId) missingFields.push("District/Section");
    if (!loadMW || loadMW <= 0) missingFields.push("Load (MW)");
    if (!feederName || feederName.trim() === "") missingFields.push("Feeder Name");
    
    // Validate that at least one affected population field is filled
    if (ruralAffected === null && urbanAffected === null && metroAffected === null) {
      missingFields.push("at least one Affected Customers field (Rural, Urban, or Metro)");
    }

    // Validate that at least one feeder customer field is filled
    if (metroFeederCustomers === null && urbanFeederCustomers === null && ruralFeederCustomers === null) {
      missingFields.push("at least one Feeder Customers field (Rural, Urban, or Metro)");
    }
    
    // Validate specific fault type when required
    if ((faultType === "Unplanned" || faultType === "Emergency") && !specificFaultType) {
      missingFields.push("Specific Fault Type");
    }
    
    // Show specific error message if any required fields are missing
    if (missingFields.length > 0) {
      const fieldsList = missingFields.length === 1 
        ? missingFields[0]
        : missingFields.slice(0, -1).join(", ") + " and " + missingFields[missingFields.length - 1];
      toast.error(`Please fill the following required field(s): ${fieldsList}`);
      return;
    }

    // Validate that affected customers don't exceed feeder customers in each category
    if (ruralAffected !== null && ruralFeederCustomers !== null && ruralAffected > ruralFeederCustomers) {
      toast.error("Rural affected customers cannot exceed rural feeder customers");
      return;
    }
    if (urbanAffected !== null && urbanFeederCustomers !== null && urbanAffected > urbanFeederCustomers) {
      toast.error("Urban affected customers cannot exceed urban feeder customers");
      return;
    }
    if (metroAffected !== null && metroFeederCustomers !== null && metroAffected > metroFeederCustomers) {
      toast.error("Metro affected customers cannot exceed metro feeder customers");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Format dates
      const formattedOccurrenceDate = new Date(occurrenceDate).toISOString();
      const formattedRestorationDate = restorationDate ? new Date(restorationDate).toISOString() : null;
      const formattedEstimatedResolutionTime = estimatedResolutionTime ? new Date(estimatedResolutionTime).toISOString() : null;

      const formDataToSubmit = {
        regionId,
        districtId,
        region: getRegionName(regionId),
        district: getDistrictName(districtId),
        date: new Date().toISOString(),
        description: reason || "",
        duration: durationHours || 0,
        occurrenceDate: formattedOccurrenceDate,
        restorationDate: formattedRestorationDate,
        faultType: faultType as FaultType,
        ...(faultType === "Unplanned" || faultType === "Emergency" ? { specificFaultType } : {}),
        status: formattedRestorationDate ? "resolved" : "pending",
        loadMW: loadMW || 0,
        unservedEnergyMWh: unservedEnergyMWh || 0,
        reason: reason || "",
        controlPanelIndications: indications || "",
        areaAffected: areaAffected || "",
        customersAffected: {
          rural: ruralAffected ?? 0,
          urban: urbanAffected ?? 0,
          metro: metroAffected ?? 0
        },
        // CIF = 1.00 for each category with affected customers (single outage event)
        // Total CIF = 1 per interruption (if at least one customer type was affected)
        customerInterruptions: {
          rural: (customersAffected.rural > 0) ? 1 : 0,
          urban: (customersAffected.urban > 0) ? 1 : 0,
          metro: (customersAffected.metro > 0) ? 1 : 0
        },
        estimatedResolutionTime: formattedEstimatedResolutionTime,
        voltageLevel: voltageLevel || "",
        repairStartDate: repairStartDate ? new Date(repairStartDate).toISOString() : null,
        repairEndDate: repairEndDate ? new Date(repairEndDate).toISOString() : null,
        feederType: feederType || "",
        feederName: feederName || "",
        bspPss: bspPss || "",
        feederCustomers: {
          metro: metroFeederCustomers ?? 0,
          urban: urbanFeederCustomers ?? 0,
          rural: ruralFeederCustomers ?? 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.id || "",
        updatedBy: user?.id || "",
        isOffline: !navigator.onLine
      };

      const offlineStorage = OfflineStorageService.getInstance();
      const isOnline = offlineStorage.isOnline();
      console.log('[ControlSystemOutageForm] Internet available:', isOnline);

      if (isOnline) {
        console.log('[ControlSystemOutageForm] Submitting outage online...');
        const outageId = await addControlSystemOutage(formDataToSubmit as Omit<ControlSystemOutage, "id">);
        
        // Log the action
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user?.id || "",
          user?.name || "",
          user?.role || "",
          "Create",
          "Outage",
          outageId,
          `Created new control system outage for feeder ${formDataToSubmit.feederName}`,
          formDataToSubmit.region,
          formDataToSubmit.district
        );

        toast.success("Outage report submitted successfully");
        resetForm();
        navigate("/dashboard");
      } else {
        console.log('[ControlSystemOutageForm] Saving outage offline...');
        try {
          // When offline, explicitly add client-side timestamp and 'offline_user'
          const offlineDataWithAudit = {
            ...formDataToSubmit,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user?.id || 'offline_user',
            updatedBy: user?.id || 'offline_user',
            isOffline: true
          };
          await offlineStorage.saveOfflineRecord('/api/controlSystemOutages', 'POST', offlineDataWithAudit as Omit<ControlSystemOutage, "id">);
          toast.success("Outage report saved offline. It will be synced when internet connection is restored.");
          resetForm();
          navigate("/dashboard");
        } catch (error) {
          console.error('[ControlSystemOutageForm] Error saving outage offline:', error);
          toast.error("Failed to save outage offline. Please try again when you have internet connection.");
        } finally {
          setIsSubmitting(false);
        }
      }
    } catch (error) {
      console.error("[ControlSystemOutageForm] Error submitting outage:", error);
      toast.error("Failed to submit outage report. Please try again.");
      setIsSubmitting(false);
    }
  };
  
  // Reset specific fault type when fault type changes
  useEffect(() => {
    if (faultType !== "Unplanned" && faultType !== "Emergency") {
      setSpecificFaultType(undefined);
    }
  }, [faultType]);

  // Fetch feeders when region changes
  useEffect(() => {
    const fetchFeeders = async () => {
      if (!regionId) {
        setFeeders([]);
        return;
      }

      try {
        // Use FeederService for offline support - get all feeders first, then filter
        const allFeedersData = await feederService.getAllFeeders();
        
        // Apply role-based filtering and region filtering
        let filteredFeeders = allFeedersData;
        
        // First filter by selected region
        const selectedRegion = regions.find(r => r.id === regionId);
        if (selectedRegion && selectedRegion.name) {
          filteredFeeders = filteredFeeders.filter(feeder => feeder.region === selectedRegion.name);
        }
        
        // Then apply role-based filtering
        // Note: ashsubt and accsubt have multi-region access, so they rely on selected region filter above
        if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
          filteredFeeders = filteredFeeders.filter(feeder => feeder.region === user.region);
        } else if (user?.role !== 'system_admin' && user?.role !== 'global_engineer' && user?.role !== 'ashsubt' && user?.role !== 'accsubt') {
          // For other roles (district_engineer, district_manager, technician, etc.), filter by their assigned region
          // ashsubt and accsubt are excluded here as they have multi-region access via selected region filter
          if (user?.region) {
            filteredFeeders = filteredFeeders.filter(feeder => feeder.region === user.region);
          }
        }
        // System admins and global engineers can see all feeders
        
        setFeeders(filteredFeeders);
      } catch (error) {
        console.error("Error fetching feeders:", error);
        toast.error("Failed to load feeders");
      }
    };

    fetchFeeders();
  }, [regionId, feederService, user]);

  // Update BSP/PSS when feeder changes
  useEffect(() => {
    if (selectedFeeder) {
      const feeder = feeders.find(f => f.id === selectedFeeder);
      if (feeder) {
        setBspPss(feeder.bspPss);
        setFeederName(feeder.name);
      }
    } else {
      setBspPss("");
      setFeederName("");
    }
  }, [selectedFeeder, feeders]);
  
  // Filter feeders based on search
  const filteredFeeders = feeders.filter(feeder => {
    if (!feederSearch) return true;
    const search = feederSearch.toLowerCase();
    return feeder.name.toLowerCase().includes(search) ||
           (feeder.alias && feeder.alias.toLowerCase().includes(search)) ||
           feeder.bspPss.toLowerCase().includes(search);
  });
  
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-2xl font-serif">HT Outage Log Report</CardTitle>
        <CardDescription>
          Report an HT outage with detailed information
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="region" className="text-base font-medium">Region</Label>
              <Select 
                value={regionId} 
                onValueChange={(value) => {
                  setRegionId(value);
                  setSelectedDistrict("");
                  setSelectedFeeder("");
                  setBspPss("");
                }}
                disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician"}
                required
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRegions.map(region => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
                              <Label htmlFor="district" className="text-base font-medium">District/Section</Label>
              <Select 
                value={districtId} 
                onValueChange={(value) => {
                  setDistrictId(value);
                  setSelectedFeeder("");
                }}
                disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician" || !regionId}
                required
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {regionId && filteredDistricts
                    .filter(d => d.regionId === regionId)
                    .map(district => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="occurrenceDate" className="text-base font-medium">Outage Occurrence Date & Time</Label>
              <Input
                id="occurrenceDate"
                type="datetime-local"
                value={occurrenceDate}
                onChange={createSanitizedInputHandler(setOccurrenceDate)}
                required
                className="h-12 text-base bg-background/50 border-muted"
              />
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="estimatedResolutionTime" className="text-base font-medium">Estimated Resolution Time</Label>
              <Input
                id="estimatedResolutionTime"
                type="datetime-local"
                value={estimatedResolutionTime}
                onChange={createSanitizedInputHandler(setEstimatedResolutionTime)}
                className="h-12 text-base bg-background/50 border-muted"
                placeholder="Select estimated resolution time"
              />
              <p className="text-sm text-muted-foreground">
                When do you expect to resolve this outage?
                {estimatedDuration !== null && (
                  <span className="block mt-1">
                    Estimated duration: {estimatedDuration.toFixed(2)} hours
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feederName" className="text-base font-medium">Feeder Name</Label>
              <Select
                value={selectedFeeder}
                onValueChange={(value) => {
                  setSelectedFeeder(value);
                  const feeder = feeders.find(f => f.id === value);
                  if (feeder) {
                    setBspPss(feeder.bspPss);
                  }
                }}
                disabled={!regionId}
                open={isFeederDropdownOpen}
                onOpenChange={(open) => {
                  if (window.innerWidth > 768) { // Only auto-close on desktop
                    setIsFeederDropdownOpen(open);
                  } else {
                    setIsFeederDropdownOpen(true); // Keep open on mobile
                  }
                }}
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select feeder" />
                </SelectTrigger>
                <SelectContent 
                  className="max-h-[300px]"
                  position="popper"
                  sideOffset={4}
                  onCloseAutoFocus={(e) => {
                    e.preventDefault();
                  }}
                  onPointerDownOutside={(e) => {
                    if (window.innerWidth > 768) { // Only close on desktop
                      e.preventDefault();
                      setIsFeederDropdownOpen(false);
                    }
                  }}
                >
                  <div className="sticky top-0 bg-background z-10 border-b p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search feeders..."
                        value={feederSearch}
                        onChange={handleSearchChange}
                        onFocus={handleSearchFocus}
                        onKeyDown={handleSearchKeyDown}
                        className="h-9 pl-9 pr-9 bg-background/50 border-muted focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                        autoFocus={window.innerWidth > 768}
                      />
                      {feederSearch && (
                        <button
                          onClick={() => {
                            setFeederSearch("");
                            if (searchInputRef.current) {
                              searchInputRef.current.focus();
                            }
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {window.innerWidth <= 768 && (
                      <button
                        onClick={() => setIsFeederDropdownOpen(false)}
                        className="absolute right-2 top-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-[250px]">
                    {filteredFeeders.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No feeders found
                      </div>
                    ) : (
                      filteredFeeders.map((feeder) => (
                        <SelectItem 
                          key={feeder.id} 
                          value={feeder.id}
                          onSelect={(e) => {
                            e.preventDefault();
                            setSelectedFeeder(feeder.id);
                            const selectedFeeder = feeders.find(f => f.id === feeder.id);
                            if (selectedFeeder) {
                              setBspPss(selectedFeeder.bspPss);
                              setFeederName(selectedFeeder.name);
                            }
                            if (window.innerWidth > 768) { // Only close on desktop
                              setIsFeederDropdownOpen(false);
                            }
                          }}
                        >
                          {feeder.name}{feeder.alias ? ` (Alias: ${feeder.alias})` : ''}
                        </SelectItem>
                      ))
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="bspPss" className="text-base font-medium">BSP/PSS</Label>
              <Input
                id="bspPss"
                type="text"
                value={bspPss}
                onChange={createSanitizedInputHandler(setBspPss)}
                className="h-12 text-base bg-background/50 border-muted"
                placeholder="BSP/PSS"
                readOnly
              />
            </div>
          </div>
          
          {selectedFeeder && (() => {
            const feeder = feeders.find(f => f.id === selectedFeeder);
            return feeder?.alias ? (
              <div className="space-y-2">
                <Label className="text-base font-medium">Feeder Alias</Label>
                <Input
                  type="text"
                  value={feeder.alias}
                  className="h-12 text-base bg-background/50 border-muted"
                  readOnly
                />
              </div>
            ) : null;
          })()}
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Feeder Customers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="metroFeederCustomers" className="text-sm font-medium">Metro Customers</Label>
                <Input
                  id="metroFeederCustomers"
                  type="number"
                  min="0"
                  value={metroFeederCustomers === null ? "" : metroFeederCustomers}
                  onChange={(e) => setMetroFeederCustomers(e.target.value === "" ? null : parseInt(e.target.value))}
                  className="h-10"
                  placeholder="Enter number of customers"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urbanFeederCustomers" className="text-sm font-medium">Urban Customers</Label>
                <Input
                  id="urbanFeederCustomers"
                  type="number"
                  min="0"
                  value={urbanFeederCustomers === null ? "" : urbanFeederCustomers}
                  onChange={(e) => setUrbanFeederCustomers(e.target.value === "" ? null : parseInt(e.target.value))}
                  className="h-10"
                  placeholder="Enter number of customers"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruralFeederCustomers" className="text-sm font-medium">Rural Customers</Label>
                <Input
                  id="ruralFeederCustomers"
                  type="number"
                  min="0"
                  value={ruralFeederCustomers === null ? "" : ruralFeederCustomers}
                  onChange={(e) => setRuralFeederCustomers(e.target.value === "" ? null : parseInt(e.target.value))}
                  className="h-10"
                  placeholder="Enter number of customers"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="faultType" className="text-base font-medium">Type of Fault</Label>
              <Select value={faultType} onValueChange={(value) => setFaultType(value as FaultType)} required>
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select fault type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Unplanned">Unplanned</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="ECG Load Shedding">ECG Load Shedding</SelectItem>
                  <SelectItem value="GridCo Outages">GridCo Outages</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Show specific fault type dropdown when Unplanned or Emergency is selected */}
            {(faultType === "Unplanned" || faultType === "Emergency") && (
              <div className="space-y-3">
                <Label htmlFor="specificFaultType" className="text-base font-medium">Specific Fault Type</Label>
                <Select 
                  value={specificFaultType} 
                  onValueChange={(value) => setSpecificFaultType(
                    faultType === "Unplanned" 
                      ? value as UnplannedFaultType 
                      : value as EmergencyFaultType
                  )}
                  required
                >
                  <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                    <SelectValue placeholder="Select specific fault type" />
                  </SelectTrigger>
                  <SelectContent>
                    {faultType === "Unplanned" ? (
                      <>
                        <SelectItem value="UNDER INVESTIGATION">Under Investigation</SelectItem>
                        <SelectItem value="JUMPER CUT">Jumper Cut</SelectItem>
                        <SelectItem value="CONDUCTOR CUT">Conductor Cut</SelectItem>
                        <SelectItem value="MERGED CONDUCTOR">Merged Conductor</SelectItem>
                        <SelectItem value="HV/LV LINE CONTACT">HV/LV Line Contact</SelectItem>
                        <SelectItem value="VEGETATION">Vegetation</SelectItem>
                        <SelectItem value="CABLE FAULT">Cable Fault</SelectItem>
                        <SelectItem value="TERMINATION FAILURE">Termination Failure</SelectItem>
                        <SelectItem value="BROKEN POLES">Broken Poles</SelectItem>
                        <SelectItem value="BURNT POLE">Burnt Pole</SelectItem>
                        <SelectItem value="FAULTY ARRESTER/INSULATOR">Faulty Arrester/Insulator</SelectItem>
                        <SelectItem value="EQIPMENT FAILURE">Equipment Failure</SelectItem>
                        <SelectItem value="PUNCTURED CABLE">Punctured Cable</SelectItem>
                        <SelectItem value="ANIMAL INTERRUPTION">Animal Interruption</SelectItem>
                        <SelectItem value="BAD WEATHER">Bad Weather</SelectItem>
                        <SelectItem value="TRANSIENT FAULTS">Transient Faults</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="UNDER INVESTIGATION">Under Investigation</SelectItem>
                        <SelectItem value="MEND CABLE">Mend Cable</SelectItem>
                        <SelectItem value="WORK ON EQUIPMENT">Work on Equipment</SelectItem>
                        <SelectItem value="FIRE">Fire</SelectItem>
                        <SelectItem value="IMPROVE HV">Improve HV</SelectItem>
                        <SelectItem value="JUMPER REPLACEMENT">Jumper Replacement</SelectItem>
                        <SelectItem value="MEND BROKEN">Mend Broken</SelectItem>
                        <SelectItem value="MEND JUMPER">Mend Jumper</SelectItem>
                        <SelectItem value="MEND TERMINATION">Mend Termination</SelectItem>
                        <SelectItem value="BROKEN POLE">Broken Pole</SelectItem>
                        <SelectItem value="BURNT POLE">Burnt Pole</SelectItem>
                        <SelectItem value="ANIMAL CONTACT">Animal Contact</SelectItem>
                        <SelectItem value="VEGETATION SAFETY">Vegetation Safety</SelectItem>
                        <SelectItem value="TRANSFER/RESTORE">Transfer/Restore</SelectItem>
                        <SelectItem value="TROUBLE SHOOTING">Trouble Shooting</SelectItem>
                        <SelectItem value="MEND LOOSE">Mend Loose</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                        <SelectItem value="REPLACE FUSE">Replace Fuse</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Placeholder to maintain grid when Specific Fault Type is hidden */}
            {(faultType !== "Unplanned" && faultType !== "Emergency") && (
              <div className="space-y-3 opacity-0 pointer-events-none">
                <Label className="text-base font-medium">Specific Fault Type</Label>
                <div className="h-12"></div>
              </div>
            )}
          </div>
          
          <Tabs defaultValue="affected" className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-lg mx-auto mb-8 gap-2 bg-transparent p-0">
              <TabsTrigger
                value="affected"
                className="flex items-center justify-center gap-2 w-full min-h-[44px] px-2 py-2 rounded-full font-bold text-xs sm:text-sm shadow transition-all duration-200
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-600
                  data-[state=active]:text-white data-[state=active]:shadow-lg
                  data-[state=inactive]:bg-white data-[state=inactive]:text-primary border border-primary/30
                  focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Affected Customers</span>
              </TabsTrigger>
              <TabsTrigger
                value="details"
                className="flex items-center justify-center gap-2 w-full min-h-[44px] px-2 py-2 rounded-full font-bold text-xs sm:text-sm shadow transition-all duration-200
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-600
                  data-[state=active]:text-white data-[state=active]:shadow-lg
                  data-[state=inactive]:bg-white data-[state=inactive]:text-primary border border-primary/30
                  focus-visible:ring-2 focus-visible:ring-primary"
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Outage Details</span>
              </TabsTrigger>
              <TabsTrigger
                value="calculations"
                className="flex items-center justify-center gap-2 w-full min-h-[44px] px-2 py-2 rounded-full font-bold text-xs sm:text-sm shadow transition-all duration-200
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-600
                  data-[state=active]:text-white data-[state=active]:shadow-lg
                  data-[state=inactive]:bg-white data-[state=inactive]:text-primary border border-primary/30
                  focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Calculations</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="affected" className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
              <div className="bg-muted/50 p-4 rounded-lg border border-muted">
                <h4 className="font-medium mb-2">Enter Number of Customers Affected by this Outage</h4>
                <p className="text-sm text-muted-foreground">
                  Please enter the number of customers affected in each population category. 
                  At least one category must have affected customers to proceed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="ruralAffected" className="font-medium flex items-center text-sm">
                    Rural Customers Affected *
                    <InfoIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                    id="ruralAffected"
                    type="number"
                    min="0"
                    value={ruralAffected === null ? "" : ruralAffected}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : parseInt(e.target.value);
                      if (value !== null && ruralFeederCustomers !== null && value > ruralFeederCustomers) {
                        toast.error("Rural affected customers cannot exceed rural feeder customers");
                        return;
                      }
                      setRuralAffected(value);
                    }}
                    className="bg-background/50 border-muted h-9 sm:h-10"
                    required
                    placeholder="Enter number of affected customers"
                    disabled={ruralFeederCustomers === null}
                  />
                  {ruralFeederCustomers === null && (
                    <p className="text-xs text-muted-foreground">Please fill Rural Feeder Customers first</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="urbanAffected" className="font-medium flex items-center text-sm">
                    Urban Customers Affected *
                    <InfoIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                    id="urbanAffected"
                    type="number"
                    min="0"
                    value={urbanAffected === null ? "" : urbanAffected}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : parseInt(e.target.value);
                      if (value !== null && urbanFeederCustomers !== null && value > urbanFeederCustomers) {
                        toast.error("Urban affected customers cannot exceed urban feeder customers");
                        return;
                      }
                      setUrbanAffected(value);
                    }}
                    className="bg-background/50 border-muted h-9 sm:h-10"
                    required
                    placeholder="Enter number of affected customers"
                    disabled={urbanFeederCustomers === null}
                  />
                  {urbanFeederCustomers === null && (
                    <p className="text-xs text-muted-foreground">Please fill Urban Feeder Customers first</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metroAffected" className="font-medium flex items-center text-sm">
                    Metro Customers Affected *
                    <InfoIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                    id="metroAffected"
                    type="number"
                    min="0"
                    value={metroAffected === null ? "" : metroAffected}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : parseInt(e.target.value);
                      if (value !== null && metroFeederCustomers !== null && value > metroFeederCustomers) {
                        toast.error("Metro affected customers cannot exceed metro feeder customers");
                        return;
                      }
                      setMetroAffected(value);
                    }}
                    className="bg-background/50 border-muted h-9 sm:h-10"
                    required
                    placeholder="Enter number of affected customers"
                    disabled={metroFeederCustomers === null}
                  />
                  {metroFeederCustomers === null && (
                    <p className="text-xs text-muted-foreground">Please fill Metro Feeder Customers first</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                * At least one population type must have affected customers
              </p>
            </TabsContent>
            
            <TabsContent value="details" className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Feeder/Equipment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="voltageLevel" className="text-sm font-medium">Voltage Level</Label>
                    <Select value={voltageLevel} onValueChange={setVoltageLevel}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select voltage level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="11kv">11kV</SelectItem>
                        <SelectItem value="33kv">33kV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="feederType" className="text-sm font-medium">Type of Feeder</Label>
                    <Select value={feederType} onValueChange={setFeederType}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select feeder type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="underground">Underground</SelectItem>
                        <SelectItem value="overhead">Overhead</SelectItem>
                        <SelectItem value="mixed network">Mixed Network</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="repairStartDate" className="text-sm font-medium">Repair Start</Label>
                    <Input
                      id="repairStartDate"
                      type="datetime-local"
                      value={repairStartDate}
                      onChange={(e) => {
                        const newRepairStartDate = e.target.value;
                        const repairStartDateTime = new Date(newRepairStartDate);
                        const occurrenceDateTime = new Date(occurrenceDate);

                        if (repairStartDateTime < occurrenceDateTime) {
                          toast.error("Repair start date cannot be before occurrence date");
                          return;
                        }

                        setRepairStartDate(newRepairStartDate);
                      }}
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be after or equal to occurrence date
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repairEndDate" className="text-sm font-medium">Repair End</Label>
                    <Input
                      id="repairEndDate"
                      type="datetime-local"
                      value={repairEndDate}
                      onChange={(e) => {
                        const newRepairEndDate = e.target.value;
                        const repairEndDateTime = new Date(newRepairEndDate);
                        const repairStartDateTime = repairStartDate ? new Date(repairStartDate) : null;

                        if (repairStartDateTime && repairEndDateTime <= repairStartDateTime) {
                          toast.error("Repair end date must be after repair start date");
                          return;
                        }

                        setRepairEndDate(newRepairEndDate);
                      }}
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be after repair start date
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium">Reason for Outage</Label>
                <Textarea
                  id="reason"
                  placeholder="Describe the reason for the outage"
                  value={reason}
                  onChange={createSanitizedInputHandler(setReason)}
                  rows={2}
                  className="bg-background/50 border-muted h-20 sm:h-24"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="indications" className="text-sm font-medium">Indications on Control Panel</Label>
                <Textarea
                  id="indications"
                  placeholder="Describe the indications observed on the control panel"
                  value={indications}
                  onChange={createSanitizedInputHandler(setIndications)}
                  rows={2}
                  className="bg-background/50 border-muted h-20 sm:h-24"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="areaAffected" className="text-sm font-medium">Area Affected</Label>
                <Input
                  id="areaAffected"
                  type="text"
                  placeholder="E.g., North Sector, Industrial Zone"
                  value={areaAffected}
                  onChange={createSanitizedInputHandler(setAreaAffected)}
                  className="h-9 sm:h-10 text-sm bg-background/50 border-muted"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="load" className="text-base font-medium flex items-center gap-2">
                    Load (MW)
                    <InfoIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Enter the load in Megawatts (MW) at the time of the outage
                    </span>
                  </Label>
                  <Input
                    id="load"
                    type="number"
                    min="0"
                    step="0.1"
                    value={loadMW === null ? "" : loadMW}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : parseFloat(e.target.value);
                      if (value === null || value >= 0) {
                        setLoadMW(value);
                      }
                    }}
                    className="h-12 text-base bg-background/50 border-muted"
                    required
                  />
                  {loadMW !== null && loadMW > 0 && durationHours !== null && unservedEnergyMWh !== null && (
                    <div className="text-sm text-muted-foreground">
                      Unserved Energy: {unservedEnergyMWh} MWh
                      <br />
                      (Load: {loadMW} MW × Duration: {durationHours.toFixed(2)} hours)
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restorationDate" className="text-sm font-medium">Restoration Date & Time</Label>
                  <Input
                    id="restorationDate"
                    type="datetime-local"
                    value={restorationDate}
                    onChange={(e) => {
                      const newRestorationDate = e.target.value;
                      const restorationDateTime = new Date(newRestorationDate);
                      const occurrenceDateTime = new Date(occurrenceDate);
                      const repairStartDateTime = repairStartDate ? new Date(repairStartDate) : null;
                      const repairEndDateTime = repairEndDate ? new Date(repairEndDate) : null;

                      if (restorationDateTime <= occurrenceDateTime) {
                        toast.error("Restoration date must be after occurrence date");
                        return;
                      }

                      if (repairStartDateTime && restorationDateTime <= repairStartDateTime) {
                        toast.error("Restoration date must be after repair start date");
                        return;
                      }

                      if (repairEndDateTime && restorationDateTime <= repairEndDateTime) {
                        toast.error("Restoration date must be after repair end date");
                        return;
                      }

                      setRestorationDate(newRestorationDate);
                    }}
                    className="h-12 text-base bg-background/50 border-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty if the outage is still active. Must be after occurrence date and repair dates.
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="calculations" className="pt-4 sm:pt-6">
              <div className="space-y-4 sm:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="durationHours" className="font-medium text-sm">Repair Duration</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {repairStartDate && repairEndDate 
                        ? `${calculateDurationHours(repairStartDate, repairEndDate).toFixed(2)} hours` 
                        : "Not calculated yet"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="unservedEnergyMWh" className="font-medium text-sm">Unserved Energy (MWh)</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {unservedEnergyMWh !== null 
                        ? `${unservedEnergyMWh.toFixed(2)} MWh` 
                        : "Not calculated yet"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Customer Interruption Duration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Metro</Label>
                      <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                        {repairStartDate && repairEndDate && metroAffected
                          ? `${(calculateDurationHours(repairStartDate, repairEndDate) * metroAffected).toFixed(2)} hours`
                          : "Not calculated yet"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Urban</Label>
                      <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                        {repairStartDate && repairEndDate && urbanAffected
                          ? `${(calculateDurationHours(repairStartDate, repairEndDate) * urbanAffected).toFixed(2)} hours`
                          : "Not calculated yet"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Rural</Label>
                      <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                        {repairStartDate && repairEndDate && ruralAffected
                          ? `${(calculateDurationHours(repairStartDate, repairEndDate) * ruralAffected).toFixed(2)} hours`
                          : "Not calculated yet"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Customer Interruption Frequency (CIF)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Metro CIF</Label>
                      <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                        {metroAffected !== null && metroAffected > 0
                          ? "1.00"
                          : "0.00"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Urban CIF</Label>
                      <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                        {urbanAffected !== null && urbanAffected > 0
                          ? "1.00"
                          : "0.00"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium text-sm">Rural CIF</Label>
                      <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                        {ruralAffected !== null && ruralAffected > 0
                          ? "1.00"
                          : "0.00"}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    CIF = 1.00 for each category with affected customers (single outage event)
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </CardContent>
      <CardFooter className="px-0 pt-4">
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Outage Report"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
