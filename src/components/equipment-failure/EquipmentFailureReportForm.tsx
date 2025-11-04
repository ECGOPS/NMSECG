import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, X, MapPin } from "lucide-react";
import Webcam from "react-webcam";

import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';
import { PhotoService } from '@/services/PhotoService';
import { LoggingService } from '@/services/LoggingService';
import { processImageWithMetadata, captureImageWithMetadata } from '@/utils/imageUtils';
import { format } from 'date-fns';
import { createSanitizedInputHandler, sanitizeFormData } from '@/utils/inputSanitization';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EquipmentFailureReport {
  id?: string;
  date: string;
  region: string;
  district: string;
  materialEquipmentName: string;
  typeOfMaterialEquipment: string;
  locationOfMaterialEquipment: string;
  ghanaPostGPS: string;
  nameOfManufacturer: string;
  serialNumber: string;
  manufacturingDate: string;
  countryOfOrigin: string;
  dateOfInstallation: string;
  dateOfCommission: string;
  descriptionOfMaterialEquipment: string;
  causeOfFailure: string;
  frequencyOfRepairs: string;
  historyOfRepairs: string;
  initialObservations: string;
  immediateActionsTaken: string;
  severityOfFault: string;
  preparedBy: string;
  contact: string;
  photo?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

interface EquipmentFailureReportFormProps {
  report?: EquipmentFailureReport;
  regions?: any[];
  districts?: any[];
  user?: any;
  onSave: (report: EquipmentFailureReport) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export function EquipmentFailureReportForm({
  report,
  regions = [],
  districts = [],
  user,
  onSave,
  onCancel,
  isEditing = false
}: EquipmentFailureReportFormProps) {
  
  // Form state
  const [formData, setFormData] = useState<EquipmentFailureReport>({
    date: new Date().toISOString().split('T')[0],
    region: '',
    district: '',
    materialEquipmentName: '',
    typeOfMaterialEquipment: '',
    locationOfMaterialEquipment: '',
    ghanaPostGPS: '',
    nameOfManufacturer: '',
    serialNumber: '',
    manufacturingDate: '',
    countryOfOrigin: '',
    dateOfInstallation: '',
    dateOfCommission: '',
    descriptionOfMaterialEquipment: '',
    causeOfFailure: '',
    frequencyOfRepairs: '',
    historyOfRepairs: '',
    initialObservations: '',
    immediateActionsTaken: '',
    severityOfFault: '',
    preparedBy: user?.name || '',
    contact: user?.email || ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo capture state - using react-webcam like substation inspection
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

  // Equipment types
  const equipmentTypes = [
    'Transformer',
    'Switchgear',
    'Circuit Breaker',
    'Relay',
    'Cable',
    'Insulator',
    'Pole',
    'Meter',
    'Fuse',
    'Arrester',
    'Other'
  ];

  // Add video constraints - enhanced for high quality
  const videoConstraints = {
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    facingMode: isMobile ? "environment" : "user",
    aspectRatio: { ideal: 16/9 },
    frameRate: { ideal: 30, min: 15 }
  };

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
        code: (error as any).code
      });
    }
  };

  // Photo capture functions - using react-webcam like substation inspection
  const startCamera = async () => {
    try {
      console.log('Starting camera...');
      setIsCapturing(true);
      setCameraError(null);
      console.log('Camera state set to capturing:', true);
    } catch (err) {
      console.error('Error starting camera:', err);
      toast.error('Failed to start camera. Please check your camera permissions.');
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    setIsCapturing(false);
    setCameraError(null);
    console.log('Camera state set to capturing:', false);
  };

  const captureImage = async () => {
    console.log('Attempting to capture high-quality image...');
    console.log('Webcam ref:', webcamRef.current);
    
    if (webcamRef.current) {
      try {
        console.log('Capturing high-quality image from webcam...');
        
        // Capture with high quality settings
        const imageSrc = webcamRef.current.getScreenshot();
        
        if (imageSrc) {
          console.log('High-quality image captured successfully');
          
          // Process image with current GPS
          const processedImage = await processImageWithMetadata(
            imageSrc,
          formData.ghanaPostGPS || 'No GPS',
          gpsAccuracy
        );
        
        // Add the image to captured images
          setCapturedImages(prev => [...prev, processedImage]);
        
        stopCamera();
          toast.success('High-quality photo captured successfully!');

        // Get fresh GPS location in the background and update the image
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords;
              setGpsAccuracy(accuracy);
              
              // Update the last captured image with fresh GPS
              processImageWithMetadata(
                  processedImage,
                `${latitude}, ${longitude}`,
                accuracy
              ).then(updatedImage => {
                setCapturedImages(prev => 
                  prev.map((img, index) => 
                    index === prev.length - 1 ? updatedImage : img
                  )
                );
              });
            },
            (error) => {
              console.error('Error getting GPS for image:', error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
          }
        } else {
          console.error('Failed to capture image from webcam');
          toast.error('Failed to capture image');
        }
        
      } catch (error) {
        console.error('Error capturing image:', error);
        toast.error('Failed to capture image');
      }
    } else {
      console.error('Webcam reference is null');
      toast.error('Camera not ready');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // Process image with current GPS
            const baseImage = await processImageWithMetadata(
              reader.result as string,
              formData.ghanaPostGPS || 'No GPS',
              gpsAccuracy
            );
            
            // Add image to captured images
            setCapturedImages(prev => [...prev, baseImage]);
            
            toast.success('Image uploaded successfully!');
          } catch (error) {
            console.error('Error processing uploaded image:', error);
            toast.error('Failed to process uploaded image');
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const renderCameraView = useMemo(() => {
    console.log('Rendering camera view, isCapturing:', isCapturing);
    
    if (!isCapturing) return null;

    return (
      <Dialog open={isCapturing} onOpenChange={(open) => {
        console.log('Dialog open state changed:', open);
        if (!open) {
          setCameraError(null);
        }
        setIsCapturing(open);
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Take Equipment Photo</DialogTitle>
            <DialogDescription>
              Take a photo of the equipment failure. Make sure the area is clearly visible and well-lit.
            </DialogDescription>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                📸 High Quality
              </Badge>
              <Badge variant="outline" className="text-xs">
                Resolution: 1920x1080
              </Badge>
            </div>
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
                screenshotQuality={0.95}
                videoConstraints={videoConstraints}
                onUserMediaError={handleCameraError}
                onUserMedia={(stream) => {
                  console.log('✅ High-quality camera initialized successfully');
                  setCameraError(null);
                }}
                className="w-full h-full rounded-md object-cover"
                mirrored={!isMobile}
                imageSmoothing={false}
                forceScreenshotSourceSize={true}
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
                className="bg-blue-600 hover:bg-blue-700 text-white"
            >
                📸 Capture High-Quality Photo
            </Button>
          </div>
            <div className="text-center text-sm text-muted-foreground space-y-1">
              <p>💡 Tip: Hold steady and ensure good lighting for crystal-clear photos</p>
              <p>📱 For best PDF quality: Keep camera steady, use natural light, and avoid shadows</p>
      </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }, [isCapturing, isMobile, videoConstraints, cameraError]);

  // Severity levels
  const severityLevels = [
    'Low',
    'Medium',
    'High',
    'Critical'
  ];

  // Frequency options
  const frequencyOptions = [
    'First time',
    '2-3 times',
    '4-5 times',
    'More than 5 times',
    'Unknown'
  ];

  // Initialize form with existing data or user defaults
  useEffect(() => {
         if (report) {
       setFormData(report);
      
      // Initialize captured images if editing existing report with photos
      if (report.photo) {
        const photoUrls = report.photo.split(',').filter(url => url.trim());
        setCapturedImages(photoUrls);
      }
    } else if (user) {
      // Set user's region and district for new reports
      if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
        setFormData(prev => ({
          ...prev,
          region: user.region || '',
          district: user.district || ''
        }));
      } else if (user.role === 'regional_engineer' || user.role === 'regional_general_manager') {
        setFormData(prev => ({
          ...prev,
          region: user.region || ''
        }));
      }
    }
  }, [report, user]);

  // Debug: Log regions and districts in form
  useEffect(() => {
    console.log('Form - Regions loaded:', regions);
    console.log('Form - Districts loaded:', districts);
    console.log('Form - Current form data:', formData);
    console.log('Form - User info:', user);
  }, [regions, districts, formData, user]);



  // Set video ready when camera stream changes - using exact same approach as overheadline
  useEffect(() => {
    // This useEffect is no longer needed as Webcam handles its own state
  }, []);

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      // No explicit cleanup needed for Webcam as it manages its own tracks
    };
  }, []);

  const handleInputChange = (field: keyof EquipmentFailureReport, value: string) => {
    // Sanitize the input value
    const sanitizedValue = sanitizeFormData({ [field]: value })[field];
    
    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Sanitize all form data before submission
    const sanitizedFormData = sanitizeFormData(formData);
    setFormData(sanitizedFormData);
    
    // Validation
    if (!formData.materialEquipmentName || !formData.typeOfMaterialEquipment || !formData.locationOfMaterialEquipment) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photos first if any were captured
      let uploadedPhotoUrls: string[] = [];
      
      if (capturedImages.length > 0) {
        setIsUploadingPhotos(true);
        toast.info('Uploading photos...');
        const photoService = PhotoService.getInstance();
        
        for (let i = 0; i < capturedImages.length; i++) {
          const image = capturedImages[i];
          try {
            const uploadResult = await photoService.uploadPhoto(
              image,
              report?.id || `temp-${Date.now()}`,
              'equipment_failure'
            );
            
            if (uploadResult.success && uploadResult.url) {
              uploadedPhotoUrls.push(uploadResult.url);
              console.log(`✅ Photo ${i + 1} uploaded: ${uploadResult.url}`);
            } else {
              console.error(`❌ Failed to upload photo ${i + 1}:`, uploadResult.error);
              toast.error(`Failed to upload photo ${i + 1}. Continuing with other photos.`);
            }
          } catch (error) {
            console.error(`❌ Error uploading photo ${i + 1}:`, error);
            toast.error(`Failed to upload photo ${i + 1}. Continuing with other photos.`);
          }
        }
        setIsUploadingPhotos(false);
      }

      // Combine existing photos with newly uploaded ones
      let finalPhotoUrls: string[] = [];
      
      // Add existing photos that weren't removed (when editing)
      if (report?.photo && isEditing) {
        const existingPhotos = report.photo.split(',').filter(url => url.trim());
        // Only keep existing photos that are still in capturedImages (not removed by user)
        const keptExistingPhotos = existingPhotos.filter(photoUrl => 
          capturedImages.some(img => img === photoUrl)
        );
        finalPhotoUrls.push(...keptExistingPhotos);
      }
      
      // Add newly uploaded photos
      finalPhotoUrls.push(...uploadedPhotoUrls);
      
      const reportData = {
        ...formData,
        photo: finalPhotoUrls.length > 0 ? finalPhotoUrls.join(',') : undefined,
        createdBy: user?.id,
        updatedBy: user?.id,
        createdAt: report?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isEditing && report?.id) {
        // Update existing report
        try {
          // Log the edit action before updating
          await LoggingService.getInstance().logEditAction(
            user?.id || 'unknown',
            user?.name || 'unknown',
            user?.role || 'unknown',
            'equipment_failure_report',
            report.id,
            report, // old values
            reportData, // new values
            `Updated equipment failure report: ${report.materialEquipmentName}`,
            report.region,
            report.district
          );

          const response = await apiRequest(`/api/equipment-failure-reports/${report.id}`, {
            method: 'PUT',
            body: JSON.stringify(reportData)
          });
          
          toast.success('Equipment failure report updated successfully');
          onSave(reportData);
        } catch (error) {
          console.error('Error updating report:', error);
          toast.error(error.message || 'Failed to update report');
        }
      } else {
        // Create new report
        try {
          const response = await apiRequest('/api/equipment-failure-reports', {
            method: 'POST',
            body: JSON.stringify(reportData)
          });
          
          // Log the create action
          await LoggingService.getInstance().logAction(
            user?.id || 'unknown',
            user?.name || 'unknown',
            user?.role || 'unknown',
            'create',
            'equipment_failure_report',
            response?.id || 'unknown',
            `Created new equipment failure report: ${reportData.materialEquipmentName}`,
            reportData.region,
            reportData.district
          );
          
          toast.success('Equipment failure report submitted successfully');
          onSave(reportData);
        } catch (error) {
          console.error('Error creating report:', error);
          toast.error(error.message || 'Failed to submit report');
        }
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Failed to save report. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhotos(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-2">
           <Label htmlFor="date">Date *</Label>
           <Input
             id="date"
             type="date"
             value={formData.date || new Date().toISOString().split('T')[0]}
             onChange={(e) => handleInputChange('date', e.target.value)}
             required
           />
         </div>

        <div className="space-y-2">
          <Label htmlFor="region">Region *</Label>
          <Select
            value={formData.region}
            onValueChange={(value) => handleInputChange('region', value)}
            disabled={user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                // Filter regions based on user role
                let filteredRegions = regions;
                
                if (user) {
                  console.log('[EquipmentFailureForm] User role:', user.role);
                  console.log('[EquipmentFailureForm] Total regions:', regions.length);
                  console.log('[EquipmentFailureForm] User region:', user.region);
                  
                  // Global engineers and system admins can see all regions
                  if (user.role === 'global_engineer' || user.role === 'system_admin') {
                    console.log('[EquipmentFailureForm] Showing all regions for admin');
                    filteredRegions = regions;
                  }
                  // Ashsubt users can see all Ashanti regions
                  else if (user.role === 'ashsubt') {
                    console.log('[EquipmentFailureForm] Filtering for ashsubt');
                    filteredRegions = regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
                    console.log('[EquipmentFailureForm] Filtered regions for ashsubt:', filteredRegions.map(r => r.name));
                  }
                  // Accsubt users can see all Accra regions
                  else if (user.role === 'accsubt') {
                    console.log('[EquipmentFailureForm] Filtering for accsubt');
                    console.log('[EquipmentFailureForm] All regions:', regions.map(r => ({id: r.id, name: r.name})));
                    filteredRegions = regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
                    console.log('[EquipmentFailureForm] Filtered regions for accsubt:', filteredRegions.map(r => r.name));
                    console.log('[EquipmentFailureForm] Filtered count:', filteredRegions.length);
                  }
                  // Regional engineers and regional general managers can only see their assigned region
                  else if (user.role === 'regional_engineer' || user.role === 'project_engineer' || user.role === 'regional_general_manager') {
                    filteredRegions = regions.filter(r => r.name === user.region);
                  }
                  // District engineers, district managers and technicians can only see their assigned region
                  else if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
                    const userDistrict = districts?.find(d => d.name === user.district);
                    filteredRegions = userDistrict ? regions.filter(r => r.id === userDistrict.regionId) : [];
                  }
                }
                
                console.log('[EquipmentFailureForm] Final filtered regions:', filteredRegions);
                return filteredRegions?.map((region) => (
                  <SelectItem key={region.id} value={region.name}>
                    {region.name}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="district">District/Section *</Label>
          <Select
            value={formData.district}
            onValueChange={(value) => handleInputChange('district', value)}
            disabled={user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select district/section" />
            </SelectTrigger>
            <SelectContent>
              {districts?.filter(d => {
                if (!formData.region) return true;
                const region = regions?.find(r => r.name === formData.region);
                return region && d.regionId === region.id;
              }).map((district) => (
                <SelectItem key={district.id} value={district.name}>
                  {district.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Equipment Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="materialEquipmentName">Material/Equipment Name *</Label>
          <Input
            id="materialEquipmentName"
            value={formData.materialEquipmentName}
            onChange={(e) => handleInputChange('materialEquipmentName', e.target.value)}
            placeholder="Enter material or equipment name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="typeOfMaterialEquipment">Type of Material/Equipment *</Label>
          <Select
            value={formData.typeOfMaterialEquipment}
            onValueChange={(value) => handleInputChange('typeOfMaterialEquipment', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select equipment type" />
            </SelectTrigger>
            <SelectContent>
              {equipmentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Location Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="locationOfMaterialEquipment">Location of Material/Equipment *</Label>
          <Input
            id="locationOfMaterialEquipment"
            value={formData.locationOfMaterialEquipment}
            onChange={(e) => handleInputChange('locationOfMaterialEquipment', e.target.value)}
            placeholder="Enter location details"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ghanaPostGPS">Ghana Post GPS</Label>
          <div className="flex gap-2">
            <Input
              id="ghanaPostGPS"
              value={formData.ghanaPostGPS}
              onChange={(e) => handleInputChange('ghanaPostGPS', e.target.value)}
              placeholder="Enter GPS coordinates"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (navigator.geolocation) {
                  setIsGettingLocation(true);
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude, accuracy } = position.coords;
                      setFormData(prev => ({
                        ...prev,
                        ghanaPostGPS: `${latitude}, ${longitude}`
                      }));
                      setGpsAccuracy(accuracy);
                      setIsGettingLocation(false);
                      toast.success(`Location obtained! Accuracy: ±${accuracy.toFixed(1)} meters`);
                    },
                    (error) => {
                      setIsGettingLocation(false);
                      toast.error('Could not get your location. Please enter coordinates manually.');
                    },
                    {
                      enableHighAccuracy: true,
                      timeout: 10000,
                      maximumAge: 0
                    }
                  );
                } else {
                  toast.error('Geolocation is not supported by your browser');
                }
              }}
              disabled={isGettingLocation}
              className="whitespace-nowrap"
            >
              <MapPin className="mr-2 h-4 w-4" />
              {isGettingLocation ? 'Getting...' : 'Get Location'}
            </Button>
          </div>
        </div>
      </div>

      {/* Manufacturer Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nameOfManufacturer">Name of Manufacturer</Label>
          <Input
            id="nameOfManufacturer"
            value={formData.nameOfManufacturer}
            onChange={(e) => handleInputChange('nameOfManufacturer', e.target.value)}
            placeholder="Enter manufacturer name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial Number</Label>
          <Input
            id="serialNumber"
            value={formData.serialNumber}
            onChange={(e) => handleInputChange('serialNumber', e.target.value)}
            placeholder="Enter serial number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="countryOfOrigin">Country of Origin</Label>
          <Input
            id="countryOfOrigin"
            value={formData.countryOfOrigin}
            onChange={(e) => handleInputChange('countryOfOrigin', e.target.value)}
            placeholder="Enter country of origin"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-2">
           <Label htmlFor="manufacturingDate">Manufacturing Date</Label>
           <Input
             id="manufacturingDate"
             type="date"
             value={formData.manufacturingDate || ''}
             onChange={(e) => handleInputChange('manufacturingDate', e.target.value)}
           />
         </div>

                 <div className="space-y-2">
           <Label htmlFor="dateOfInstallation">Date of Installation</Label>
           <Input
             id="dateOfInstallation"
             type="date"
             value={formData.dateOfInstallation || ''}
             onChange={(e) => handleInputChange('dateOfInstallation', e.target.value)}
           />
         </div>

                 <div className="space-y-2">
           <Label htmlFor="dateOfCommission">Date of Commission</Label>
           <Input
             id="dateOfCommission"
             type="date"
             value={formData.dateOfCommission || ''}
             onChange={(e) => handleInputChange('dateOfCommission', e.target.value)}
           />
         </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="descriptionOfMaterialEquipment">Description of Material/Equipment</Label>
        <Textarea
          id="descriptionOfMaterialEquipment"
          value={formData.descriptionOfMaterialEquipment}
          onChange={(e) => handleInputChange('descriptionOfMaterialEquipment', e.target.value)}
          placeholder="Provide detailed description of the material or equipment"
          rows={3}
        />
      </div>

      {/* Failure Information */}
      <div className="space-y-2">
        <Label htmlFor="causeOfFailure">Cause of Failure of Material/Equipment</Label>
        <Textarea
          id="causeOfFailure"
          value={formData.causeOfFailure}
          onChange={(e) => handleInputChange('causeOfFailure', e.target.value)}
          placeholder="Describe the cause of failure"
          rows={3}
        />
      </div>

      {/* Repair History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="frequencyOfRepairs">Frequency of Repairs (In House)</Label>
          <Select
            value={formData.frequencyOfRepairs}
            onValueChange={(value) => handleInputChange('frequencyOfRepairs', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {frequencyOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="severityOfFault">Severity of Fault</Label>
          <Select
            value={formData.severityOfFault}
            onValueChange={(value) => handleInputChange('severityOfFault', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select severity" />
            </SelectTrigger>
            <SelectContent>
              {severityLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="historyOfRepairs">History of Repairs Carried Out</Label>
        <Textarea
          id="historyOfRepairs"
          value={formData.historyOfRepairs}
          onChange={(e) => handleInputChange('historyOfRepairs', e.target.value)}
          placeholder="Describe the history of repairs"
          rows={3}
        />
      </div>

      {/* Observations and Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="initialObservations">Initial Observations After Equipment Failure</Label>
          <Textarea
            id="initialObservations"
            value={formData.initialObservations}
            onChange={(e) => handleInputChange('initialObservations', e.target.value)}
            placeholder="Describe initial observations"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="immediateActionsTaken">Immediate Actions Taken</Label>
          <Textarea
            id="immediateActionsTaken"
            value={formData.immediateActionsTaken}
            onChange={(e) => handleInputChange('immediateActionsTaken', e.target.value)}
            placeholder="Describe immediate actions taken"
            rows={3}
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="preparedBy">Prepared By *</Label>
          <Input
            id="preparedBy"
            value={formData.preparedBy}
            onChange={(e) => handleInputChange('preparedBy', e.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact">Contact *</Label>
          <Input
            id="contact"
            value={formData.contact}
            onChange={(e) => handleInputChange('contact', e.target.value)}
            placeholder="Enter contact information"
            required
          />
        </div>
      </div>

      {/* Existing Photos (when editing) */}
      {isEditing && report?.photo && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Photos</CardTitle>
            <CardDescription>
              Photos already attached to this report. You can remove them if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {report.photo.split(',').filter(url => url.trim()).map((photoUrl, index) => (
                <div key={`existing-${index}`} className="relative group">
                                     <img
                     src={PhotoService.getInstance().convertToProxyUrl(photoUrl)}
                     alt={`Existing photo ${index + 1}`}
                     className="w-full h-32 object-cover rounded-lg border-2 border-blue-200"
                   />
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                             onClick={() => window.open(PhotoService.getInstance().convertToProxyUrl(photoUrl), '_blank')}
                    >
                      View Full Size
                    </Button>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Existing
                    </Badge>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        // Remove this existing photo from capturedImages
                        setCapturedImages(prev => 
                          prev.filter(img => img !== photoUrl)
                        );
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo Capture and Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment Photos</CardTitle>
          <CardDescription>
            Capture new photos or upload additional images
            {capturedImages.length > 0 && (
              <span className="ml-2 text-sm font-medium text-blue-600">
                ({capturedImages.length} new photo{capturedImages.length !== 1 ? 's' : ''})
              </span>
            )}
          </CardDescription>
          <div className="mt-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
              📸 High-quality camera for crystal-clear PDF reports
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
            

          </div>

          {/* Camera Dialog - Render outside form to avoid nesting issues */}
          {renderCameraView}

          {capturedImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {capturedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Equipment photo ${index + 1}`}
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No photos captured yet</p>
              <p className="text-sm">Use the camera or upload buttons above to add photos</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-3">
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
          disabled={isSubmitting || isUploadingPhotos}
          className="px-8"
        >
          {isUploadingPhotos ? 'Uploading Photos...' : 
           isSubmitting ? 'Saving...' : 
           (isEditing ? 'Update Report' : 'Submit Report')}
        </Button>
      </div>
    </form>
  );
}
