import React, { useState, useEffect, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, MapPin, Camera, Upload, X } from "lucide-react";
import { VITInspectionChecklist, VITAsset, YesNoOption, GoodBadOption } from "@/lib/types";
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { apiRequest } from '@/lib/api';
import { VITOfflineService } from '@/services/VITOfflineService';
import { VITSyncService } from "@/services/VITSyncService";
import LoggingService from "@/services/LoggingService";
import { createSanitizedInputHandler, sanitizeFormData } from '@/utils/inputSanitization';
import { processImageWithMetadata, captureImageWithMetadata } from "@/utils/imageUtils";
import { PhotoService } from "@/services/PhotoService";
import { FeederService } from "@/services/FeederService";

interface VITInspectionFormProps {
  inspection?: VITInspectionChecklist;
  onClose: () => void;
  onSuccess?: (inspection: VITInspectionChecklist) => void;
  preSelectedAssetId?: string;
}

export function VITInspectionForm({ inspection, onClose, onSuccess, preSelectedAssetId }: VITInspectionFormProps) {
  const { vitAssets, addVITInspection, updateVITInspection } = useData();
  const { user } = useAzureADAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<string>('');
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>(inspection?.photoUrls || []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const webcamRef = useRef<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    inspection?.vitAssetId || preSelectedAssetId || ""
  );
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);
  const [inspectionDate, setInspectionDate] = useState<string>(
    inspection?.inspectionDate || new Date().toISOString().split('T')[0]
  );
  const [inspectedBy, setInspectedBy] = useState<string>(
    inspection?.inspectedBy || user?.name || ""
  );
  const [remarks, setRemarks] = useState<string>(inspection?.remarks || "");
  const [offlineAssets, setOfflineAssets] = useState<VITAsset[]>([]);
  const [feederAlias, setFeederAlias] = useState<string | undefined>(inspection?.feederAlias);

  // Initialize feeder service early to avoid initialization order issues
  const feederService = FeederService.getInstance();

  // Load feeder alias when inspection data changes (for edit mode)
  useEffect(() => {
    if (inspection?.feederAlias) {
      setFeederAlias(inspection.feederAlias);
    } else if (inspection?.feederName) {
      // If inspection has feederName but no alias, try to fetch it
      feederService.getAllFeeders().then(allFeeders => {
        const feeder = allFeeders.find(f => f.name === inspection.feederName);
        if (feeder) {
          setFeederAlias(feeder.alias);
        }
      }).catch(err => {
        console.warn('[VITInspectionForm] Error fetching feeder alias for edit mode:', err);
      });
    }
  }, [inspection?.feederAlias, inspection?.feederName, feederService]);

  // Inspection checklist states
  const [rodentTermiteEncroachment, setRodentTermiteEncroachment] = useState<YesNoOption>(inspection?.rodentTermiteEncroachment || "No");
  const [cleanDustFree, setCleanDustFree] = useState<YesNoOption>(inspection?.cleanDustFree || "No");
  const [protectionButtonEnabled, setProtectionButtonEnabled] = useState<YesNoOption>(inspection?.protectionButtonEnabled || "No");
  const [recloserButtonEnabled, setRecloserButtonEnabled] = useState<YesNoOption>(inspection?.recloserButtonEnabled || "No");
  const [groundEarthButtonEnabled, setGroundEarthButtonEnabled] = useState<YesNoOption>(inspection?.groundEarthButtonEnabled || "No");
  const [acPowerOn, setAcPowerOn] = useState<YesNoOption>(inspection?.acPowerOn || "No");
  const [batteryPowerLow, setBatteryPowerLow] = useState<YesNoOption>(inspection?.batteryPowerLow || "No");
  const [handleLockOn, setHandleLockOn] = useState<YesNoOption>(inspection?.handleLockOn || "No");
  const [remoteButtonEnabled, setRemoteButtonEnabled] = useState<YesNoOption>(inspection?.remoteButtonEnabled || "No");
  const [gasLevelLow, setGasLevelLow] = useState<YesNoOption>(inspection?.gasLevelLow || "No");
  const [earthingArrangementAdequate, setEarthingArrangementAdequate] = useState<YesNoOption>(inspection?.earthingArrangementAdequate || "No");
  const [noFusesBlown, setNoFusesBlown] = useState<YesNoOption>(inspection?.noFusesBlown || "No");
  const [noDamageToBushings, setNoDamageToBushings] = useState<YesNoOption>(inspection?.noDamageToBushings || "No");
  const [noDamageToHVConnections, setNoDamageToHVConnections] = useState<YesNoOption>(inspection?.noDamageToHVConnections || "No");
  const [insulatorsClean, setInsulatorsClean] = useState<YesNoOption>(inspection?.insulatorsClean || "No");
  const [paintworkAdequate, setPaintworkAdequate] = useState<YesNoOption>(inspection?.paintworkAdequate || "No");
  const [ptFuseLinkIntact, setPtFuseLinkIntact] = useState<YesNoOption>(inspection?.ptFuseLinkIntact || "No");
  const [noCorrosion, setNoCorrosion] = useState<YesNoOption>(inspection?.noCorrosion || "No");
  const [silicaGelCondition, setSilicaGelCondition] = useState<GoodBadOption>(inspection?.silicaGelCondition || "Good");
  const [correctLabelling, setCorrectLabelling] = useState<YesNoOption>(inspection?.correctLabelling || "No");

  const vitOfflineService = VITOfflineService.getInstance();
  const vitSyncService = VITSyncService.getInstance();

  // Combine all images for display and submission
  const allImages = [...capturedImages, ...uploadedImages];

  // File upload handler with Azure Blob Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedAssetId) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        console.log(`[VITForm] Processing file:`, { 
          name: file.name, 
          size: file.size, 
          type: file.type,
          sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
        });

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Image = reader.result as string;
            
            // Process image with GPS metadata
            const processedImage = await processImageWithMetadata(
              base64Image,
              gpsLocation || 'No GPS',
              gpsAccuracy
            );
            
            // Upload to Azure Blob Storage
            const result = await PhotoService.getInstance().uploadPhoto(
              processedImage,
              selectedAssetId,
              'vit-inspection'
            );
            
            if (result.success) {
              setPhotoUrls(prev => [...prev, result.url!]);
              setUploadedImages(prev => [...prev, processedImage]); // Keep for display
              
              toast({
                title: "Success",
                description: "Image uploaded successfully!"
              });
            } else {
              throw new Error(result.error || 'Upload failed');
            }
          } catch (error) {
            console.error('Error processing uploaded image:', error);
            toast({
              title: "Error",
              description: "Failed to process image",
              variant: "destructive"
            });
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: "Failed to upload images",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Clear the input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Camera functions
  const startCamera = async () => {
    try {
      setIsCapturing(true);
      setCameraError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
      setCameraError('Failed to access camera. Please check permissions.');
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
    setIsVideoReady(false);
  };

  const captureImage = async () => {
    if (!videoRef.current || !selectedAssetId) return;

    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      // Flip the image horizontally for better UX
      context.scale(-1, 1);
      context.translate(-canvas.width, 0);
      context.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Process image with GPS metadata
      const processedImage = await processImageWithMetadata(
        imageData,
        gpsLocation || 'No GPS',
        gpsAccuracy
      );
      
      // Upload to Azure Blob Storage
      const result = await PhotoService.getInstance().uploadPhoto(
        processedImage,
        selectedAssetId,
        'vit-inspection'
      );
      
      if (result.success) {
        setPhotoUrls(prev => [...prev, result.url!]);
        setCapturedImages(prev => [...prev, processedImage]); // Keep for display
        
        toast({
          title: "Success",
          description: "Photo captured and uploaded successfully!"
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
      
      stopCamera();
    } catch (error) {
      console.error('Error capturing image:', error);
      toast({
        title: "Error",
        description: "Failed to capture and upload photo",
        variant: "destructive"
      });
    }
  };

  // Remove image function
  const removeImage = (index: number, isCaptured: boolean) => {
    if (isCaptured) {
      setCapturedImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setUploadedImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Load offline assets
  useEffect(() => {
    const loadOfflineAssets = async () => {
      try {
        const pendingAssets = await vitOfflineService.getPendingAssets();
        setOfflineAssets(pendingAssets.map(item => ({ ...item.asset, id: item.key })));
      } catch (error) {
        console.error('Error loading offline assets:', error);
      }
    };

    loadOfflineAssets();
  }, [vitOfflineService]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Get GPS location on component mount
  useEffect(() => {
    const getCurrentGPS = () => {
      if (navigator.geolocation) {
        setIsGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            setGpsLocation(`${latitude}, ${longitude}`);
            setGpsAccuracy(accuracy);
            setIsGettingLocation(false);
            console.log('[VITForm] GPS location obtained:', { latitude, longitude, accuracy });
          },
          (error) => {
            console.error('[VITForm] GPS error:', error);
            setGpsLocation('No GPS');
            setGpsAccuracy(0);
            setIsGettingLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      } else {
        setGpsLocation('No GPS');
        setGpsAccuracy(0);
      }
    };

    getCurrentGPS();
  }, []);

  // Load existing photos when inspection prop changes
  useEffect(() => {
    if (inspection?.photoUrls && inspection.photoUrls.length > 0) {
      console.log('[VITForm] Loading existing photos:', inspection.photoUrls);
      setPhotoUrls(inspection.photoUrls);
      
      // For display purposes, we'll show placeholder images for existing photos
      // since we don't have the base64 data for existing photos
      const existingImagePlaceholders = inspection.photoUrls.map((url, index) => 
        `existing-photo-${index}`
      );
      setUploadedImages(existingImagePlaceholders);
    }
  }, [inspection]);

  // Handle preSelectedAssetId when it changes
  useEffect(() => {
    if (preSelectedAssetId && !inspection?.vitAssetId) {
      setSelectedAssetId(preSelectedAssetId);
    }
  }, [preSelectedAssetId, inspection?.vitAssetId]);

  // Update selected asset when asset ID changes
  useEffect(() => {
    console.log('[VITInspectionForm] Asset selection debug:', {
      selectedAssetId,
      vitAssetsCount: vitAssets.length,
      offlineAssetsCount: offlineAssets.length,
      vitAssets: vitAssets.map(a => ({ id: a.id, serialNumber: a.serialNumber })),
      offlineAssets: offlineAssets.map(a => ({ id: a.id, serialNumber: a.serialNumber }))
    });

    if (selectedAssetId) {
      // First check online assets
      const onlineAsset = vitAssets.find(a => a.id === selectedAssetId);
      if (onlineAsset) {
        console.log('[VITInspectionForm] Found online asset:', onlineAsset);
        setSelectedAsset(onlineAsset);
        // Fetch feeder alias if asset has feederName
        if (onlineAsset.feederName) {
          feederService.getAllFeeders().then(allFeeders => {
            const feeder = allFeeders.find(f => f.name === onlineAsset.feederName);
            if (feeder) {
              setFeederAlias(feeder.alias);
            } else {
              setFeederAlias(undefined);
            }
          }).catch(err => {
            console.warn('[VITInspectionForm] Error fetching feeder alias:', err);
            setFeederAlias(undefined);
          });
        } else {
          setFeederAlias(undefined);
        }
        return;
      }

      // Then check offline assets
      const offlineAsset = offlineAssets.find(a => a.id === selectedAssetId);
      if (offlineAsset) {
        console.log('[VITInspectionForm] Found offline asset:', offlineAsset);
        setSelectedAsset(offlineAsset);
        // For offline assets, try to fetch feeder alias
        if (offlineAsset.feederName) {
          feederService.getAllFeeders().then(allFeeders => {
            const feeder = allFeeders.find(f => f.name === offlineAsset.feederName);
            if (feeder) {
              setFeederAlias(feeder.alias);
            } else {
              setFeederAlias(undefined);
            }
          }).catch(err => {
            console.warn('[VITInspectionForm] Error fetching feeder alias:', err);
            setFeederAlias(undefined);
          });
        } else {
          setFeederAlias(undefined);
        }
        return;
      }

      // If not found in either, clear selection
      console.log('[VITInspectionForm] Asset not found in either array');
      setSelectedAsset(null);
      setFeederAlias(undefined);
    } else {
      setSelectedAsset(null);
      setFeederAlias(undefined);
    }
  }, [selectedAssetId, vitAssets, offlineAssets, feederService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get feeder info from the selected asset's feederName or inspection data
      let feederName = selectedAsset?.feederName || inspection?.feederName || '';
      let feederAliasValue: string | undefined = feederAlias || inspection?.feederAlias;
      
      // If we don't have alias yet, try to fetch it
      if (feederName && !feederAliasValue) {
        try {
          // Try to get feeder alias from feeder service
          const allFeeders = await feederService.getAllFeeders();
          const feeder = allFeeders.find(f => f.name === feederName);
          if (feeder) {
            feederAliasValue = feeder.alias;
            console.log('[VITInspectionForm] Found feeder alias:', { feederName, feederAlias: feederAliasValue });
          }
        } catch (error) {
          console.warn('[VITInspectionForm] Error fetching feeder info:', error);
          // Continue without alias if lookup fails
        }
      }

      const inspectionData = {
        vitAssetId: selectedAssetId,
        region: selectedAsset?.region || '',
        district: selectedAsset?.district || '',
        feederName: feederName,
        feederAlias: feederAliasValue,
        inspectionDate: inspectionDate,
        inspectedBy: user?.name || 'unknown',
        rodentTermiteEncroachment,
        cleanDustFree,
        protectionButtonEnabled,
        recloserButtonEnabled,
        groundEarthButtonEnabled,
        acPowerOn,
        batteryPowerLow,
        handleLockOn,
        remoteButtonEnabled,
        gasLevelLow,
        earthingArrangementAdequate,
        noFusesBlown,
        noDamageToBushings,
        noDamageToHVConnections,
        insulatorsClean,
        paintworkAdequate,
        ptFuseLinkIntact,
        noCorrosion,
        silicaGelCondition,
        correctLabelling,
        remarks,
        photoUrls: photoUrls, // Azure Blob Storage URLs
        createdBy: user?.id || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (inspection?.id) {
        // Update existing inspection - only send updatable fields
        const updateData = {
          id: inspection.id, // Include the id field that the backend requires
          vitAssetId: selectedAssetId,
          region: selectedAsset?.region || '',
          district: selectedAsset?.district || '',
          feederName: feederName,
          feederAlias: feederAlias,
          inspectionDate: inspectionDate,
          inspectedBy: user?.name || 'unknown',
          rodentTermiteEncroachment,
          cleanDustFree,
          protectionButtonEnabled,
          recloserButtonEnabled,
          groundEarthButtonEnabled,
          acPowerOn,
          batteryPowerLow,
          handleLockOn,
          remoteButtonEnabled,
          gasLevelLow,
          earthingArrangementAdequate,
          noFusesBlown,
          noDamageToBushings,
          noDamageToHVConnections,
          insulatorsClean,
          paintworkAdequate,
          ptFuseLinkIntact,
          noCorrosion,
          silicaGelCondition,
          correctLabelling,
          remarks,
          photoUrls: photoUrls, // Azure Blob Storage URLs
          updatedAt: new Date().toISOString()
        };

        // Log the edit action before updating
        await LoggingService.getInstance().logEditAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'vit_inspection',
          inspection.id,
          inspection, // old values
          updateData, // new values
          `Updated VIT inspection: ${inspection.inspectionDate || inspection.id}`,
          inspection.region,
          inspection.district
        );

        await updateVITInspection(inspection.id, updateData);
        toast({
          title: "Success",
          description: "Inspection updated successfully",
        });
      } else {
        // Create new inspection
        const isOnline = navigator.onLine;
        
        if (isOnline) {
          try {
            const result = await addVITInspection(inspectionData);
            
            // Log the create action
            await LoggingService.getInstance().logAction(
              user?.id || 'unknown',
              user?.name || 'unknown',
              user?.role || 'unknown',
              'create',
              'vit_inspection',
              result || 'unknown',
              `Created new VIT inspection`,
              selectedAsset?.region,
              selectedAsset?.district
            );
            
            toast({
              title: "Success",
              description: "Inspection created successfully",
            });
            
            // Dispatch event for online inspection added
            window.dispatchEvent(new CustomEvent('inspectionAdded', {
              detail: {
                type: 'vit',
                inspection: { ...inspectionData, id: result },
                status: 'success'
              }
            }));
          } catch (error) {
            console.error("API call failed, falling back to offline save:", error);
            // Fall back to offline save if API fails
            await handleOfflineSave(inspectionData);
          }
        } else {
          // Device is offline, save locally
          await handleOfflineSave(inspectionData);
        }
      }

      if (onClose) {
        onClose();
      }
      if (onSuccess) {
        onSuccess(inspectionData as VITInspectionChecklist);
      }
    } catch (error) {
      console.error('Error saving inspection:', error);
      toast({
        title: "Error",
        description: "Failed to save inspection",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle offline save for VIT inspections
  const handleOfflineSave = async (inspectionData: any) => {
    try {
      console.log("Saving VIT inspection offline...");
      
      // Use VITOfflineService to save inspection offline
      const offlineId = await vitOfflineService.saveInspectionOffline(inspectionData);
      
      console.log("VIT inspection saved offline:", offlineId);
      
      // Dispatch event for offline inspection added
      window.dispatchEvent(new CustomEvent('inspectionAdded', {
        detail: {
          type: 'vit',
          inspection: { ...inspectionData, id: offlineId },
          status: 'offline'
        }
      }));
      
      toast({
        title: "Saved Offline",
        description: "Inspection saved offline. It will be synced when internet connection is restored.",
      });
      
    } catch (error) {
      console.error("Error saving VIT inspection offline:", error);
      toast({
        title: "Error",
        description: "Failed to save inspection offline. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // ... rest of the component logic remains the same ...

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {inspection ? 'Edit VIT Inspection' : 'New VIT Inspection'}
          </h2>
          <Button variant="ghost" onClick={() => onClose && onClose()}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Asset Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="asset">Switchgear Asset</Label>
              {preSelectedAssetId && selectedAsset ? (
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedAsset.serialNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedAsset.typeOfUnit} - {selectedAsset.location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedAsset.region} / {selectedAsset.district}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pre-selected
                    </div>
                  </div>
                </div>
              ) : (
                <Select value={selectedAssetId} onValueChange={(value) => {
                  console.log('[VITInspectionForm] Asset selected:', value);
                  setSelectedAssetId(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a switchgear asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      console.log('[VITInspectionForm] Rendering dropdown with:', {
                        vitAssetsCount: vitAssets.length,
                        offlineAssetsCount: offlineAssets.length,
                        totalAssets: vitAssets.length + offlineAssets.length
                      });
                      return null;
                    })()}
                    {/* Online assets */}
                    {vitAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.serialNumber} - {asset.location}
                      </SelectItem>
                    ))}
                    {/* Offline assets */}
                    {offlineAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.serialNumber} - {asset.location} (Offline)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label htmlFor="inspectionDate">Inspection Date</Label>
              <Input
                type="date"
                value={inspectionDate}
                onChange={createSanitizedInputHandler(setInspectionDate)}
                required
              />
            </div>
          </div>

          {/* Feeder Information - Display when asset is selected */}
          {selectedAsset && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="feederName">Feeder Name</Label>
                <Input
                  id="feederName"
                  type="text"
                  value={selectedAsset.feederName || inspection?.feederName || ''}
                  readOnly
                  className="bg-muted/50"
                  placeholder="Feeder name will be set from asset"
                />
              </div>
              <div>
                <Label htmlFor="feederAlias">Feeder Alias</Label>
                <Input
                  id="feederAlias"
                  type="text"
                  value={feederAlias || inspection?.feederAlias || ''}
                  readOnly
                  className="bg-muted/50"
                  placeholder="Feeder alias (if available)"
                />
              </div>
            </div>
          )}

          {/* Inspection Checklist */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">VIT Inspection Checklist</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Environmental Conditions */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">Environmental Conditions</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rodentTermiteEncroachment"
                      checked={rodentTermiteEncroachment === "Yes"}
                      onCheckedChange={(checked) => setRodentTermiteEncroachment(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="rodentTermiteEncroachment">Rodent/Termite Encroachment</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cleanDustFree"
                      checked={cleanDustFree === "Yes"}
                      onCheckedChange={(checked) => setCleanDustFree(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="cleanDustFree">Clean & Dust Free</Label>
                  </div>
                </div>

                {/* Protection & Control */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">Protection & Control</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="protectionButtonEnabled"
                      checked={protectionButtonEnabled === "Yes"}
                      onCheckedChange={(checked) => setProtectionButtonEnabled(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="protectionButtonEnabled">Protection Button Enabled</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recloserButtonEnabled"
                      checked={recloserButtonEnabled === "Yes"}
                      onCheckedChange={(checked) => setRecloserButtonEnabled(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="recloserButtonEnabled">Recloser Button Enabled</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="groundEarthButtonEnabled"
                      checked={groundEarthButtonEnabled === "Yes"}
                      onCheckedChange={(checked) => setGroundEarthButtonEnabled(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="groundEarthButtonEnabled">Ground/Earth Button Enabled</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remoteButtonEnabled"
                      checked={remoteButtonEnabled === "Yes"}
                      onCheckedChange={(checked) => setRemoteButtonEnabled(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="remoteButtonEnabled">Remote Button Enabled</Label>
                  </div>
                </div>

                {/* Power Systems */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">Power Systems</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="acPowerOn"
                      checked={acPowerOn === "Yes"}
                      onCheckedChange={(checked) => setAcPowerOn(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="acPowerOn">AC Power On</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="batteryPowerLow"
                      checked={batteryPowerLow === "Yes"}
                      onCheckedChange={(checked) => setBatteryPowerLow(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="batteryPowerLow">Battery Power Low</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="gasLevelLow"
                      checked={gasLevelLow === "Yes"}
                      onCheckedChange={(checked) => setGasLevelLow(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="gasLevelLow">Gas Level Low</Label>
                  </div>
                </div>

                {/* Safety & Security */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">Safety & Security</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="handleLockOn"
                      checked={handleLockOn === "Yes"}
                      onCheckedChange={(checked) => setHandleLockOn(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="handleLockOn">Handle Lock On</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="earthingArrangementAdequate"
                      checked={earthingArrangementAdequate === "Yes"}
                      onCheckedChange={(checked) => setEarthingArrangementAdequate(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="earthingArrangementAdequate">Earthing Arrangement Adequate</Label>
                  </div>
                </div>

                {/* Equipment Condition */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">Equipment Condition</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="noFusesBlown"
                      checked={noFusesBlown === "Yes"}
                      onCheckedChange={(checked) => setNoFusesBlown(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="noFusesBlown">No Fuses Blown</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="noDamageToBushings"
                      checked={noDamageToBushings === "Yes"}
                      onCheckedChange={(checked) => setNoDamageToBushings(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="noDamageToBushings">No Damage to Bushings</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="noDamageToHVConnections"
                      checked={noDamageToHVConnections === "Yes"}
                      onCheckedChange={(checked) => setNoDamageToHVConnections(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="noDamageToHVConnections">No Damage to HV Connections</Label>
                  </div>
                </div>

                {/* Visual Inspection */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">Visual Inspection</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="insulatorsClean"
                      checked={insulatorsClean === "Yes"}
                      onCheckedChange={(checked) => setInsulatorsClean(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="insulatorsClean">Insulators Clean</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="paintworkAdequate"
                      checked={paintworkAdequate === "Yes"}
                      onCheckedChange={(checked) => setPaintworkAdequate(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="paintworkAdequate">Paintwork Adequate</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ptFuseLinkIntact"
                      checked={ptFuseLinkIntact === "Yes"}
                      onCheckedChange={(checked) => setPtFuseLinkIntact(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="ptFuseLinkIntact">PT Fuse Link Intact</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="noCorrosion"
                      checked={noCorrosion === "Yes"}
                      onCheckedChange={(checked) => setNoCorrosion(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="noCorrosion">No Corrosion</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="correctLabelling"
                      checked={correctLabelling === "Yes"}
                      onCheckedChange={(checked) => setCorrectLabelling(checked ? "Yes" : "No")}
                    />
                    <Label htmlFor="correctLabelling">Correct Labelling</Label>
                  </div>
                </div>

                {/* Special Conditions */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">Special Conditions</h4>
                  <div className="space-y-2">
                    <Label htmlFor="silicaGelCondition">Silica Gel Condition</Label>
                    <Select value={silicaGelCondition} onValueChange={(value: string) => setSilicaGelCondition(value as GoodBadOption)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Bad">Bad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              value={remarks}
              onChange={createSanitizedInputHandler(setRemarks)}
              placeholder="Additional remarks..."
              rows={3}
            />
          </div>

          {/* Photo Upload Section */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Inspection Photos</h3>
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
                      id="vit-image-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('vit-image-upload')?.click()}
                      className="w-full sm:w-auto"
                      disabled={isUploading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploading ? 'Uploading...' : 'Upload Images'}
                    </Button>
                  </div>
                </div>

                {/* Camera View */}
                {isCapturing && (
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
                )}

                {/* Camera Error */}
                {cameraError && (
                  <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">
                    {cameraError}
                  </div>
                )}

                {/* Display Images */}
                {(allImages.length > 0 || photoUrls.length > 0) && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* Existing Photos (from database) */}
                    {photoUrls.map((url, index) => (
                      <div key={`existing-${index}`} className="relative group">
                        <img
                          src={PhotoService.getInstance().convertToProxyUrl(url)}
                          alt={`Existing photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                          onError={(e) => {
                            console.error('Error loading existing photo:', url);
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02NCA0MEM3My45NDExIDQwIDgyIDQ4LjA1ODkgODIgNThDNzIgNTggNjQgNjUuOTQxMSA2NCA3NkM2NCA2Ni4wNTg5IDU1Ljk0MTEgNTggNDYgNThDNDYgNDguMDU4OSA1NC4wNTg5IDQwIDY0IDQwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                          }}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setPhotoUrls(prev => prev.filter((_, i) => i !== index));
                            setUploadedImages(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-2 left-2 bg-gray-600 text-white text-xs px-2 py-1 rounded">
                          Existing
                        </div>
                      </div>
                    ))}
                    
                    {/* Captured Images */}
                    {capturedImages.map((image, index) => (
                      <div key={`captured-${index}`} className="relative group">
                        <img
                          src={image}
                          alt={`Captured image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index, true)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                          Camera
                        </div>
                      </div>
                    ))}
                    
                    {/* Uploaded Images */}
                    {uploadedImages.map((image, index) => {
                      // Skip placeholder images for existing photos
                      if (typeof image === 'string' && image.startsWith('existing-photo-')) {
                        return null;
                      }
                      
                      return (
                        <div key={`uploaded-${index}`} className="relative group">
                          <img
                            src={image}
                            alt={`Uploaded image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index, false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                            Upload
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Image Count and GPS Status */}
                {(allImages.length > 0 || photoUrls.length > 0) && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Total images: {photoUrls.length} ({capturedImages.length} captured, {uploadedImages.filter(img => !img.startsWith('existing-photo-')).length} uploaded)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      GPS Location: {gpsLocation} {gpsAccuracy > 0 && `(±${Math.round(gpsAccuracy)}m)`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Storage: {photoUrls.length} images uploaded to Azure Blob Storage
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {inspection ? 'Update Inspection' : 'Create Inspection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
