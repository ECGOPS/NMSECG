import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData, DataContextType } from "@/contexts/DataContext";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { 
  Loader2, InfoIcon, Users, Clock, ActivityIcon, FileText, Calculator, 
  PlusCircle, X, ChevronLeft, Save, Calendar, MapPin, AlertTriangle, Layers, 
  CheckCircle, Building, Zap, Phone
} from "lucide-react";
import { FaultType, OP5Fault, AffectedPopulation, ReliabilityIndices, MaterialUsed } from "@/lib/types";
import { 
  calculateOutageDuration, 
  calculateMTTR, 
  calculateCustomerLostHours,
  calculateReliabilityIndicesByType
} from "@/lib/calculations";
import { toast } from "@/components/ui/sonner";
import { Layout } from "@/components/layout/Layout";
import { formatDuration } from "@/utils/calculations";
import { Textarea } from "@/components/ui/textarea";
import { v4 as uuidv4 } from "uuid";
import { LoggingService } from "@/services/LoggingService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";

// Enhanced Helper function to format date for input field safely
const formatDateForInput = (dateString: string | null | undefined): string => {
  // console.log(`[formatDateForInput] Input: '${dateString}' (Type: ${typeof dateString})`); // Log input
  if (dateString === null || dateString === undefined || dateString === "") {
     return "";
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        console.warn(`[formatDateForInput] Invalid date string parsed as NaN: '${dateString}'`);
        return ""; 
    }
    const formatted = date.toISOString().slice(0, 16); 
    // console.log(`[formatDateForInput] Output: '${formatted}'`); // Log output
    return formatted;
  } catch (error) {
    console.error(`[formatDateForInput] Error formatting date string: '${dateString}'`, error);
    return "";
  }
};

// Type for calculated values state
interface CalculatedState {
  outageDuration: number | null;
  mttr: number | null;
  customerLostHours: number | null;
  reliabilityIndices: {
    rural: ReliabilityIndices;
    urban: ReliabilityIndices;
    metro: ReliabilityIndices;
    total: ReliabilityIndices;
  };
}

// Helper function to get badge color for fault type
const getFaultTypeBadgeColor = (type: string | undefined) => {
  if (!type) return "bg-gray-100 text-gray-800";
  
  switch (type) {
    case "Planned":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Unplanned":
      return "bg-red-100 text-red-800 border-red-200";
    case "Emergency":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "ECG Load Shedding":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "GridCo Outage":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function EditOP5FaultPage() {
  const { id } = useParams<{ id: string }>();
  const { getOP5FaultById, updateOP5Fault, regions, districts } = useData();
  const { user } = useAzureADAuth();
  const navigate = useNavigate();
  
  const [fault, setFault] = useState<OP5Fault | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  
  // Use Partial for formData as it might not be complete initially
  const [formData, setFormData] = useState<Partial<OP5Fault>>({
    specificFaultType: undefined,
    areasAffected: "",
    restorationDate: null,
    affectedPopulation: {
      rural: 0,
      urban: 0,
      metro: 0
    },
    materialsUsed: [],
    substationName: "",
    substationNo: "",
    feeder: "",
    voltageLevel: "",
    description: "",
    regionId: "",
    districtId: "",
    fuseCircuit: "",
    fusePhase: "",
    otherFaultType: "",
    createdBy: "",
    updatedBy: "",
    customerPhoneNumber: "",
    alternativePhoneNumber: "",
    transformerRating: null,
    outageType: "",
  });

  // Derived values state
  const [calculatedValues, setCalculatedValues] = useState<CalculatedState>({
    outageDuration: null,
    mttr: null,
    customerLostHours: null,
    reliabilityIndices: {
      rural: { saidi: 0, saifi: 0, caidi: 0 },
      urban: { saidi: 0, saifi: 0, caidi: 0 },
      metro: { saidi: 0, saifi: 0, caidi: 0 },
      total: { saidi: 0, saifi: 0, caidi: 0 }
    }
  });

  // Material state
  const [currentMaterialType, setCurrentMaterialType] = useState<string>("");
  const [currentMaterialDetails, setCurrentMaterialDetails] = useState<Partial<MaterialUsed>>({});

  // Add a ref to track if initial data has been loaded
  const initialLoadDone = useRef(false);

  // Update the initial data loading useEffect to fetch from API
  useEffect(() => {
    if (id && !initialLoadDone.current) {
      console.log('[Initial Load] Starting initial load for ID:', id);
      
      const fetchFault = async () => {
        try {
          const response = await apiRequest(`/api/faults/${id}`);
          console.log('[Initial Load] API response:', response);
          
          if (response) {
            console.log('[Initial Load] Raw fetched fault:', response);
            console.log('[Initial Load] Description:', response.description);
            console.log('[Initial Load] Specific Fault Type:', response.specificFaultType);
            setFault(response);
        
        const formattedOcc = formatDateForInput(response.occurrenceDate);
        const formattedRep = formatDateForInput(response.repairDate);
        const formattedRepEnd = formatDateForInput(response.repairEndDate);
        const formattedRes = formatDateForInput(response.restorationDate);
        const formattedEstRes = formatDateForInput(response.estimatedResolutionTime);
        
        // Parse fuse-specific information from description if it exists
        let fuseCircuit = response.fuseCircuit || "";
        let fusePhase = response.fusePhase || "";
        let description = response.description || "";
        
        // Check if this is a fuse-related fault
        if (response.specificFaultType === "REPLACE FUSE" || response.specificFaultType === "PHASE OFF") {
          console.log('[Initial Load] Processing fuse/phase data for:', response.specificFaultType);
          
          // If we don't have circuit/phase in dedicated fields, try to extract from description
          if (!fuseCircuit || !fusePhase) {
            console.log('[Initial Load] Attempting to extract from description:', description);
          const circuitMatch = description.match(/Circuit: ([^,]+)/);
          const phaseMatch = description.match(/Phase: ([^,]+)/);
          
          if (circuitMatch) {
            fuseCircuit = circuitMatch[1].trim();
              console.log('[Initial Load] Found circuit in description:', fuseCircuit);
              // Remove the circuit info from description
            description = description.replace(/Circuit: [^,]+,/, "").trim();
          }
            
          if (phaseMatch) {
            fusePhase = phaseMatch[1].trim();
              console.log('[Initial Load] Found phase in description:', fusePhase);
              // Remove the phase info from description
            description = description.replace(/Phase: [^,]+,/, "").trim();
            }
          } else {
            console.log('[Initial Load] Using existing circuit/phase data:', {
              circuit: fuseCircuit,
              phase: fusePhase
            });
          }
        }

        const newFormData = {
          ...response,
          occurrenceDate: formattedOcc,
          repairDate: formattedRep,
          repairEndDate: formattedRepEnd,
          restorationDate: formattedRes,
          estimatedResolutionTime: formattedEstRes,
          affectedPopulation: response.affectedPopulation || { rural: 0, urban: 0, metro: 0 },
          materialsUsed: response.materialsUsed || [],
          description: description,
          fuseCircuit: fuseCircuit,
          fusePhase: fusePhase,
          otherFaultType: response.specificFaultType === "OTHERS" ? response.otherFaultType || "" : "",
          customerPhoneNumber: response.customerPhoneNumber || "",
          alternativePhoneNumber: response.alternativePhoneNumber || "",
          transformerRating: response.transformerRating || null,
          outageType: response.faultType || "",
        };
        
        console.log('[Initial Load] Final form data:', {
          outageType: newFormData.outageType,
          specificFaultType: newFormData.specificFaultType,
          fuseCircuit: newFormData.fuseCircuit,
          fusePhase: newFormData.fusePhase,
          description: newFormData.description
        });
        
        setFormData(newFormData);
        initialLoadDone.current = true;
        } else {
          console.error(`[Initial Load] Fault with ID ${id} not found.`);
          setLoadingError(`Fault with ID ${id} not found.`);
          toast.error("Fault not found.");
          navigate("/dashboard");
        }
        setIsLoading(false);
      } catch (error) {
        console.error(`[Initial Load] Error fetching fault with ID ${id}:`, error);
        setLoadingError(`Error fetching fault: ${error.message}`);
        toast.error("Error loading fault data.");
        navigate("/dashboard");
        setIsLoading(false);
      }
    };
    
    fetchFault();
  }
}, [id, navigate]);

  // Timeout mechanism to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('[EditOP5FaultPage] Loading timeout reached');
        setLoadingError("Loading timeout. Please refresh the page or try again.");
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Calculate metrics when form data changes
  useEffect(() => {
    const { 
      occurrenceDate: occStr, 
      repairDate: repStr,
      repairEndDate: repEndStr,
      restorationDate: resStr,
      estimatedResolutionTime: estResStr,
      affectedPopulation,
      districtId
    } = formData;
    
    // Debug logging for MTTR calculation
    console.log("[MTTR Debug] Input dates:", { 
      occurrenceDate: occStr,
      repairDate: repStr,
      repairEndDate: repEndStr,
      restorationDate: resStr,
      estimatedResolutionTime: estResStr
    });

    let duration: number | null = null;
    let mttrValue: number | null = null;
    let lostHours: number | null = null;
    let ruralIndices: ReliabilityIndices = { saidi: 0, saifi: 0, caidi: 0 };
    let urbanIndices: ReliabilityIndices = { saidi: 0, saifi: 0, caidi: 0 };
    let metroIndices: ReliabilityIndices = { saidi: 0, saifi: 0, caidi: 0 };
    let totalIndices: ReliabilityIndices = { saidi: 0, saifi: 0, caidi: 0 };

    // --- Safely create Date objects --- 
    let occDate: Date | null = null;
    let repDate: Date | null = null;
    let repEndDate: Date | null = null;
    let resDate: Date | null = null;
    let estResDate: Date | null = null;

    // Safely parse dates with debug logging
    if (occStr) { 
      try { 
        occDate = new Date(occStr); 
        if(isNaN(occDate.getTime())) { 
          console.warn("[MTTR Debug] Invalid Occurrence Date:", occStr);
          occDate = null; 
        } 
      } catch (error) { 
        console.error("[MTTR Debug] Error parsing Occurrence Date:", error);
        occDate = null; 
      } 
    }

    // Validate repair date if it exists
    if (repStr) {
      try {
        repDate = new Date(repStr);
        if (isNaN(repDate.getTime())) {
          console.warn("[MTTR Debug] Invalid Repair Date:", repStr);
          repDate = null;
        } else if (occDate && repDate <= occDate) {
          toast.error("Repair date must be after occurrence date");
          setFormData(prev => ({ ...prev, repairDate: "" }));
          return;
        }
      } catch (error) {
        console.error("[MTTR Debug] Error parsing Repair Date:", error);
        repDate = null;
      }
    }

    // Validate repair end date if it exists
    if (repEndStr) {
      try {
        repEndDate = new Date(repEndStr);
        if (isNaN(repEndDate.getTime())) {
          console.warn("[MTTR Debug] Invalid Repair End Date:", repEndStr);
          repEndDate = null;
        } else {
          if (!repDate) {
            toast.error("Repair start date must be set before repair end date");
            setFormData(prev => ({ ...prev, repairEndDate: "" }));
            return;
          }
          if (repEndDate <= repDate) {
            toast.error("Repair end date must be after repair start date");
            setFormData(prev => ({ ...prev, repairEndDate: "" }));
            return;
          }
        }
      } catch (error) {
        console.error("[MTTR Debug] Error parsing Repair End Date:", error);
        repEndDate = null;
      }
    }

    // Validate restoration date if it exists
    if (resStr) {
      try {
        resDate = new Date(resStr);
        if (isNaN(resDate.getTime())) {
          console.warn("[MTTR Debug] Invalid Restoration Date:", resStr);
          resDate = null;
        } else {
          if (!occDate) {
            toast.error("Occurrence date must be set before restoration date");
            setFormData(prev => ({ ...prev, restorationDate: "" }));
            return;
          }
          if (resDate <= occDate) {
            toast.error("Restoration date must be after occurrence date");
            setFormData(prev => ({ ...prev, restorationDate: "" }));
            return;
          }
          if (repDate && resDate <= repDate) {
            toast.error("Restoration date must be after repair start date");
            setFormData(prev => ({ ...prev, restorationDate: "" }));
            return;
          }
          if (repEndDate && resDate <= repEndDate) {
            toast.error("Restoration date must be after repair end date");
            setFormData(prev => ({ ...prev, restorationDate: "" }));
            return;
          }
        }
      } catch (error) {
        console.error("[MTTR Debug] Error parsing Restoration Date:", error);
        resDate = null;
      }
    }

    // Validate estimated resolution time if it exists
    if (estResStr) {
      try {
        estResDate = new Date(estResStr);
        if (isNaN(estResDate.getTime())) {
          console.warn("[MTTR Debug] Invalid Estimated Resolution Time:", estResStr);
          estResDate = null;
        } else if (occDate && estResDate <= occDate) {
          toast.error("Estimated resolution time must be after occurrence date");
          setFormData(prev => ({ ...prev, estimatedResolutionTime: "" }));
          return;
        }
      } catch (error) {
        console.error("[MTTR Debug] Error parsing Estimated Resolution Time:", error);
        estResDate = null;
      }
    }

    // Calculate duration only if both dates are valid and in correct order
    if (occDate && resDate && resDate > occDate) {
       duration = calculateOutageDuration(occStr!, resStr!);
       console.log("[MTTR Debug] Calculated duration:", duration);
    }

    // Calculate MTTR only if both dates are valid and in correct order
    if (repDate && repEndDate && repEndDate > repDate) {
        mttrValue = calculateMTTR(repStr!, repEndStr!);
        console.log("[MTTR Debug] Calculated MTTR:", mttrValue);
    } else {
        console.log("[MTTR Debug] MTTR not calculated because:", {
            hasRepairDate: !!repDate,
            hasRepairEndDate: !!repEndDate,
            isRepairEndAfterRepair: repDate && repEndDate ? repEndDate > repDate : false
        });
    }
    
    // Calculate lost hours if duration is valid and population exists
    if (duration !== null && affectedPopulation) {
      lostHours = calculateCustomerLostHours(duration, affectedPopulation);
    }
      
    // Calculate indices if district, population, and duration are valid
    const selectedDistrict = districts.find(d => d.id === districtId);
    if (selectedDistrict?.population && duration !== null && affectedPopulation) {
      const totalPopulation = (selectedDistrict.population.rural || 0) + 
                              (selectedDistrict.population.urban || 0) + 
                              (selectedDistrict.population.metro || 0);
      const pop = selectedDistrict.population;
      const affPop = affectedPopulation;

      // Calculate indices, checking population > 0
      if (pop.rural && pop.rural > 0) {
          ruralIndices = calculateReliabilityIndicesByType(duration, { rural: affPop.rural || 0, urban: 0, metro: 0 }, pop.rural);
      }
      if (pop.urban && pop.urban > 0) {
          urbanIndices = calculateReliabilityIndicesByType(duration, { rural: 0, urban: affPop.urban || 0, metro: 0 }, pop.urban);
      }
      if (pop.metro && pop.metro > 0) {
          metroIndices = calculateReliabilityIndicesByType(duration, { rural: 0, urban: 0, metro: affPop.metro || 0 }, pop.metro);
      }
        if (totalPopulation > 0) {
         totalIndices = calculateReliabilityIndicesByType(duration, affPop, totalPopulation);
      }
    }

    // Update the calculated values state
    setCalculatedValues({
      outageDuration: duration,
      mttr: mttrValue,
      customerLostHours: lostHours,
      reliabilityIndices: { rural: ruralIndices, urban: urbanIndices, metro: metroIndices, total: totalIndices }
    });

  }, [formData, districts]); // Dependency array

  // Generic handler for most inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  // Generic handler for Select components
  const handleSelectChange = (id: keyof OP5Fault, value: string) => {
    console.log('[handleSelectChange] Called with:', { id, value });
    console.log('[handleSelectChange] Current formData:', {
      outageType: formData.outageType,
      specificFaultType: formData.specificFaultType,
      fuseCircuit: formData.fuseCircuit,
      fusePhase: formData.fusePhase
    });
    
    if (id === 'outageType') {
      console.log('[handleSelectChange] Updating outage type to:', value);
      setFormData(prev => {
        const newData = {
          ...prev,
          outageType: value
        };
        console.log('[handleSelectChange] New formData:', newData);
        return newData;
      });
    } else if (id === 'specificFaultType') {
      console.log('[handleSelectChange] Updating specific fault type to:', value);
      setFormData(prev => {
        // Preserve circuit and phase data for fuse-related types
        const shouldPreserveData = value === "REPLACE FUSE" || value === "PHASE OFF";
        const newData = {
          ...prev,
          specificFaultType: value,
          // Only reset circuit and phase if not a fuse-related fault
          ...(shouldPreserveData ? {} : {
            fuseCircuit: "",
            fusePhase: ""
          })
        };
        console.log('[handleSelectChange] New formData:', newData);
        return newData;
      });
    } else if (id === 'fuseCircuit' || id === 'fusePhase') {
      console.log('[handleSelectChange] Updating', id, 'to:', value);
      setFormData(prev => {
        const newData = {
          ...prev,
          [id]: value
        };
        console.log('[handleSelectChange] New formData:', newData);
        return newData;
      });
    } else {
        setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  // Update the formData watcher useEffect
  useEffect(() => {
    console.log('[formData useEffect] formData changed:', {
      outageType: formData.outageType,
      faultType: formData.faultType,
      specificFaultType: formData.specificFaultType,
      fuseCircuit: formData.fuseCircuit,
      fusePhase: formData.fusePhase
    });

    // Ensure circuit and phase data is maintained for PHASE OFF type
    if (formData.specificFaultType === "PHASE OFF" || formData.specificFaultType === "REPLACE FUSE") {
      const currentCircuit = formData.fuseCircuit || "";
      const currentPhase = formData.fusePhase || "";
      
      if (currentCircuit || currentPhase) {
        console.log('[formData useEffect] Maintaining circuit/phase data:', {
          circuit: currentCircuit,
          phase: currentPhase
        });
      }
    }
  }, [formData]);

  // Specific handler for affected population inputs
  const handleAffectedPopulationChange = (type: keyof AffectedPopulation, value: string) => {
    const numValue = value === "" ? 0 : parseInt(value, 10); // Ensure radix 10
    if (!isNaN(numValue) && numValue >= 0) {
      setFormData(prev => ({
        ...prev,
        affectedPopulation: {
          ...(prev.affectedPopulation || { rural: 0, urban: 0, metro: 0 }),
          [type]: numValue
        }
      }));
    } else if (value === "") { // Allow clearing the input, treat as 0
       setFormData(prev => ({
         ...prev,
         affectedPopulation: {
           ...(prev.affectedPopulation || { rural: 0, urban: 0, metro: 0 }),
           [type]: 0
         }
       }));
    }
    // Ignore invalid inputs (e.g., negative numbers, non-numeric strings)
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fault || !updateOP5Fault) return;

    // Validate required fields
    if (!formData.regionId || !formData.districtId) {
      toast.error("Region and district are required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse dates
      const occurrenceDate = formData.occurrenceDate ? new Date(formData.occurrenceDate).toISOString() : null;
      const repairDate = formData.repairDate ? new Date(formData.repairDate).toISOString() : null;
      const restorationDate = formData.restorationDate ? new Date(formData.restorationDate).toISOString() : null;

      // Prepare the data for submission
      const formDataToSubmit: Partial<OP5Fault> = {
        ...formData,
        occurrenceDate,
        repairDate,
        restorationDate,
        status: restorationDate ? 'resolved' as const : 'pending' as const,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || "",
        description: formData.description || "",
        faultType: formData.outageType as FaultType,
        // Ensure circuit and phase data is included for both REPLACE FUSE and PHASE OFF types
        ...((formData.specificFaultType === "REPLACE FUSE" || formData.specificFaultType === "PHASE OFF") && {
          fuseCircuit: formData.fuseCircuit || "",
          fusePhase: formData.fusePhase || ""
        })
      };

      // Remove undefined values
      Object.keys(formDataToSubmit).forEach(key => {
        if (formDataToSubmit[key] === undefined) {
          delete formDataToSubmit[key];
        }
      });

      console.log('[Submit] Submitting form data:', {
        specificFaultType: formDataToSubmit.specificFaultType,
        fuseCircuit: formDataToSubmit.fuseCircuit,
        fusePhase: formDataToSubmit.fusePhase,
        description: formDataToSubmit.description
      });

      // Log the edit action before updating
      await LoggingService.getInstance().logEditAction(
        user?.uid || 'unknown',
        user?.name || 'unknown',
        user?.role || 'unknown',
        'op5_fault',
        fault.id,
        fault, // old values
        formDataToSubmit, // new values
        `Updated OP5 fault: ${fault.specificFaultType || fault.id}`,
        fault.region,
        fault.district
      );

      await updateOP5Fault(fault.id, formDataToSubmit);
      toast.success("Fault updated successfully");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error updating fault:", error);
      toast.error("Failed to update fault");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Filter districts based on selected region and user role
  const filteredDistricts = formData.regionId && Array.isArray(districts)
    ? districts.filter(d => {
        // Basic check: Must belong to the selected region
        if (d.regionId !== formData.regionId) return false;
        
        // Role-based filtering
        if (user?.role === "district_engineer" || user?.role === "technician") {
          // District engineer and technician see only their assigned district
          return d.name === user.district;
        } else if (user?.role === "regional_engineer") {
           // Regional engineer sees all districts within their assigned region
           // Find the region object corresponding to the user's region name
           const userRegionObj = Array.isArray(regions) ? regions.find(r => r.name === user.region) : null;
           // Check if the district's regionId matches the user's region ID
           return userRegionObj ? d.regionId === userRegionObj.id : false; // If user region not found, show no districts
        }
        
        // Other roles (e.g., admin) see all districts in the selected region
        return true; 
      })
    : []; // Return empty array if no region selected or districts not loaded

  // Material handlers
  const handleMaterialTypeChange = (value: string) => {
    setCurrentMaterialType(value);
    setCurrentMaterialDetails({ type: value }); // Reset details when type changes
  };

  const handleMaterialDetailChange = (field: keyof MaterialUsed, value: string | number) => {
    setCurrentMaterialDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleAddMaterial = () => {
    if (!currentMaterialType) {
      toast.error("Please select a material type.");
      return;
    }

    let materialToAdd: MaterialUsed | null = null;
    const id = uuidv4(); // Generate unique ID

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
      setFormData(prev => ({
        ...prev,
        materialsUsed: [...(prev.materialsUsed || []), materialToAdd!]
      }));
      // Reset inputs
      setCurrentMaterialType("");
      setCurrentMaterialDetails({});
    }
  };

  const handleRemoveMaterial = (idToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      materialsUsed: prev.materialsUsed?.filter(material => material.id !== idToRemove) || []
    }));
  };

  // Get region and district names for display
  const regionName = regions.find(r => r.id === formData.regionId)?.name || "Unknown Region";
  const districtName = districts.find(d => d.id === formData.districtId)?.name || "Unknown District";
  const faultTypeBadgeClass = getFaultTypeBadgeColor(formData.faultType);
  
  // Fault not found state (should have been handled by useEffect navigation, but good fallback)
  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-lg font-medium">Loading OP5 Fault Details...</p>
            <p className="text-sm text-muted-foreground">ID: {id}</p>
            {loadingError && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-destructive">{loadingError}</p>
                <Button 
                  onClick={() => {
                    setLoadingError(null);
                    setIsLoading(true);
                    window.location.reload();
                  }} 
                  variant="outline" 
                  size="sm"
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }
  
  if (!fault) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg text-muted-foreground mb-4">Fault not found.</p>
           <Button onClick={() => navigate("/dashboard")} variant="outline">
             <ChevronLeft className="mr-2 h-4 w-4" />
             Return to Dashboard
           </Button>
        </div>
      </Layout>
    );
  }
  
  // Main component render
  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8 max-w-[90rem] px-4 sm:px-6 md:px-8">
        {/* Page header with breadcrumb */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-1 px-2 text-muted-foreground" 
                onClick={() => navigate("/dashboard")}
              >
                Dashboard
              </Button>
              <span>/</span>
              <span className="text-foreground">Edit OP5 Fault Report</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
              Edit OP5 Fault Report
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="h-9 sm:h-10 gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
        
        {/* Summary card with key information */}
        <Card className="overflow-hidden border-0 bg-muted/50 text-foreground shadow-sm">
          <CardHeader className="bg-muted/30 pb-3">
            <CardTitle className="text-lg sm:text-xl font-medium flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Fault Summary
              </span>
              <span className="text-sm font-normal text-muted-foreground">ID: {id?.substring(0, 8)}...</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-base">Areas Affected</div>
                  <div className="text-muted-foreground mt-1">{regionName}, {districtName}</div>
                  <div className="text-sm mt-2">{formData.areasAffected || "No specific areas affected"}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-base">Occurred</div>
                  <div className="text-muted-foreground mt-1">
                    {formData.occurrenceDate ? new Date(formData.occurrenceDate).toLocaleString() : "Not specified"}
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 sm:col-span-2 lg:col-span-1">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-base">Affected Customers</div>
                  <div className="text-muted-foreground mt-1">
                    {formData.affectedPopulation ? 
                      Object.values(formData.affectedPopulation).reduce((a, b) => a + b, 0) : 
                      0} total
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main form card */}
        <Card className="shadow-sm">
          <CardContent className="pt-6 sm:pt-8">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6 sm:space-y-8 md:space-y-10">
                {/* --- Section 1: Identification --- */}
                <div className="space-y-4 rounded-md">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Building className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Location Information</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="region" className="text-sm font-medium">Region</Label>
                      <Select
                        value={formData.regionId || ''} 
                        onValueChange={(value) => handleSelectChange('regionId', value)}
                        disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "regional_general_manager"}
                      >
                        <SelectTrigger id="region" className="h-10">
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map(region => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="district" className="text-sm font-medium">District/Section</Label>
                      <Select 
                        value={formData.districtId || ''} 
                        onValueChange={(value) => handleSelectChange('districtId', value)}
                        disabled={user?.role === "district_engineer" || user?.role === "technician" || !formData.regionId}
                      >
                        <SelectTrigger id="district" className="h-10">
                          <SelectValue placeholder="Select district" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredDistricts.map(district => (
                            <SelectItem key={district.id} value={district.id}>
                              {district.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="areasAffected" className="text-sm font-medium">Areas Affected</Label>
                      <Input
                        id="areasAffected"
                        value={formData.areasAffected || ""} 
                        onChange={handleInputChange}
                        placeholder="E.g., Near transformer XYZ, Pole #123, or specific address"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="substationName" className="text-sm font-medium">Substation Name</Label>
                      <Input
                        id="substationName"
                        value={formData.substationName || ""} 
                        onChange={handleInputChange}
                        placeholder="Enter substation name"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="substationNo" className="text-sm font-medium">Substation Number</Label>
                      <Input
                        id="substationNo"
                        value={formData.substationNo || ""} 
                        onChange={handleInputChange}
                        placeholder="Enter substation number"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="voltageLevel" className="text-sm font-medium">Voltage Level</Label>
                      <Select
                        value={formData.voltageLevel || ""} 
                        onValueChange={(value) => handleSelectChange('voltageLevel', value)}
                      >
                        <SelectTrigger id="voltageLevel" className="h-10">
                          <SelectValue placeholder="Select voltage level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.433">0.433 kV</SelectItem>
                          <SelectItem value="11">11 kV</SelectItem>
                          <SelectItem value="33">33 kV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="outageType" className="text-sm font-medium">Outage Type</Label>
                      <Select
                        value={formData.outageType || ""}
                        onValueChange={(value) => {
                          console.log('[OutageType Select] Value changed to:', value);
                          console.log('[OutageType Select] Current formData outage type:', formData.outageType);
                          handleSelectChange('outageType', value);
                        }}
                      >
                        <SelectTrigger id="outageType" className="h-10">
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
                  </div>
                </div>
                  
                {/* --- Section 2: Fault Details --- */}
                <div className="space-y-4 rounded-md">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Fault Details</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4">
                    {/* Show specific fault type dropdown when Unplanned or Emergency is selected */}
                    {(formData.outageType === "Unplanned" || formData.outageType === "Emergency") && (
                      <div className="space-y-2">
                        <Label htmlFor="specificFaultType" className="text-sm font-medium">Specific Fault Type</Label>
                        <Select
                          value={formData.specificFaultType || ""}
                          onValueChange={(value) => handleSelectChange('specificFaultType', value)}
                        >
                          <SelectTrigger id="specificFaultType" className="h-10">
                            <SelectValue placeholder="Select specific fault type" />
                          </SelectTrigger>
                          <SelectContent>
                            {formData.outageType === "Unplanned" ? (
                              <>
                                <SelectItem value="REPLACE FUSE">Replace Fuse</SelectItem>
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
                            ) : (
                              <>
                                <SelectItem value="REPLACE FUSE">Replace Fuse</SelectItem>
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
                      </div>
                    )}

                    {/* Show additional fields for Replace Fuse or Phase Off */}
                    {(formData.specificFaultType === "REPLACE FUSE" || formData.specificFaultType === "PHASE OFF") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fuseCircuit" className="text-sm font-medium">Circuit</Label>
                          <Input
                            id="fuseCircuit"
                            value={formData.fuseCircuit || ""}
                            onChange={handleInputChange}
                            placeholder="Enter circuit name/number"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fusePhase" className="text-sm font-medium">Phase</Label>
                          <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="redPhase"
                                checked={formData.fusePhase?.includes("RED")}
                                onChange={(e) => {
                                  const phases = (formData.fusePhase || "").split(",").filter(p => p !== "RED");
                                  if (e.target.checked) {
                                    phases.push("RED");
                                  }
                                  handleSelectChange('fusePhase', phases.join(","));
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                              <label htmlFor="redPhase" className="text-sm font-medium text-red-600">Red Phase</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="yellowPhase"
                                checked={formData.fusePhase?.includes("YELLOW")}
                                onChange={(e) => {
                                  const phases = (formData.fusePhase || "").split(",").filter(p => p !== "YELLOW");
                                  if (e.target.checked) {
                                    phases.push("YELLOW");
                                  }
                                  handleSelectChange('fusePhase', phases.join(","));
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                              />
                              <label htmlFor="yellowPhase" className="text-sm font-medium text-yellow-600">Yellow Phase</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="bluePhase"
                                checked={formData.fusePhase?.includes("BLUE")}
                                onChange={(e) => {
                                  const phases = (formData.fusePhase || "").split(",").filter(p => p !== "BLUE");
                                  if (e.target.checked) {
                                    phases.push("BLUE");
                                  }
                                  handleSelectChange('fusePhase', phases.join(","));
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
                    {formData.specificFaultType === "OTHERS" && (
                      <div className="space-y-2">
                        <Label htmlFor="otherFaultType" className="text-sm font-medium">Specify Fault Type</Label>
                        <Input
                          id="otherFaultType"
                          value={formData.otherFaultType || ""}
                          onChange={handleInputChange}
                          placeholder="Enter the specific fault type"
                          className="h-10"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <Label htmlFor="transformerRating" className="text-sm font-medium">Transformer Rating (kVA)</Label>
                    <Input
                      id="transformerRating"
                      type="number"
                      value={formData.transformerRating || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., 100, 200, 500"
                      min="0"
                      step="1"
                      className="mt-1 h-10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the transformer rating in kVA (kilovolt-amperes)
                    </p>
                  </div>

                  <div className="pt-2">
                    <Label htmlFor="description" className="text-sm font-medium">Fault Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={handleInputChange}
                      placeholder="Provide a detailed description of the fault incident, including cause if known"
                      className="mt-1 h-24 resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <Label htmlFor="remarks" className="text-sm font-medium">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks || ''}
                      onChange={handleInputChange}
                      placeholder="Enter any additional remarks or notes about the fault"
                      className="mt-1 h-24 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerPhoneNumber" className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Primary Contact Number
                      </Label>
                      <Input
                        id="customerPhoneNumber"
                        type="tel"
                        value={formData.customerPhoneNumber || ""}
                        onChange={(e) => {
                          // Only allow digits and + symbol
                          const value = e.target.value.replace(/[^\d+]/g, '');
                          setFormData(prev => ({ ...prev, customerPhoneNumber: value }));
                        }}
                        placeholder="e.g., +233201234567"
                        pattern="[0-9+]*"
                        maxLength={15}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the customer's primary contact number (digits only, with optional + prefix)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="alternativePhoneNumber" className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Secondary Contact Number
                      </Label>
                      <Input
                        id="alternativePhoneNumber"
                        type="tel"
                        value={formData.alternativePhoneNumber || ""}
                        onChange={(e) => {
                          // Only allow digits and + symbol
                          const value = e.target.value.replace(/[^\d+]/g, '');
                          setFormData(prev => ({ ...prev, alternativePhoneNumber: value }));
                        }}
                        placeholder="e.g., +233201234567"
                        pattern="[0-9+]*"
                        maxLength={15}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter an alternative contact number (digits only, with optional + prefix)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Materials Used Section */}
                <div className="space-y-4 rounded-md">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Layers className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Materials Used</h2>
                  </div>

                  <div className="space-y-6 pt-4">
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-3 py-1">
                          Add Material
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="materialType" className="text-sm font-medium">Material Type</Label>
                          <Select
                            value={currentMaterialType}
                            onValueChange={handleMaterialTypeChange}
                          >
                            <SelectTrigger id="materialType" className="h-10">
                              <SelectValue placeholder="Select material type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Fuse">Fuse</SelectItem>
                              <SelectItem value="Conductor">Conductor</SelectItem>
                              <SelectItem value="Others">Others</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {currentMaterialType === "Fuse" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="fuseRating" className="text-sm font-medium">Fuse Rating</Label>
                              <Input
                                id="fuseRating"
                                value={currentMaterialDetails.rating || ""}
                                onChange={(e) => handleMaterialDetailChange('rating', e.target.value)}
                                placeholder="Enter fuse rating"
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="fuseQuantity" className="text-sm font-medium">Quantity</Label>
                              <Input
                                id="fuseQuantity"
                                type="number"
                                min="1"
                                value={currentMaterialDetails.quantity || ""}
                                onChange={(e) => handleMaterialDetailChange('quantity', e.target.value)}
                                placeholder="Enter quantity"
                                className="h-10"
                              />
                            </div>
                          </>
                        )}

                        {currentMaterialType === "Conductor" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="conductorType" className="text-sm font-medium">Conductor Type</Label>
                              <Input
                                id="conductorType"
                                value={currentMaterialDetails.conductorType || ""}
                                onChange={(e) => handleMaterialDetailChange('conductorType', e.target.value)}
                                placeholder="Enter conductor type"
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="conductorLength" className="text-sm font-medium">Length (meters)</Label>
                              <Input
                                id="conductorLength"
                                type="number"
                                min="1"
                                value={currentMaterialDetails.length || ""}
                                onChange={(e) => handleMaterialDetailChange('length', e.target.value)}
                                placeholder="Enter length"
                                className="h-10"
                              />
                            </div>
                          </>
                        )}

                        {currentMaterialType === "Others" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="materialDescription" className="text-sm font-medium">Description</Label>
                              <Input
                                id="materialDescription"
                                value={currentMaterialDetails.description || ""}
                                onChange={(e) => handleMaterialDetailChange('description', e.target.value)}
                                placeholder="Enter material description"
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="materialQuantity" className="text-sm font-medium">Quantity</Label>
                              <Input
                                id="materialQuantity"
                                type="number"
                                min="1"
                                value={currentMaterialDetails.quantity || ""}
                                onChange={(e) => handleMaterialDetailChange('quantity', e.target.value)}
                                placeholder="Enter quantity"
                                className="h-10"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <Button
                        type="button"
                        onClick={handleAddMaterial}
                        className="w-full sm:w-auto"
                        disabled={!currentMaterialType}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Material
                      </Button>
                    </div>

                    {formData.materialsUsed && formData.materialsUsed.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-3 py-1">
                            Added Materials
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {formData.materialsUsed.length} material{formData.materialsUsed.length !== 1 ? 's' : ''} added
                          </p>
                        </div>

                        <div className="grid gap-4">
                          {formData.materialsUsed.map((material) => (
                            <div key={material.id} className="border rounded-lg p-4 flex justify-between items-start">
                              <div className="space-y-1">
                                <h4 className="font-medium">{material.type}</h4>
                                {material.type === "Fuse" && (
                                  <p className="text-sm text-muted-foreground">
                                    Rating: {material.rating || ''}, Quantity: {material.quantity || ''}
                                  </p>
                                )}
                                {material.type === "Conductor" && (
                                  <p className="text-sm text-muted-foreground">
                                    Type: {material.conductorType || ''}, Length: {material.length || ''}m
                                  </p>
                                )}
                                {material.type === "Others" && (
                                  <p className="text-sm text-muted-foreground">
                                    {material.description || ''}, Quantity: {material.quantity || ''}
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMaterial(material.id)}
                                className="text-destructive hover:text-destructive/90"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* --- Section 4: Timing --- */}
                <div className="space-y-4 rounded-md">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Clock className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Timing Information</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="occurrenceDate" className="text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-red-500"></span>
                          Occurrence Date & Time
                        </span>
                      </Label>
                      <Input
                        id="occurrenceDate"
                        type="datetime-local"
                        value={formData.occurrenceDate || ""} 
                        onChange={handleInputChange}
                        className="w-full h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">When the fault first occurred</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="repairDate" className="text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                          Repair Start Date & Time
                        </span>
                      </Label>
                      <Input
                        id="repairDate"
                        type="datetime-local"
                        value={formData.repairDate || ""} 
                        onChange={handleInputChange}
                        className="w-full h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">When repair work began</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="repairEndDate" className="text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          Repair End Date & Time
                        </span>
                      </Label>
                      <Input
                        id="repairEndDate"
                        type="datetime-local"
                        value={formData.repairEndDate || ""} 
                        onChange={handleInputChange}
                        className="w-full h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">When repair work was completed</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estimatedResolutionTime" className="text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                          Estimated Resolution Time
                        </span>
                      </Label>
                      <Input
                        id="estimatedResolutionTime"
                        type="datetime-local"
                        value={formData.estimatedResolutionTime || ""} 
                        onChange={handleInputChange}
                        className="w-full h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Expected time of fault resolution</p>
                    </div>

                    <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                      <Label htmlFor="restorationDate" className="text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-green-500"></span>
                          Restoration Date & Time
                        </span>
                      </Label>
                      <Input
                        id="restorationDate"
                        type="datetime-local"
                        value={formData.restorationDate || ""} 
                        onChange={handleInputChange}
                        className="w-full h-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">When service was fully restored</p>
                    </div>
                  </div>
                </div>

                {/* --- Section 5: Impact & Calculations (Tabs) --- */} 
                <div className="space-y-4 rounded-md">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Users className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Impact & Analysis</h2>
                  </div>
                
                  <Tabs defaultValue="affected" className="w-full pt-4">
                    <TabsList className="grid w-full grid-cols-2 h-11"> 
                      <TabsTrigger value="affected" className="flex items-center justify-center gap-1.5 text-sm py-2 rounded-l-md">
                        <Users className="h-4 w-4" />
                        <span>Affected Population</span>
                      </TabsTrigger>
                      <TabsTrigger value="calculations" className="flex items-center justify-center gap-1.5 text-sm py-2 rounded-r-md">
                        <Calculator className="h-4 w-4" />
                        <span>Calculations & Metrics</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* Affected Population Tab */}
                    <TabsContent value="affected" className="pt-6 border rounded-md p-4 sm:p-6 shadow-sm mt-2">
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-3 py-1">
                            Customer Impact
                          </Badge>
                          <p className="text-sm text-muted-foreground">Enter the number of customers affected in each category</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="ruralAffected" className="text-sm font-medium">Rural Population</Label>
                            <div className="relative">
                              <Input
                                id="ruralAffected"
                                type="number"
                                min="0"
                                value={formData.affectedPopulation?.rural ?? ''} 
                                onChange={(e) => handleAffectedPopulationChange('rural', e.target.value)}
                                placeholder="Number affected"
                                className="h-10 pl-9"
                              />
                              <Users className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="urbanAffected" className="text-sm font-medium">Urban Population</Label>
                            <div className="relative">
                              <Input
                                id="urbanAffected"
                                type="number"
                                min="0"
                                value={formData.affectedPopulation?.urban ?? ''}
                                onChange={(e) => handleAffectedPopulationChange('urban', e.target.value)}
                                placeholder="Number affected"
                                className="h-10 pl-9"
                              />
                              <Users className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
                            </div>
                          </div>
                          
                          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                            <Label htmlFor="metroAffected" className="text-sm font-medium">Metro Population</Label>
                            <div className="relative">
                              <Input
                                id="metroAffected"
                                type="number"
                                min="0"
                                value={formData.affectedPopulation?.metro ?? ''}
                                onChange={(e) => handleAffectedPopulationChange('metro', e.target.value)}
                                placeholder="Number affected"
                                className="h-10 pl-9"
                              />
                              <Users className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md mt-4">
                          <span className="text-sm font-medium">Total Affected:</span>
                          <span className="text-lg font-semibold">
                            {(formData.affectedPopulation ? 
                              (formData.affectedPopulation.rural || 0) + 
                              (formData.affectedPopulation.urban || 0) + 
                              (formData.affectedPopulation.metro || 0) : 0).toLocaleString()} customers
                          </span>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Calculations Tab */}
                    <TabsContent value="calculations" className="pt-6 border rounded-md p-4 sm:p-6 shadow-sm mt-2">
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-3 py-1">
                            Calculated Metrics
                          </Badge>
                          <p className="text-sm text-muted-foreground">Automatically calculated based on your inputs</p>
                        </div>
                        
                        {/* Row 1: Duration & MTTR */} 
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="outageDuration" className="text-sm font-medium flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-primary"/> 
                              <span>Outage Duration</span>
                            </Label>
                            <div className="bg-muted/30 rounded-md p-3 text-sm border min-h-[44px] flex items-center">
                              {calculatedValues.outageDuration !== null 
                                ? <span className="font-medium">{formatDuration(calculatedValues.outageDuration)}</span>
                                : <span className="text-muted-foreground italic text-xs">Requires valid Occurrence & Restoration Dates</span>}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="mttr" className="text-sm font-medium flex items-center gap-1.5">
                              <ActivityIcon className="h-4 w-4 text-primary"/> 
                              <span>Mean Time To Repair (MTTR)</span>
                            </Label>
                            <div className="bg-muted/30 rounded-md p-3 text-sm border min-h-[44px] flex items-center">
                              {calculatedValues.mttr !== null 
                                ? <span className="font-medium">{formatDuration(calculatedValues.mttr)}</span>
                                : <span className="text-muted-foreground italic text-xs">Requires valid Occurrence & Repair Dates</span>}
                            </div>
                          </div>
                        </div>
                        
                        {/* Row 2: Customer Lost Hours */} 
                        <div className="space-y-2">
                          <Label htmlFor="customerLostHours" className="text-sm font-medium flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-primary"/> 
                            <span>Customer Lost Hours</span>
                          </Label>
                          <div className="bg-muted/30 rounded-md p-3 text-sm border min-h-[44px] flex items-center">
                            {calculatedValues.customerLostHours !== null 
                              ? <span className="font-medium">{calculatedValues.customerLostHours.toFixed(2)} Cshr</span>
                              : <span className="text-muted-foreground italic text-xs">Requires valid Duration & Affected Pop.</span>}
                          </div>
                        </div>
                        
                        {/* Row 3: Reliability Indices */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              <ActivityIcon className="h-4 w-4 text-primary"/> 
                              <span>Reliability Indices</span>
                            </Label>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          {/* Combined Indices Table */} 
                          <div className="border rounded-md overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr className="text-left">
                                  <th className="p-2.5 font-medium">Population</th>
                                  <th className="p-2.5 font-medium">SAIDI</th>
                                  <th className="p-2.5 font-medium">SAIFI</th>
                                  <th className="p-2.5 font-medium">CAIDI</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Rural */}
                                <tr className="border-b hover:bg-muted/20">
                                  <td className="p-2.5 font-medium">Rural</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.rural.saidi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.rural.saifi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.rural.caidi ?? 0).toFixed(3)}</td>
                                </tr>
                                {/* Urban */}
                                <tr className="border-b hover:bg-muted/20">
                                  <td className="p-2.5 font-medium">Urban</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.urban.saidi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.urban.saifi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.urban.caidi ?? 0).toFixed(3)}</td>
                                </tr>
                                {/* Metro */}
                                <tr className="border-b hover:bg-muted/20">
                                  <td className="p-2.5 font-medium">Metro</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.metro.saidi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.metro.saifi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.metro.caidi ?? 0).toFixed(3)}</td>
                                </tr>
                                {/* Total */}
                                <tr className="bg-primary/5 font-semibold">
                                  <td className="p-2.5">Total (District)</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.total.saidi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.total.saifi ?? 0).toFixed(3)}</td>
                                  <td className="p-2.5">{(calculatedValues.reliabilityIndices.total.caidi ?? 0).toFixed(3)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          
                          <div className="text-xs text-muted-foreground mt-2">
                            <span className="font-medium">Legend:</span> SAIDI = System Average Interruption Duration Index, 
                            SAIFI = System Average Interruption Frequency Index, 
                            CAIDI = Customer Average Interruption Duration Index
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Submit Button */}
                <div className="pt-6 flex flex-col sm:flex-row gap-4 items-center justify-end border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(-1)} 
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full sm:w-auto h-11 gap-2 order-1 sm:order-2 bg-primary text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Updating Report...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 