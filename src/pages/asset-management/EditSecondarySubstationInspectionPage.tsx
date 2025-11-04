import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { SecondarySubstationInspection } from "@/types/inspection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronRightIcon, Camera, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Webcam from "react-webcam";
import { PhotoService } from "@/services/PhotoService";

export default function EditSecondarySubstationInspectionPage() {
  // Store original images to preserve them even if state changes
  const originalImagesRef = useRef<string[]>([]);
  const isInitialLoadRef = useRef<boolean>(true);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSavedInspection, updateSubstationInspection } = useData();
  
  // Helper function to determine if an image is base64 or URL
  const isBase64Image = (image: string): boolean => {
    return image.startsWith('data:image/');
  };
  
  const [formData, setFormData] = useState<Partial<SecondarySubstationInspection>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showFullImage, setShowFullImage] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug: Log formData.images changes
  useEffect(() => {
    console.log('[EditSecondarySubstation] formData.images changed:', {
      hasImages: !!formData.images,
      length: formData.images?.length || 0,
      images: formData.images?.map(img => img?.substring(0, 80)) || []
    });
  }, [formData.images]);

  // Load inspection data when component mounts
  useEffect(() => {
    if (id) {
      const loadInspection = async () => {
        // Try to get from savedInspections first
        let inspection = getSavedInspection(id);
        
        // If not found, fetch from API
        if (!inspection) {
          try {
            const { apiRequest } = await import('@/lib/api');
            inspection = await apiRequest(`/api/substations/${id}`);
            console.log('[EditSecondarySubstation] Fetched from API:', inspection);
          } catch (error) {
            console.error('[EditSecondarySubstation] Failed to fetch from API:', error);
            toast.error("Inspection not found");
            navigate("/asset-management/inspection-management");
            return;
          }
        }
        
        if (inspection) {
          console.log('[EditSecondarySubstation] Loading inspection for edit:', inspection); // Debug log
          // Store original images for preservation during updates
          const originalImages = inspection.images || [];
          console.log('[EditSecondarySubstation] Original images from inspection:', {
            count: originalImages.length,
            images: originalImages.map(img => ({
              type: typeof img,
              length: img?.length || 0,
              preview: img?.substring(0, 100) || 'null',
              isBlob: img?.includes('.blob.core.windows.net/') || false
            }))
          });
          originalImagesRef.current = originalImages;
          
          // Explicitly set images in formData to ensure they're preserved
          setFormData({
            ...inspection,
            images: originalImages // Explicitly set images to preserve Firebase/Azure URLs
          });
          console.log('[EditSecondarySubstation] setFormData called with images:', originalImages.length);
          
          // IMPORTANT: Initialize capturedImages from inspection.images directly
          // This ensures Firebase URLs and Azure Blob URLs are preserved for display
          // Use originalImages (from inspection) not formData.images (async state update)
          // Note: useEffect will skip syncing because isInitialLoadRef.current is still true
            setCapturedImages(originalImages);
          
          // Mark initial load as complete AFTER state updates are queued
          // Use requestAnimationFrame to ensure this runs after React's state update cycle
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              isInitialLoadRef.current = false;
            });
          });
        } else {
          toast.error("Inspection not found");
          navigate("/asset-management/inspection-management");
        }
      };
      
      loadInspection();
    }
  }, [id, getSavedInspection, navigate]);

  const videoConstraints = {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

  const handleCameraError = (error: string | DOMException) => {
    console.error('Camera error:', error);
    setCameraError(error.toString());
    toast.error("Failed to access camera. Please check your camera permissions.");
  };

  const captureImage = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const newImages = [...(formData.images || []), imageSrc];
        setFormData(prev => ({ ...prev, images: newImages }));
        setCapturedImages(newImages);
        setIsCapturing(false);
        setCameraError(null);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Image = reader.result as string;
          const newImages = [...(formData.images || []), base64Image];
          setFormData(prev => ({ ...prev, images: newImages }));
          setCapturedImages(newImages);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    const newImages = (formData.images || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
    setCapturedImages(newImages);
  };

  // Update formData when capturedImages changes (but preserve existing URLs on initial load)
  useEffect(() => {
    // Skip the initial sync to avoid overwriting formData.images that was just set
    if (isInitialLoadRef.current) {
      return;
    }
    
    // Only sync if capturedImages is different from formData.images (prevents unnecessary updates)
    const imagesEqual = JSON.stringify(capturedImages) === JSON.stringify(formData.images);
    if (!imagesEqual && (capturedImages.length > 0 || formData.images?.length === 0)) {
    setFormData(prev => ({
      ...prev,
      images: capturedImages
    }));
    }
  }, [capturedImages, formData.images]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const photoService = PhotoService.getInstance();
      const uploadedPhotos: string[] = [];
      
      /**
       * IMAGE PRESERVATION LOGIC
       * 
       * Preserve existing image URLs when:
       * 1. capturedImages array is empty or not provided (user didn't interact with images)
       * 2. Image is already a URL (not base64) - preserve as-is (Azure or Firebase)
       * 3. Only upload new base64 images to Azure Blob
       * 
       * Priority: Azure Blob URLs > Firebase URLs
       * Backward compatibility: Firebase URLs continue working
       */
      
      // Handle images - USE FORM DATA DIRECTLY LIKE OVERHEAD LINE
      // Use formData.images if available, otherwise fallback to originalImagesRef to preserve existing photos
      // This prevents losing photos if formData.images gets cleared by the useEffect
      const imagesToProcess = (formData.images && formData.images.length > 0) 
        ? formData.images 
        : (originalImagesRef.current || []);
      
      if (imagesToProcess.length > 0) {
        console.log(`📸 Processing ${imagesToProcess.length} photos...`);
        console.log(`[EditSecondarySubstation] Using ${formData.images?.length > 0 ? 'formData.images' : 'originalImagesRef'} for processing`);
        
        for (let i = 0; i < imagesToProcess.length; i++) {
          const image = imagesToProcess[i];
          
          // Check if it's already a URL (Azure Blob Storage or Firebase URL)
          if (!isBase64Image(image)) {
            // Preserve existing URL (Azure or Firebase) - THIS IS THE KEY!
            uploadedPhotos.push(image);
            console.log(`✅ Photo ${i + 1} preserved (existing URL): ${image.substring(0, 50)}...`);
          } else {
            // Upload new base64 image to Azure Blob
            const tempInspectionId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`;
            
            const uploadResult = await photoService.uploadPhoto(
              image,
              tempInspectionId,
              'substation-inspection'
            );
            
            if (uploadResult.success && uploadResult.url) {
              uploadedPhotos.push(uploadResult.url);
              console.log(`✅ Photo ${i + 1} uploaded to Azure: ${uploadResult.url}`);
            } else {
              console.error(`❌ Failed to upload photo ${i + 1}:`, uploadResult.error);
              toast.error(`Failed to upload photo ${i + 1}. Continuing with other photos.`);
            }
          }
        }
      } else {
        console.log(`[EditSecondarySubstation] No images to process - preserving existing images if any`);
      }
      
      const updatedData: Partial<SecondarySubstationInspection> = {
        ...formData,
        images: uploadedPhotos.length > 0 ? uploadedPhotos : (originalImagesRef.current || formData.images || []), // Use uploaded photo URLs, fallback to preserve existing
        type: 'secondary', // Ensure type is preserved
        updatedAt: new Date().toISOString()
      };

      console.log('[EditSecondarySubstation] Submitting inspection data:', updatedData);
      console.log('[EditSecondarySubstation] Form data keys:', Object.keys(updatedData));
      console.log('[EditSecondarySubstation] Has region:', !!updatedData.region, updatedData.region);
      console.log('[EditSecondarySubstation] Has district:', !!updatedData.district, updatedData.district);
      
      await updateSubstationInspection(id!, updatedData);
      toast.success("Inspection updated successfully");
      navigate("/asset-management/inspection-management");
    } catch (error) {
      console.error("[EditSecondarySubstation] Error updating inspection:", error);
      console.error("[EditSecondarySubstation] Error details:", {
        message: error.message,
        stack: error.stack
      });
      toast.error("Failed to update inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoize converted image URLs to ensure they're always properly converted
  const convertedImageUrls = useMemo(() => {
    console.log('[EditSecondarySubstation] useMemo running, formData.images:', {
      hasImages: !!formData.images,
      length: formData.images?.length || 0,
      images: formData.images || []
    });
    
    if (!formData.images || formData.images.length === 0) {
      console.log('[EditSecondarySubstation] No images to convert');
      return [];
    }
    
    const photoService = PhotoService.getInstance();
    console.log('[EditSecondarySubstation] Converting images, count:', formData.images.length);
    
    return formData.images.map((image, index) => {
      console.log(`[EditSecondarySubstation] Processing image ${index + 1}:`, {
        type: typeof image,
        length: image?.length || 0,
        preview: image?.substring(0, 100) || 'null/undefined',
        isBlob: image?.includes('.blob.core.windows.net/') || false
      });
      
      const converted = photoService.convertToProxyUrl(image || '');
      
      console.log(`[EditSecondarySubstation] Image ${index + 1} conversion result:`, {
        original: image?.substring(0, 100) || 'null',
        converted: converted?.substring(0, 100) || 'null',
        isConverted: converted?.includes('/api/photos/serve/') || false,
        stillBlob: converted?.includes('.blob.core.windows.net/') || false
      });
      
      return {
        original: image || '',
        converted: converted || '',
        index: index
      };
    });
  }, [formData.images]);

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

           {convertedImageUrls.length > 0 && (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {convertedImageUrls.map(({ original, converted, index }) => {
                 // Double-check conversion before rendering
                 const finalUrl = converted && !converted.includes('.blob.core.windows.net/') 
                   ? converted 
                   : PhotoService.getInstance().convertToProxyUrl(original || '');
                 
                 console.log(`[EditSecondarySubstation] Rendering image ${index + 1}:`, {
                   original: original?.substring(0, 80),
                   converted: converted?.substring(0, 80),
                   finalUrl: finalUrl?.substring(0, 80),
                   isBlob: finalUrl?.includes('.blob.core.windows.net/'),
                   isProxy: finalUrl?.includes('/api/photos/serve/')
                 });
                 
                 return (
                 <div key={index} className="relative group">
                   <img
                     src={finalUrl}
                     alt={`Inspection image ${index + 1}`}
                     className="w-full h-32 object-cover rounded-lg cursor-pointer"
                     onClick={() => setShowFullImage(finalUrl)}
                     onLoad={() => {
                       console.log(`[EditSecondarySubstation] Image ${index + 1} loaded successfully:`, finalUrl?.substring(0, 80));
                     }}
                     onError={(e) => {
                       console.error(`[EditSecondarySubstation] Image ${index + 1} failed to load:`, {
                         src: e.currentTarget.src,
                         original: original?.substring(0, 100),
                         converted: converted?.substring(0, 100),
                         finalUrl: finalUrl?.substring(0, 100)
                       });
                       // Force use proxy even on error
                       if (finalUrl && finalUrl.includes('.blob.core.windows.net/')) {
                         const photoService = PhotoService.getInstance();
                         const retryUrl = photoService.convertToProxyUrl(original || '');
                         console.log(`[EditSecondarySubstation] Retrying with converted URL:`, retryUrl?.substring(0, 100));
                         e.currentTarget.src = retryUrl;
                       }
                     }}
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
               );
               })}
             </div>
           )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>Add any additional notes or remarks about this inspection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="remarks">Additional Notes</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter any additional notes or remarks..."
                  className="min-h-[200px] resize-none"
                />
              </div>
            </CardContent>
          </Card>
          {renderPhotoSection()}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

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