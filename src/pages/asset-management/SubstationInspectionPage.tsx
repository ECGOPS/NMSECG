import { useState, useEffect, useMemo, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { v4 as uuidv4 } from "uuid";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ConditionStatus, InspectionItem } from "@/lib/types";
import { SubstationInspection } from "@/lib/asset-types";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useData } from "@/contexts/DataContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useNavigate, useParams, Link } from "react-router-dom";
import { SubstationInspectionService } from "@/services/SubstationInspectionService";
import { ChevronLeft, ChevronRight, ChevronRightIcon, Camera, Upload, X, Wifi, WifiOff, Save, Database, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Webcam from "react-webcam";
import { PhotoService } from "@/services/PhotoService";
import { OfflineBadge } from "@/components/common/OfflineBadge";

interface Category {
  id: string;
  name: string;
  items: InspectionItem[];
}

export default function SubstationInspectionPage() {
  const { user } = useAzureADAuth();
  const { regions, districts, saveInspection, getSavedInspection, savedInspections } = useData();
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
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const inspectionService = SubstationInspectionService.getInstance();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regionId, setRegionId] = useState<string>("");
  const [districtId, setDistrictId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showFullImage, setShowFullImage] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toISOString().split('T')[1].slice(0,5),
    inspectionDate: new Date().toISOString().split('T')[0],
    substationNo: "",
    substationName: "",
    type: "indoor" as "indoor" | "outdoor",
    substationType: "primary" as "primary" | "secondary",
    location: "",
    voltageLevel: "",
    status: "Pending",
    remarks: "",
    cleanDustFree: undefined,
    protectionButtonEnabled: undefined,
    recloserButtonEnabled: undefined,
    groundEarthButtonEnabled: undefined,
    acPowerOn: undefined,
    batteryPowerLow: undefined,
    handleLockOn: undefined,
    remoteButtonEnabled: undefined,
    gasLevelLow: undefined,
    earthingArrangementAdequate: undefined,
    noFusesBlown: undefined,
    noDamageToBushings: undefined,
    noDamageToHVConnections: undefined,
    insulatorsClean: undefined,
    paintworkAdequate: undefined,
    ptFuseLinkIntact: undefined,
    noCorrosion: undefined,
    silicaGelCondition: undefined,
    correctLabelling: undefined,
    region: "",
    district: "",
    regionId: "",
    districtId: "",
    items: [],
    generalBuilding: [],
    controlEquipment: [],
    basement: [],
    powerTransformer: [],
    outdoorEquipment: [],
    siteCondition: [],
    gpsLocation: ""
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const didInit = useRef(false);
  const didEditInit = useRef(false);
  const [afterCapturedImages, setAfterCapturedImages] = useState<string[]>([]);

  // Offline functionality state
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineInspectionId, setOfflineInspectionId] = useState<string | null>(null);
  const [lastSavedOffline, setLastSavedOffline] = useState<Date | null>(null);

  // Add video constraints
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: isMobile ? "environment" : "user"
  };

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

  // Handle camera error
  const handleCameraError = (error: string | DOMException) => {
    console.error('Camera error:', error);
    const errorMessage = error.toString();
    setCameraError(errorMessage);
    toast.error("Failed to access camera. Please check your camera permissions.");
    
    // Additional debugging
    if (error instanceof DOMException) {
      console.error('DOM Exception details:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
    }
  };

  // Capture image from webcam
  const captureImage = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImages(prev => [...prev, imageSrc]);
        setIsCapturing(false);
        setCameraError(null);
      }
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Update formData when capturedImages changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      images: capturedImages
    }));
  }, [capturedImages]);

  // Add the photo section to the form
  const renderPhotoSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
        <CardDescription>Take or upload photos of the inspection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCapturing(true)}
              className="w-full sm:flex-1"
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Photos
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </Button>
          </div>

          {capturedImages.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {capturedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Inspection image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer"
                    onClick={() => setShowFullImage(image)}
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
  );

  // Add handlers for after-inspection photos
  const [isCapturingAfter, setIsCapturingAfter] = useState(false);
  const afterWebcamRef = useRef<Webcam>(null);
  const captureAfterImage = async () => {
    console.log('🔍 Attempting to capture after inspection image...');
    if (afterWebcamRef.current) {
      try {
        const imageSrc = afterWebcamRef.current.getScreenshot();
        if (imageSrc) {
          console.log('✅ After inspection image captured successfully');
          setAfterCapturedImages(prev => [...prev, imageSrc]);
          setIsCapturingAfter(false);
          setCameraError(null);
        } else {
          console.error('❌ Failed to capture image - no image source returned');
          setCameraError('Failed to capture image. Please try again.');
        }
      } catch (error) {
        console.error('❌ Error capturing after inspection image:', error);
        setCameraError(`Capture error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.error('❌ After webcam reference is null');
      setCameraError('Camera not initialized. Please try again.');
    }
  };
  const handleAfterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAfterCapturedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    }
  };
  const removeAfterImage = (index: number) => {
    setAfterCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Update formData when afterCapturedImages changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      afterImages: afterCapturedImages
    }));
  }, [afterCapturedImages]);

  // Add the after-inspection photo section
  const renderAfterPhotoSection = () => {
    console.log('🔍 Rendering after inspection photo section');
    return (
      <Card>
        <CardHeader>
          <CardTitle>After Inspection Photos</CardTitle>
          <CardDescription>Take or upload photos after inspection corrections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  console.log('🔘 Take After Inspection Photo button clicked');
                  setIsCapturingAfter(true);
                }}
                className="w-full sm:flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                onClick={() => document.getElementById('after-file-upload')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Photos
                <input
                  id="after-file-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleAfterFileUpload}
                />
              </Button>
            </div>
            {afterCapturedImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {afterCapturedImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`After inspection image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg cursor-pointer"
                      onClick={() => setShowFullImage(image)}
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
  };

  // Update item status
  const updateItemStatus = (categoryIndex: number, itemIndex: number, status: ConditionStatus) => {
    setCategories(prevCategories => {
      const newCategories = [...prevCategories];
      const updatedItems = [...newCategories[categoryIndex].items];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], status };
      newCategories[categoryIndex] = {
        ...newCategories[categoryIndex],
        items: updatedItems,
      };
      const categoryName = newCategories[categoryIndex].name.toLowerCase().replace(" ", "");
      const categoryKey = categoryName as keyof SubstationInspection;
      setFormData(prev => ({
        ...prev,
        [categoryKey]: newCategories[categoryIndex].items,
      }));
      return newCategories;
    });
  };

  // Add calculateStatusSummary function
  const calculateStatusSummary = () => {
    // Get items from each category separately to avoid duplication
    const generalBuildingItems = categories.find(c => c.name === "General Building")?.items || [];
    const controlEquipmentItems = categories.find(c => c.name === "Control Equipment")?.items || [];
    const powerTransformerItems = categories.find(c => c.name === "Power Transformer")?.items || [];
    const outdoorEquipmentItems = categories.find(c => c.name === "Outdoor Equipment")?.items || [];

    // Calculate totals for each status
    const total = generalBuildingItems.length + controlEquipmentItems.length + 
                 powerTransformerItems.length + outdoorEquipmentItems.length;
    
    const good = [
      ...generalBuildingItems,
      ...controlEquipmentItems,
      ...powerTransformerItems,
      ...outdoorEquipmentItems
    ].filter(item => item.status === "good").length;
    
    const bad = [
      ...generalBuildingItems,
      ...controlEquipmentItems,
      ...powerTransformerItems,
      ...outdoorEquipmentItems
    ].filter(item => item.status === "bad").length;

    return { total, good, bad };
  };

  // Initialize region and district based on user's assigned values
  useEffect(() => {
    if (
      user?.role === "district_engineer" ||
      user?.role === "regional_engineer" ||
      user?.role === "regional_general_manager" ||
      user?.role === "technician" ||
      user?.role === "district_manager"
    ) {
      // Find region ID based on user's assigned region name
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setRegionId(userRegion.id);
        setFormData(prev => ({ ...prev, region: userRegion.name }));

        // For district engineer, technician, and district manager, also set the district
        if ((user.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district) {
          const userDistrict = districts.find(d => 
            d.regionId === userRegion.id && d.name === user.district
          );
          if (userDistrict) {
            setDistrictId(userDistrict.id);
            setFormData(prev => ({ ...prev, district: userDistrict.name }));
          }
        }
        // For regional_engineer and regional_general_manager, set district to first in region if available
        if ((user.role === "regional_engineer" || user.role === "regional_general_manager") && !user.district) {
          const regionDistricts = districts.filter(d => d.regionId === userRegion.id);
          if (regionDistricts.length > 0) {
            setDistrictId(regionDistricts[0].id);
            setFormData(prev => ({ ...prev, district: regionDistricts[0].name }));
          }
        }
      }
    }
  }, [user, regions, districts]);

  // Ensure district engineer's, technician's, and district manager's district is always set correctly
  useEffect(() => {
    if ((user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        const userDistrict = districts.find(d => 
          d.regionId === userRegion.id && d.name === user.district
        );
        if (userDistrict) {
          setRegionId(userRegion.id);
          setDistrictId(userDistrict.id);
          setFormData(prev => ({ 
            ...prev, 
            region: userRegion.name,
            district: userDistrict.name 
          }));
        }
      }
    }
  }, [user, regions, districts]);

  // Filter regions and districts based on user role
  const filteredRegions = (() => {
    if (!user) return regions;
    
    // Global engineers and system admins can see all regions
    if (user.role === "global_engineer" || user.role === "system_admin") {
      return regions;
    }
    
    // Regional engineers, regional general managers, and project engineers can only see their assigned region
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
  
  const filteredDistricts = (() => {
    if (!regionId) {
      // If no region selected, show districts based on user role
      if (user?.role === "ashsubt") {
        return districts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
      }
      if (user?.role === "accsubt") {
        return districts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
      }
      return [];
    }
    
    return districts.filter(d => {
      // First check if district belongs to selected region
      if (d.regionId !== regionId) return false;
      
      // For district engineers, technicians, and district managers, only show their assigned district
      if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") {
        return d.name === user.district;
      }
      
      // For regional engineers, regional general managers, project engineers, ashsubt, and accsubt, show all districts in the selected region
      if (user?.role === "regional_engineer" || user?.role === "regional_general_manager" || user?.role === "project_engineer" || user?.role === "ashsubt" || user?.role === "accsubt") {
        return true;
      }
      
      // For global engineers and system admins, show all districts in the selected region
      if (user?.role === "global_engineer" || user?.role === "system_admin") {
        return true;
      }
      
      // For other roles, show all districts in the selected region
      return true;
    });
  })();

  // Handle region change - prevent district engineers, technicians, and district managers from changing region
  const handleRegionChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager" || user?.role === "regional_general_manager") return; // Prevent district engineers, technicians, district managers, and regional general managers from changing region
    
    setRegionId(value);
    const region = regions.find(r => r.id === value);
    setFormData(prev => ({ ...prev, region: region?.name || "" }));
    setDistrictId("");
    setFormData(prev => ({ ...prev, district: "" }));
  };

  // Handle district change - prevent district engineers, technicians, and district managers from changing district
  const handleDistrictChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") return; // Prevent district engineers, technicians, and district managers from changing district
    
    setDistrictId(value);
    const district = districts.find(d => d.id === value);
    setFormData(prev => ({ ...prev, district: district?.name || "" }));
  };

  // Handle generic form input changes
  const handleInputChange = (field: keyof SubstationInspection, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Initialize formData with categories
  useEffect(() => {
    if (id) {
      // Edit mode - load existing inspection
      const inspection = getSavedInspection(id);
      if (inspection) {
        console.log('Loading inspection for edit:', inspection); // Debug log

        // Set formData with all inspection data
        setFormData({
          date: inspection.date || new Date().toISOString().split('T')[0],
          time: inspection.time || (inspection.createdAt ? new Date(inspection.createdAt).toISOString().split('T')[1].slice(0,5) : new Date().toISOString().split('T')[1].slice(0,5)),
          inspectionDate: inspection.inspectionDate || new Date().toISOString().split('T')[0],
          substationNo: inspection.substationNo || "",
          substationName: inspection.substationName || "",
          type: inspection.type || "indoor",
          substationType: inspection.substationType || "primary",
          location: inspection.location || "",
          voltageLevel: inspection.voltageLevel || "",
          status: inspection.status || "Pending",
          remarks: inspection.remarks || "",
          cleanDustFree: inspection.cleanDustFree,
          protectionButtonEnabled: inspection.protectionButtonEnabled,
          recloserButtonEnabled: inspection.recloserButtonEnabled,
          groundEarthButtonEnabled: inspection.groundEarthButtonEnabled,
          acPowerOn: inspection.acPowerOn,
          batteryPowerLow: inspection.batteryPowerLow,
          handleLockOn: inspection.handleLockOn,
          remoteButtonEnabled: inspection.remoteButtonEnabled,
          gasLevelLow: inspection.gasLevelLow,
          earthingArrangementAdequate: inspection.earthingArrangementAdequate,
          noFusesBlown: inspection.noFusesBlown,
          noDamageToBushings: inspection.noDamageToBushings,
          noDamageToHVConnections: inspection.noDamageToHVConnections,
          insulatorsClean: inspection.insulatorsClean,
          paintworkAdequate: inspection.paintworkAdequate,
          ptFuseLinkIntact: inspection.ptFuseLinkIntact,
          noCorrosion: inspection.noCorrosion,
          silicaGelCondition: inspection.silicaGelCondition,
          correctLabelling: inspection.correctLabelling,
          region: inspection.region || "",
          district: inspection.district || "",
          regionId: inspection.regionId || "",
          districtId: inspection.districtId || "",
          items: inspection.items || [],
          generalBuilding: inspection.generalBuilding || [],
          controlEquipment: inspection.controlEquipment || [],
          basement: inspection.basement || [],
          powerTransformer: inspection.powerTransformer || [],
          outdoorEquipment: inspection.outdoorEquipment || [],
          siteCondition: inspection.siteCondition || [],
          gpsLocation: inspection.gpsLocation || "",
          images: inspection.images || [],
          afterImages: inspection.afterImages || []
        });

        // Set region and district IDs
        if (inspection.regionId) {
          setRegionId(inspection.regionId);
        }
        if (inspection.districtId) {
          setDistrictId(inspection.districtId);
        }

        // Create categories array directly from inspection data
        const categoriesFromInspection: Category[] = [
          {
            id: "site-condition",
            name: "Site Condition",
            items: (inspection.siteCondition || []).map(item => ({
              id: item.id,
              name: item.name,
              category: item.category || "site condition", // Use saved category if available
              status: item.status,
              remarks: item.remarks || ""
            }))
          },
          {
            id: "general-building",
            name: "General Building",
            items: (inspection.generalBuilding || []).map(item => ({
              id: item.id,
              name: item.name,
              category: item.category || "general building",
              status: item.status,
              remarks: item.remarks || ""
            }))
          },
          {
            id: "control-equipment",
            name: "Control Equipment",
            items: (inspection.controlEquipment || []).map(item => ({
              id: item.id,
              name: item.name,
              category: item.category || "control equipment",
              status: item.status,
              remarks: item.remarks || ""
            }))
          },
          {
            id: "basement",
            name: "Basement",
            items: (inspection.basement || []).map(item => ({
              id: item.id,
              name: item.name,
              category: item.category || "basement",
              status: item.status,
              remarks: item.remarks || ""
            }))
          },
          {
            id: "power-transformer",
            name: "Power Transformer",
            items: (inspection.powerTransformer || []).map(item => ({
              id: item.id,
              name: item.name,
              category: item.category || "power transformer",
              status: item.status,
              remarks: item.remarks || ""
            }))
          },
          {
            id: "outdoor-equipment",
            name: "Outdoor Equipment",
            items: (inspection.outdoorEquipment || []).map(item => ({
              id: item.id,
              name: item.name,
              category: item.category || "outdoor equipment",
              status: item.status,
              remarks: item.remarks || ""
            }))
          }
        ];

        console.log('Setting categories from inspection:', categoriesFromInspection); // Debug log
        setCategories(categoriesFromInspection);

        // Update formData with the items from categoriesFromInspection
        setFormData(prev => ({
          ...prev,
          siteCondition: categoriesFromInspection.find(c => c.id === 'site-condition')?.items || [],
          generalBuilding: categoriesFromInspection.find(c => c.id === 'general-building')?.items || [],
          controlEquipment: categoriesFromInspection.find(c => c.id === 'control-equipment')?.items || [],
          basement: categoriesFromInspection.find(c => c.id === 'basement')?.items || [],
          powerTransformer: categoriesFromInspection.find(c => c.id === 'power-transformer')?.items || [],
          outdoorEquipment: categoriesFromInspection.find(c => c.id === 'outdoor-equipment')?.items || [],
          remarks: inspection.remarks || "",
          gpsLocation: inspection.gpsLocation || "",
          images: inspection.images || [],
          afterImages: inspection.afterImages || []
        }));
      }
    } else {
      // Create mode - only initialize once
      if (didInit.current) return;
      didInit.current = true;
      const defaultItems = [
        {
          id: "site-condition",
          name: "Site Condition",
          items: [
            { id: `sc-fencing-${uuidv4()}`, name: "Adequate protection against unauthorised access (Fencing)", status: undefined, remarks: "", category: "site condition" },
            { id: `sc-gate-${uuidv4()}`, name: "Gate/Locks/Padlocks", status: undefined, remarks: "", category: "site condition" },
            { id: `sc-gutter-${uuidv4()}`, name: "Guttering, drains", status: undefined, remarks: "", category: "site condition" },
            { id: `sc-trench-${uuidv4()}`, name: "Trenches and Trench covered", status: undefined, remarks: "", category: "site condition" },
            { id: `sc-lighting-${uuidv4()}`, name: "Compound/Outside Lighting", status: undefined, remarks: "", category: "site condition" },
            { id: `sc-compound-${uuidv4()}`, name: "Compound (clean or weedy)", status: undefined, remarks: "", category: "site condition" },
            { id: `sc-backyard-${uuidv4()}`, name: "Substation backyard (clean or weedy)", status: undefined, remarks: "", category: "site condition" },
            { id: `sc-tagging-${uuidv4()}`, name: "Tagging/Warning plate on equipment", status: undefined, remarks: "", category: "site condition" },
          ],
        },
        {
          id: "general-building",
          name: "General Building",
          items: [
            { id: `gb-housekeeping-${uuidv4()}`, name: "House keeping", status: undefined, remarks: "", category: "general building" },
            { id: `gb-paintwork-${uuidv4()}`, name: "Paintwork", status: undefined, remarks: "", category: "general building" },
            { id: `gb-roof-${uuidv4()}`, name: "Roof leakage", status: undefined, remarks: "", category: "general building" },
            { id: `gb-doors-${uuidv4()}`, name: "Doors locks/Hinges", status: undefined, remarks: "", category: "general building" },
            { id: `gb-washroom-${uuidv4()}`, name: "Washroom Cleanliness", status: undefined, remarks: "", category: "general building" },
            { id: `gb-toilet-${uuidv4()}`, name: "Toilet Facility condition", status: undefined, remarks: "", category: "general building" },
            { id: `gb-water-${uuidv4()}`, name: "Water flow/ availability", status: undefined, remarks: "", category: "general building" },
            { id: `gb-ac-${uuidv4()}`, name: "AC Unit working", status: undefined, remarks: "", category: "general building" },
            { id: `gb-lighting-${uuidv4()}`, name: "Inside Lighting", status: undefined, remarks: "", category: "general building" },
            { id: `gb-fire-${uuidv4()}`, name: "Fire Extinguisher available", status: undefined, remarks: "", category: "general building" },
            { id: `gb-logo-${uuidv4()}`, name: "Logo and signboard available and on equipment", status: undefined, remarks: "", category: "general building" },
          ],
        },
        {
          id: "control-equipment",
          name: "Control Equipment",
          items: [
            { id: `ce-cabinet-${uuidv4()}`, name: "Control Cabinet Clean", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-cable-11kv-${uuidv4()}`, name: "General outlook of cable termination 11KV", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-cable-33kv-${uuidv4()}`, name: "General outlook of cable termination 33KV", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-meters-${uuidv4()}`, name: "Ammeters/Voltmeters functioning", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-annunciators-${uuidv4()}`, name: "Annunciators functioning", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-heaters-${uuidv4()}`, name: "Heaters operation", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-labelling-${uuidv4()}`, name: "Labelling Clear", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-alarm-${uuidv4()}`, name: "Alarm", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-sf6-${uuidv4()}`, name: "SF6 gas level", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-spring-${uuidv4()}`, name: "All closing Spring Charge motor working", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-relay-${uuidv4()}`, name: "Relay flags/Indication", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-semaphore-${uuidv4()}`, name: "Semaphore indications", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-battery-outlook-${uuidv4()}`, name: "Battery bank outlook", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-battery-level-${uuidv4()}`, name: "Battery electrolyte level", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-battery-voltage-${uuidv4()}`, name: "Battery voltage", status: undefined, remarks: "", category: "control equipment" },
          ],
        },
        {
          id: "basement",
          name: "Basement",
          items: [
            { id: `bs-lighting-${uuidv4()}`, name: "Lighting", status: undefined, remarks: "", category: "basement" },
            { id: `bs-cable-${uuidv4()}`, name: "Cable condition", status: undefined, remarks: "", category: "basement" },
            { id: `bs-flood-${uuidv4()}`, name: "Flooded basement", status: undefined, remarks: "", category: "basement" },
          ],
        },
        {
          id: "power-transformer",
          name: "Power Transformer",
          items: [
            { id: `pt-outlook-${uuidv4()}`, name: "General outlook, No corrosion of fans, radiators", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-bushing-${uuidv4()}`, name: "Transformer bushing (check for flashover or dirt)", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-oil-level-${uuidv4()}`, name: "Oil Level gauge", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-oil-leak-${uuidv4()}`, name: "Oil leakage", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-thermometer-${uuidv4()}`, name: "Themometer", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-gas-pressure-${uuidv4()}`, name: "Gas presure indicator working", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-silica-${uuidv4()}`, name: "Silica gel", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-body-ground-${uuidv4()}`, name: "Trafo body earthed/grounded", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-neutral-ground-${uuidv4()}`, name: "Neutral point earthed/grounded", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-fans-${uuidv4()}`, name: "Fans operating correctly", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-oltc-oil-${uuidv4()}`, name: "OLTC Oil level", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-oltc-leak-${uuidv4()}`, name: "Any leakage OLTC", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-oltc-heaters-${uuidv4()}`, name: "Heaters in OLTC, Marshalling box working", status: undefined, remarks: "", category: "power transformer" },
          ],
        },
        {
          id: "outdoor-equipment",
          name: "Outdoor Equipment",
          items: [
            { id: `oe-disconnect-status-${uuidv4()}`, name: "Disconnect switch properly closed/open", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-disconnect-latch-${uuidv4()}`, name: "Disconnect switch (check latching allignmet)", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-disconnect-porcelain-${uuidv4()}`, name: "Disconnect switch porcelain (check for dirt or flashover)", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-disconnect-motor-${uuidv4()}`, name: "Disconnect switch motor mechanism functioning", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-disconnect-handle-${uuidv4()}`, name: "Disconnect switch operating handle damage", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-disconnect-heaters-${uuidv4()}`, name: "Heaters in Disconnect switch box working", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-arrester-porcelain-${uuidv4()}`, name: "Lighting/Surge Arrestor porcelain dusty", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-arrester-counter-${uuidv4()}`, name: "Lighting/Surge Arrestor counter functioning", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-ct-bushing-${uuidv4()}`, name: "CT Bushing (check for dirt or flashover)", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-vt-bushing-${uuidv4()}`, name: "VT Bushing (check for dirt or flashover)", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-cb-sf6-${uuidv4()}`, name: "CB check for SF6 gas level", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-cb-rust-${uuidv4()}`, name: "Check CB Housing for rust", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-cb-heaters-${uuidv4()}`, name: "Heaters in CB Housing working", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-cable-term-${uuidv4()}`, name: "Check all Cable termination", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-clamps-${uuidv4()}`, name: "Inspect all Clamps", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-hissing-${uuidv4()}`, name: "Hissing Noise", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-earthing-${uuidv4()}`, name: "All equipment and system earthing secured", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-station-trans-${uuidv4()}`, name: "General condition of the station transformer", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-earthing-trans-${uuidv4()}`, name: "General condition of the NGR/Earthing transformer", status: undefined, remarks: "", category: "outdoor equipment" },
          ],
        },
      ];
      
      setCategories(defaultItems);
      setFormData(prev => ({
        ...prev,
        items: [],
        siteCondition: defaultItems[0].items,
        generalBuilding: defaultItems[1].items,
        controlEquipment: defaultItems[2].items,
        basement: defaultItems[3].items,
        powerTransformer: defaultItems[4].items,
        outdoorEquipment: defaultItems[5].items,
      }));
    }
  }, [id, getSavedInspection]);

  // Update item remarks
  const updateItemRemarks = (categoryIndex: number, itemIndex: number, remarks: string) => {
    setCategories(prevCategories => {
      const newCategories = [...prevCategories];
      newCategories[categoryIndex] = {
        ...newCategories[categoryIndex],
        items: newCategories[categoryIndex].items.map((item, index) =>
          index === itemIndex ? { ...item, remarks } : item
        ),
      };
      const categoryName = newCategories[categoryIndex].name.toLowerCase().replace(" ", "");
      const categoryKey = categoryName as keyof SubstationInspection;
      setFormData(prev => ({
        ...prev,
        [categoryKey]: newCategories[categoryIndex].items,
      }));
      return newCategories;
    });
  };

  // Add online status listener
  useEffect(() => {
    const handleOnlineStatusChange = () => {
      // Online status is now managed by the offline context
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!regionId || !districtId) {
      toast.error("Region and District are required.");
      setIsSubmitting(false);
      return;
    }

    // Validate location fields
    if (!formData.location || formData.location.trim() === '') {
      toast.error("Location description is required.");
      setIsSubmitting(false);
      return;
    }

    if (!formData.gpsLocation || formData.gpsLocation.trim() === '') {
      toast.error("GPS Location is required.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Upload photos first
      const photoService = PhotoService.getInstance();
      const uploadedPhotos: string[] = [];
      const uploadedAfterPhotos: string[] = [];
      
      // Upload before images
      if (capturedImages && capturedImages.length > 0) {
        console.log(`📸 Uploading ${capturedImages.length} before photos...`);
        
        for (let i = 0; i < capturedImages.length; i++) {
          const base64Image = capturedImages[i];
          console.log(`[FormSubmit] Processing image ${i + 1}:`, { length: base64Image.length, startsWith: base64Image.substring(0, 30) });
          
          // Generate a unique temporary ID for the inspection
          const tempInspectionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-before-${i}`;
          console.log(`[FormSubmit] Generated temp ID:`, tempInspectionId);
          
          const uploadResult = await photoService.uploadPhoto(
            base64Image,
            tempInspectionId,
            'substation-inspection'
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
      
      // Upload after images
      if (afterCapturedImages && afterCapturedImages.length > 0) {
        console.log(`📸 Uploading ${afterCapturedImages.length} after photos...`);
        
        for (let i = 0; i < afterCapturedImages.length; i++) {
          const base64Image = afterCapturedImages[i];
          
          // Generate a unique temporary ID for the inspection
          const tempInspectionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-after-${i}`;
          
          const uploadResult = await photoService.uploadPhoto(
            base64Image,
            tempInspectionId,
            'substation-inspection'
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

      // Get the selected region and district names
      const selectedRegionName = regions.find(r => r.id === regionId)?.name || "";
      const selectedDistrictName = districts.find(d => d.id === districtId)?.name || "";
      
      // Get all inspection items from categories
      const inspectionItems = {
        siteCondition: categories[0]?.items || [],
        generalBuilding: categories[1]?.items || [],
        controlEquipment: categories[2]?.items || [],
        basement: categories[3]?.items || [],
        powerTransformer: categories[4]?.items || [],
        outdoorEquipment: categories[5]?.items || []
      };
      
      const inspectionData: SubstationInspection = {
        id: uuidv4(),
        region: selectedRegionName,
        regionId: regionId,
        district: selectedDistrictName,
        districtId: districtId,
        date: formData.date || new Date().toISOString().split('T')[0],
        time: formData.time || new Date().toISOString().split('T')[1].slice(0,5),
        inspectionDate: formData.inspectionDate || new Date().toISOString().split('T')[0],
        substationNo: formData.substationNo,
        substationName: formData.substationName || "",
        type: formData.type || "indoor",
        substationType: formData.substationType || "primary",
        items: [
          ...inspectionItems.siteCondition.map(item => ({
            id: item.id || uuidv4(),
            name: item.name || "",
            category: item.category || "site condition",
            status: item.status,
            remarks: item.remarks || ""
          })),
          ...inspectionItems.generalBuilding.map(item => ({
            id: item.id || uuidv4(),
            name: item.name || "",
            category: item.category || "general building",
            status: item.status,
            remarks: item.remarks || ""
          })),
          ...inspectionItems.controlEquipment.map(item => ({
            id: item.id || uuidv4(),
            name: item.name || "",
            category: item.category || "control equipment",
            status: item.status,
            remarks: item.remarks || ""
          })),
          ...inspectionItems.basement.map(item => ({
            id: item.id || uuidv4(),
            name: item.name || "",
            category: item.category || "basement",
            status: item.status,
            remarks: item.remarks || ""
          })),
          ...inspectionItems.powerTransformer.map(item => ({
            id: item.id || uuidv4(),
            name: item.name || "",
            category: item.category || "power transformer",
            status: item.status,
            remarks: item.remarks || ""
          })),
          ...inspectionItems.outdoorEquipment.map(item => ({
            id: item.id || uuidv4(),
            name: item.name || "",
            category: item.category || "outdoor equipment",
            status: item.status,
            remarks: item.remarks || ""
          }))
        ],
        siteCondition: inspectionItems.siteCondition.map(item => ({
          id: item.id || uuidv4(),
          name: item.name || "",
          category: item.category || "site condition",
          status: item.status,
          remarks: item.remarks || ""
        })),
        generalBuilding: inspectionItems.generalBuilding.map(item => ({
          id: item.id || uuidv4(),
          name: item.name || "",
          category: item.category || "general building",
          status: item.status,
          remarks: item.remarks || ""
        })),
        controlEquipment: inspectionItems.controlEquipment.map(item => ({
          id: item.id || uuidv4(),
          name: item.name || "",
          category: item.category || "control equipment",
          status: item.status,
          remarks: item.remarks || ""
        })),
        basement: inspectionItems.basement.map(item => ({
          id: item.id || uuidv4(),
          name: item.name || "",
          category: item.category || "basement",
          status: item.status,
          remarks: item.remarks || ""
        })),
        powerTransformer: inspectionItems.powerTransformer.map(item => ({
          id: item.id || uuidv4(),
          name: item.name || "",
          category: item.category || "power transformer",
          status: item.status,
          remarks: item.remarks || ""
        })),
        outdoorEquipment: inspectionItems.outdoorEquipment.map(item => ({
          id: item.id || uuidv4(),
          name: item.name || "",
          category: item.category || "outdoor equipment",
          status: item.status,
          remarks: item.remarks || ""
        })),
        remarks: formData.remarks || "",
        createdBy: user?.name || "Unknown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inspectedBy: user?.name || "Unknown",
        location: formData.location || "",
        voltageLevel: formData.voltageLevel || "",
        status: formData.status || "Pending",
        // Add checklist items without default values
        cleanDustFree: formData.cleanDustFree,
        protectionButtonEnabled: formData.protectionButtonEnabled,
        recloserButtonEnabled: formData.recloserButtonEnabled,
        groundEarthButtonEnabled: formData.groundEarthButtonEnabled,
        acPowerOn: formData.acPowerOn,
        batteryPowerLow: formData.batteryPowerLow,
        handleLockOn: formData.handleLockOn,
        remoteButtonEnabled: formData.remoteButtonEnabled,
        gasLevelLow: formData.gasLevelLow,
        earthingArrangementAdequate: formData.earthingArrangementAdequate,
        noFusesBlown: formData.noFusesBlown,
        noDamageToBushings: formData.noDamageToBushings,
        noDamageToHVConnections: formData.noDamageToHVConnections,
        insulatorsClean: formData.insulatorsClean,
        paintworkAdequate: formData.paintworkAdequate,
        ptFuseLinkIntact: formData.ptFuseLinkIntact,
        noCorrosion: formData.noCorrosion,
        silicaGelCondition: formData.silicaGelCondition,
        correctLabelling: formData.correctLabelling,
        gpsLocation: formData.gpsLocation || "",
        images: uploadedPhotos, // Use uploaded photo URLs instead of base64
        afterImages: uploadedAfterPhotos // Use uploaded after photo URLs instead of base64
      };

      // Log the inspection data before saving
      console.log('Inspection data before saving:', inspectionData);

      // Use the saveInspection function from DataContext which handles online/offline logic
      await saveInspection(inspectionData);
      
      navigate("/asset-management/inspection-management");
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInspections = useMemo(() => {
    if (!savedInspections) return [];
    // Use user.region and user.role directly in the dependency array to force update
    const userRegion = user?.region;
    const userRole = user?.role;
    return savedInspections.filter(inspection => {
      if (userRole === 'global_engineer' || userRole === 'system_admin') return true;
      if (userRole === 'regional_engineer' || userRole === 'project_engineer') return inspection.region === userRegion;
      if (userRole === 'district_engineer' || userRole === 'technician') return inspection.district === user?.district;
      return false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedInspections, user?.region, user?.role, user?.district]);

  // Update the renderPage function to ensure all sections are rendered
  const renderPage = (page: number) => {
    switch (page) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Enter the basic information about the inspection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="substationType">Substation Type</Label>
                  <Select
                    value={formData.substationType}
                    onValueChange={(value) => {
                      // Always update the state first
                      setFormData(prev => ({ ...prev, substationType: value as "primary" | "secondary" }));
                      
                      if (value === "secondary") {
                        // Navigate to the secondary substation inspection form
                        navigate("/asset-management/secondary-substation-inspection");
                      }
                      // If value is "primary", we stay on this page (already updated state above)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select substation type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={regionId}
                    onValueChange={handleRegionChange}
                    required
                    disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "district_manager" || user?.role === "regional_general_manager"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRegions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="district">District/Section</Label>
                  <Select
                    value={districtId}
                    onValueChange={handleDistrictChange}
                    required
                    disabled={user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager" || (!regionId && !(user?.role === "ashsubt" || user?.role === "accsubt"))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDistricts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange("time", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="substationNo">Substation Number</Label>
                  <Input
                    id="substationNo"
                    type="text"
                    value={formData.substationNo || ''}
                    onChange={(e) => handleInputChange('substationNo', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="substationName">Substation Name (Optional)</Label>
                    <Input
                      id="substationName"
                      type="text"
                      value={formData.substationName || ''}
                      onChange={(e) => handleInputChange('substationName', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleInputChange("type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indoor">Indoor</SelectItem>
                        <SelectItem value="outdoor">Outdoor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
                  <Input
                    id="location"
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Enter substation location"
                    required
                    className={!formData.location || formData.location.trim() === '' ? "border-red-500" : ""}
                  />
                  <p className="text-sm text-muted-foreground">
                    Location description is required for inspection tracking
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status || "Pending"}
                    onValueChange={value => handleInputChange('status', value)}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gpsLocation">GPS Location <span className="text-red-500">*</span></Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        id="gpsLocation"
                        type="text"
                        value={formData.gpsLocation || ''}
                        onChange={(e) => handleInputChange('gpsLocation', e.target.value)}
                        placeholder="Latitude, Longitude"
                        required
                        className={!formData.gpsLocation || formData.gpsLocation.trim() === '' ? "border-red-500" : ""}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (navigator.geolocation) {
                            toast.info("Getting location... This may take a few moments.");
                            const options = {
                              enableHighAccuracy: true,
                              timeout: 30000, // Increased timeout to 30 seconds
                              maximumAge: 0
                            };
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const { latitude, longitude, accuracy } = position.coords;
                                const preciseLat = latitude.toFixed(6);
                                const preciseLong = longitude.toFixed(6);
                                handleInputChange('gpsLocation', `${preciseLat}, ${preciseLong}`);
                                if (accuracy > 20) {
                                  toast.warning(`GPS accuracy is poor (±${accuracy.toFixed(1)} meters). Please try again for a better reading.`);
                                } else {
                                  toast.success(`Location captured! Accuracy: ±${accuracy.toFixed(1)} meters`);
                                }
                              },
                              (error) => {
                                let errorMessage = 'Error getting location: ';
                                switch (error.code) {
                                  case error.TIMEOUT:
                                    errorMessage += 'Location request timed out. Please try again.';
                                    break;
                                  case error.POSITION_UNAVAILABLE:
                                    errorMessage += 'Location information is unavailable. Please check your device settings.';
                                    break;
                                  case error.PERMISSION_DENIED:
                                    errorMessage += 'Location permission denied. Please enable location services.';
                                    break;
                                  default:
                                    errorMessage += error.message;
                                }
                                toast.error(errorMessage);
                              },
                              options
                            );
                          } else {
                            toast.error('Geolocation is not supported by your browser');
                          }
                        }}
                      >
                        Get Location
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      GPS coordinates are required for inspection location tracking. Click "Get Location" to capture GPS coordinates. The accuracy will be shown in meters. If the first attempt fails, try again.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voltageLevel">Voltage Level</Label>
                  <Input
                    id="voltageLevel"
                    type="text"
                    value={formData.voltageLevel || ''}
                    onChange={(e) => handleInputChange('voltageLevel', e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Site Condition</CardTitle>
              <CardDescription>Record the condition of site-related items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {categories[0]?.items.map((item, itemIndex) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                    <h3 className="text-base font-medium flex-1">{item.name}</h3>
                    <div className="flex items-center space-x-6">
                      <RadioGroup
                        value={item.status}
                        onValueChange={(value) => updateItemStatus(0, itemIndex, value as "good" | "bad")}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="good"
                            id={`good-${item.id}`}
                            className="text-green-500 border-green-500 focus:ring-green-500"
                          />
                          <Label htmlFor={`good-${item.id}`} className="text-green-600">Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="bad"
                            id={`bad-${item.id}`}
                            className="text-red-500 border-red-500 focus:ring-red-500"
                          />
                          <Label htmlFor={`bad-${item.id}`} className="text-red-600">Bad</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`remarks-${item.id}`} className="text-sm">Remarks</Label>
                    <Textarea
                      id={`remarks-${item.id}`}
                      value={item.remarks}
                      onChange={(e) => updateItemRemarks(0, itemIndex, e.target.value)}
                      placeholder="Add any comments or observations"
                      className="mt-1 h-20"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>General Building</CardTitle>
              <CardDescription>Record the condition of general building items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {categories[1]?.items.map((item, itemIndex) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                    <h3 className="text-base font-medium flex-1">{item.name}</h3>
                    <div className="flex items-center space-x-6">
                      <RadioGroup
                        value={item.status}
                        onValueChange={(value) => updateItemStatus(1, itemIndex, value as "good" | "bad")}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="good"
                            id={`good-${item.id}`}
                            className="text-green-500 border-green-500 focus:ring-green-500"
                          />
                          <Label htmlFor={`good-${item.id}`} className="text-green-600">Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="bad"
                            id={`bad-${item.id}`}
                            className="text-red-500 border-red-500 focus:ring-red-500"
                          />
                          <Label htmlFor={`bad-${item.id}`} className="text-red-600">Bad</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`remarks-${item.id}`} className="text-sm">Remarks</Label>
                    <Textarea
                      id={`remarks-${item.id}`}
                      value={item.remarks}
                      onChange={(e) => updateItemRemarks(1, itemIndex, e.target.value)}
                      placeholder="Add any comments or observations"
                      className="mt-1 h-20"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Control Equipment</CardTitle>
              <CardDescription>Record the condition of control equipment items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {categories[2]?.items.map((item, itemIndex) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                    <h3 className="text-base font-medium flex-1">{item.name}</h3>
                    <div className="flex items-center space-x-6">
                      <RadioGroup
                        value={item.status}
                        onValueChange={(value) => updateItemStatus(2, itemIndex, value as "good" | "bad")}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="good"
                            id={`good-${item.id}`}
                            className="text-green-500 border-green-500 focus:ring-green-500"
                          />
                          <Label htmlFor={`good-${item.id}`} className="text-green-600">Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="bad"
                            id={`bad-${item.id}`}
                            className="text-red-500 border-red-500 focus:ring-red-500"
                          />
                          <Label htmlFor={`bad-${item.id}`} className="text-red-600">Bad</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`remarks-${item.id}`} className="text-sm">Remarks</Label>
                    <Textarea
                      id={`remarks-${item.id}`}
                      value={item.remarks}
                      onChange={(e) => updateItemRemarks(2, itemIndex, e.target.value)}
                      placeholder="Add any comments or observations"
                      className="mt-1 h-20"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Basement</CardTitle>
              <CardDescription>Record the condition of basement items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {categories[3]?.items.map((item, itemIndex) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                    <h3 className="text-base font-medium flex-1">{item.name}</h3>
                    <div className="flex items-center space-x-6">
                      <RadioGroup
                        value={item.status}
                        onValueChange={(value) => updateItemStatus(3, itemIndex, value as "good" | "bad")}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="good"
                            id={`good-${item.id}`}
                            className="text-green-500 border-green-500 focus:ring-green-500"
                          />
                          <Label htmlFor={`good-${item.id}`} className="text-green-600">Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="bad"
                            id={`bad-${item.id}`}
                            className="text-red-500 border-red-500 focus:ring-red-500"
                          />
                          <Label htmlFor={`bad-${item.id}`} className="text-red-600">Bad</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`remarks-${item.id}`} className="text-sm">Remarks</Label>
                    <Textarea
                      id={`remarks-${item.id}`}
                      value={item.remarks}
                      onChange={(e) => updateItemRemarks(3, itemIndex, e.target.value)}
                      placeholder="Add any comments or observations"
                      className="mt-1 h-20"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case 6:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Power Transformer</CardTitle>
              <CardDescription>Record the condition of power transformer items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {categories[4]?.items.map((item, itemIndex) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                    <h3 className="text-base font-medium flex-1">{item.name}</h3>
                    <div className="flex items-center space-x-6">
                      <RadioGroup
                        value={item.status}
                        onValueChange={(value) => updateItemStatus(4, itemIndex, value as "good" | "bad")}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="good"
                            id={`good-${item.id}`}
                            className="text-green-500 border-green-500 focus:ring-green-500"
                          />
                          <Label htmlFor={`good-${item.id}`} className="text-green-600">Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="bad"
                            id={`bad-${item.id}`}
                            className="text-red-500 border-red-500 focus:ring-red-500"
                          />
                          <Label htmlFor={`bad-${item.id}`} className="text-red-600">Bad</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`remarks-${item.id}`} className="text-sm">Remarks</Label>
                    <Textarea
                      id={`remarks-${item.id}`}
                      value={item.remarks}
                      onChange={(e) => updateItemRemarks(4, itemIndex, e.target.value)}
                      placeholder="Add any comments or observations"
                      className="mt-1 h-20"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case 7:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Outdoor Equipment</CardTitle>
              <CardDescription>Record the condition of outdoor equipment items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {categories[5]?.items.map((item, itemIndex) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                    <h3 className="text-base font-medium flex-1">{item.name}</h3>
                    <div className="flex items-center space-x-6">
                      <RadioGroup
                        value={item.status}
                        onValueChange={(value) => updateItemStatus(5, itemIndex, value as "good" | "bad")}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="good"
                            id={`good-${item.id}`}
                            className="text-green-500 border-green-500 focus:ring-green-500"
                          />
                          <Label htmlFor={`good-${item.id}`} className="text-green-600">Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="bad"
                            id={`bad-${item.id}`}
                            className="text-red-500 border-red-500 focus:ring-red-500"
                          />
                          <Label htmlFor={`bad-${item.id}`} className="text-red-600">Bad</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`remarks-${item.id}`} className="text-sm">Remarks</Label>
                    <Textarea
                      id={`remarks-${item.id}`}
                      value={item.remarks}
                      onChange={(e) => updateItemRemarks(5, itemIndex, e.target.value)}
                      placeholder="Add any comments or observations"
                      className="mt-1 h-20"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case 8:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>Add any additional notes or observations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="remarks">Additional Notes</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => handleInputChange("remarks", e.target.value)}
                    placeholder="Add any additional notes or observations"
                    className="h-32"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  const totalPages = 8;

  // Reset form to default values
  const resetForm = () => {
    const defaultFormData = {
      date: new Date().toISOString().split('T')[0],
      time: new Date().toISOString().split('T')[1].slice(0,5),
      inspectionDate: new Date().toISOString().split('T')[0],
      substationNo: "",
      substationName: "",
      type: "indoor" as "indoor" | "outdoor",
      substationType: "primary" as "primary" | "secondary",
      location: "",
      voltageLevel: "",
      status: "Pending",
      remarks: "",
      cleanDustFree: undefined,
      protectionButtonEnabled: undefined,
      recloserButtonEnabled: undefined,
      groundEarthButtonEnabled: undefined,
      acPowerOn: undefined,
      batteryPowerLow: undefined,
      handleLockOn: undefined,
      remoteButtonEnabled: undefined,
      gasLevelLow: undefined,
      earthingArrangementAdequate: undefined,
      noFusesBlown: undefined,
      noDamageToBushings: undefined,
      noDamageToHVConnections: undefined,
      insulatorsClean: undefined,
      paintworkAdequate: undefined,
      ptFuseLinkIntact: undefined,
      noCorrosion: undefined,
      silicaGelCondition: undefined,
      correctLabelling: undefined,
      region: "",
      district: "",
      regionId: "",
      districtId: "",
      items: [],
      generalBuilding: [],
      controlEquipment: [],
      basement: [],
      powerTransformer: [],
      outdoorEquipment: [],
      siteCondition: [],
      gpsLocation: ""
    };

    // Set region and district based on user role
    if (user) {
      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
        const userRegion = regions.find(r => r.name === user.region);
        const userDistrict = districts.find(d => d.name === user.district);
        if (userRegion && userDistrict) {
          defaultFormData.region = user.region;
          defaultFormData.district = user.district;
          defaultFormData.regionId = userRegion.id;
          defaultFormData.districtId = userDistrict.id;
        }
      } else if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          defaultFormData.region = user.region;
          defaultFormData.regionId = userRegion.id;
          // Set district to first district in this region if available
          const regionDistricts = districts.filter(d => d.regionId === userRegion.id);
          if (regionDistricts.length > 0) {
            defaultFormData.district = regionDistricts[0].name;
            defaultFormData.districtId = regionDistricts[0].id;
          }
        }
      }
    }

    setFormData(defaultFormData);
    setCapturedImages([]);
    setAfterCapturedImages([]);
    setOfflineInspectionId(null);
    setLastSavedOffline(null);
    setShowFullImage(null);
    setCameraError(null);
    setIsCapturing(false);
    setIsCapturingAfter(false);
    
    // Reset categories to default
    const defaultItems = [
      {
        id: "site-condition",
        name: "Site Condition",
        items: [
          { id: "clean-dust-free", name: "Clean & Dust Free", status: "pending" },
          { id: "protection-button-enabled", name: "Protection Button Enabled", status: "pending" },
          { id: "recloser-button-enabled", name: "Recloser Button Enabled", status: "pending" },
          { id: "ground-earth-button-enabled", name: "Ground/Earth Button Enabled", status: "pending" },
          { id: "ac-power-on", name: "AC Power On", status: "pending" },
          { id: "battery-power-low", name: "Battery Power Low", status: "pending" },
          { id: "handle-lock-on", name: "Handle Lock On", status: "pending" },
          { id: "remote-button-enabled", name: "Remote Button Enabled", status: "pending" },
          { id: "gas-level-low", name: "Gas Level Low", status: "pending" },
          { id: "earthing-arrangement-adequate", name: "Earthing Arrangement Adequate", status: "pending" }
        ]
      },
      {
        id: "general-building",
        name: "General Building",
        items: [
          { id: "no-fuses-blown", name: "No Fuses Blown", status: "pending" },
          { id: "no-damage-to-bushings", name: "No Damage to Bushings", status: "pending" },
          { id: "no-damage-to-hv-connections", name: "No Damage to HV Connections", status: "pending" },
          { id: "insulators-clean", name: "Insulators Clean", status: "pending" },
          { id: "paintwork-adequate", name: "Paintwork Adequate", status: "pending" },
          { id: "pt-fuse-link-intact", name: "PT Fuse Link Intact", status: "pending" },
          { id: "no-corrosion", name: "No Corrosion", status: "pending" },
          { id: "silica-gel-condition", name: "Silica Gel Condition", status: "pending" },
          { id: "correct-labelling", name: "Correct Labelling", status: "pending" }
        ]
      },
      {
        id: "control-equipment",
        name: "Control Equipment",
        items: []
      },
      {
        id: "basement",
        name: "Basement",
        items: []
      },
      {
        id: "power-transformer",
        name: "Power Transformer",
        items: []
      },
      {
        id: "outdoor-equipment",
        name: "Outdoor Equipment",
        items: []
      }
    ];
    setCategories(defaultItems);
  };

  // Handle offline save
  const handleOfflineSave = async () => {
    setIsSavingOffline(true);
    
    // Validate location fields for offline save
    if (!formData.location || formData.location.trim() === '') {
      toast.error("Location description is required.");
      setIsSavingOffline(false);
      return;
    }

    if (!formData.gpsLocation || formData.gpsLocation.trim() === '') {
      toast.error("GPS Location is required.");
      setIsSavingOffline(false);
      return;
    }
    
    try {
      // Get the selected region and district names
      const selectedRegionName = regions.find(r => r.id === regionId)?.name || "";
      const selectedDistrictName = districts.find(d => d.id === districtId)?.name || "";
      
      // Get all inspection items from categories
      const inspectionItems = {
        generalBuilding: formData.generalBuilding || [],
        controlEquipment: formData.controlEquipment || [],
        basement: formData.basement || [],
        powerTransformer: formData.powerTransformer || [],
        outdoorEquipment: formData.outdoorEquipment || [],
        siteCondition: formData.siteCondition || []
      };

      // Prepare inspection data for offline storage
      const inspectionData = {
        ...formData,
        region: selectedRegionName,
        district: selectedDistrictName,
        regionId: regionId,
        districtId: districtId,
        type: "indoor", // Keep the original type (indoor/outdoor)
        substationType: "primary", // Explicitly set substationType for primary substation
        items: inspectionItems,
        // Store base64 images for offline storage
        images: capturedImages || [],
        afterImages: afterCapturedImages || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save inspection to offline storage
      const offlineId = await saveInspectionOffline(inspectionData);
      setOfflineInspectionId(offlineId);
      setLastSavedOffline(new Date());

      // Save photos to offline storage
      if (capturedImages && capturedImages.length > 0) {
        for (let i = 0; i < capturedImages.length; i++) {
          const base64Image = capturedImages[i];
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

      if (afterCapturedImages && afterCapturedImages.length > 0) {
        for (let i = 0; i < afterCapturedImages.length; i++) {
          const base64Image = afterCapturedImages[i];
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

      toast.success(`Inspection saved offline with ID: ${offlineId}. Will sync when online.`);
      console.log('[OfflineSave] Inspection saved offline:', offlineId);
      
      // Clear the form after successful offline save
      resetForm();
      
      // Navigate back (activate cancel button functionality)
      navigate(-1);
      
    } catch (error) {
      console.error('[OfflineSave] Failed to save inspection offline:', error);
      toast.error("Failed to save inspection offline. Please try again.");
    } finally {
      setIsSavingOffline(false);
    }
  };

  // Handle manual sync
  const handleManualSync = async () => {
    if (isOnline && totalOfflineItems > 0) {
      await startSync();
      toast.success("Syncing offline data to server...");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Add breadcrumb navigation */}
        <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-6">
          <Link to="/asset-management/inspection-management" className="hover:text-foreground transition-colors">
            Inspection Management
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="text-foreground">New Substation Inspection</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Substation Inspection</h1>
            <p className="text-muted-foreground mt-1">
              Record a new inspection for a substation
              {!isOnline && (
                <span className="ml-2 text-yellow-600 font-medium">
                  (Offline Mode)
                </span>
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {renderPage(currentPage)}
          {currentPage === 8 && renderPhotoSection()}
          {currentPage === 8 && renderAfterPhotoSection()}
          {console.log('🔍 Current page:', currentPage, 'Total pages:', totalPages)}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground order-2 sm:order-none">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  // Scroll to top when navigating to next page
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto"
                disabled={currentPage === 1 && (!regionId || !districtId)}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                {/* Offline Status Indicators */}
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <OfflineBadge showDetails={true} />
                  </div>
                  
                  {isOffline && (
                    <div className="flex items-center gap-2 text-base text-yellow-600">
                      <WifiOff className="h-4 w-4 flex-shrink-0" />
                      <span>You are currently offline. Use "Save Offline" to save your work locally.</span>
                    </div>
                  )}
                  
                  {offlineInspectionId && (
                    <div className="flex items-center gap-2 text-base text-blue-600">
                      <Save className="h-4 w-4 flex-shrink-0" />
                      <span>Offline ID: {offlineInspectionId}</span>
                      {lastSavedOffline && (
                        <span>(Saved: {lastSavedOffline.toLocaleTimeString()})</span>
                      )}
                    </div>
                  )}
                  
                  {totalOfflineItems > 0 && (
                    <div className="flex items-center gap-2 text-base text-orange-600">
                      <span>📊 {totalOfflineItems} items pending sync</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                  
                  {/* Offline Save Button */}
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleOfflineSave}
                    disabled={isSavingOffline || isOnline}
                    className="flex items-center gap-2 w-full sm:w-auto"
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
                  
                  {/* Sync Button */}
                  {isOnline && totalOfflineItems > 0 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleManualSync}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <Wifi className="h-4 w-4" />
                      Sync Now
                    </Button>
                  )}
                  
                  {/* Submit Button - Disabled when offline */}
                <Button 
                  type="submit" 
                  size="lg" 
                    disabled={isSubmitting || isOffline}
                    className={`w-full sm:w-auto ${isOffline ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSubmitting ? "Saving..." : "Save Inspection"}
                </Button>
                </div>
              </div>
            )}
          </div>
        </form>

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
                
                {offlineInspectionId && (
                  <p className="text-base text-blue-600 mt-2 font-medium">
                    ✅ Your inspection has been saved offline and will sync when connection is restored.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera Dialog */}
        <Dialog open={isCapturing} onOpenChange={(open) => {
          if (!open) {
            setCameraError(null);
          }
          setIsCapturing(open);
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Take Photo</DialogTitle>
              <DialogDescription>
                Take a photo of the inspection. Make sure the area is clearly visible and well-lit.
              </DialogDescription>
              {cameraError && (
                <p className="text-sm text-red-500 mt-2">
                  Error: {cameraError}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative aspect-video bg-black">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  onUserMediaError={handleCameraError}
                  className="w-full h-full rounded-md object-cover"
                  mirrored={!isMobile}
                  imageSmoothing={true}
                />
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCapturing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={captureImage}
                  disabled={!!cameraError}
                >
                  Capture
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* After Inspection Camera Dialog */}
        <Dialog open={isCapturingAfter} onOpenChange={(open) => {
          console.log('🔍 After inspection dialog state changed:', open);
          if (!open) {
            setCameraError(null);
          }
          setIsCapturingAfter(open);
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Take After Inspection Photo</DialogTitle>
              <DialogDescription>
                Take a photo after inspection corrections. Make sure the area is clearly visible and well-lit.
              </DialogDescription>
              {cameraError && (
                <p className="text-sm text-red-500 mt-2">
                  Error: {cameraError}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative aspect-video bg-black">
                <Webcam
                  audio={false}
                  ref={afterWebcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  onUserMediaError={handleCameraError}
                  onUserMedia={(stream) => {
                    console.log('✅ After inspection camera initialized successfully');
                    setCameraError(null);
                  }}
                  className="w-full h-full rounded-md object-cover"
                  mirrored={!isMobile}
                  imageSmoothing={true}
                />
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCapturingAfter(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={captureAfterImage}
                  disabled={!!cameraError}
                >
                  Capture
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Full Image Dialog */}
        <Dialog open={!!showFullImage} onOpenChange={(open) => !open && setShowFullImage(null)}>
          <DialogContent className="max-w-4xl">
            {showFullImage && (
              <img
                src={showFullImage}
                alt="Full size inspection image"
                className="w-full h-auto rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}