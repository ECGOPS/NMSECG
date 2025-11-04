import { useState, useEffect } from "react";
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
import { Loader2, InfoIcon, Users, Clock, ActivityIcon, FileText, Calculator, X, PlusCircle, Phone } from "lucide-react";
import { 
    FaultType, 
    UnplannedFaultType, 
    EmergencyFaultType, 
    OP5Fault, 
    AffectedPopulation, 
    ReliabilityIndices,
    MaterialUsed
} from "@/lib/types";
import { 
  calculateOutageDuration, 
  calculateMTTR, 
  calculateCustomerLostHours,
  calculateReliabilityIndicesByType
} from "@/lib/calculations";
import { toast } from "@/components/ui/sonner";
import { formatDuration } from "@/utils/calculations";
import { v4 as uuidv4 } from 'uuid';
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { PermissionService } from "@/services/PermissionService";
import { OfflineStorageService } from "@/services/OfflineStorageService";

interface OP5FormProps {
  defaultRegionId?: string;
  defaultDistrictId?: string;
  onSubmit?: (formData: Partial<OP5Fault>) => void;
}

export function OP5Form({ defaultRegionId = "", defaultDistrictId = "", onSubmit }: OP5FormProps) {
  const { regions, districts, addOP5Fault } = useData();
  const { user } = useAzureADAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const offlineStorage = OfflineStorageService.getInstance();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regionId, setRegionId] = useState<string>(defaultRegionId);
  const [districtId, setDistrictId] = useState<string>(defaultDistrictId);
  const [outageType, setOutageType] = useState<string>("");
  const [outageDescription, setOutageDescription] = useState<string>("");
  const [areasAffected, setAreasAffected] = useState<string>("");
  const [substationNo, setSubstationNo] = useState<string>("");
  const [occurrenceDate, setOccurrenceDate] = useState<string>("");
  const [repairDate, setRepairDate] = useState<string>("");
  const [repairEndDate, setRepairEndDate] = useState<string>("");
  const [restorationDate, setRestorationDate] = useState<string>("");
  const [ruralAffected, setRuralAffected] = useState<number | null>(null);
  const [urbanAffected, setUrbanAffected] = useState<number | null>(null);
  const [metroAffected, setMetroAffected] = useState<number | null>(null);
  const [specificFaultType, setSpecificFaultType] = useState<UnplannedFaultType | EmergencyFaultType | undefined>(undefined);
  const [fuseCircuit, setFuseCircuit] = useState<string>("");
  const [fusePhase, setFusePhase] = useState<string>("");
  const [otherFaultType, setOtherFaultType] = useState<string>("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState<string>("");
  const [alternativePhoneNumber, setAlternativePhoneNumber] = useState<string>("");
  const [transformerRating, setTransformerRating] = useState<number | null>(null);
  
  // Derived values
  const [outageDuration, setOutageDuration] = useState<number | null>(null);
  const [mttr, setMttr] = useState<number | null>(null);
  const [customerLostHours, setCustomerLostHours] = useState<number | null>(null);
  
  // Replace the existing reliability indices state with:
  const [reliabilityIndices, setReliabilityIndices] = useState<{
    rural: ReliabilityIndices;
    urban: ReliabilityIndices;
    metro: ReliabilityIndices;
  }>({
    rural: { saidi: 0, saifi: 0, caidi: 0 },
    urban: { saidi: 0, saifi: 0, caidi: 0 },
    metro: { saidi: 0, saifi: 0, caidi: 0 }
  });
  
  // Add new state for feeder/circuit and voltage level
  const [feeder, setFeeder] = useState<string>("");
  const [voltageLevel, setVoltageLevel] = useState<string>("");
  
  // Add new state for substation name
  const [substationName, setSubstationName] = useState<string>("");
  
  // Add new state for estimated resolution time
  const [estimatedResolutionTime, setEstimatedResolutionTime] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [remarks, setRemarks] = useState<string>("");
  
  // Check if user has permission to report faults
  useEffect(() => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
  }, [user, navigate]);
  
  // Filter regions and districts based on user role
  const filteredRegions = regions.filter(region => {
    console.log('[OP5Form] Checking region:', region.id, region.name);
    console.log('[OP5Form] User role:', user?.role);
    console.log('[OP5Form] User region:', user?.region);
    
    // Global engineers and system admins can see all regions
    if (user?.role === "global_engineer" || user?.role === "system_admin") {
      console.log('[OP5Form] Admin - showing all regions');
      return true;
    }
    
    // Ashsubt users can see all Ashanti regions
    if (user?.role === "ashsubt") {
      const result = ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(region.id);
      console.log('[OP5Form] Ashsubt - region', region.id, 'included:', result);
      return result;
    }
    
    // Accsubt users can see all Accra regions
    if (user?.role === "accsubt") {
      const result = ['subtransmission-accra', 'accra-east', 'accra-west'].includes(region.id);
      console.log('[OP5Form] Accsubt - region', region.id, 'included:', result);
      return result;
    }
    
    // Regional engineers and regional general managers can only see their assigned region
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
    
    // Regional engineers, project engineers, regional general managers, ashsubt, and accsubt can see all districts in their selected region
    if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager" || user?.role === "ashsubt" || user?.role === "accsubt") {
      // For ashsubt and accsubt, region filtering already restricts which regions they can select
      // For regional engineers, project engineers, and regional general managers, they can only select their assigned region
      if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager") {
        const userRegion = regions.find(r => r.name === user.region);
        return userRegion ? district.regionId === userRegion.id : false;
      }
      // For ashsubt and accsubt, show all districts in the selected region
      return district.regionId === regionId;
    }
    
    // District engineers, district managers and technicians can only see their assigned district
    if (user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") 
      return district.name === user.district;
    
    return false;
  });

  // Add this validation function before the useEffect
  const validateRestorationDate = (restorationDateStr: string): boolean => {
    if (!restorationDateStr) return true; // Empty restoration date is valid (for pending faults)
    
    const restorationDateTime = new Date(restorationDateStr);
    const occurrenceDateTime = new Date(occurrenceDate);
    
    // Basic validation for occurrence date
    if (!occurrenceDate) {
      toast.error("Please set the occurrence date first");
      setRestorationDate("");
      return false;
    }

    // Check against occurrence date
    if (restorationDateTime <= occurrenceDateTime) {
      toast.error("Restoration date must be after occurrence date");
      setRestorationDate("");
      return false;
    }

    // If repair date exists, validate against it
    if (repairDate) {
      const repairDateTime = new Date(repairDate);
      if (restorationDateTime <= repairDateTime) {
        toast.error("Restoration date must be after repair start date");
        setRestorationDate("");
        return false;
      }

      // If repair end date exists, validate against it
      if (repairEndDate) {
        const repairEndDateTime = new Date(repairEndDate);
        if (restorationDateTime <= repairEndDateTime) {
          toast.error("Restoration date must be after repair end date");
          setRestorationDate("");
          return false;
        }
      }
    }

    return true;
  };

  // Update the useEffect to validate restoration date whenever any date changes
  useEffect(() => {
    if (occurrenceDate) {
      // Calculate estimated duration if estimated resolution time exists
      if (estimatedResolutionTime) {
        // Validate estimated resolution time is after occurrence date
        if (new Date(estimatedResolutionTime) <= new Date(occurrenceDate)) {
          toast.error("Estimated resolution time must be after occurrence date");
          setEstimatedResolutionTime("");
          setEstimatedDuration(null);
          return;
        }
        const duration = calculateOutageDuration(occurrenceDate, estimatedResolutionTime);
        setEstimatedDuration(duration);
      } else {
        setEstimatedDuration(null);
      }

      // Validate repair date if it exists
      if (repairDate) {
        if (new Date(repairDate) <= new Date(occurrenceDate)) {
          toast.error("Repair date must be after occurrence date");
          setRepairDate("");
          return;
        }
      }

      // Validate repair end date if it exists
      if (repairEndDate) {
        if (!repairDate) {
          toast.error("Repair start date must be set before repair end date");
          setRepairEndDate("");
          return;
        }
        if (new Date(repairEndDate) <= new Date(repairDate)) {
          toast.error("Repair end date must be after repair start date");
          setRepairEndDate("");
          return;
        }
      }

      // Validate restoration date if it exists
      if (restorationDate) {
        if (!validateRestorationDate(restorationDate)) {
          return;
        }

        // Calculate metrics only if all validations pass
        const duration = calculateOutageDuration(occurrenceDate, restorationDate);
        setOutageDuration(duration);
        
        // Calculate MTTR if both repair dates are available
        if (repairDate && repairEndDate) {
          const mttr = calculateMTTR(repairDate, repairEndDate);
          setMttr(mttr);
        }
        
        // Calculate customer lost hours
        const lostHours = calculateCustomerLostHours(duration, {
          rural: ruralAffected || 0,
          urban: urbanAffected || 0,
          metro: metroAffected || 0
        });
        setCustomerLostHours(lostHours);
        
        const selectedDistrict = districts.find(d => d.id === districtId);
        if (selectedDistrict?.population) {
          const totalPopulation = (selectedDistrict.population.rural || 0) + 
                                (selectedDistrict.population.urban || 0) + 
                                (selectedDistrict.population.metro || 0);
          
          if (totalPopulation > 0) {
            setReliabilityIndices({
              rural: calculateReliabilityIndicesByType(
                duration,
                { rural: ruralAffected || 0, urban: 0, metro: 0 },
                totalPopulation
              ),
              urban: calculateReliabilityIndicesByType(
                duration,
                { rural: 0, urban: urbanAffected || 0, metro: 0 },
                totalPopulation
              ),
              metro: calculateReliabilityIndicesByType(
                duration,
                { rural: 0, urban: 0, metro: metroAffected || 0 },
                totalPopulation
              ),
            });
          }
        }
      }
    }
  }, [occurrenceDate, repairDate, repairEndDate, restorationDate, districtId, districts, ruralAffected, urbanAffected, metroAffected, estimatedResolutionTime]);

  // Add a separate useEffect to validate restoration date when other dates change
  useEffect(() => {
    if (restorationDate) {
      validateRestorationDate(restorationDate);
    }
  }, [occurrenceDate, repairDate, repairEndDate]);
  
  // Reset specific fault type when fault type changes
  useEffect(() => {
    if (outageType !== "Unplanned" && outageType !== "Emergency") {
      setSpecificFaultType(undefined);
    }
  }, [outageType]);
  
  // --- State for Materials Used --- 
  const [materialsUsed, setMaterialsUsed] = useState<MaterialUsed[]>([]);
  const [currentMaterialType, setCurrentMaterialType] = useState<string>("");
  const [currentMaterialDetails, setCurrentMaterialDetails] = useState<Partial<MaterialUsed>>({});
  // --- End State for Materials Used --- 
  
  // Add these helper functions before the handleSubmit function
  const getRegionName = (id: string) => regions.find(r => r.id === id)?.name || "Unknown";
  const getDistrictName = (id: string) => districts.find(d => d.id === id)?.name || "Unknown";

  // Add this function to check if district population is set
  const isDistrictPopulationSet = () => {
    if (!districtId) return false;
    const selectedDistrict = districts.find(d => d.id === districtId);
    if (!selectedDistrict?.population) return false;
    
    // Check if at least one population value is set and not zero
    const { rural, urban, metro } = selectedDistrict.population;
    return (rural !== null && rural > 0) || 
           (urban !== null && urban > 0) || 
           (metro !== null && metro > 0);
  };

  const getDistrictPopulation = () => {
    if (!districtId) return { rural: 0, urban: 0, metro: 0 };
    const selectedDistrict = districts.find(d => d.id === districtId);
    return selectedDistrict?.population || { rural: 0, urban: 0, metro: 0 };
  };

  // Add this after the district selection dropdown
  const renderDistrictPopulationWarning = () => {
    if (!districtId) return null;
    
    const selectedDistrict = districts.find(d => d.id === districtId);
    if (!selectedDistrict) return null;
    
    if (!isDistrictPopulationSet()) {
      return (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          <p className="font-medium">Warning: No district population data</p>
          <p>There is no valid population data set for {selectedDistrict.name}. Please contact your district engineer to set the population data before proceeding with the fault report.</p>
          <p className="mt-1 text-xs">Population data is required to calculate reliability indices and validate affected customer numbers. At least one population category (rural, urban, or metro) must have a value greater than 0.</p>
        </div>
      );
    }
    
    return null;
  };

  // Add this function after getDistrictPopulation
  const validateAffectedPopulation = (type: 'rural' | 'urban' | 'metro', value: number | null) => {
    if (value === null) return true;
    const districtPop = getDistrictPopulation();
    return value <= (districtPop[type] || 0);
  };

  const resetForm = () => {
    setRegionId(defaultRegionId);
    setDistrictId(defaultDistrictId);
    setOutageType("");
    setOutageDescription("");
    setAreasAffected("");
    setSubstationNo("");
    setOccurrenceDate("");
    setRepairDate("");
    setRepairEndDate("");
    setRestorationDate("");
    setRuralAffected(null);
    setUrbanAffected(null);
    setMetroAffected(null);
    setSpecificFaultType(undefined);
    setOutageDuration(null);
    setMttr(null);
    setCustomerLostHours(null);
    setReliabilityIndices({
      rural: { saidi: 0, saifi: 0, caidi: 0 },
      urban: { saidi: 0, saifi: 0, caidi: 0 },
      metro: { saidi: 0, saifi: 0, caidi: 0 }
    });
    setFeeder("");
    setVoltageLevel("");
    setSubstationName("");
    setFuseCircuit("");
    setFusePhase("");
    setOtherFaultType("");
    setEstimatedResolutionTime("");
    setCustomerPhoneNumber("");
    setAlternativePhoneNumber("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has permission to report faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }

    // Validate required fields
    if (!regionId || !districtId) {
      toast.error("Failed to create OP5 fault: Region and district are required");
      return;
    }

    // Validate that affected customers don't exceed district population
    const districtPop = getDistrictPopulation();
    if (ruralAffected && ruralAffected > (districtPop.rural || 0)) {
      toast.error(`Failed to create OP5 fault: Affected rural customers (${ruralAffected}) cannot exceed district rural population (${districtPop.rural})`);
      return;
    }
    if (urbanAffected && urbanAffected > (districtPop.urban || 0)) {
      toast.error(`Failed to create OP5 fault: Affected urban customers (${urbanAffected}) cannot exceed district urban population (${districtPop.urban})`);
      return;
    }
    if (metroAffected && metroAffected > (districtPop.metro || 0)) {
      toast.error(`Failed to create OP5 fault: Affected metro customers (${metroAffected}) cannot exceed district metro population (${districtPop.metro})`);
      return;
    }

    // Validate fuse-specific fields if Replace Fuse is selected
    if (specificFaultType === "REPLACE FUSE") {
      if (!fuseCircuit) {
        toast.error("Failed to create OP5 fault: Circuit is required for Replace Fuse");
        return;
      }
      if (!fusePhase) {
        toast.error("Failed to create OP5 fault: Phase is required for Replace Fuse");
        return;
      }
    }

    // Validate other fault type if Others is selected
    if (specificFaultType === "OTHERS" as UnplannedFaultType | EmergencyFaultType && !otherFaultType) {
      toast.error("Failed to create OP5 fault: Please specify the fault type");
      return;
    }

    // Check if district population is set
    if (!isDistrictPopulationSet()) {
      const selectedDistrict = districts.find(d => d.id === districtId);
      toast.error(`Failed to create OP5 fault: No district population set for ${selectedDistrict?.name}. Please inform your district engineer.`);
      return;
    }

    if (!outageType) {
      toast.error("Failed to create OP5 fault: Fault type is required");
      return;
    }

    if (!areasAffected) {
      toast.error("Failed to create OP5 fault: Areas affected is required");
      return;
    }

    if (!occurrenceDate) {
      toast.error("Failed to create OP5 fault: Occurrence date is required");
      return;
    }

    // Validate specific fault type for Unplanned and Emergency faults
    if ((outageType === "Unplanned" || outageType === "Emergency") && !specificFaultType) {
      toast.error("Failed to create OP5 fault: Specific fault type is required for " + outageType + " faults");
      return;
    }

    // Validate repair end date if fault is resolved
    if (restorationDate && !repairEndDate) {
      toast.error("Failed to create OP5 fault: Repair end date is required when fault is resolved");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Format dates
      const formattedOccurrenceDate = new Date(occurrenceDate).toISOString();
      const formattedRepairDate = repairDate ? new Date(repairDate).toISOString() : null;
      const formattedRepairEndDate = repairEndDate ? new Date(repairEndDate).toISOString() : null;
      const formattedRestorationDate = restorationDate ? new Date(restorationDate).toISOString() : null;
      const formattedEstimatedResolutionTime = estimatedResolutionTime ? new Date(estimatedResolutionTime).toISOString() : null;

      const formDataToSubmit: Omit<OP5Fault, "id"> = {
        faultType: outageType as FaultType,
        specificFaultType: specificFaultType === "OTHERS" ? otherFaultType : (specificFaultType || ""),
        description: outageDescription || "",
        areasAffected: areasAffected || "",
        substationName: substationName || "",
        substationNo: substationNo || "",
        feeder: feeder || "",
        voltageLevel: voltageLevel || "",
        occurrenceDate: formattedOccurrenceDate,
        repairDate: formattedRepairDate,
        repairEndDate: formattedRepairEndDate,
        restorationDate: formattedRestorationDate,
        affectedPopulation: {
          rural: ruralAffected || 0,
          urban: urbanAffected || 0,
          metro: metroAffected || 0
        },
        regionId: regionId,
        districtId: districtId,
        region: regions.find(r => r.id === regionId)?.name || '',
        district: districts.find(d => d.id === districtId)?.name || '',
        status: formattedRestorationDate ? 'resolved' as const : 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid || "",
        updatedBy: user?.uid || "",
        estimatedResolutionTime: formattedEstimatedResolutionTime,
        customerPhoneNumber: customerPhoneNumber || undefined,
        alternativePhoneNumber: alternativePhoneNumber || undefined,
        transformerRating: transformerRating || undefined,
        outageType: outageType,
        remarks: remarks || "",
        materialsUsed: materialsUsed.map(material => ({
          id: material.id,
          type: material.type,
          rating: material.rating,
          quantity: material.quantity,
          conductorType: material.conductorType,
          length: material.length,
          description: material.description
        })),
        // Add circuit and phase data for both REPLACE FUSE and PHASE OFF types
        ...((specificFaultType === "REPLACE FUSE" || (specificFaultType as string) === "PHASE OFF") && {
          fuseCircuit: fuseCircuit || "",
          fusePhase: fusePhase || ""
        })
      };

      // Remove undefined fields recursively before saving
      function removeUndefinedDeep(obj) {
        if (Array.isArray(obj)) {
          return obj.map(removeUndefinedDeep);
        } else if (obj && typeof obj === 'object') {
          return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = removeUndefinedDeep(value);
            }
            return acc;
          }, {});
        }
        return obj;
      }

      const cleanData = removeUndefinedDeep(formDataToSubmit);

      const isOnline = offlineStorage.isOnline();
      console.log('[OP5Form] Internet available:', isOnline);

      if (isOnline) {
        console.log('[OP5Form] Submitting fault online...');
        await addOP5Fault(cleanData);
        toast.success("Fault report submitted successfully");
        resetForm();
        navigate("/dashboard");
      } else {
        console.log('[OP5Form] Saving fault offline...');
        try {
          await offlineStorage.saveOfflineRecord('/api/op5Faults', 'POST', cleanData);
          toast.success("Fault report saved offline. It will be synced when internet connection is restored.");
          resetForm();
          navigate("/dashboard");
        } catch (error) {
          console.error('[OP5Form] Error saving fault offline:', error);
          toast.error("Failed to save fault offline. Please try again when you have internet connection.");
        } finally {
          setIsSubmitting(false);
        }
      }
    } catch (error) {
      console.error("[OP5Form] Error submitting fault:", error);
      toast.error("Failed to submit fault report. Please try again.");
      setIsSubmitting(false);
    }
  };
  
  // --- Handlers for Materials --- 
  const handleMaterialTypeChange = (value: string) => {
    setCurrentMaterialType(value);
    setCurrentMaterialDetails({ type: value }); // Reset details when type changes
  };

  const handleMaterialDetailChange = (field: keyof MaterialUsed, value: string | number) => {
    setCurrentMaterialDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleAddMaterial = () => {
    let materialToAdd: MaterialUsed | null = null;
    const id = uuidv4(); // Generate unique ID

    if (!currentMaterialType) {
      toast.error("Please select a material type.");
      return;
    }

    switch (currentMaterialType) {
      case "Fuse":
        if (!currentMaterialDetails.rating || !currentMaterialDetails.quantity || currentMaterialDetails.quantity <= 0) {
          toast.error("Please enter valid fuse rating and quantity (> 0).");
          return;
        }
        materialToAdd = { 
          id,
          type: "Fuse", 
          rating: currentMaterialDetails.rating, 
          quantity: Number(currentMaterialDetails.quantity) 
        };
        break;
      case "Conductor":
        if (!currentMaterialDetails.conductorType || !currentMaterialDetails.length || currentMaterialDetails.length <= 0) {
          toast.error("Please enter valid conductor type and length (> 0).");
          return;
        }
        materialToAdd = { 
          id,
          type: "Conductor", 
          conductorType: currentMaterialDetails.conductorType, 
          length: Number(currentMaterialDetails.length) 
        };
        break;
      case "Others":
        if (!currentMaterialDetails.description || !currentMaterialDetails.quantity || currentMaterialDetails.quantity <= 0) {
          toast.error("Please enter a description and quantity (> 0) for other materials.");
          return;
        }
        materialToAdd = { 
          id,
          type: "Others", 
          description: currentMaterialDetails.description, 
          quantity: Number(currentMaterialDetails.quantity) 
        };
        break;
      default:
        toast.error("Invalid material type selected.");
        return;
    }

    if (materialToAdd) {
      console.log("[handleAddMaterial] Adding material:", materialToAdd);
      setMaterialsUsed(prev => [...prev, materialToAdd!]);
      // Reset inputs
      setCurrentMaterialType("");
      setCurrentMaterialDetails({});
    }
  };

  const handleRemoveMaterial = (idToRemove: string) => {
    console.log("[handleRemoveMaterial] Removing material with ID:", idToRemove);
    setMaterialsUsed(prev => prev.filter(material => material.id !== idToRemove));
  };
  // --- End Handlers for Materials --- 
  
  // Initialize region and district based on user's assigned values
  useEffect(() => {
    if (!user) return;

    console.log("[OP5Form] Initializing with user:", {
      role: user.role,
      region: user.region,
      district: user.district
    });

    // For district engineers, district managers and technicians
    if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.district) {
      const userDistrict = districts.find(d => d.name === user.district);
      console.log("[OP5Form] Found user district:", userDistrict);
      
      if (userDistrict) {
        setDistrictId(userDistrict.id);
        setRegionId(userDistrict.regionId);
        console.log("[OP5Form] Set district and region:", {
          districtId: userDistrict.id,
          regionId: userDistrict.regionId
        });
        return;
      }
    }
    
    // For regional engineers and regional general managers
    if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      console.log("[OP5Form] Found user region:", userRegion);
      
      if (userRegion) {
        setRegionId(userRegion.id);
        console.log("[OP5Form] Set region:", userRegion.id);
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
  
  // Update MTTR calculation when repair dates change
  useEffect(() => {
    if (repairDate && repairEndDate) {
      const calculatedMTTR = calculateMTTR(repairDate, repairEndDate);
      setMttr(calculatedMTTR);
    } else {
      setMttr(null);
    }
  }, [repairDate, repairEndDate]);
  
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-2xl font-serif">OP5 Fault Report</CardTitle>
        <CardDescription>
          Report an OP5 fault with detailed information
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="region" className="text-base font-medium">Region</Label>
              <Select 
                value={regionId} 
                onValueChange={setRegionId}
                disabled={user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager" || user?.role === "project_engineer" || user?.role === "regional_general_manager"}
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
                              <Label htmlFor="district" className="text-base font-medium">District/Section *</Label>
              <Select 
                value={districtId} 
                onValueChange={setDistrictId}
                disabled={user?.role === "district_engineer" || user?.role === "technician" || !regionId}
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
              {renderDistrictPopulationWarning()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="outageType" className="text-base font-medium">Outage Type</Label>
              <Select value={outageType} onValueChange={(value) => setOutageType(value as string)}>
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select outage type" />
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
            
            <div className="space-y-3">
              <Label htmlFor="areasAffected" className="text-base font-medium">Areas Affected *</Label>
              <Input
                id="areasAffected"
                value={areasAffected}
                onChange={(e) => setAreasAffected(e.target.value)}
                placeholder="Enter areas affected"
                className="h-12 text-base bg-background/50 border-muted"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="substationName" className="text-base font-medium">Substation Name (S/S Name)</Label>
              <Input
                id="substationName"
                value={substationName}
                onChange={(e) => setSubstationName(e.target.value)}
                placeholder="Enter substation name"
                className="h-12 text-base bg-background/50 border-muted"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="substationNo" className="text-base font-medium">Substation Number</Label>
              <Input
                id="substationNo"
                value={substationNo}
                onChange={(e) => setSubstationNo(e.target.value)}
                placeholder="Enter substation number"
                className="h-12 text-base bg-background/50 border-muted"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="feeder" className="text-base font-medium">Feeder / Circuit</Label>
              <Input
                id="feeder"
                value={feeder}
                onChange={(e) => setFeeder(e.target.value)}
                placeholder="Enter feeder or circuit name"
                className="h-12 text-base bg-background/50 border-muted"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="voltageLevel" className="text-base font-medium">Voltage Level (kV)</Label>
              <Select value={voltageLevel} onValueChange={setVoltageLevel}>
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select voltage level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.433">0.433 kV</SelectItem>
                  <SelectItem value="11">11 kV</SelectItem>
                  <SelectItem value="33">33 kV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Show specific fault type dropdown when Unplanned or Emergency is selected */}
          {(outageType === "Unplanned" || outageType === "Emergency") && (
            <div className="space-y-3">
              <Label htmlFor="specificFaultType" className="text-base font-medium">Specific Fault Type</Label>
              <Select 
                value={specificFaultType} 
                onValueChange={(value) => {
                  setSpecificFaultType(
                    outageType === "Unplanned" 
                      ? value as UnplannedFaultType 
                      : value as EmergencyFaultType
                  );
                  // Reset fuse-specific fields when changing fault type
                  if (value !== "REPLACE FUSE") {
                    setFuseCircuit("");
                    setFusePhase("");
                  }
                  // Reset other fault type when not selecting Others
                  if (value !== "OTHERS") {
                    setOtherFaultType("");
                  }
                }}
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select specific fault type" />
                </SelectTrigger>
                <SelectContent>
                  {outageType === "Unplanned" ? (
                    <>
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
                      <SelectItem value="PHASE OFF">Phase Off</SelectItem>
                      <SelectItem value="BURNT PHASE">Burnt Phase</SelectItem>
                      <SelectItem value="OTHERS">Others</SelectItem>
                    </>
                  ) : (
                    <>
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
                      <SelectItem value="BURNT PHASE">Burnt Phase</SelectItem>
                      <SelectItem value="ANIMAL CONTACT">Animal Contact</SelectItem>
                      <SelectItem value="VEGETATION SAFETY">Vegetation Safety</SelectItem>
                      <SelectItem value="TRANSFER/RESTORE">Transfer/Restore</SelectItem>
                      <SelectItem value="TROUBLE SHOOTING">Trouble Shooting</SelectItem>
                      <SelectItem value="MEND LOOSE">Mend Loose</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="PHASE OFF">Phase Off</SelectItem>
                      <SelectItem value="OTHERS">Others</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>

              {/* Show additional fields for Replace Fuse or Phase Off */}
              {((specificFaultType as string) === "REPLACE FUSE" || (specificFaultType as string) === "PHASE OFF") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  <div className="space-y-3">
                    <Label htmlFor="fuseCircuit" className="text-base font-medium">Circuit</Label>
                    <Input
                      id="fuseCircuit"
                      value={fuseCircuit}
                      onChange={(e) => setFuseCircuit(e.target.value)}
                      placeholder="Enter circuit name/number"
                      className="h-12 text-base bg-background/50 border-muted"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="fusePhase" className="text-base font-medium">Phase</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="redPhase"
                          checked={fusePhase.includes("RED")}
                          onChange={(e) => {
                            const phases = fusePhase.split(",").filter(p => p !== "RED");
                            if (e.target.checked) {
                              phases.push("RED");
                            }
                            setFusePhase(phases.join(","));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <label htmlFor="redPhase" className="text-sm font-medium text-red-600">Red Phase</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="yellowPhase"
                          checked={fusePhase.includes("YELLOW")}
                          onChange={(e) => {
                            const phases = fusePhase.split(",").filter(p => p !== "YELLOW");
                            if (e.target.checked) {
                              phases.push("YELLOW");
                            }
                            setFusePhase(phases.join(","));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                        />
                        <label htmlFor="yellowPhase" className="text-sm font-medium text-yellow-600">Yellow Phase</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="bluePhase"
                          checked={fusePhase.includes("BLUE")}
                          onChange={(e) => {
                            const phases = fusePhase.split(",").filter(p => p !== "BLUE");
                            if (e.target.checked) {
                              phases.push("BLUE");
                            }
                            setFusePhase(phases.join(","));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="bluePhase" className="text-sm font-medium text-blue-600">Blue Phase</label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Show input field for Other fault type */}
              {specificFaultType === "OTHERS" && (
                <div className="mt-4">
                  <Label htmlFor="otherFaultType" className="text-base font-medium">Specify Fault Type</Label>
                  <Input
                    id="otherFaultType"
                    value={otherFaultType}
                    onChange={(e) => setOtherFaultType(e.target.value)}
                    placeholder="Enter the specific fault type"
                    className="h-12 text-base bg-background/50 border-muted"
                  />
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-3">
            <Label htmlFor="transformerRating" className="text-base font-medium">Transformer Rating (kVA)</Label>
            <Input
              id="transformerRating"
              type="number"
              value={transformerRating || ""}
              onChange={(e) => setTransformerRating(e.target.value ? Number(e.target.value) : null)}
              placeholder="e.g., 100, 200, 500"
              min="0"
              step="1"
              className="h-12 text-base bg-background/50 border-muted"
            />
            <p className="text-xs text-muted-foreground">
              Enter the transformer rating in kVA (kilovolt-amperes)
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="outageDescription" className="text-base font-medium">Fault Description</Label>
            <Textarea
              id="outageDescription"
              value={outageDescription}
              onChange={(e) => setOutageDescription(e.target.value)}
              className="h-12 text-base bg-background/50 border-muted"
            />
          </div>

          {/* --- Material Use Section --- */}
          <div className="space-y-4 p-4 border rounded-md bg-background/30">
              <h3 className="text-lg font-semibold border-b pb-2">Materials Used</h3>
              
              {/* Material Input Row */}
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                  {/* Material Type Select */}
                  <div className="space-y-1 flex-1">
                      <Label htmlFor="materialType">Material Type</Label>
                      <Select value={currentMaterialType} onValueChange={handleMaterialTypeChange}>
                          <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Fuse">Fuse</SelectItem>
                              <SelectItem value="Conductor">Conductor</SelectItem>
                              <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  
                  {/* Conditional Detail Inputs */} 
                  {currentMaterialType === "Fuse" && (
                      <>
                           <div className="space-y-1 flex-1">
                              <Label htmlFor="fuseRating">Rating</Label>
                              <Input 
                                id="fuseRating" 
                                type="number"
                                min="0"
                                step="1"
                                value={currentMaterialDetails.rating || ""} 
                                onChange={(e) => handleMaterialDetailChange('rating', e.target.value)} 
                                placeholder="e.g., 100" 
                                className="h-10" 
                              />
                           </div>
                           <div className="space-y-1" style={{ flexBasis: '100px'}}> {/* Fixed width for quantity */}
                              <Label htmlFor="fuseQuantity">Quantity</Label>
                              <Input id="fuseQuantity" type="number" value={currentMaterialDetails.quantity || ""} onChange={(e) => handleMaterialDetailChange('quantity', e.target.value)} placeholder="Qty" min="1" className="h-10" />
                           </div>
                      </>
                  )}
                  {currentMaterialType === "Conductor" && (
                       <>
                           <div className="space-y-1 flex-1">
                              <Label htmlFor="conductorType">Conductor Type</Label>
                              <Input id="conductorType" value={currentMaterialDetails.conductorType || ""} onChange={(e) => handleMaterialDetailChange('conductorType', e.target.value)} placeholder="e.g., ACSR 150mm²" className="h-10" />
                           </div>
                           <div className="space-y-1" style={{ flexBasis: '120px'}}>{/* Fixed width */}
                              <Label htmlFor="conductorLength">Length (m)</Label>
                              <Input id="conductorLength" type="number" value={currentMaterialDetails.length || ""} onChange={(e) => handleMaterialDetailChange('length', e.target.value)} placeholder="Length" min="0.1" step="0.1" className="h-10" />
                           </div>
                      </>
                  )}
                   {currentMaterialType === "Others" && (
                       <>
                           <div className="space-y-1 flex-1">
                              <Label htmlFor="otherDescription">Description</Label>
                              <Input id="otherDescription" value={currentMaterialDetails.description || ""} onChange={(e) => handleMaterialDetailChange('description', e.target.value)} placeholder="Material description" className="h-10" />
                           </div>
                           <div className="space-y-1" style={{ flexBasis: '100px'}}> {/* Fixed width */}
                              <Label htmlFor="otherQuantity">Quantity</Label>
                              <Input id="otherQuantity" type="number" value={currentMaterialDetails.quantity || ""} onChange={(e) => handleMaterialDetailChange('quantity', e.target.value)} placeholder="Qty" min="1" className="h-10" />
                           </div>
                      </>
                  )}

                  {/* Add Button (Aligned with inputs) */} 
                   <Button 
                       type="button" 
                       onClick={handleAddMaterial} 
                       disabled={!currentMaterialType}
                       className="h-10 flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white hover:from-primary/90 hover:to-blue-600/90 shadow-lg transition-all duration-200"
                       title="Add Material"
                   >
                      <PlusCircle className="h-5 w-5" />
                      <span>Add Material</span>
                   </Button>
              </div>

              {/* Display Added Materials */} 
              {materialsUsed.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Added Materials:</h4>
                      <ul className="list-none space-y-1">
                          {materialsUsed.map((material) => (
                              <li key={material.id} className="flex items-center justify-between bg-muted/30 p-2 rounded text-sm">
                                  <span>
                                      {material.type === "Fuse" && `Fuse: ${material.rating}, Qty: ${material.quantity}`}
                                      {material.type === "Conductor" && `Conductor: ${material.conductorType}, Length: ${material.length}m`}
                                      {material.type === "Others" && `Other: ${material.description}, Qty: ${material.quantity}`}
                                  </span>
                                  <Button 
                                      type="button" 
                                      onClick={() => handleRemoveMaterial(material.id)} 
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                  >
                                      <X className="h-4 w-4 text-destructive" />
                                  </Button>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
          </div>
          {/* --- End Material Use Section --- */}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="customerPhoneNumber" className="text-base font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Primary Contact Number
              </Label>
              <Input
                id="customerPhoneNumber"
                type="tel"
                value={customerPhoneNumber}
                onChange={(e) => {
                  // Only allow digits and + symbol
                  const value = e.target.value.replace(/[^\d+]/g, '');
                  setCustomerPhoneNumber(value);
                }}
                placeholder="e.g., +233201234567"
                pattern="[0-9+]*"
                maxLength={15}
                className="h-12 text-base bg-background/50 border-muted"
              />
              <p className="text-xs text-muted-foreground">
                Enter the customer's primary contact number (digits only, with optional + prefix)
              </p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="alternativePhoneNumber" className="text-base font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Secondary Contact Number
              </Label>
              <Input
                id="alternativePhoneNumber"
                type="tel"
                value={alternativePhoneNumber}
                onChange={(e) => {
                  // Only allow digits and + symbol
                  const value = e.target.value.replace(/[^\d+]/g, '');
                  setAlternativePhoneNumber(value);
                }}
                placeholder="e.g., +233201234567"
                pattern="[0-9+]*"
                maxLength={15}
                className="h-12 text-base bg-background/50 border-muted"
              />
              <p className="text-xs text-muted-foreground">
                Enter an alternative contact number (digits only, with optional + prefix)
              </p>
            </div>
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
            <TabsContent value="affected" className="space-y-6 pt-6">
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border border-muted">
                  <h4 className="font-medium mb-2">Enter Number of Customers Affected by this Outage</h4>
                  <p className="text-sm text-muted-foreground">
                    Please enter the number of customers affected in each population category. 
                    At least one category must have affected customers to proceed.
                  </p>
                </div>
                
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                    <Label htmlFor="ruralControl" className="font-medium flex items-center">
                      Rural Population Affected *
                      <InfoIcon className="h-4 w-4 ml-1 text-muted-foreground" />
                    </Label>
                    <Input
                      id="ruralControl"
                      type="number"
                      min="0"
                      max={getDistrictPopulation().rural || 0}
                      value={ruralAffected === null ? "" : ruralAffected}
                      onChange={(e) => {
                        const value = e.target.value === "" ? null : parseInt(e.target.value);
                        if (value === null || validateAffectedPopulation('rural', value)) {
                          setRuralAffected(value);
                        } else {
                          toast.error(`Affected rural customers cannot exceed district rural population (${getDistrictPopulation().rural})`);
                        }
                      }}
                      className="bg-background/50 border-muted"
                      placeholder="Enter number of affected customers"
                      disabled={!getDistrictPopulation().rural}
                    />
                    {!getDistrictPopulation().rural && (
                      <p className="text-xs text-muted-foreground">No rural population data available for this district</p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="urbanControl" className="font-medium flex items-center">
                      Urban Population Affected *
                    <InfoIcon className="h-4 w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                      id="urbanControl"
                    type="number"
                    min="0"
                      max={getDistrictPopulation().urban || 0}
                      value={urbanAffected === null ? "" : urbanAffected}
                      onChange={(e) => {
                        const value = e.target.value === "" ? null : parseInt(e.target.value);
                        if (value === null || validateAffectedPopulation('urban', value)) {
                          setUrbanAffected(value);
                        } else {
                          toast.error(`Affected urban customers cannot exceed district urban population (${getDistrictPopulation().urban})`);
                        }
                      }}
                    className="bg-background/50 border-muted"
                      placeholder="Enter number of affected customers"
                    disabled={!getDistrictPopulation().urban}
                  />
                  {!getDistrictPopulation().urban && (
                    <p className="text-xs text-muted-foreground">No urban population data available for this district</p>
                  )}
                </div>
                
                <div className="space-y-3">
                    <Label htmlFor="metroControl" className="font-medium flex items-center">
                      Metro Population Affected *
                    <InfoIcon className="h-4 w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                      id="metroControl"
                    type="number"
                    min="0"
                      max={getDistrictPopulation().metro || 0}
                      value={metroAffected === null ? "" : metroAffected}
                      onChange={(e) => {
                        const value = e.target.value === "" ? null : parseInt(e.target.value);
                        if (value === null || validateAffectedPopulation('metro', value)) {
                          setMetroAffected(value);
                        } else {
                          toast.error(`Affected metro customers cannot exceed district metro population (${getDistrictPopulation().metro})`);
                        }
                      }}
                    className="bg-background/50 border-muted"
                      placeholder="Enter number of affected customers"
                    disabled={!getDistrictPopulation().metro}
                    />
                  {!getDistrictPopulation().metro && (
                    <p className="text-xs text-muted-foreground">No metro population data available for this district</p>
                  )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  * At least one population type must have affected customers
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="details" className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="occurrenceDate" className="text-base font-medium">Fault Occurrence Date & Time *</Label>
                  <Input
                    id="occurrenceDate"
                    type="datetime-local"
                    value={occurrenceDate}
                    onChange={(e) => setOccurrenceDate(e.target.value)}
                    required
                    className="h-12 text-base bg-background/50 border-muted"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="repairDate">Repair Start Date & Time (Optional)</Label>
                  <Input
                    id="repairDate"
                    type="datetime-local"
                    value={repairDate}
                    onChange={(e) => setRepairDate(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="repairEndDate">
                    Repair End Date & Time
                    {restorationDate && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id="repairEndDate"
                    type="datetime-local"
                    value={repairEndDate}
                    onChange={(e) => setRepairEndDate(e.target.value)}
                    className="h-10"
                    required={!!restorationDate}
                  />
                  {mttr !== null && (
                    <p className="text-sm text-muted-foreground">
                      MTTR: {formatDuration(mttr)}
                    </p>
                  )}
                  {restorationDate && !repairEndDate && (
                    <p className="text-sm text-destructive">
                      Repair end date is required when fault is resolved
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="estimatedResolutionTime" className="text-base font-medium">Estimated Resolution Time</Label>
                  <Input
                    id="estimatedResolutionTime"
                    type="datetime-local"
                    value={estimatedResolutionTime}
                    onChange={(e) => setEstimatedResolutionTime(e.target.value)}
                    className="h-10"
                    placeholder="Select estimated resolution time"
                  />
                  <p className="text-sm text-muted-foreground">
                    When do you expect to resolve this fault?
                    {estimatedDuration !== null && (
                      <span className="block mt-1">
                        Estimated duration: {formatDuration(estimatedDuration)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="restorationDate" className="text-base font-medium">Fault Restoration Date & Time</Label>
                <Input
                  id="restorationDate"
                  type="datetime-local"
                  value={restorationDate}
                  onChange={(e) => setRestorationDate(e.target.value)}
                  className="h-12 text-base bg-background/50 border-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if the fault is still active
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="remarks" className="text-base font-medium">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter any additional remarks or notes about the fault"
                  className="min-h-[100px] text-base bg-background/50 border-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Add any additional information, observations, or notes that might be relevant to this fault report
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="calculations" className="pt-4 sm:pt-6">
              <div className="space-y-4 sm:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerLostHours" className="font-medium text-sm">Customer Lost Hours</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {customerLostHours !== null 
                        ? formatDuration(customerLostHours)
                        : "Not calculated yet"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="repairDuration" className="font-medium text-sm">Repair Duration</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {mttr !== null 
                        ? formatDuration(mttr)
                        : "Not calculated yet"}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Label className="font-medium text-sm">Reliability Indices</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Rural Population</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIDI</div>
                          <div>{(reliabilityIndices.rural.saidi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIFI</div>
                          <div>{(reliabilityIndices.rural.saifi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">CAIDI</div>
                          <div>{(reliabilityIndices.rural.caidi ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Urban Population</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIDI</div>
                          <div>{(reliabilityIndices.urban.saidi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIFI</div>
                          <div>{(reliabilityIndices.urban.saifi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">CAIDI</div>
                          <div>{(reliabilityIndices.urban.caidi ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Metro Population</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIDI</div>
                          <div>{(reliabilityIndices.metro.saidi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIFI</div>
                          <div>{(reliabilityIndices.metro.saifi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">CAIDI</div>
                          <div>{(reliabilityIndices.metro.caidi ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
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
            "Submit Fault Report"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
