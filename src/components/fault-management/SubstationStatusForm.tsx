import { useState, useEffect, useRef } from "react";
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
import { Loader2, MapPin, Camera, Upload, X, Wifi, WifiOff, Save, Database } from "lucide-react";
import { SubstationStatus } from "@/lib/types";
import { getRegions, getDistricts, getDistrictsByRegion, apiRequest } from "@/lib/api";
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { useNavigate } from "react-router-dom";
import { processImageWithMetadata, captureImageWithMetadata } from "@/utils/imageUtils";
import { PhotoService } from "@/services/PhotoService";
import { OfflineBadge } from '@/components/common/OfflineBadge';
import { PhotoCapture } from '@/components/common/PhotoCapture';
import { createSanitizedInputHandler, sanitizeFormData } from '@/utils/inputSanitization';

interface SubstationStatusFormProps {
  substationStatus?: SubstationStatus | null;
  onSubmit: (substationStatus: SubstationStatus) => void;
  onCancel: () => void;
}

export function SubstationStatusForm({ substationStatus, onSubmit, onCancel }: SubstationStatusFormProps) {
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
    totalOfflineItems
  } = useOffline();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const navigate = useNavigate();
  const [locationError, setLocationError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>(substationStatus?.images || []);
  const [isMobile, setIsMobile] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineInspectionId, setOfflineInspectionId] = useState<string | null>(null);
  const [lastSavedOffline, setLastSavedOffline] = useState<Date | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  
  // Camera functionality
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const photoService = PhotoService.getInstance();
  
  const isDistrictScopedUser = !!user && (user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician");

  // Helper function to determine if an image is base64 or URL
  const isBase64Image = (image: string): boolean => {
    return image.startsWith('data:image/');
  };

  // Helper function to get image source
  const getImageSource = (image: string): string => {
    if (isBase64Image(image)) {
      return image;
    }
    return photoService.convertToProxyUrl(image);
  };

  const [formData, setFormData] = useState<SubstationStatus>(() => {
    const defaultFormData: SubstationStatus = {
      id: substationStatus?.id || "",
      createdAt: substationStatus?.createdAt || new Date().toISOString(),
      updatedAt: substationStatus?.updatedAt || new Date().toISOString(),
      date: substationStatus?.date || new Date().toISOString().split('T')[0],
      time: substationStatus?.time || new Date().toTimeString().slice(0, 5),
      region: substationStatus?.region || user?.region || "",
      district: substationStatus?.district || user?.district || "",
      regionId: substationStatus?.regionId || user?.regionId || "",
      districtId: substationStatus?.districtId || user?.districtId || "",
      latitude: substationStatus?.latitude || 0,
      longitude: substationStatus?.longitude || 0,
      location: substationStatus?.location || "",
      status: substationStatus?.status || "pending",
      inspector: {
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || ""
      },
      substationNumber: substationStatus?.substationNumber || "",
      substationName: substationStatus?.substationName || "",
      rating: substationStatus?.rating || "",
      transformerType: substationStatus?.transformerType || "PMT",
      transformerConditions: {
        namePlate: substationStatus?.transformerConditions?.namePlate || false,
        oilLeakage: substationStatus?.transformerConditions?.oilLeakage || "no",
        bushing: substationStatus?.transformerConditions?.bushing || "intact",
         notes: substationStatus?.transformerConditions?.notes || "",
         photos: substationStatus?.transformerConditions?.photos || [],
         namePlatePhotos: substationStatus?.transformerConditions?.namePlatePhotos || []
      },
      fuseConditions: {
         fuseType: substationStatus?.fuseConditions?.fuseType || "intact",
        fuseHolder: substationStatus?.fuseConditions?.fuseHolder || "intact",
        notes: substationStatus?.fuseConditions?.notes || "",
        photos: substationStatus?.fuseConditions?.photos || []
      },
      earthingConditions: {
        earthingStatus: substationStatus?.earthingConditions?.earthingStatus || "intact",
        notes: substationStatus?.earthingConditions?.notes || "",
        photos: substationStatus?.earthingConditions?.photos || []
      },
      generalNotes: substationStatus?.generalNotes || "",
      images: substationStatus?.images || [],
      afterImages: substationStatus?.afterImages || []
    };

    // Set region and district based on user role, prefer IDs
    if (user) {
      const resolveRegionId = () => {
        if (user.regionId) return user.regionId;
        if (user.region) {
          const match = regions.find(r => r.id === user.region || r.name === user.region);
          return match?.id || "";
        }
        return "";
      };
      const resolvedRegionId = resolveRegionId();

      const resolveDistrictId = () => {
        if (user.districtId) return user.districtId;
        if (user.district) {
          // Try to match by id or name within the resolved region if available
          const pool = resolvedRegionId ? districts.filter(d => d.regionId === resolvedRegionId) : districts;
          const match = pool.find(d => d.id === user.district || d.name === user.district);
          return match?.id || "";
        }
        return "";
      };

      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician")) {
        defaultFormData.region = resolvedRegionId || defaultFormData.region;
        defaultFormData.district = resolveDistrictId() || defaultFormData.district;
      }
    }

    return defaultFormData;
  });

  const [filteredDistricts, setFilteredDistricts] = useState<typeof districts>([]);
  const hasInitialized = useRef(false);

  // Calculate filtered regions based on user role
  const filteredRegions = (() => {
    if (!user) return regions;
    
    // Global engineers and system admins can see all regions
    if (user.role === "global_engineer" || user.role === "system_admin") {
      return regions;
    }
    
    // Regional engineers, regional general managers can only see their assigned region
    if (user.role === "regional_engineer" || user.role === "regional_general_manager" || user.role === "project_engineer") {
      return regions.filter(r => r.name === user.region);
    }
    
    // Ashsubt users can see all Ashanti regions
    if (user.role === "ashsubt") {
      return regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
    }
    
    // Accsubt users can see all Accra regions
    if (user.role === "accsubt") {
      return regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
    }
    
    // District engineers, district managers and technicians can only see their assigned region
    if (user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") {
      const userDistrict = districts.find(d => d.name === user.district);
      return userDistrict ? regions.filter(r => r.id === userDistrict.regionId) : [];
    }
    
    // Default: show all regions
    return regions;
  })();

  // Initialize default region for ashsubt and accsubt (only once)
  useEffect(() => {
    if (!user || hasInitialized.current) return;
    
    // For ashsubt - set default to first allowed Ashanti region
    if (user.role === "ashsubt" && !formData.region) {
      const ashsubtRegions = regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
      if (ashsubtRegions.length > 0) {
        setFormData(prev => ({ ...prev, region: ashsubtRegions[0].id }));
        hasInitialized.current = true;
      }
      return;
    }

    // For accsubt - set default to first allowed Accra region
    if (user.role === "accsubt" && !formData.region) {
      const accsubtRegions = regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
      if (accsubtRegions.length > 0) {
        setFormData(prev => ({ ...prev, region: accsubtRegions[0].id }));
        hasInitialized.current = true;
      }
      return;
    }
  }, [user, regions, formData.region]);

  // Ensure region/district are set to IDs once user and lists are available
  useEffect(() => {
    if (!user) return;
    
    // Skip for ashsubt and accsubt users - they handle their own region selection
    if (user.role === "ashsubt" || user.role === "accsubt") return;
    
    // Only correct if currently empty or appears to be a name not matching an ID
    const currentRegion = formData.region;
    const currentDistrict = formData.district;
    
    const needsRegionFix = !currentRegion || !regions.find(r => r.id === currentRegion);
    const needsDistrictFix = !currentDistrict || !districts.find(d => d.id === currentDistrict);
    if (!needsRegionFix && !needsDistrictFix) return;

    const regionId = user.regionId || (user.region ? (regions.find(r => r.id === user.region || r.name === user.region)?.id || "") : "");
    const districtId = user.districtId || (user.district ? (districts.find(d => d.id === user.district || d.name === user.district)?.id || "") : "");

    setFormData(prev => {
      // Only update if we have values and they're different
      if (!regionId && !districtId) return prev;
      
      return {
        ...prev,
        ...(regionId && regionId !== prev.region ? { region: regionId } : {}),
        ...(districtId && districtId !== prev.district ? { district: districtId } : {})
      };
    });
  }, [user, regions, districts]);

  useEffect(() => {
    if (formData.region) {
      const regionDistricts = districts.filter(d => d.regionId === formData.region);
      setFilteredDistricts(regionDistricts);
      
      // Reset district if it's not in the new region
      if (!regionDistricts.find(d => d.id === formData.district)) {
        setFormData(prev => ({ ...prev, district: "" }));
      }
    } else {
      // If no region selected, show districts based on user role
      if (user?.role === "ashsubt") {
        const ashsubtDistricts = districts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
        setFilteredDistricts(ashsubtDistricts);
      } else if (user?.role === "accsubt") {
        const accsubtDistricts = districts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
        setFilteredDistricts(accsubtDistricts);
      } else {
        setFilteredDistricts([]);
      }
    }
  }, [formData.region, districts, user]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Sync capturedImages with formData.images
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      images: capturedImages
    }));
  }, [capturedImages]);

  // Update form data when substationStatus prop changes (for edit mode)
  useEffect(() => {
    if (substationStatus) {
      console.log('🔄 Loading substationStatus for edit mode:', substationStatus);
      console.log('📸 Transformer photos:', substationStatus.transformerConditions?.photos);
      console.log('📸 Name plate photos:', substationStatus.transformerConditions?.namePlatePhotos);
      console.log('📸 Fuse photos:', substationStatus.fuseConditions?.photos);
      console.log('📸 Earthing photos:', substationStatus.earthingConditions?.photos);
      
      setFormData(prev => ({
        ...prev,
        id: substationStatus.id || "",
        createdAt: substationStatus.createdAt || new Date().toISOString(),
        updatedAt: substationStatus.updatedAt || new Date().toISOString(),
        date: substationStatus.date || new Date().toISOString().split('T')[0],
        time: substationStatus.time || new Date().toTimeString().slice(0, 5),
        region: substationStatus.region || "",
        district: substationStatus.district || "",
        latitude: substationStatus.latitude || 0,
        longitude: substationStatus.longitude || 0,
        location: substationStatus.location || "",
        status: substationStatus.status || "pending",
        inspector: {
          id: substationStatus.inspector?.id || user?.id || "",
          name: substationStatus.inspector?.name || user?.name || "",
          email: substationStatus.inspector?.email || user?.email || ""
        },
        substationNumber: substationStatus.substationNumber || "",
        substationName: substationStatus.substationName || "",
        rating: substationStatus.rating || "",
        transformerType: substationStatus.transformerType || "PMT",
        transformerConditions: {
          namePlate: substationStatus.transformerConditions?.namePlate || false,
          oilLeakage: substationStatus.transformerConditions?.oilLeakage || "no",
          bushing: substationStatus.transformerConditions?.bushing || "intact",
          notes: substationStatus.transformerConditions?.notes || "",
          photos: substationStatus.transformerConditions?.photos || [],
          namePlatePhotos: substationStatus.transformerConditions?.namePlatePhotos || []
        },
                 fuseConditions: {
           fuseType: substationStatus.fuseConditions?.fuseType || "intact",
          fuseHolder: substationStatus.fuseConditions?.fuseHolder || "intact",
          notes: substationStatus.fuseConditions?.notes || "",
          photos: substationStatus.fuseConditions?.photos || []
        },
        earthingConditions: {
          earthingStatus: substationStatus.earthingConditions?.earthingStatus || "intact",
          notes: substationStatus.earthingConditions?.notes || "",
          photos: substationStatus.earthingConditions?.photos || []
        },
        generalNotes: substationStatus.generalNotes || "",
        images: substationStatus.images || [],
        afterImages: substationStatus.afterImages || []
      }));
      
      // Also update capturedImages for general photos
      setCapturedImages(substationStatus.images || []);
    }
  }, [substationStatus, user]);

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      setFormData(prev => ({
        ...prev,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }));

      setGpsAccuracy(position.coords.accuracy);
      
      // Get address from coordinates
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        if (data.display_name) {
          setFormData(prev => ({
            ...prev,
            location: data.display_name
          }));
        }
      } catch (error) {
        console.log("Could not get address from coordinates");
      }

    } catch (error: any) {
      console.error("Error getting location:", error);
      setLocationError(error.message || "Failed to get location");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    // Sanitize the input value if it's a string
    const sanitizedValue = typeof value === 'string' 
      ? sanitizeFormData({ [field]: value })[field]
      : value;
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: sanitizedValue
      };
      
      // Handle region change - also set regionId
      if (field === 'region') {
        const selectedRegion = regions.find(r => r.name === sanitizedValue);
        if (selectedRegion) {
          newData.regionId = selectedRegion.id;
        }
        // Clear district when region changes
        newData.district = "";
        newData.districtId = "";
      }
      
      // Handle district change - also set districtId
      if (field === 'district') {
        const selectedDistrict = districts.find(d => d.name === sanitizedValue);
        if (selectedDistrict) {
          newData.districtId = selectedDistrict.id;
        }
      }
      
      return newData;
    });
  };

  const handleNestedChange = (section: string, field: string, value: any) => {
    setFormData(prev => {
      const currentSection = prev[section as keyof SubstationStatus];
      if (typeof currentSection === 'object' && currentSection !== null && !Array.isArray(currentSection)) {
        return {
      ...prev,
      [section]: {
            ...currentSection,
        [field]: value
      }
        };
      } else {
        // If the section is not an object (e.g., arrays like images), just set the value directly
        return {
          ...prev,
          [section]: value
        };
      }
    });
  };

  const startCamera = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'environment'
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsVideoReady(true);
        };
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      toast({
        title: "Camera Error",
        description: "Failed to start camera. Please check permissions.",
        variant: "destructive"
      });
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoReady(false);
    setIsCapturing(false);
  };

  const handlePhotoCapture = async () => {
    if (!videoRef.current || !isVideoReady) {
      toast({
        title: "Camera Not Ready",
        description: "Please wait for camera to initialize",
        variant: "destructive"
      });
      return;
    }

    try {
      const imageData = captureImageWithMetadata(
        videoRef.current,
        `${formData.latitude}, ${formData.longitude}`,
        gpsAccuracy
      );
      
      if (imageData) {
        setCapturedImages(prev => [...prev, imageData]);
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, imageData]
        }));
        
        toast({
          title: "Success",
          description: "Photo captured successfully!"
        });
      }
    } catch (error) {
      console.error("Error capturing photo:", error);
      toast({
        title: "Error",
        description: "Failed to capture photo",
        variant: "destructive"
      });
    }
  };

  const removePhoto = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      if (base64Data) {
        setCapturedImages(prev => [...prev, base64Data]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (isSubmitting || isSavingOffline) {
      console.log('🚫 Form submission blocked - already in progress');
      return;
    }
    
    if (!formData.region || !formData.district) {
      toast({
        title: "Validation Error",
        description: "Please select region and district/section",
        variant: "destructive"
      });
      return;
    }

    if (formData.images.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please take at least one photo",
        variant: "destructive"
      });
      return;
    }

    console.log('🚀 Starting form submission...', { 
      hasExistingStatus: !!substationStatus, 
      existingId: substationStatus?.id,
      formDataId: formData.id 
    });
    setIsSubmitting(true);

    try {
      if (isOffline) {
        // Save offline - prepare inspection data
        setIsSavingOffline(true);
        
        const inspectionData = {
          ...formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Store all base64 images for offline storage
          images: formData.images || [],
          afterImages: formData.afterImages || [],
          transformerConditions: {
            ...formData.transformerConditions,
            photos: formData.transformerConditions.photos || [],
            namePlatePhotos: formData.transformerConditions.namePlatePhotos || []
          },
          fuseConditions: {
            ...formData.fuseConditions,
            photos: formData.fuseConditions.photos || []
          },
          earthingConditions: {
            ...formData.earthingConditions,
            photos: formData.earthingConditions.photos || []
          }
        };

        const offlineId = await saveInspectionOffline(inspectionData);
        setOfflineInspectionId(offlineId);
        setLastSavedOffline(new Date());
        
        toast({
          title: "Saved Offline",
          description: "Substation status with photos saved offline. Will sync when online.",
        });
        
        // Save photos offline - just like overhead line pattern
        // General images (before)
        for (let i = 0; i < formData.images.length; i++) {
          const base64Image = formData.images[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
            const filename = `before_${i + 1}_${Date.now()}.jpg`;
            await savePhotoOffline(offlineId, base64Image, filename, 'before', 'image/jpeg');
          }
        }

        // After images
        for (let i = 0; i < formData.afterImages.length; i++) {
          const base64Image = formData.afterImages[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
            const filename = `after_${i + 1}_${Date.now()}.jpg`;
            await savePhotoOffline(offlineId, base64Image, filename, 'after', 'image/jpeg');
          }
        }

        // Transformer condition photos
        if (formData.transformerConditions.photos && formData.transformerConditions.photos.length > 0) {
          for (let i = 0; i < formData.transformerConditions.photos.length; i++) {
            const base64Image = formData.transformerConditions.photos[i];
            if (base64Image && base64Image.startsWith('data:image/')) {
              const filename = `transformer_${i + 1}_${Date.now()}.jpg`;
              await savePhotoOffline(offlineId, base64Image, filename, 'correction', 'image/jpeg');
            }
          }
        }

        // Name plate photos
        if (formData.transformerConditions.namePlatePhotos && formData.transformerConditions.namePlatePhotos.length > 0) {
          for (let i = 0; i < formData.transformerConditions.namePlatePhotos.length; i++) {
            const base64Image = formData.transformerConditions.namePlatePhotos[i];
            if (base64Image && base64Image.startsWith('data:image/')) {
              const filename = `nameplate_${i + 1}_${Date.now()}.jpg`;
              await savePhotoOffline(offlineId, base64Image, filename, 'correction', 'image/jpeg');
            }
          }
        }

        // Fuse condition photos
        if (formData.fuseConditions.photos && formData.fuseConditions.photos.length > 0) {
          for (let i = 0; i < formData.fuseConditions.photos.length; i++) {
            const base64Image = formData.fuseConditions.photos[i];
            if (base64Image && base64Image.startsWith('data:image/')) {
              const filename = `fuse_${i + 1}_${Date.now()}.jpg`;
              await savePhotoOffline(offlineId, base64Image, filename, 'correction', 'image/jpeg');
            }
          }
        }

        // Earthing condition photos
        if (formData.earthingConditions.photos && formData.earthingConditions.photos.length > 0) {
          for (let i = 0; i < formData.earthingConditions.photos.length; i++) {
            const base64Image = formData.earthingConditions.photos[i];
            if (base64Image && base64Image.startsWith('data:image/')) {
              const filename = `earthing_${i + 1}_${Date.now()}.jpg`;
              await savePhotoOffline(offlineId, base64Image, filename, 'correction', 'image/jpeg');
            }
          }
        }
        
      } else {
        // Save online - Upload photos first, then submit form with URLs
        const uploadedPhotos: string[] = [];
        
        // Upload photos first - only upload base64 images, preserve existing URLs
        if (formData.images && formData.images.length > 0) {
          console.log(`📸 Processing ${formData.images.length} general photos...`);
          
          for (let i = 0; i < formData.images.length; i++) {
            const image = formData.images[i];
            
            if (isBase64Image(image)) {
              // Upload base64 image
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`;
              
              const uploadResult = await photoService.uploadPhoto(
                image,
                tempId,
                'substation-inspection'
              );
              
              if (uploadResult.success && uploadResult.url) {
                uploadedPhotos.push(uploadResult.url);
                console.log(`✅ General photo ${i + 1} uploaded: ${uploadResult.url}`);
              } else {
                console.error(`❌ Failed to upload general photo ${i + 1}:`, uploadResult.error);
                toast({
                  title: "Warning",
                  description: `Failed to upload general photo ${i + 1}. Continuing with other photos.`,
                  variant: "destructive",
                });
              }
            } else {
              // Preserve existing URL
              uploadedPhotos.push(image);
              console.log(`✅ General photo ${i + 1} preserved (existing URL): ${image}`);
            }
          }
        }

        // Upload section-specific photos
        const uploadSectionPhotos = async (photos: string[], sectionName: string) => {
          const uploadedUrls: string[] = [];
          
          for (let i = 0; i < photos.length; i++) {
            const image = photos[i];
            
            if (isBase64Image(image)) {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${sectionName}-${i}`;
              
              const uploadResult = await photoService.uploadPhoto(
                image,
                tempId,
                `substation-${sectionName}`
              );
              
              if (uploadResult.success && uploadResult.url) {
                uploadedUrls.push(uploadResult.url);
                console.log(`✅ ${sectionName} photo ${i + 1} uploaded: ${uploadResult.url}`);
              } else {
                console.error(`❌ Failed to upload ${sectionName} photo ${i + 1}:`, uploadResult.error);
                toast({
                  title: "Warning",
                  description: `Failed to upload ${sectionName} photo ${i + 1}. Continuing with other photos.`,
                  variant: "destructive",
                });
              }
            } else {
              // Preserve existing URL
              uploadedUrls.push(image);
              console.log(`✅ ${sectionName} photo ${i + 1} preserved (existing URL): ${image}`);
            }
          }
          
          return uploadedUrls;
        };

                 // Upload transformer conditions photos
         if (formData.transformerConditions.photos && formData.transformerConditions.photos.length > 0) {
           console.log(`📸 Processing ${formData.transformerConditions.photos.length} transformer condition photos...`);
           const transformerPhotos = await uploadSectionPhotos(formData.transformerConditions.photos, 'transformer');
           formData.transformerConditions.photos = transformerPhotos;
         }

         // Upload name plate photos
         if (formData.transformerConditions.namePlatePhotos && formData.transformerConditions.namePlatePhotos.length > 0) {
           console.log(`📸 Processing ${formData.transformerConditions.namePlatePhotos.length} name plate photos...`);
           const namePlatePhotos = await uploadSectionPhotos(formData.transformerConditions.namePlatePhotos, 'nameplate');
           formData.transformerConditions.namePlatePhotos = namePlatePhotos;
         }

        // Upload fuse conditions photos
        if (formData.fuseConditions.photos && formData.fuseConditions.photos.length > 0) {
          console.log(`📸 Processing ${formData.fuseConditions.photos.length} fuse condition photos...`);
          const fusePhotos = await uploadSectionPhotos(formData.fuseConditions.photos, 'fuse');
          formData.fuseConditions.photos = fusePhotos;
        }

        // Upload earthing conditions photos
        if (formData.earthingConditions.photos && formData.earthingConditions.photos.length > 0) {
          console.log(`📸 Processing ${formData.earthingConditions.photos.length} earthing condition photos...`);
          const earthingPhotos = await uploadSectionPhotos(formData.earthingConditions.photos, 'earthing');
          formData.earthingConditions.photos = earthingPhotos;
        }
        
        // Determine if this is a create or update operation
        const isUpdate = substationStatus && substationStatus.id;
        
        // Submit form with photo URLs instead of base64
        const submissionData = {
          ...formData,
          images: uploadedPhotos, // Use uploaded photo URLs instead of base64
          // Only add submissionId for new records (not updates)
          ...(isUpdate ? {} : { submissionId: `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` })
        };
        
        const endpoint = isUpdate 
          ? `/api/substation-status/${substationStatus.id}` 
          : '/api/substation-status';
        const method = isUpdate ? 'PUT' : 'POST';
        
        console.log(`🔄 Making ${method} request to ${endpoint}`, { isUpdate, id: substationStatus?.id });
        
        const response = await apiRequest(endpoint, {
          method,
          body: JSON.stringify(submissionData)
        });

        if (response.success) {
          console.log('✅ Form submission successful:', response);
          console.log('📊 Response data to pass to parent:', response.data);
          
          toast({
            title: "Success",
            description: isUpdate 
              ? "Substation status updated successfully" 
              : "Substation status created successfully",
          });
          
          // Reset form state after successful submission
          if (isUpdate) {
            // For updates, just close the form (parent will handle navigation)
            console.log('✅ Update successful, closing form');
          } else {
            // For new records, reset the form
            console.log('✅ Create successful, resetting form');
            setFormData({
              id: "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              date: new Date().toISOString().split('T')[0],
              time: new Date().toTimeString().slice(0, 5),
              region: user?.region || "",
              district: user?.district || "",
              regionId: user?.regionId || "",
              districtId: user?.districtId || "",
              latitude: 0,
              longitude: 0,
              location: "",
              status: "pending",
              inspector: {
                id: user?.id || "",
                name: user?.name || "",
                email: user?.email || ""
              },
              substationNumber: "",
              substationName: "",
              rating: "",
              transformerType: "PMT",
              transformerConditions: {
                namePlate: false,
                oilLeakage: "no",
                bushing: "intact",
                 notes: "",
                 photos: [],
                 namePlatePhotos: []
              },
              fuseConditions: {
                 fuseType: "intact",
                fuseHolder: "intact",
                notes: "",
                photos: []
              },
              earthingConditions: {
                earthingStatus: "intact",
                notes: "",
                photos: []
              },
              generalNotes: "",
              images: [],
              afterImages: []
            });
            setCapturedImages([]);
            setOfflineInspectionId(null);
            setLastSavedOffline(null);
          }
          
          // Pass the database response data (includes proper ID) to parent
          console.log('🚀 Calling onSubmit with response.data');
          onSubmit(response.data);
        } else {
          throw new Error(response.error || "Failed to submit");
        }
      }
    } catch (error: any) {
      console.error("Error submitting substation status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit substation status",
        variant: "destructive"
      });
      
      // Reset submission state on error
      setIsSubmitting(false);
      setIsSavingOffline(false);
    } finally {
      // Ensure states are reset
      setIsSubmitting(false);
      setIsSavingOffline(false);
    }
  };

  const handleSaveOffline = async () => {
    if (isOffline) {
      toast({
        title: "Already Offline",
        description: "You are already offline. Data will be saved automatically.",
      });
      return;
    }

    try {
      setIsSavingOffline(true);
      
      // Prepare inspection data for offline storage (including base64 images)
      const inspectionData = {
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Store all base64 images for offline storage
        images: formData.images || [],
        afterImages: formData.afterImages || [],
        transformerConditions: {
          ...formData.transformerConditions,
          photos: formData.transformerConditions.photos || [],
          namePlatePhotos: formData.transformerConditions.namePlatePhotos || []
        },
        fuseConditions: {
          ...formData.fuseConditions,
          photos: formData.fuseConditions.photos || []
        },
        earthingConditions: {
          ...formData.earthingConditions,
          photos: formData.earthingConditions.photos || []
        }
      };

      // Save inspection to offline storage
      const offlineId = await saveInspectionOffline(inspectionData);
      setOfflineInspectionId(offlineId);
      setLastSavedOffline(new Date());

      // Save photos to offline storage - just like overhead line
      if (formData.images && formData.images.length > 0) {
        for (let i = 0; i < formData.images.length; i++) {
          const base64Image = formData.images[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
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
      }

      if (formData.afterImages && formData.afterImages.length > 0) {
        for (let i = 0; i < formData.afterImages.length; i++) {
          const base64Image = formData.afterImages[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
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
      }
      
      // Save transformer condition photos
      if (formData.transformerConditions.photos && formData.transformerConditions.photos.length > 0) {
        for (let i = 0; i < formData.transformerConditions.photos.length; i++) {
          const base64Image = formData.transformerConditions.photos[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
            const filename = `transformer_${i + 1}_${Date.now()}.jpg`;
            await savePhotoOffline(
              offlineId,
              base64Image,
              filename,
              'correction',
              'image/jpeg'
            );
          }
        }
      }

      // Save name plate photos
      if (formData.transformerConditions.namePlatePhotos && formData.transformerConditions.namePlatePhotos.length > 0) {
        for (let i = 0; i < formData.transformerConditions.namePlatePhotos.length; i++) {
          const base64Image = formData.transformerConditions.namePlatePhotos[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
            const filename = `nameplate_${i + 1}_${Date.now()}.jpg`;
            await savePhotoOffline(
              offlineId,
              base64Image,
              filename,
              'correction',
              'image/jpeg'
            );
          }
        }
      }

      // Save fuse condition photos
      if (formData.fuseConditions.photos && formData.fuseConditions.photos.length > 0) {
        for (let i = 0; i < formData.fuseConditions.photos.length; i++) {
          const base64Image = formData.fuseConditions.photos[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
            const filename = `fuse_${i + 1}_${Date.now()}.jpg`;
            await savePhotoOffline(
              offlineId,
              base64Image,
              filename,
              'correction',
              'image/jpeg'
            );
          }
        }
      }

      // Save earthing condition photos
      if (formData.earthingConditions.photos && formData.earthingConditions.photos.length > 0) {
        for (let i = 0; i < formData.earthingConditions.photos.length; i++) {
          const base64Image = formData.earthingConditions.photos[i];
          if (base64Image && base64Image.startsWith('data:image/')) {
            const filename = `earthing_${i + 1}_${Date.now()}.jpg`;
            await savePhotoOffline(
              offlineId,
              base64Image,
              filename,
              'correction',
              'image/jpeg'
            );
          }
        }
      }
      
      toast({
        title: "Saved Offline",
        description: "Substation status with photos saved offline. Will sync when online.",
      });
      
    } catch (error: any) {
      console.error("Error saving offline:", error);
      toast({
        title: "Error",
        description: "Failed to save offline",
        variant: "destructive"
      });
    } finally {
      setIsSavingOffline(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Debug logging for form data
  console.log('🔍 Current formData state:', {
    transformerPhotos: formData.transformerConditions.photos,
    namePlatePhotos: formData.transformerConditions.namePlatePhotos,
    fusePhotos: formData.fuseConditions.photos,
    earthingPhotos: formData.earthingConditions.photos,
    generalPhotos: formData.images
  });

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Substation Status Inspection</h1>
          <p className="text-muted-foreground">Complete substation inspection and status assessment</p>
        </div>
        <OfflineBadge />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Essential details about the inspection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="region">Region *</Label>
                <Select
                  value={formData.region}
                  onValueChange={(value) => handleInputChange("region", value)}
                  required
                  disabled={isDistrictScopedUser}
                >
                  <SelectTrigger>
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

              <div>
                <Label htmlFor="district">District/Section *</Label>
                <Select
                  value={formData.district}
                  onValueChange={(value) => handleInputChange("district", value)}
                  required
                  disabled={isDistrictScopedUser || (!formData.region && !(user?.role === "ashsubt" || user?.role === "accsubt"))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select district/section" />
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

              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="substationNumber">Substation Number *</Label>
                <Input
                  id="substationNumber"
                  value={formData.substationNumber}
                  onChange={(e) => handleInputChange("substationNumber", e.target.value)}
                  placeholder="Enter substation number"
                  required
                />
              </div>

              <div>
                <Label htmlFor="substationName">Substation Name *</Label>
                <Input
                  id="substationName"
                  value={formData.substationName}
                  onChange={(e) => handleInputChange("substationName", e.target.value)}
                  placeholder="Enter substation name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="rating">Rating *</Label>
                <Input
                  id="rating"
                  value={formData.rating}
                  onChange={(e) => handleInputChange("rating", e.target.value)}
                  placeholder="e.g., 100kVA, 200kVA"
                  required
                />
              </div>

              <div>
                <Label htmlFor="transformerType">Transformer Type *</Label>
                <Select
                  value={formData.transformerType}
                  onValueChange={(value) => handleInputChange("transformerType", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select transformer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PMT">PMT</SelectItem>
                    <SelectItem value="GMT">GMT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* GPS Location */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>GPS Location</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  Get Location
                </Button>
              </div>
              
              {locationError && (
                <p className="text-sm text-red-500">{locationError}</p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => handleInputChange("latitude", parseFloat(e.target.value) || 0)}
                    placeholder="0.000000"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => handleInputChange("longitude", parseFloat(e.target.value) || 0)}
                    placeholder="0.000000"
                  />
                </div>
              </div>
              
              {gpsAccuracy && (
                <p className="text-sm text-muted-foreground">
                  GPS Accuracy: ±{gpsAccuracy.toFixed(1)} meters
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="location">Location Description</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder="Enter location description"
              />
            </div>
          </CardContent>
        </Card>

        {/* Transformer Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Transformer Conditions</CardTitle>
            <CardDescription>Assess the current state of the transformer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
                               <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="namePlate"
                  checked={formData.transformerConditions.namePlate}
                  onCheckedChange={(checked) => 
                    handleNestedChange("transformerConditions", "namePlate", checked)
                  }
                />
                <Label htmlFor="namePlate">Name Plate Present</Label>
                  </div>

                  {/* Name Plate Photos - Show when Name Plate is checked OR when photos exist */}
                  {(formData.transformerConditions.namePlate || (formData.transformerConditions.namePlatePhotos && formData.transformerConditions.namePlatePhotos.length > 0)) && (
                    <div className="pt-2">
                      {!formData.transformerConditions.namePlate && formData.transformerConditions.namePlatePhotos && formData.transformerConditions.namePlatePhotos.length > 0 && (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm text-blue-700">
                            ⚠️ Name plate photos exist but "Name Plate Present" is not checked. 
                            Check the box above to enable editing these photos.
                          </p>
                        </div>
                      )}
                      <PhotoCapture
                        title="Name Plate Photos"
                        description="Take photos to document the name plate details"
                        photos={formData.transformerConditions.namePlatePhotos || []}
                        onPhotosChange={(photos) => 
                          handleNestedChange("transformerConditions", "namePlatePhotos", photos)
                        }
                        section="name plate"
                        gpsLocation={`${formData.latitude}, ${formData.longitude}`}
                        gpsAccuracy={gpsAccuracy}
                        maxPhotos={3}
                      />
                    </div>
                  )}
              </div>

              <div>
                <Label htmlFor="oilLeakage">Oil Leakage</Label>
                <Select
                  value={formData.transformerConditions.oilLeakage}
                  onValueChange={(value) => 
                    handleNestedChange("transformerConditions", "oilLeakage", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select oil leakage status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                               {/* Oil Leakage Photos - Show when Oil Leakage is "yes" OR when photos exist */}
                {(formData.transformerConditions.oilLeakage === "yes" || (formData.transformerConditions.photos && formData.transformerConditions.photos.length > 0)) && (
                  <div className="pt-2">
                    {formData.transformerConditions.oilLeakage !== "yes" && formData.transformerConditions.photos && formData.transformerConditions.photos.length > 0 && (
                      <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                        <p className="text-sm text-orange-700">
                          ⚠️ Oil leakage photos exist but "Oil Leakage" is not set to "Yes". 
                          Set to "Yes" above to enable editing these photos.
                        </p>
                      </div>
                    )}
                    <PhotoCapture
                      title="Oil Leakage Photos"
                      description="Take photos to document the oil leakage issue"
                      photos={formData.transformerConditions.photos || []}
                      onPhotosChange={(photos) => 
                        handleNestedChange("transformerConditions", "photos", photos)
                      }
                      section="oil leakage"
                      gpsLocation={`${formData.latitude}, ${formData.longitude}`}
                      gpsAccuracy={gpsAccuracy}
                      maxPhotos={5}
                    />
                  </div>
                )}

              <div>
                <Label htmlFor="bushing">Bushing Condition</Label>
                <Select
                  value={formData.transformerConditions.bushing}
                  onValueChange={(value) => 
                    handleNestedChange("transformerConditions", "bushing", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bushing condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broken">Broken</SelectItem>
                    <SelectItem value="cracked">Cracked</SelectItem>
                    <SelectItem value="leaking_oil">Leaking Oil</SelectItem>
                    <SelectItem value="intact">Intact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="transformerNotes">Transformer Notes</Label>
                <Textarea
                  id="transformerNotes"
                  value={formData.transformerConditions.notes}
                  onChange={(e) => 
                    handleNestedChange("transformerConditions", "notes", e.target.value)
                  }
                  placeholder="Add notes about transformer conditions..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fuse Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Fuse Conditions</CardTitle>
            <CardDescription>Assess the current state of fuses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                 <Label htmlFor="fuseType">Fuse Status</Label>
                <Select
                  value={formData.fuseConditions.fuseType}
                  onValueChange={(value) => 
                    handleNestedChange("fuseConditions", "fuseType", value)
                  }
                >
                  <SelectTrigger>
                     <SelectValue placeholder="Select fuse status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linked">Linked</SelectItem>
                     <SelectItem value="intact">Intact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fuseHolder">Fuse Holder Condition</Label>
                <Select
                  value={formData.fuseConditions.fuseHolder}
                  onValueChange={(value) => 
                    handleNestedChange("fuseConditions", "fuseHolder", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fuse holder condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loose">Loose</SelectItem>
                    <SelectItem value="intact">Intact</SelectItem>
                    <SelectItem value="burnt">Burnt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fuseNotes">Fuse Notes</Label>
                <Textarea
                  id="fuseNotes"
                  value={formData.fuseConditions.notes}
                  onChange={(e) => 
                    handleNestedChange("fuseConditions", "notes", e.target.value)
                  }
                  placeholder="Add notes about fuse conditions..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fuse Conditions Photos */}
        <PhotoCapture
          title="Fuse Conditions Photos"
          description="Take photos to document fuse conditions and holder status"
          photos={formData.fuseConditions.photos || []}
          onPhotosChange={(photos) => 
            handleNestedChange("fuseConditions", "photos", photos)
          }
          section="fuse conditions"
          gpsLocation={`${formData.latitude}, ${formData.longitude}`}
          gpsAccuracy={gpsAccuracy}
          maxPhotos={5}
        />

        {/* Earthing Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Earthing Conditions</CardTitle>
            <CardDescription>Assess the earthing system status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="earthingStatus">Earthing Status</Label>
                <Select
                  value={formData.earthingConditions.earthingStatus}
                  onValueChange={(value) => 
                    handleNestedChange("earthingConditions", "earthingStatus", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select earthing status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cut">Cut</SelectItem>
                    <SelectItem value="intact">Intact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="earthingNotes">Earthing Notes</Label>
                <Textarea
                  id="earthingNotes"
                  value={formData.earthingConditions.notes}
                  onChange={(e) => 
                    handleNestedChange("earthingConditions", "notes", e.target.value)
                  }
                  placeholder="Add notes about earthing conditions..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Earthing Conditions Photos */}
        <PhotoCapture
          title="Earthing Conditions Photos"
          description="Take photos to document earthing system status"
          photos={formData.earthingConditions.photos || []}
          onPhotosChange={(photos) => 
            handleNestedChange("earthingConditions", "photos", photos)
          }
          section="earthing conditions"
          gpsLocation={`${formData.latitude}, ${formData.longitude}`}
          gpsAccuracy={gpsAccuracy}
          maxPhotos={5}
        />

        {/* General Notes */}
        <Card>
          <CardHeader>
            <CardTitle>General Notes</CardTitle>
            <CardDescription>Additional observations and recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.generalNotes}
              onChange={(e) => handleInputChange("generalNotes", e.target.value)}
              placeholder="Add general notes, observations, and recommendations..."
              rows={4}
            />
          </CardContent>
        </Card>

                 {/* Photos */}
         <Card>
           <CardHeader>
             <CardTitle>Photos</CardTitle>
             <CardDescription>Take photos to document the inspection</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             {/* Camera Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
               {!isCapturing ? (
                 <Button
                   type="button"
                   variant="outline"
                   onClick={startCamera}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                 >
                   <Camera className="h-4 w-4" />
                    <span className="hidden sm:inline">Start Camera</span>
                    <span className="sm:hidden">Camera</span>
                 </Button>
               ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                   <Button
                     type="button"
                     variant="outline"
                     onClick={handlePhotoCapture}
                     disabled={!isVideoReady}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                   >
                     <Camera className="h-4 w-4" />
                      <span className="hidden sm:inline">Take Photo</span>
                      <span className="sm:hidden">Capture</span>
                   </Button>
                   <Button
                     type="button"
                     variant="outline"
                     onClick={stopCamera}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                   >
                     <X className="h-4 w-4" />
                      <span className="hidden sm:inline">Stop Camera</span>
                      <span className="sm:hidden">Stop</span>
                   </Button>
                 </div>
               )}

                {/* File Upload Button */}
                <div className="relative w-full sm:w-auto">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(file);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload Photo</span>
                    <span className="sm:hidden">Upload</span>
                  </Button>
                </div>
               
               {isOffline && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-muted-foreground w-full sm:w-auto">
                   <WifiOff className="h-4 w-4" />
                    <span className="hidden sm:inline">Photos will be saved offline</span>
                    <span className="sm:hidden">Offline mode</span>
                 </div>
               )}
             </div>

             {/* Camera View */}
             {isCapturing && (
               <div className="relative">
                 <video
                   ref={videoRef}
                   autoPlay
                   playsInline
                   muted
                   className="w-full max-w-full sm:max-w-md mx-auto rounded-lg border"
                   style={{ transform: 'scaleX(-1)' }} // Mirror the camera view
                 />
                 {!isVideoReady && (
                   <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                     <div className="text-center">
                       <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                       <p className="text-sm text-muted-foreground">Initializing camera...</p>
                     </div>
                   </div>
                 )}
               </div>
             )}

            {capturedImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {capturedImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={getImageSource(image)}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                      onError={(e) => {
                        console.error('Failed to load image:', image);
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDE5VjVhMiAyIDAgMCAwLTItMkg1YTIgMiAwIDAgMC0yIDJ2MTRhMiAyIDAgMCAwIDIgMmgxNGEyIDIgMCAwIDAgMi0yWiIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNOC41IDE0LjVMMTIgMTFMMTUuNSAxNC41IiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0xMiAxMXYzLjUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+';
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {capturedImages.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Camera className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm sm:text-base">No photos taken yet</p>
                <p className="text-xs sm:text-sm">Take photos to document the inspection</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          
          
          <Button
            type="submit"
            disabled={isSubmitting || isSavingOffline}
            className="min-w-[120px]"
            onClick={(e) => {
              // Additional click protection
              if (isSubmitting || isSavingOffline) {
                e.preventDefault();
                console.log('🚫 Submit button click blocked - already in progress');
                return;
              }
            }}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOffline ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Offline
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </div>

        {/* Offline Status - Only show when offline */}
        {offlineInspectionId && isOffline && (
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Database className="h-4 w-4" />
              <span className="font-medium">Saved Offline</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Inspection ID: {offlineInspectionId}
              {lastSavedOffline && (
                <span className="ml-2">
                  • Saved: {lastSavedOffline.toLocaleString()}
                </span>
              )}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
