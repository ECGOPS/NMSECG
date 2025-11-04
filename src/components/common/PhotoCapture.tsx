import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Camera, Upload, X, WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useOffline } from "@/contexts/OfflineContext";
import { processImageWithMetadata, captureImageWithMetadata } from "@/utils/imageUtils";

interface PhotoCaptureProps {
  title: string;
  description: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  section: string;
  gpsLocation?: string;
  gpsAccuracy?: number;
  maxPhotos?: number;
  className?: string;
}

export function PhotoCapture({
  title,
  description,
  photos,
  onPhotosChange,
  section,
  gpsLocation,
  gpsAccuracy,
  maxPhotos = 10,
  className = ""
}: PhotoCaptureProps) {
  const { toast } = useToast();
  const { isOffline } = useOffline();
  
  // Camera functionality
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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

    if (photos.length >= maxPhotos) {
      toast({
        title: "Photo Limit Reached",
        description: `Maximum ${maxPhotos} photos allowed for this section.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const imageData = captureImageWithMetadata(
        videoRef.current,
        gpsLocation || "0, 0",
        gpsAccuracy
      );
      
      if (imageData) {
        const newPhotos = [...photos, imageData];
        onPhotosChange(newPhotos);
        
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
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  const handleImageUpload = (file: File) => {
    if (photos.length >= maxPhotos) {
      toast({
        title: "Photo Limit Reached",
        description: `Maximum ${maxPhotos} photos allowed for this section.`,
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;
      if (base64Data) {
        try {
          // Process image with metadata
          const processedImage = await processImageWithMetadata(
            base64Data,
            gpsLocation || "0, 0",
            gpsAccuracy
          );
          
          const newPhotos = [...photos, processedImage];
          onPhotosChange(newPhotos);
          
          toast({
            title: "Success",
            description: "Photo uploaded successfully!"
          });
        } catch (error) {
          console.error("Error processing uploaded image:", error);
          toast({
            title: "Error",
            description: "Failed to process uploaded image",
            variant: "destructive"
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {photos.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image}
                  alt={`${title} Photo ${index + 1}`}
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

        {/* Empty State */}
        {photos.length === 0 && (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <Camera className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm sm:text-base">No photos taken yet</p>
            <p className="text-xs sm:text-sm">Take photos to document the {section.toLowerCase()}</p>
          </div>
        )}

        {/* Photo Count */}
        {photos.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            {photos.length} of {maxPhotos} photos taken
          </div>
        )}
      </CardContent>
    </Card>
  );
}
