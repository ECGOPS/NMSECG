import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, MapPin, Camera, Upload, X, Wifi, WifiOff, Save, Database } from "lucide-react";
import { NetworkInspection, ConditionStatus } from "@/lib/types";
import { getRegions, getDistricts, getDistrictsByRegion, apiRequest } from "@/lib/api";
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { useNavigate } from "react-router-dom";

import { FeederService } from "@/services/FeederService";
import { processImageWithMetadata, captureImageWithMetadata } from "@/utils/imageUtils";
import { PhotoService } from "@/services/PhotoService";
import { OfflineBadge } from '@/components/common/OfflineBadge';
import { createSanitizedInputHandler, sanitizeFormData } from '@/utils/inputSanitization';

interface OverheadLineInspectionFormProps {
  inspection?: NetworkInspection | null;
  onSubmit: (inspection: NetworkInspection) => void;
  onCancel: () => void;
}

interface FeederInfo {
  id: string;
  name: string;
  alias?: string;
  bspPss: string;
  region: string;
  district: string;
  regionId: string;
  districtId: string;
  voltageLevel: string;
  feederType: string;
}

export function OverheadLineInspectionForm({ inspection, onSubmit, onCancel }: OverheadLineInspectionFormProps) {
  const { regions, districts } = useData();
  const { user, loading } = useAzureADAuth();
  const { toast } = useToast();
  const { 
    isOnline, 
    isOffline, 
    saveInspectionOffline, 
    savePhotoOffline, 
    startSync,
    pendingInspections,
    pendingPhotos,
    totalOfflineItems,
    getCachedFeederData,
    preloadFeederData
  } = useOffline();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const navigate = useNavigate();
  const { addNetworkInspection, updateNetworkInspection } = useData();
  const [offlineInspections, setOfflineInspections] = useState<NetworkInspection[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [feeders, setFeeders] = useState<FeederInfo[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineInspectionId, setOfflineInspectionId] = useState<string | null>(null);
  const [lastSavedOffline, setLastSavedOffline] = useState<Date | null>(null);
  const [isPreloadingFeederData, setIsPreloadingFeederData] = useState(false);
  // Add state for after-correction camera
  const [isCapturingAfter, setIsCapturingAfter] = useState(false);
  const videoRefAfter = useRef<HTMLVideoElement>(null);
  const [isVideoReadyAfter, setIsVideoReadyAfter] = useState(false);
  let cameraStreamAfter: MediaStream | null = null;
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  
  const feederService = FeederService.getInstance();

  // Helper function for sanitized input changes
  const handleSanitizedInputChange = (field: string, value: string) => {
    const sanitizedValue = sanitizeFormData({ [field]: value })[field];
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
  };

  const handleSanitizedNestedChange = (parentField: string, childField: string, value: string) => {
    const sanitizedValue = sanitizeFormData({ [childField]: value })[childField];
    setFormData(prev => {
      const parentValue = prev[parentField as keyof NetworkInspection] as any;
      return {
        ...prev,
        [parentField]: {
          ...(parentValue && typeof parentValue === 'object' ? parentValue : {}),
          [childField]: sanitizedValue
        }
      };
    });
  };

  // Handle cancel confirmation
  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = () => {
    setShowCancelDialog(false);
    onCancel();
  };

  const handleCancelCancel = () => {
    setShowCancelDialog(false);
  };

  // Helper function to determine if an image is base64 or URL
  const isBase64Image = (image: string): boolean => {
    return image.startsWith('data:image/');
  };

  const defaultInsulatorCondition = {
    insulatorType: "",
    brokenOrCracked: false,
    burntOrFlashOver: false,
    shattered: false,
    defectiveBinding: false,
    notes: ""
  };

  const [formData, setFormData] = useState<NetworkInspection>(() => {
    const defaultFormData: NetworkInspection = {
      id: "",
      region: "",
      district: "",
      feederName: "",
      voltageLevel: "",
      referencePole: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latitude: 0,
      longitude: 0,
      items: [],
      inspector: {
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || ""
      },
      poleId: "",
      poleHeight: "8m",
      poleType: "CP",
      groundCondition: "",
      poleCondition: {
        tilted: false,
        broken: false,
        rotten: false,
        burnt: false,
        substandard: false,
        conflictWithLV: false,
        notes: ""
      },
      stayCondition: {
        requiredButNotAvailable: false,
        cut: false,
        misaligned: false,
        defectiveStay: false,
        notes: ""
      },
      crossArmCondition: {
        misaligned: false,
        bend: false,
        corroded: false,
        substandard: false,
        others: false,
        notes: ""
      },
      insulatorCondition: defaultInsulatorCondition,
      conductorCondition: {
        looseConnectors: false,
        weakJumpers: false,
        burntLugs: false,
        saggedLine: false,
        brokenConductor: false,
        undersized: false,
        notes: ""
      },
      lightningArresterCondition: {
        brokenOrCracked: false,
        flashOver: false,
        noEarthing: false,
        bypassed: false,
        noArrester: false,
        notes: ""
      },
      dropOutFuseCondition: {
        brokenOrCracked: false,
        flashOver: false,
        insufficientClearance: false,
        looseOrNoEarthing: false,
        corroded: false,
        linkedHVFuses: false,
        others: false,
        notes: ""
      },
      transformerCondition: {
        leakingOil: false,
        lowOilLevel: false,
        missingEarthLeads: false,
        linkedHVFuses: false,
        rustedTank: false,
        crackedBushing: false,
        others: false,
        notes: ""
      },
      recloserCondition: {
        lowGasLevel: false,
        lowBatteryLevel: false,
        burntVoltageTransformers: false,
        protectionDisabled: false,
        bypassed: false,
        others: false,
        notes: ""
      },
      vegetationConflicts: {
        climbers: false,
        trees: false,
        others: false,
        notes: ""
      },
      additionalNotes: "",
      images: [],
      afterImages: [],
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    };

    // Set region and district based on user role
    if (user) {
      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
        defaultFormData.region = user.region;
        defaultFormData.district = user.district;
      } else if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
        defaultFormData.region = user.region;
        // Set district to first district in this region if available
        const regionObj = regions.find(r => r.name === user.region);
        if (regionObj) {
          const regionDistricts = districts.filter(d => d.regionId === regionObj.id);
          if (regionDistricts.length > 0) {
            defaultFormData.district = regionDistricts[0].name;
          }
        }
      } else if (user.role === "system_admin" && regions.length > 0) {
        defaultFormData.region = regions[0].name;
        if (districts.length > 0) {
          defaultFormData.district = districts[0].name;
        }
      }
    }

    if (inspection) {
      console.log('[OverheadLineInspectionForm] Editing inspection:', {
        id: inspection.id,
        latitude: inspection.latitude,
        longitude: inspection.longitude,
        location: inspection.location
      });
      
      return {
        ...defaultFormData,
        ...inspection,
        images: inspection.images || [],
        date: inspection.date ? inspection.date.split('T')[0] : new Date().toISOString().split('T')[0],
        time: inspection.time,
        status: inspection.status || "pending",
        // Ensure GPS coordinates are numbers
        latitude: typeof inspection.latitude === 'string' ? parseFloat(inspection.latitude) : inspection.latitude,
        longitude: typeof inspection.longitude === 'string' ? parseFloat(inspection.longitude) : inspection.longitude,
        // Ensure checklist fields are properly initialized
        poleCondition: inspection.poleCondition || defaultFormData.poleCondition,
        stayCondition: inspection.stayCondition || defaultFormData.stayCondition,
        crossArmCondition: inspection.crossArmCondition || defaultFormData.crossArmCondition,
        insulatorCondition: inspection.insulatorCondition || defaultFormData.insulatorCondition,
        conductorCondition: inspection.conductorCondition || defaultFormData.conductorCondition,
        lightningArresterCondition: inspection.lightningArresterCondition || defaultFormData.lightningArresterCondition,
        dropOutFuseCondition: inspection.dropOutFuseCondition || defaultFormData.dropOutFuseCondition,
        transformerCondition: inspection.transformerCondition || defaultFormData.transformerCondition,
        recloserCondition: inspection.recloserCondition || defaultFormData.recloserCondition,
        vegetationConflicts: inspection.vegetationConflicts || defaultFormData.vegetationConflicts
      };
    }

    if (!defaultFormData.afterImages) defaultFormData.afterImages = [];

    return defaultFormData;
  });

  // Filter regions and districts based on user role
  const filteredRegions = useMemo(() => {
    if (!user) return [];
    if (user.role === "global_engineer" || user.role === "system_admin") return regions;
    
    // Ashsubt users can see all Ashanti regions
    if (user.role === "ashsubt") {
      return regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
    }
    
    // Accsubt users can see all Accra regions
    if (user.role === "accsubt") {
      return regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
    }
    
    if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
      return regions.filter(r => r.name === user.region);
    }
    if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region) {
      return regions.filter(r => r.name === user.region);
    }
    return [];
  }, [regions, user]);

  const filteredDistricts = useMemo(() => {
    if (!user || !formData.region) return [];
    const region = regions.find(r => r.name === formData.region);
    if (!region) return [];

    if (user.role === "global_engineer" || user.role === "system_admin") {
      return districts.filter(d => d.regionId === region.id);
    }
    // For ashsubt, accsubt, and regional roles, show all districts in the selected region
    if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager" || user.role === "ashsubt" || user.role === "accsubt") {
      return districts.filter(d => d.regionId === region.id);
    }
    if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.district) {
      return districts.filter(d => d.name === user.district && d.regionId === region.id);
    }
    return [];
  }, [districts, formData.region, user, regions]);

  // Handle region change
  const handleRegionChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      region: value,
      district: "" // Reset district when region changes
    }));
  };

  // Handle district change
  const handleDistrictChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      district: value
    }));
  };

  // Show loading state while auth is being checked
  if (loading) {
    return <div>Loading...</div>;
  }

  // Update form data when user or regions/districts change
  useEffect(() => {
    if (user && !inspection) {
      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
        setFormData(prev => ({
          ...prev,
          region: user.region,
          district: user.district,
          inspector: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        }));
      } else if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
        // Set region and default district for regional_general_manager
        const regionObj = regions.find(r => r.name === user.region);
        let defaultDistrict = "";
        if (regionObj) {
          const regionDistricts = districts.filter(d => d.regionId === regionObj.id);
          if (regionDistricts.length > 0) {
            defaultDistrict = regionDistricts[0].name;
          }
        }
        setFormData(prev => ({
          ...prev,
          region: user.region,
          district: defaultDistrict,
          inspector: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        }));
      }
    }
  }, [user, inspection, regions, districts]);

  // Update form data when inspection prop changes
  useEffect(() => {
    if (inspection) {
      console.log('[OverheadLineInspectionForm] useEffect - updating form data with inspection:', {
        id: inspection.id,
        latitude: inspection.latitude,
        longitude: inspection.longitude,
        location: inspection.location,
        poleCondition: inspection.poleCondition,
        stayCondition: inspection.stayCondition,
        crossArmCondition: inspection.crossArmCondition,
        insulatorCondition: inspection.insulatorCondition,
        conductorCondition: inspection.conductorCondition,
        lightningArresterCondition: inspection.lightningArresterCondition,
        dropOutFuseCondition: inspection.dropOutFuseCondition,
        transformerCondition: inspection.transformerCondition,
        recloserCondition: inspection.recloserCondition,
        vegetationConflicts: inspection.vegetationConflicts
      });
      
      setFormData(currentData => {
        const newData = {
          ...currentData,
          ...inspection,
          date: inspection.date ? inspection.date.split('T')[0] : new Date().toISOString().split('T')[0],
          time: inspection.time,
          status: inspection.status || "pending",
          // Ensure GPS coordinates are numbers
          latitude: typeof inspection.latitude === 'string' ? parseFloat(inspection.latitude) : inspection.latitude,
          longitude: typeof inspection.longitude === 'string' ? parseFloat(inspection.longitude) : inspection.longitude,
          // Ensure checklist fields are properly initialized
          poleCondition: inspection.poleCondition || currentData.poleCondition,
          stayCondition: inspection.stayCondition || currentData.stayCondition,
          crossArmCondition: inspection.crossArmCondition || currentData.crossArmCondition,
          insulatorCondition: inspection.insulatorCondition || currentData.insulatorCondition,
          conductorCondition: inspection.conductorCondition || currentData.conductorCondition,
          lightningArresterCondition: inspection.lightningArresterCondition || currentData.lightningArresterCondition,
          dropOutFuseCondition: inspection.dropOutFuseCondition || currentData.dropOutFuseCondition,
          transformerCondition: inspection.transformerCondition || currentData.transformerCondition,
          recloserCondition: inspection.recloserCondition || currentData.recloserCondition,
          vegetationConflicts: inspection.vegetationConflicts || currentData.vegetationConflicts
        };
        
        console.log('[OverheadLineInspectionForm] useEffect - new form data:', {
          latitude: newData.latitude,
          longitude: newData.longitude,
          location: newData.location,
          poleCondition: newData.poleCondition,
          stayCondition: newData.stayCondition,
          crossArmCondition: newData.crossArmCondition,
          insulatorCondition: newData.insulatorCondition,
          conductorCondition: newData.conductorCondition,
          lightningArresterCondition: newData.lightningArresterCondition,
          dropOutFuseCondition: newData.dropOutFuseCondition,
          transformerCondition: newData.transformerCondition,
          recloserCondition: newData.recloserCondition,
          vegetationConflicts: newData.vegetationConflicts
        });
        
        return newData;
      });
    }
  }, [inspection]);

  // Memoize handlers
  const handleGetLocation = useCallback(() => {
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      setIsGettingLocation(false);
      toast({
        title: "Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setGpsAccuracy(accuracy); // Store accuracy for image metadata
        setIsGettingLocation(false);
        toast({
          title: "Success",
          description: `Location obtained successfully! Accuracy: ±${accuracy.toFixed(1)} meters`,
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Error",
          description: "Could not get your location. Please try again or enter coordinates manually.",
          variant: "destructive",
        });
      }
    );
  }, [toast]);

  const handleStatusChange = (status: "pending" | "in-progress" | "completed" | "rejected") => {
    setFormData(currentData => ({
      ...currentData,
      status
    }));

    // Show notification for status change
    const notificationTitle = 'Inspection Status Updated';
    const notificationBody = `Status changed to ${status}`;
    showNotification(notificationTitle, { body: notificationBody });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate location coordinates
    if (!formData.latitude || !formData.longitude || formData.latitude === 0 || formData.longitude === 0) {
      toast({
        title: "Location Required",
        description: "Please provide GPS coordinates (latitude and longitude) for the inspection location.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate location description
    if (!formData.location || formData.location.trim() === '') {
      toast({
        title: "Location Description Required",
        description: "Please provide a location description for the inspection.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate ground condition
    if (!formData.groundCondition || formData.groundCondition.trim() === '') {
      toast({
        title: "Ground Condition Required",
        description: "Please select a ground condition for the inspection.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate coordinate ranges
    if (formData.latitude < -90 || formData.latitude > 90) {
      toast({
        title: "Invalid Latitude",
        description: "Latitude must be between -90 and 90 degrees.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.longitude < -180 || formData.longitude > 180) {
      toast({
        title: "Invalid Longitude",
        description: "Longitude must be between -180 and 180 degrees.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Upload photos first
      const photoService = PhotoService.getInstance();
      const uploadedPhotos: string[] = [];
      const uploadedAfterPhotos: string[] = [];
      
      // Upload before images
      if (formData.images && formData.images.length > 0) {
        console.log(`📸 Processing ${formData.images.length} before photos...`);
        console.log(`[FormSubmit] Images in formData:`, formData.images.map((img, idx) => ({ index: idx, length: img.length, preview: img.substring(0, 50) + '...' })));
        
        for (let i = 0; i < formData.images.length; i++) {
          const image = formData.images[i];
          console.log(`[FormSubmit] Processing image ${i + 1}:`, { length: image.length, startsWith: image.substring(0, 30) });
          
          // Check if it's already a URL (Azure Blob Storage or other HTTP URL)
          if (!isBase64Image(image)) {
            // Preserve existing URL
            uploadedPhotos.push(image);
            console.log(`✅ Before photo ${i + 1} preserved (existing URL): ${image}`);
          } else {
            // Upload base64 image
            const tempInspectionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-before-${i}`;
            console.log(`[FormSubmit] Generated temp ID:`, tempInspectionId);
            
            const uploadResult = await photoService.uploadPhoto(
              image,
              tempInspectionId,
              'overhead-inspection'
            );
            
            if (uploadResult.success && uploadResult.url) {
              uploadedPhotos.push(uploadResult.url);
              console.log(`✅ Before photo ${i + 1} uploaded: ${uploadResult.url}`);
            } else {
              console.error(`❌ Failed to upload before photo ${i + 1}:`, uploadResult.error);
              toast({
                title: "Warning",
                description: `Failed to upload before photo ${i + 1}. Continuing with other photos.`,
                variant: "destructive",
              });
            }
          }
        }
      }
      
      // Upload after images
      if (formData.afterImages && formData.afterImages.length > 0) {
        console.log(`📸 Processing ${formData.afterImages.length} after photos...`);
        
        for (let i = 0; i < formData.afterImages.length; i++) {
          const image = formData.afterImages[i];
          
          // Check if it's already a URL (Azure Blob Storage or other HTTP URL)
          if (!isBase64Image(image)) {
            // Preserve existing URL
            uploadedAfterPhotos.push(image);
            console.log(`✅ After photo ${i + 1} preserved (existing URL): ${image}`);
          } else {
            // Upload base64 image
            const tempInspectionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-after-${i}`;
            
            const uploadResult = await photoService.uploadPhoto(
              image,
              tempInspectionId,
              'overhead-inspection'
            );
            
            if (uploadResult.success && uploadResult.url) {
              uploadedAfterPhotos.push(uploadResult.url);
              console.log(`✅ After photo ${i + 1} uploaded: ${uploadResult.url}`);
            } else {
              console.error(`❌ Failed to upload after photo ${i + 1}:`, uploadResult.error);
              toast({
                title: "Warning",
                description: `Failed to upload after photo ${i + 1}. Continuing with other photos.`,
                variant: "destructive",
              });
            }
          }
        }
      }

      // Prepare inspection data with explicit handling of feederAlias
      const inspectionData: any = {
        ...formData,
        images: uploadedPhotos, // Use uploaded photo URLs instead of base64
        afterImages: uploadedAfterPhotos, // Use uploaded after photo URLs instead of base64
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Explicitly handle feederAlias - if undefined, set to null to clear it in database
      if (formData.feederAlias === undefined || formData.feederAlias === null || formData.feederAlias === '') {
        inspectionData.feederAlias = null;
      } else {
        inspectionData.feederAlias = formData.feederAlias;
      }
      
      console.log('[OverheadLineInspectionForm] Inspection data with feederAlias:', {
        feederName: inspectionData.feederName,
        feederAlias: inspectionData.feederAlias,
        hasAlias: !!inspectionData.feederAlias
      });

      console.log('[OverheadLineInspectionForm] Form data keys:', Object.keys(formData));
      console.log('[OverheadLineInspectionForm] Has vegetationConflicts:', !!formData.vegetationConflicts);
      console.log('[OverheadLineInspectionForm] Has afterImages:', formData.afterImages !== undefined);
      console.log('[OverheadLineInspectionForm] referencePole:', formData.referencePole);
      console.log('[OverheadLineInspectionForm] poleId:', formData.poleId);
      console.log('[OverheadLineInspectionForm] voltageLevel:', formData.voltageLevel);
      console.log('[OverheadLineInspectionForm] groundCondition:', formData.groundCondition);
      console.log('[OverheadLineInspectionForm] feederName:', formData.feederName);
      console.log('[OverheadLineInspectionForm] Inspection data keys:', Object.keys(inspectionData));
      console.log('[OverheadLineInspectionForm] Final vegetationConflicts:', inspectionData.vegetationConflicts);
      console.log('[OverheadLineInspectionForm] Final voltageLevel:', inspectionData.voltageLevel);
      console.log('[OverheadLineInspectionForm] Final groundCondition:', inspectionData.groundCondition);

      // Call the onSubmit callback with the inspection data
      onSubmit(inspectionData);
    } catch (error) {
      console.error('Error creating overhead line inspection:', error);
      toast({
        title: "Error",
        description: "Failed to create overhead line inspection",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to default values
  const resetForm = () => {
    const defaultFormData: NetworkInspection = {
      id: "",
      region: "",
      district: "",
      feederName: "",
      voltageLevel: "",
      referencePole: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latitude: 0,
      longitude: 0,
      items: [],
      inspector: {
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || ""
      },
      poleId: "",
      poleHeight: "8m",
      poleType: "CP",
      groundCondition: "",
      poleCondition: {
        tilted: false,
        broken: false,
        rotten: false,
        burnt: false,
        substandard: false,
        conflictWithLV: false,
        notes: ""
      },
      stayCondition: {
        requiredButNotAvailable: false,
        cut: false,
        misaligned: false,
        defectiveStay: false,
        notes: ""
      },
      crossArmCondition: {
        misaligned: false,
        bend: false,
        corroded: false,
        substandard: false,
        others: false,
        notes: ""
      },
      insulatorCondition: defaultInsulatorCondition,
      conductorCondition: {
        looseConnectors: false,
        weakJumpers: false,
        burntLugs: false,
        saggedLine: false,
        brokenConductor: false,
        undersized: false,
        notes: ""
      },
      lightningArresterCondition: {
        brokenOrCracked: false,
        flashOver: false,
        noEarthing: false,
        bypassed: false,
        noArrester: false,
        notes: ""
      },
      dropOutFuseCondition: {
        brokenOrCracked: false,
        flashOver: false,
        insufficientClearance: false,
        looseOrNoEarthing: false,
        corroded: false,
        linkedHVFuses: false,
        others: false,
        notes: ""
      },
      transformerCondition: {
        leakingOil: false,
        lowOilLevel: false,
        missingEarthLeads: false,
        linkedHVFuses: false,
        rustedTank: false,
        crackedBushing: false,
        others: false,
        notes: ""
      },
      recloserCondition: {
        lowGasLevel: false,
        lowBatteryLevel: false,
        burntVoltageTransformers: false,
        protectionDisabled: false,
        bypassed: false,
        others: false,
        notes: ""
      },
      vegetationConflicts: {
        climbers: false,
        trees: false,
        others: false,
        notes: ""
      },
      additionalNotes: "",
      images: [],
      afterImages: [],
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    };

    // Set region and district based on user role
    if (user) {
      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
        defaultFormData.region = user.region;
        defaultFormData.district = user.district;
      } else if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
        defaultFormData.region = user.region;
        // Set district to first district in this region if available
        const regionObj = regions.find(r => r.name === user.region);
        if (regionObj) {
          const regionDistricts = districts.filter(d => d.regionId === regionObj.id);
          if (regionDistricts.length > 0) {
            defaultFormData.district = regionDistricts[0].name;
          }
        }
      }
    }

    setFormData(defaultFormData);
    setCapturedImages([]);
    setOfflineInspectionId(null);
    setLastSavedOffline(null);
    
    // Reset camera and UI state
    setIsCapturing(false);
    setIsCapturingAfter(false);
    setIsVideoReady(false);
    setIsVideoReadyAfter(false);
    setLocationError(null);
    setGpsAccuracy(undefined);
    
    // Stop any active camera streams
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (cameraStreamAfter) {
      cameraStreamAfter.getTracks().forEach(track => track.stop());
      cameraStreamAfter = null;
    }
  };

  // Handle offline save
  const handleOfflineSave = async () => {
    setIsSavingOffline(true);
    
    // Validate location coordinates for offline save
    if (!formData.latitude || !formData.longitude || formData.latitude === 0 || formData.longitude === 0) {
      toast({
        title: "Location Required",
        description: "Please provide GPS coordinates (latitude and longitude) for the inspection location.",
        variant: "destructive",
      });
      setIsSavingOffline(false);
      return;
    }

    // Validate location description for offline save
    if (!formData.location || formData.location.trim() === '') {
      toast({
        title: "Location Description Required",
        description: "Please provide a location description for the inspection.",
        variant: "destructive",
      });
      setIsSavingOffline(false);
      return;
    }

    // Validate ground condition for offline save
    if (!formData.groundCondition || formData.groundCondition.trim() === '') {
      toast({
        title: "Ground Condition Required",
        description: "Please select a ground condition for the inspection.",
        variant: "destructive",
      });
      setIsSavingOffline(false);
      return;
    }

    // Validate coordinate ranges
    if (formData.latitude < -90 || formData.latitude > 90) {
      toast({
        title: "Invalid Latitude",
        description: "Latitude must be between -90 and 90 degrees.",
        variant: "destructive",
      });
      setIsSavingOffline(false);
      return;
    }

    if (formData.longitude < -180 || formData.longitude > 180) {
      toast({
        title: "Invalid Longitude",
        description: "Longitude must be between -180 and 180 degrees.",
        variant: "destructive",
      });
      setIsSavingOffline(false);
      return;
    }
    
    try {
      // Prepare inspection data for offline storage
      const inspectionData = {
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Store base64 images for offline storage
        images: formData.images || [],
        afterImages: formData.afterImages || []
      };

      // Save inspection to offline storage
      const offlineId = await saveInspectionOffline(inspectionData);
      setOfflineInspectionId(offlineId);
      setLastSavedOffline(new Date());

      // Save photos to offline storage
      if (formData.images && formData.images.length > 0) {
        for (let i = 0; i < formData.images.length; i++) {
          const base64Image = formData.images[i];
          const filename = `before_${i + 1}_${Date.now()}.jpg`;
          
          await savePhotoOffline(
            offlineId,
            base64Image,
            filename,
            'before',
            'image/jpeg'
          );
        }
      }

      if (formData.afterImages && formData.afterImages.length > 0) {
        for (let i = 0; i < formData.afterImages.length; i++) {
          const base64Image = formData.afterImages[i];
          const filename = `after_${i + 1}_${Date.now()}.jpg`;
          
          await savePhotoOffline(
            offlineId,
            base64Image,
            filename,
            'after',
            'image/jpeg'
          );
        }
      }

      toast({
        title: "Saved Offline",
        description: `Inspection saved offline with ID: ${offlineId}. Will sync when online.`,
        variant: "default",
      });

      console.log('[OfflineSave] Inspection saved offline:', offlineId);
      
      // Clear the form after successful offline save
      resetForm();
      
      // Close the form (activate cancel button functionality)
      onCancel();
      
    } catch (error) {
      console.error('[OfflineSave] Failed to save inspection offline:', error);
      toast({
        title: "Offline Save Failed",
        description: "Failed to save inspection offline. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingOffline(false);
    }
  };

  // Handle manual sync
  const handleManualSync = async () => {
    if (isOnline && totalOfflineItems > 0) {
      await startSync();
      toast({
        title: "Sync Started",
        description: "Syncing offline data to server...",
        variant: "default",
      });
    }
  };

  // Load regions only once on mount
  useEffect(() => {
    async function loadRegions() {
      try {
        const regions = await getRegions();
        if (regions.length > 0 && !formData.region) {
          setFormData(prev => ({ ...prev, region: regions[0].name }));
        }
      } catch (error) {
        toast({
          title: "Error loading regions",
          description: "Failed to load regions. Please try again.",
          variant: "destructive",
        });
      }
    }
    loadRegions();
  }, [toast]);

  // Load districts when region changes
  useEffect(() => {
    async function loadDistricts() {
      if (!formData.region) return;
      try {
        const districts = await getDistrictsByRegion(regions.find(r => r.name === formData.region)?.id || '');
        if (districts.length > 0 && !formData.district) {
          setFormData(prev => ({ ...prev, district: districts[0].name }));
        }
      } catch (error) {
        toast({
          title: "Error loading districts",
          description: "Failed to load districts. Please try again.",
          variant: "destructive",
        });
      }
    }
    loadDistricts();
  }, [formData.region, toast]);

  // Fetch feeders when region changes
  useEffect(() => {
    const fetchFeeders = async () => {
      if (!formData.region) {
        setFeeders([]);
        return;
      }

      try {
        const region = regions.find(r => r.name === formData.region);
        console.log('Selected region:', formData.region);
        console.log('Found region:', region);
        
        if (!region) {
          console.log('No region found for:', formData.region);
          return;
        }

        let allFeedersData: any[] = [];
        
        // Try to get feeders with offline support
        if (isOnline) {
          try {
            // Online: try to fetch fresh data
            allFeedersData = await feederService.getAllFeeders();
            console.log('[Form] Fetched fresh feeder data online:', allFeedersData.length);
          } catch (error) {
            console.warn('[Form] Failed to fetch fresh feeder data, trying cached data:', error);
            // Fallback to cached data
            allFeedersData = await getCachedFeederData(region.id) || [];
          }
        } else {
          // Offline: use cached data
          console.log('[Form] Offline mode - using cached feeder data');
          allFeedersData = await getCachedFeederData(region.id) || [];
        }
        
        // Apply role-based filtering and region filtering
        let filteredFeeders = allFeedersData;
        
        console.log('[OverheadLineInspectionForm] Feeder loading:', {
          allFeedersCount: allFeedersData.length,
          selectedRegion: region?.name,
          userRole: user?.role,
          userRegion: user?.region
        });
        
        // First filter by selected region
        if (region && region.name) {
          filteredFeeders = filteredFeeders.filter(feeder => feeder.region === region.name);
          console.log('[OverheadLineInspectionForm] After region filter:', {
            filteredCount: filteredFeeders.length,
            sampleFeeder: filteredFeeders[0]
          });
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
        
        console.log('Fetched feeders:', allFeedersData);
        console.log('User role:', user?.role);
        console.log('User region:', user?.region);
        console.log('Filtered feeders by role:', filteredFeeders);
        
        // Remove duplicate feeders by name (keep first occurrence)
        const uniqueFeeders = filteredFeeders.filter((feeder, index, self) => 
          index === self.findIndex(f => f.name === feeder.name)
        );
        
        // Sort feeders alphabetically by name
        const sortedFeeders = uniqueFeeders.sort((a, b) => {
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        console.log('Unique feeders:', uniqueFeeders.length, 'Total before:', filteredFeeders.length);
        console.log('Sorted feeders alphabetically:', sortedFeeders.map(f => f.name));
        setFeeders(sortedFeeders);

        // If we have feeders and no feeder is selected, select the first one
        if (sortedFeeders.length > 0 && !formData.feederName) {
          const firstFeeder = sortedFeeders[0];
          setFormData(prev => ({
            ...prev,
            feederName: firstFeeder.name,
            feederAlias: firstFeeder.alias || undefined,
            voltageLevel: firstFeeder.voltageLevel
          }));
        }
        
        // Sync alias for currently selected feeder if it exists
        if (sortedFeeders.length > 0 && formData.feederName) {
          const currentFeeder = sortedFeeders.find(f => f.name === formData.feederName);
          if (currentFeeder) {
            setFormData(prev => ({
              ...prev,
              feederAlias: currentFeeder.alias || undefined,
              voltageLevel: currentFeeder.voltageLevel || prev.voltageLevel
            }));
          }
        }
        
        // Show offline warning if no feeders available
        if (sortedFeeders.length === 0 && isOffline) {
          toast({
            title: "No Feeder Data Available Offline",
            description: "Please go online to load feeder data, or use cached data if available.",
            variant: "destructive",
          });
        }
        
      } catch (error) {
        console.error("Error fetching feeders:", error);
        toast({
          title: "Error",
          description: isOffline 
            ? "No feeder data available offline. Please go online to load data."
            : "Failed to load feeders. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchFeeders();
  }, [formData.region, regions, feederService, user, isOnline, isOffline, getCachedFeederData]);

  // Sync alias when feeders are loaded or feeder name changes
  useEffect(() => {
    if (formData.feederName && feeders.length > 0) {
      const currentFeeder = feeders.find(f => f.name === formData.feederName);
      if (currentFeeder) {
        // Update alias to match current feeder (clear if no alias)
        setFormData(prev => {
          const newAlias = currentFeeder.alias || undefined;
          if (prev.feederAlias !== newAlias) {
            console.log('[OverheadLineInspectionForm] Syncing alias:', {
              oldAlias: prev.feederAlias,
              newAlias: newAlias,
              feederName: formData.feederName
            });
            return {
              ...prev,
              feederAlias: newAlias
            };
          }
          return prev;
        });
      }
    }
  }, [formData.feederName, feeders]);

  // Handle feeder selection
  const handleFeederChange = (feederName: string) => {
    console.log('[OverheadLineInspectionForm] Feeder selection:', {
      selectedFeederName: feederName,
      availableFeeders: feeders.map(f => ({ name: f.name, voltageLevel: f.voltageLevel, alias: f.alias }))
    });
    
    const selectedFeeder = feeders.find(f => f.name === feederName);
    console.log('[OverheadLineInspectionForm] Found feeder:', selectedFeeder);
    
    if (selectedFeeder) {
      setFormData(prev => {
        const newData = {
          ...prev,
          feederName: selectedFeeder.name,
          // Explicitly clear alias if new feeder doesn't have one, otherwise set it
          feederAlias: selectedFeeder.alias ? selectedFeeder.alias : undefined,
          voltageLevel: selectedFeeder.voltageLevel
        };
        console.log('[OverheadLineInspectionForm] Updated form data:', {
          feederName: newData.feederName,
          feederAlias: newData.feederAlias,
          voltageLevel: newData.voltageLevel,
          hasAlias: !!selectedFeeder.alias
        });
        return newData;
      });
    } else {
      console.warn('[OverheadLineInspectionForm] Feeder not found:', feederName);
      // Clear feeder-related data if feeder not found
      setFormData(prev => ({
        ...prev,
        feederName: feederName, // Keep the selected name even if not found
        feederAlias: undefined, // Clear alias
        voltageLevel: prev.voltageLevel // Keep voltage level if it was set
      }));
    }
  };

  // Memoize form sections
  const renderInspectorInfo = useMemo(() => (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-base font-medium text-muted-foreground">Inspector Name</Label>
            <p className="text-base">{formData.inspector.name}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-base font-medium text-muted-foreground">Inspector Email</Label>
            <p className="text-base">{formData.inspector.email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  const renderBasicInformation = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region *</Label>
            <Select
              value={formData.region}
              onValueChange={handleRegionChange}
              disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "regional_general_manager"}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {filteredRegions.map((region, index) => (
                  <SelectItem key={`${region.id}-${index}`} value={region.name}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
                            <Label htmlFor="district">District/Section *</Label>
            <Select
              value={formData.district}
              onValueChange={handleDistrictChange}
              disabled={user?.role === "district_engineer" || user?.role === "technician" || !formData.region}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {filteredDistricts.map((district, index) => (
                  <SelectItem key={`${district.id}-${index}`} value={district.name}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeder">Feeder *</Label>
            <Select
              value={formData.feederName}
              onValueChange={handleFeederChange}
              disabled={!formData.region}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select feeder" />
              </SelectTrigger>
              <SelectContent>
                {feeders.map((feeder, index) => (
                  <SelectItem key={`feeder-${feeder.id}-${index}`} value={feeder.name}>
                    {feeder.name}{feeder.alias ? ` (${feeder.alias})` : ''} ({feeder.voltageLevel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Helpful message when no feeders available */}
            {feeders.length === 0 && formData.region && (
              <div className="text-base text-amber-600 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 flex-shrink-0" />
                  {isOffline ? (
                    <span>No feeder data available offline. Go online and use "Preload Feeder Data" to cache data.</span>
                  ) : (
                    <span>No feeders found for this region. Please check your selection or contact support.</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {formData.feederName && (() => {
            const selectedFeeder = feeders.find(f => f.name === formData.feederName);
            // Show alias field only if the selected feeder has an alias
            return selectedFeeder?.alias ? (
              <div className="space-y-2">
                <Label htmlFor="feederAlias">Feeder Alias</Label>
                <Input
                  id="feederAlias"
                  value={selectedFeeder.alias || ''}
                  readOnly
                  placeholder="Feeder alias will be set automatically"
                />
              </div>
            ) : null;
          })()}

          <div className="space-y-2">
            <Label htmlFor="voltageLevel">Voltage Level *</Label>
            <Input
              id="voltageLevel"
              value={formData.voltageLevel}
              readOnly
              placeholder="Voltage level will be set automatically"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referencePole">Reference Pole *</Label>
            <Input
              id="referencePole"
              value={formData.referencePole}
              onChange={(e) => handleSanitizedInputChange('referencePole', e.target.value)}
              placeholder="Enter reference pole"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date || new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time *</Label>
            <Input
              id="time"
              type="time"
              value={formData.time || new Date().toTimeString().slice(0, 5)}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>GPS Coordinates <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Latitude (GPS)"
                value={formData.latitude || ''}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                required
                min="-90"
                max="90"
                step="any"
                className={(!formData.latitude || formData.latitude === 0) ? "border-red-500" : ""}
              />
              <Input
                type="number"
                placeholder="Longitude (GPS)"
                value={formData.longitude || ''}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                required
                min="-180"
                max="180"
                step="any"
                className={(!formData.longitude || formData.longitude === 0) ? "border-red-500" : ""}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={isGettingLocation}
                title="Get current location"
              >
                {isGettingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              GPS coordinates are required for inspection location tracking
            </p>
          </div>
          <div className="space-y-2">
            <Label>Location <span className="text-red-500">*</span></Label>
            <Input
              type="text"
              placeholder="Enter location description"
              value={formData.location || ''}
              onChange={e => handleSanitizedInputChange('location', e.target.value)}
              required
              className={!formData.location || formData.location.trim() === '' ? "border-red-500" : ""}
            />
            <p className="text-sm text-muted-foreground">
              Location description is required for inspection tracking
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData, filteredRegions, filteredDistricts, feeders, handleGetLocation, isGettingLocation]);

  // Add pole information section
  const renderPoleInformation = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pole Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="poleId">Pole ID / No. (Range)</Label>
            <Input
              id="poleId"
              value={formData.poleId}
              onChange={(e) => handleSanitizedInputChange('poleId', e.target.value)}
              placeholder="Enter pole ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleHeight">Pole Height</Label>
            <Select
              value={formData.poleHeight}
              onValueChange={(value) => setFormData({ ...formData, poleHeight: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pole height" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8m">8m</SelectItem>
                <SelectItem value="9m">9m</SelectItem>
                <SelectItem value="10m">10m</SelectItem>
                <SelectItem value="11m">11m</SelectItem>
                <SelectItem value="14m">14m</SelectItem>
                <SelectItem value="16m">16m</SelectItem>
                <SelectItem value="18m">18m</SelectItem>
                <SelectItem value="20m">20m</SelectItem>
                <SelectItem value="24m">24m</SelectItem>
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleType">Pole Type</Label>
            <Select
              value={formData.poleType}
              onValueChange={(value) => setFormData({ ...formData, poleType: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pole type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CP">CP - Concrete</SelectItem>
                <SelectItem value="WP">WP - Wood</SelectItem>
                <SelectItem value="SP">SP - Steel Tubular</SelectItem>
                <SelectItem value="ST">ST - Steel Tower</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="groundCondition">Ground Condition <span className="text-red-500">*</span></Label>
            <Select
              value={formData.groundCondition}
              onValueChange={value => setFormData({ ...formData, groundCondition: value })}
            >
              <SelectTrigger id="groundCondition" className={!formData.groundCondition ? "border-red-500" : ""}>
                <SelectValue placeholder="Select Ground Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Waterlog">Waterlog</SelectItem>
                <SelectItem value="Rocky">Rocky</SelectItem>
                <SelectItem value="Sandy">Sandy</SelectItem>
                <SelectItem value="Clay">Clay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Update pole condition section
  const renderPoleCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pole Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleTilted"
              checked={formData.poleCondition.tilted}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, tilted: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleTilted">Tilted</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleBroken"
              checked={formData.poleCondition.broken}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, broken: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleBroken">Broken Pole</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleRotten"
              checked={formData.poleCondition.rotten}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, rotten: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleRotten">Rotten</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleBurnt"
              checked={formData.poleCondition.burnt}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, burnt: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleBurnt">Burnt</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleSubstandard"
              checked={formData.poleCondition.substandard}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, substandard: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleSubstandard">Substandard</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleConflictWithLV"
              checked={formData.poleCondition.conflictWithLV}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, conflictWithLV: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleConflictWithLV">Conflict with LV</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleNotes">Notes</Label>
            <Textarea
              id="poleNotes"
              value={formData.poleCondition.notes}
              onChange={(e) => handleSanitizedNestedChange('poleCondition', 'notes', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Update stay condition section
  const renderStayCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Stay Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayRequiredButNotAvailable"
              checked={formData.stayCondition.requiredButNotAvailable}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, requiredButNotAvailable: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayRequiredButNotAvailable">Required but not available</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayCut"
              checked={formData.stayCondition.cut}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, cut: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayCut">Cut</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayMisaligned"
              checked={formData.stayCondition.misaligned}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, misaligned: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayMisaligned">Misaligned</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayDefectiveStay"
              checked={formData.stayCondition.defectiveStay}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, defectiveStay: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayDefectiveStay">Defective Stay (Spread)</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stayNotes">Notes</Label>
            <Textarea
              id="stayNotes"
              value={formData.stayCondition.notes}
              onChange={(e) => setFormData({ ...formData, stayCondition: { ...formData.stayCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add cross arm condition section
  const renderCrossArmCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cross Arm Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmMisaligned"
              checked={formData.crossArmCondition.misaligned}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, misaligned: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmMisaligned">Misaligned</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmBend"
              checked={formData.crossArmCondition.bend}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, bend: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmBend">Bend</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmCorroded"
              checked={formData.crossArmCondition.corroded}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, corroded: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmCorroded">Corroded</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmSubstandard"
              checked={formData.crossArmCondition.substandard}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, substandard: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmSubstandard">Substandard</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmOthers"
              checked={formData.crossArmCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crossArmNotes">Notes</Label>
            <Textarea
              id="crossArmNotes"
              value={formData.crossArmCondition.notes}
              onChange={(e) => setFormData({ ...formData, crossArmCondition: { ...formData.crossArmCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add insulator condition section
  const renderInsulatorCondition = useMemo(() => {
    const insulatorTypes = [
      { value: 'pin', label: 'Pin Insulator' },
      { value: 'post', label: 'Post Insulator' },
      { value: 'strain', label: 'Strain Insulator' },
      { value: 'shackle', label: 'Shackle Insulator' },
    ];
    const typeSelected = !!formData.insulatorCondition.insulatorType;
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Insulator Condition</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insulatorType">Insulator Type</Label>
              <Select
                value={formData.insulatorCondition.insulatorType || ''}
                onValueChange={value => setFormData({
                  ...formData,
                  insulatorCondition: { ...formData.insulatorCondition, insulatorType: value }
                })}
              >
                <SelectTrigger id="insulatorType">
                  <SelectValue placeholder="Select Insulator Type" />
                </SelectTrigger>
                <SelectContent>
                  {insulatorTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorBrokenOrCracked"
                checked={formData.insulatorCondition.brokenOrCracked}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, brokenOrCracked: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorBrokenOrCracked">Broken/Cracked</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorBurntOrFlashOver"
                checked={formData.insulatorCondition.burntOrFlashOver}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, burntOrFlashOver: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorBurntOrFlashOver">Burnt/Flash over</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorShattered"
                checked={formData.insulatorCondition.shattered}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, shattered: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorShattered">Shattered</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorDefectiveBinding"
                checked={formData.insulatorCondition.defectiveBinding}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, defectiveBinding: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorDefectiveBinding">Defective Binding</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insulatorNotes">Notes</Label>
              <Textarea
                id="insulatorNotes"
                value={formData.insulatorCondition.notes}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  insulatorCondition: { ...formData.insulatorCondition, notes: e.target.value } 
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [formData]);

  // Add conductor condition section
  const renderConductorCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Conductor Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorLooseConnectors"
              checked={formData.conductorCondition.looseConnectors}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, looseConnectors: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorLooseConnectors">Loose Connectors</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorWeakJumpers"
              checked={formData.conductorCondition.weakJumpers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, weakJumpers: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorWeakJumpers">Weak Jumpers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorBurntLugs"
              checked={formData.conductorCondition.burntLugs}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, burntLugs: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorBurntLugs">Burnt Lugs</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorSaggedLine"
              checked={formData.conductorCondition.saggedLine}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, saggedLine: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorSaggedLine">Sagged Line</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorBrokenConductor"
              checked={formData.conductorCondition.brokenConductor}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, brokenConductor: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorBrokenConductor">Broken Conductor</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorUndersized"
              checked={formData.conductorCondition.undersized}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, undersized: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorUndersized">Undersized</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="conductorNotes">Notes</Label>
            <Textarea
              id="conductorNotes"
              value={formData.conductorCondition.notes}
              onChange={(e) => setFormData({ ...formData, conductorCondition: { ...formData.conductorCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add lightning arrester condition section
  const renderLightningArresterCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Lightning Arrester Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterBrokenOrCracked"
              checked={formData.lightningArresterCondition.brokenOrCracked}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, brokenOrCracked: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterBrokenOrCracked">Broken/Cracked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterFlashOver"
              checked={formData.lightningArresterCondition.flashOver}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, flashOver: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterFlashOver">Flash over</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterNoEarthing"
              checked={formData.lightningArresterCondition.noEarthing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, noEarthing: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterNoEarthing">No Earthing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterBypassed"
              checked={formData.lightningArresterCondition.bypassed}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, bypassed: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterBypassed">By-passed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterNoArrester"
              checked={formData.lightningArresterCondition.noArrester}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, noArrester: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterNoArrester">No Arrester</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="arresterNotes">Notes</Label>
            <Textarea
              id="arresterNotes"
              value={formData.lightningArresterCondition.notes}
              onChange={(e) => setFormData({ ...formData, lightningArresterCondition: { ...formData.lightningArresterCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add drop out fuse condition section
  const renderDropOutFuseCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drop Out Fuse/Isolator Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseBrokenOrCracked"
              checked={formData.dropOutFuseCondition.brokenOrCracked}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, brokenOrCracked: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseBrokenOrCracked">Broken/Cracked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseFlashOver"
              checked={formData.dropOutFuseCondition.flashOver}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, flashOver: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseFlashOver">Flash over</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseInsufficientClearance"
              checked={formData.dropOutFuseCondition.insufficientClearance}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, insufficientClearance: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseInsufficientClearance">Insufficient Clearance</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseLooseOrNoEarthing"
              checked={formData.dropOutFuseCondition.looseOrNoEarthing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, looseOrNoEarthing: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseLooseOrNoEarthing">Loose or No Earthing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseCorroded"
              checked={formData.dropOutFuseCondition.corroded}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, corroded: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseCorroded">Corroded</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseLinkedHVFuses"
              checked={formData.dropOutFuseCondition.linkedHVFuses}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, linkedHVFuses: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseLinkedHVFuses">Linked HV Fuses</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseOthers"
              checked={formData.dropOutFuseCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuseNotes">Notes</Label>
            <Textarea
              id="fuseNotes"
              value={formData.dropOutFuseCondition.notes}
              onChange={(e) => setFormData({ ...formData, dropOutFuseCondition: { ...formData.dropOutFuseCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add transformer condition section
  const renderTransformerCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Transformer Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLeakingOil"
              checked={formData.transformerCondition.leakingOil}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, leakingOil: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLeakingOil">Leaking Oil</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLowOilLevel"
              checked={formData.transformerCondition.lowOilLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, lowOilLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLowOilLevel">Low Oil Level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerMissingEarthLeads"
              checked={formData.transformerCondition.missingEarthLeads}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, missingEarthLeads: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerMissingEarthLeads">Missing Earth leads (HV/LV)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLinkedHVFuses"
              checked={formData.transformerCondition.linkedHVFuses}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, linkedHVFuses: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLinkedHVFuses">Linked HV Fuses</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerRustedTank"
              checked={formData.transformerCondition.rustedTank}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, rustedTank: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerRustedTank">Rusted Tank</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerCrackedBushing"
              checked={formData.transformerCondition.crackedBushing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, crackedBushing: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerCrackedBushing">Cracked Bushing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerOthers"
              checked={formData.transformerCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transformerNotes">Notes</Label>
            <Textarea
              id="transformerNotes"
              value={formData.transformerCondition.notes}
              onChange={(e) => setFormData({ ...formData, transformerCondition: { ...formData.transformerCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add recloser condition section
  const renderRecloserCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recloser/Sectionalizer (VIT) Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserLowGasLevel"
              checked={formData.recloserCondition.lowGasLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, lowGasLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserLowGasLevel">Low Gas Level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserLowBatteryLevel"
              checked={formData.recloserCondition.lowBatteryLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, lowBatteryLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserLowBatteryLevel">Low Battery level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserBurntVoltageTransformers"
              checked={formData.recloserCondition.burntVoltageTransformers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, burntVoltageTransformers: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserBurntVoltageTransformers">Burnt Voltage Transformers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserProtectionDisabled"
              checked={formData.recloserCondition.protectionDisabled}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, protectionDisabled: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserProtectionDisabled">Protection Disabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserBypassed"
              checked={formData.recloserCondition.bypassed}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, bypassed: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserBypassed">By-passed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserOthers"
              checked={formData.recloserCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recloserNotes">Notes</Label>
            <Textarea
              id="recloserNotes"
              value={formData.recloserCondition.notes}
              onChange={(e) => setFormData({ ...formData, recloserCondition: { ...formData.recloserCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add vegetation conflicts section
  const renderVegetationConflicts = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Vegetation Conflicts</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="vegetationClimbers"
              checked={formData.vegetationConflicts.climbers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  vegetationConflicts: { ...formData.vegetationConflicts, climbers: checked as boolean },
                })
              }
            />
            <Label htmlFor="vegetationClimbers">Climbers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="vegetationTrees"
              checked={formData.vegetationConflicts.trees}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  vegetationConflicts: { ...formData.vegetationConflicts, trees: checked as boolean },
                })
              }
            />
            <Label htmlFor="vegetationTrees">Trees</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="vegetationOthers"
              checked={formData.vegetationConflicts.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  vegetationConflicts: { ...formData.vegetationConflicts, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="vegetationOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vegetationNotes">Notes</Label>
            <Textarea
              id="vegetationNotes"
              value={formData.vegetationConflicts.notes}
              onChange={(e) => setFormData({ ...formData, vegetationConflicts: { ...formData.vegetationConflicts, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  const renderAdditionalNotes = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
        <div className="space-y-2">
          <Textarea
            value={formData.additionalNotes}
            onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
            placeholder="Enter any additional observations or notes..."
            className="min-h-[100px]"
          />
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add event listeners for offline sync
  useEffect(() => {
    const handleInspectionAdded = (event: CustomEvent) => {
      if (event.detail.type === 'overhead') {
        if (event.detail.status === 'success') {
          toast({ 
            title: "Success", 
            description: "Inspection saved offline successfully" 
          });
        } else {
          toast({ 
            title: "Error", 
            description: event.detail.error || "Failed to save inspection offline",
            variant: "destructive"
          });
        }
      }
    };

    const handleInspectionSynced = (event: CustomEvent) => {
      if (event.detail.status === 'success') {
        toast({ 
          title: "Success", 
          description: "Offline inspection synced successfully" 
        });
      } else {
        toast({ 
          title: "Error", 
          description: event.detail.error || "Failed to sync offline inspection",
          variant: "destructive"
        });
      }
    };

    window.addEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    window.addEventListener('inspectionSynced', handleInspectionSynced as EventListener);

    return () => {
      window.removeEventListener('inspectionAdded', handleInspectionAdded as EventListener);
      window.removeEventListener('inspectionSynced', handleInspectionSynced as EventListener);
    };
  }, [toast]);

  // Note: isOffline is now provided by the offline context

  // Note: Offline inspections are now managed by the offline context

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Effect to handle video stream when it's available
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play()
          .then(() => {
            console.log('Video playback started');
            setIsVideoReady(true);
          })
          .catch(error => {
            console.error('Error playing video:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to start video playback"
            });
          });
      };
    }
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      console.log('Starting camera...');
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained:', stream);
      
      streamRef.current = stream;
      setCameraStream(stream);
      setIsCapturing(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to access camera. Please check your camera permissions."
      });
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    setCameraStream(null);
    setIsVideoReady(false);
    setIsCapturing(false);
    console.log('Camera stopped');
  };

  // Helper to add timestamp to an image on a canvas and return a data URL
  const addTimestampToImage = (canvas, ctx) => {
    const timestamp = new Date().toLocaleString();
    ctx.font = '24px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const padding = 10;
    const textWidth = ctx.measureText(timestamp).width;
    const x = canvas.width - textWidth - padding;
    const y = canvas.height - padding;
    ctx.fillRect(x - 5, y - 28, textWidth + 10, 32);
    ctx.fillStyle = 'white';
    ctx.fillText(timestamp, x, y);
    return canvas.toDataURL('image/jpeg');
  };

  const captureImage = async () => {
    if (videoRef.current) {
      try {
        // Capture the image immediately
        const baseImage = captureImageWithMetadata(
          videoRef.current,
          `${formData.latitude}, ${formData.longitude}`,
          gpsAccuracy
        );
        
        // Add the image to form data immediately
        setFormData(prev => ({
          ...prev,
          images: [...(Array.isArray(prev.images) ? prev.images : []), baseImage]
        }));
        
        stopCamera();
        toast({
          title: "Success",
          description: "Photo captured successfully!"
        });

        // Get fresh GPS location in the background and update the image
        const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
          return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'));
              return;
            }
            
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                resolve({ latitude, longitude, accuracy });
              },
              (error) => {
                reject(error);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          });
        };

        // Update image with fresh GPS in background using the base image
        getCurrentGPS().then(async gpsData => {
          const updatedImage = await processImageWithMetadata(
            baseImage,
            `${gpsData.latitude}, ${gpsData.longitude}`,
            gpsData.accuracy
          );
          
          // Update the last added image with fresh GPS
          setFormData(prev => ({
            ...prev,
            images: prev.images.map((img, index) => 
              index === prev.images.length - 1 ? updatedImage : img
            )
          }));
          
          toast({
            title: "GPS Updated",
            description: `Photo updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
          });
        }).catch(error => {
          console.error('Error getting GPS for image:', error);
          // Don't show error to user since photo was already captured
        });
        
      } catch (error) {
        console.error('Error capturing image:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to capture image"
        });
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      console.log(`[FileUpload] Processing ${files.length} file(s)`);
      for (const file of Array.from(files)) {
        console.log(`[FileUpload] Processing file:`, { 
          name: file.name, 
          size: file.size, 
          type: file.type,
          sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
        });
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            console.log(`[FileUpload] File read successfully, size:`, (reader.result as string).length, 'characters');
            console.log(`[FileUpload] Processing with GPS...`);
            
            // Process image immediately with current GPS
            const baseImage = await processImageWithMetadata(
              reader.result as string,
              `${formData.latitude}, ${formData.longitude}`,
              gpsAccuracy
            );
            
            console.log(`[FileUpload] Image processed successfully, processed size:`, baseImage.length, 'characters');
            console.log(`[FileUpload] Adding to form data...`);
            
            // Add image to form data immediately
            setFormData(prev => {
              const newImages = [...(Array.isArray(prev.images) ? prev.images : []), baseImage];
              console.log(`[FileUpload] Form data updated, total images:`, newImages.length);
              return {
                ...prev,
                images: newImages
              };
            });
            
            console.log(`[FileUpload] Image added to form data successfully`);
            toast({
              title: "Success",
              description: "Image uploaded successfully!"
            });

            // Debug: Log the current form data images
            setFormData(prev => {
              console.log(`[FileUpload] Current form data images count:`, prev.images?.length || 0);
              return prev;
            });

            // Get fresh GPS location in the background and update the image
            const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
              return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error('Geolocation not supported'));
                  return;
                }
                
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    resolve({ latitude, longitude, accuracy });
                  },
                  (error) => {
                    reject(error);
                  },
                  {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                  }
                );
              });
            };

            // Update image with fresh GPS in background
            getCurrentGPS().then(async gpsData => {
              const updatedImage = await processImageWithMetadata(
                reader.result as string,
                `${gpsData.latitude}, ${gpsData.longitude}`,
                gpsData.accuracy
              );
              
              // Update the last added image with fresh GPS
              setFormData(prev => ({
                ...prev,
                images: prev.images.map((img, index) => 
                  index === prev.images.length - 1 ? updatedImage : img
                )
              }));
              
              toast({
                title: "GPS Updated",
                description: `Image updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
              });
            }).catch(error => {
              console.error('Error getting GPS for uploaded image:', error);
              // Don't show error to user since image was already uploaded
            });
            
          } catch (error) {
            console.error('[FileUpload] Error processing uploaded image:', error);
            console.error('[FileUpload] Error details:', {
              message: error.message,
              stack: error.stack,
              fileSize: file.size,
              fileType: file.type
            });
            toast({
              variant: "destructive",
              title: "Error",
              description: `Failed to process uploaded image: ${error.message}`
            });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: (Array.isArray(prev.images) ? prev.images : []).filter((_, i) => i !== index)
    }));
  };

  // Debug function to test photo upload
  const testPhotoUpload = async () => {
    try {
      console.log('[TestUpload] Testing photo upload...');
      const photoService = PhotoService.getInstance();
      
      // Create a simple test image (1x1 pixel)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 1, 1);
      }
      const testImage = canvas.toDataURL('image/jpeg');
      
      console.log('[TestUpload] Test image created:', testImage.substring(0, 50) + '...');
      
      const result = await photoService.uploadPhoto(
        testImage,
        'test-upload',
        'overhead-inspection'
      );
      
      console.log('[TestUpload] Upload result:', result);
      
      if (result.success) {
        toast({
          title: "Test Success",
          description: "Test upload worked! Check console for details."
        });
      } else {
        toast({
          title: "Test Failed",
          description: `Test upload failed: ${result.error}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[TestUpload] Error:', error);
      toast({
        title: "Test Error",
        description: "Test upload error - check console",
        variant: "destructive"
      });
    }
  };

  // Update the camera view section
  const renderCameraView = useMemo(() => {
    if (!isCapturing) return null;

    return (
      <div className="relative border-2 border-gray-300 rounded-lg p-2">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full max-w-md rounded-lg bg-black"
          style={{ 
            transform: 'scaleX(-1)',
            minHeight: '300px',
            objectFit: 'cover'
          }}
        />
        {isVideoReady && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <Button
              type="button"
              onClick={captureImage}
              className="bg-white text-black hover:bg-gray-100"
            >
              Capture
            </Button>
            <Button
              type="button"
              onClick={stopCamera}
              variant="destructive"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }, [isCapturing, isVideoReady]);

  // Update the image upload section to use the new camera view
  const renderImageUpload = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Images</h3>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={startCamera}
              disabled={isCapturing}
              className="w-full sm:w-auto"
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <div className="relative w-full sm:w-auto">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="image-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('image-upload')?.click()}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </Button>
            </div>
            {/* Test Upload button hidden
            <Button
              type="button"
              variant="outline"
              onClick={testPhotoUpload}
              className="w-full sm:w-auto"
            >
              🧪 Test Upload
            </Button>
            */}
          </div>

          {renderCameraView}

          {formData.images && formData.images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {formData.images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={PhotoService.getInstance().convertToProxyUrl(image)}
                    alt={`Inspection image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ), [formData.images, isCapturing, isVideoReady]);

  const handleAfterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // Process after image immediately with current GPS
            const baseImage = await processImageWithMetadata(
              reader.result as string,
              `${formData.latitude}, ${formData.longitude}`,
              gpsAccuracy
            );
            
            // Add image to form data immediately
            setFormData(prev => ({
              ...prev,
              afterImages: [...(Array.isArray(prev.afterImages) ? prev.afterImages : []), baseImage]
            }));
            
            toast({
              title: "Success",
              description: "After image uploaded successfully!"
            });

            // Get fresh GPS location in the background and update the image
            const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
              return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error('Geolocation not supported'));
                  return;
                }
                
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    resolve({ latitude, longitude, accuracy });
                  },
                  (error) => {
                    reject(error);
                  },
                  {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                  }
                );
              });
            };

            // Update image with fresh GPS in background
            getCurrentGPS().then(async gpsData => {
              const updatedImage = await processImageWithMetadata(
                reader.result as string,
                `${gpsData.latitude}, ${gpsData.longitude}`,
                gpsData.accuracy
              );
              
              // Update the last added after image with fresh GPS
              setFormData(prev => ({
                ...prev,
                afterImages: prev.afterImages.map((img, index) => 
                  index === prev.afterImages.length - 1 ? updatedImage : img
                )
              }));
              
              toast({
                title: "GPS Updated",
                description: `After image updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
              });
            }).catch(error => {
              console.error('Error getting GPS for uploaded after image:', error);
              // Don't show error to user since image was already uploaded
            });
            
          } catch (error) {
            console.error('Error processing uploaded after image:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to process uploaded after image"
            });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeAfterImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      afterImages: (Array.isArray(prev.afterImages) ? prev.afterImages : []).filter((_, i) => i !== index)
    }));
  };

  const startCameraAfter = async () => {
    setIsCapturingAfter(true);
    setIsVideoReadyAfter(false);
    try {
      cameraStreamAfter = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (videoRefAfter.current) {
        videoRefAfter.current.srcObject = cameraStreamAfter;
        videoRefAfter.current.onloadedmetadata = () => setIsVideoReadyAfter(true);
      }
    } catch (err) {
      setIsCapturingAfter(false);
      toast({
        title: "Error",
        description: "Failed to access camera for after-correction photo.",
        variant: "destructive",
      });
    }
  };
  const stopCameraAfter = () => {
    setIsCapturingAfter(false);
    setIsVideoReadyAfter(false);
    if (videoRefAfter.current) {
      videoRefAfter.current.srcObject = null;
    }
    if (cameraStreamAfter) {
      cameraStreamAfter.getTracks().forEach(track => track.stop());
      cameraStreamAfter = null;
    }
  };
  const captureAfterImage = async () => {
    if (videoRefAfter.current) {
      try {
        // Capture the after image immediately
        const baseImage = captureImageWithMetadata(
          videoRefAfter.current,
          `${formData.latitude}, ${formData.longitude}`,
          gpsAccuracy
        );
        
        // Add the image to form data immediately
        setFormData(prev => ({
          ...prev,
          afterImages: [...(Array.isArray(prev.afterImages) ? prev.afterImages : []), baseImage]
        }));
        
        stopCameraAfter();
        toast({
          title: "Success",
          description: "After photo captured successfully!"
        });

        // Get fresh GPS location in the background and update the image
        const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
          return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'));
              return;
            }
            
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                resolve({ latitude, longitude, accuracy });
              },
              (error) => {
                reject(error);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          });
        };

        // Update image with fresh GPS in background using the base image
        getCurrentGPS().then(async gpsData => {
          const updatedImage = await processImageWithMetadata(
            baseImage,
            `${gpsData.latitude}, ${gpsData.longitude}`,
            gpsData.accuracy
          );
          
          // Update the last added after image with fresh GPS
          setFormData(prev => ({
            ...prev,
            afterImages: prev.afterImages.map((img, index) => 
              index === prev.afterImages.length - 1 ? updatedImage : img
            )
          }));
          
          toast({
            title: "GPS Updated",
            description: `After photo updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
          });
        }).catch(error => {
          console.error('Error getting GPS for after image:', error);
          // Don't show error to user since photo was already captured
        });
        
      } catch (error) {
        console.error('Error capturing after image:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to capture after image"
        });
      }
    }
  };
  const renderCameraViewAfter = useMemo(() => {
    if (!isCapturingAfter) return null;
    return (
      <div className="relative border-2 border-gray-300 rounded-lg p-2">
        <video
          ref={videoRefAfter}
          autoPlay
          playsInline
          muted
          className="w-full max-w-md rounded-lg bg-black"
          style={{
            transform: 'scaleX(-1)',
            minHeight: '300px',
            objectFit: 'cover'
          }}
        />
        {isVideoReadyAfter && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <Button
              type="button"
              onClick={captureAfterImage}
              className="bg-white text-black hover:bg-gray-100"
            >
              Capture
            </Button>
            <Button
              type="button"
              onClick={stopCameraAfter}
              variant="destructive"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }, [isCapturingAfter, isVideoReadyAfter]);

  const renderAfterImages = useMemo(() => {
    // Only show after images section if there are before images
    if (!formData.images || formData.images.length === 0) {
      return null;
    }

    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">After Inspection Correction Photos</h3>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={startCameraAfter}
                disabled={isCapturingAfter}
                className="w-full sm:w-auto"
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
              <div className="relative w-full sm:w-auto">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAfterImageUpload}
                  className="hidden"
                  id="after-image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('after-image-upload')?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </Button>
              </div>
            </div>
            {renderCameraViewAfter}
            {formData.afterImages && formData.afterImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {formData.afterImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={PhotoService.getInstance().convertToProxyUrl(image)}
                      alt={`After Correction image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeAfterImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }, [formData.images, formData.afterImages, isCapturingAfter, isVideoReadyAfter]);

  useEffect(() => {
    if (user && !inspection && (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region && regions.length > 0 && districts.length > 0) {
      const regionObj = regions.find(r => r.name === user.region);
      if (regionObj) {
        const regionDistricts = districts.filter(d => d.regionId === regionObj.id);
        if (regionDistricts.length > 0 && !formData.district) {
          setFormData(prev => ({
            ...prev,
            region: user.region,
            district: regionDistricts[0].name,
            inspector: {
              id: user.id,
              name: user.name,
              email: user.email
            }
          }));
        }
      }
    }
  }, [user, inspection, regions, districts, formData.district]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold">
            {inspection ? "Edit Network Inspection" : "New Network Inspection"}
          </h2>
          
          {/* Offline Status Indicators */}
          <div className="mt-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <OfflineBadge showDetails={true} />
              
              {/* Feeder Data Preload Button */}
              {isOnline && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      setIsPreloadingFeederData(true);
                      try {
                        await preloadFeederData();
                        toast({
                          title: "Feeder Data Preloaded",
                          description: "Feeder data has been cached for offline use.",
                          variant: "default",
                        });
                      } catch (error) {
                        toast({
                          title: "Preload Failed",
                          description: "Failed to preload feeder data. Please try again.",
                          variant: "destructive",
                        });
                      } finally {
                        setIsPreloadingFeederData(false);
                      }
                    }}
                    disabled={isPreloadingFeederData}
                    className="flex items-center gap-2 text-sm w-full sm:w-auto min-h-[44px] touch-manipulation"
                    title="Preload feeder data for offline use"
                  >
                    {isPreloadingFeederData ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Preloading...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" />
                        Preload Feeder Data
                      </>
                    )}
                  </Button>
                  
                  {/* Helpful tip */}
                  <span className="text-sm text-gray-500 text-center sm:text-left">
                    💡 Preload feeder data to work offline
                  </span>
                </div>
              )}
            </div>
            
            {isOffline && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-base text-yellow-600">
                <div className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4 flex-shrink-0" />
                  <span>You are currently offline. Changes will be saved locally and synced when you're back online.</span>
                </div>
              </div>
            )}
            
            {/* Offline Feeder Data Info */}
            {isOffline && feeders.length === 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-base text-blue-600">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 flex-shrink-0" />
                  <span>No feeder data available offline. Go online and use "Preload Feeder Data" to cache data for offline use.</span>
                </div>
              </div>
            )}
            
            {offlineInspectionId && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-base text-blue-600">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 flex-shrink-0" />
                  <span>Offline ID: {offlineInspectionId}</span>
                  {lastSavedOffline && (
                    <span>(Saved: {lastSavedOffline.toLocaleTimeString()})</span>
                  )}
                </div>
              </div>
            )}
            
            {totalOfflineItems > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-base text-orange-600">
                <span>📊 {totalOfflineItems} items pending sync</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {isOnline && totalOfflineItems > 0 && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleManualSync}
              className="flex items-center gap-2 w-full sm:w-auto min-h-[44px] touch-manipulation"
            >
              <Wifi className="h-4 w-4" />
              Sync Now
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleCancelClick}
            className="w-full sm:w-auto min-h-[44px] touch-manipulation"
          >
            Cancel
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {renderInspectorInfo}
        {renderBasicInformation}
        {renderPoleInformation}
        {renderPoleCondition}
        {renderStayCondition}
        {renderCrossArmCondition}
        {renderInsulatorCondition}
        {renderConductorCondition}
        {renderLightningArresterCondition}
        {renderDropOutFuseCondition}
        {renderTransformerCondition}
        {renderRecloserCondition}
        {renderVegetationConflicts}
        {renderAdditionalNotes}
        {renderImageUpload}
        {renderAfterImages}

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancelClick}
              className="w-full sm:w-auto min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            
            {/* Offline Save Button */}
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleOfflineSave}
              disabled={isSavingOffline || isOnline}
              className="flex items-center gap-2 w-full sm:w-auto min-h-[44px] touch-manipulation"
            >
              {isSavingOffline ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isOnline ? (
                <>
                  <Wifi className="mr-2 h-4 w-4" />
                  Online - Use Submit
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Offline
                </>
              )}
            </Button>
          </div>
          
          {/* Submit Button - Full width on mobile */}
          <Button 
            type="submit" 
            disabled={isSubmitting || isOffline}
            className={`w-full sm:w-auto min-h-[44px] touch-manipulation ${isOffline ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {inspection ? "Updating..." : "Submitting..."}
              </>
            ) : (
              inspection ? "Update Inspection" : "Submit Inspection"
            )}
          </Button>
        </div>
        
        {/* Offline Help Message */}
        {isOffline && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <WifiOff className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-blue-900">Working Offline</h4>
                <p className="text-sm text-blue-700 mt-1">
                  You're currently offline. Use the "Save Offline" button to save your work locally. 
                  Your data will automatically sync when you're back online, or you can manually sync using the "Sync Now" button.
                </p>
                
                {/* Feeder data specific help */}
                {feeders.length === 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-amber-800">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 flex-shrink-0" />
                        <span className="text-base font-medium">Feeder Data Not Available Offline</span>
                      </div>
                      <p className="text-sm text-amber-700 mt-1 sm:mt-0">
                        To work offline with feeder data, go online and use the "Preload Feeder Data" button to cache the data locally.
                      </p>
                    </div>
                  </div>
                )}
                {offlineInspectionId && (
                  <p className="text-base text-blue-600 mt-2 font-medium">
                    ✅ Your inspection has been saved offline and will sync when connection is restored.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Inspection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel? Any unsaved changes will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelCancel}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 