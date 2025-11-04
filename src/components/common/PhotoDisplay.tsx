import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PhotoService } from "@/services/PhotoService";

interface PhotoDisplayProps {
  title: string;
  description: string;
  photos: string[];
  section: string;
  className?: string;
  showTitle?: boolean;
}

export function PhotoDisplay({
  title,
  description,
  photos,
  section,
  className = "",
  showTitle = true
}: PhotoDisplayProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  
  const photoService = PhotoService.getInstance();

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

  const openPhotoViewer = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsViewerOpen(true);
  };

  const closePhotoViewer = () => {
    setIsViewerOpen(false);
    setSelectedPhotoIndex(null);
  };

  const goToPreviousPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const goToNextPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  const downloadPhoto = async (image: string) => {
    try {
      const link = document.createElement('a');
      link.href = image;
      link.download = `${section}_photo_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  };

  if (photos.length === 0) {
    return null; // Don't render anything if no photos
  }

  return (
    <>
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {photos.map((image, index) => (
              <div key={index} className="relative group cursor-pointer">
                <img
                  src={getImageSource(image)}
                  alt={`${title} Photo ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
                  onClick={() => openPhotoViewer(index)}
                  onError={(e) => {
                    console.error('Failed to load image:', image);
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDE5VjVhMiAyIDAgMCAwLTItMkg1YTIgMiAwIDAgMC0yIDJ2MTRhMiAyIDAgMCAwIDIgMmgxNGEyIDIgMCAwIDAgMi0yWiIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNOC41IDE0LjVMMTIgMTFMMTUuNSAxNC41IiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0xMiAxMXYzLjUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+';
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-center">
                    <p className="text-sm font-medium">Click to view</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-sm text-muted-foreground text-center mt-3">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} available
          </div>
        </CardContent>
      </Card>

      {/* Photo Viewer Dialog */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>{title} - Photo {selectedPhotoIndex !== null ? selectedPhotoIndex + 1 : 0} of {photos.length}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={closePhotoViewer}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative flex-1 p-4 pt-0">
            {selectedPhotoIndex !== null && (
              <div className="relative">
                {/* Navigation Buttons */}
                {photos.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPhoto}
                      disabled={selectedPhotoIndex === 0}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPhoto}
                      disabled={selectedPhotoIndex === photos.length - 1}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                
                {/* Main Photo */}
                <div className="flex justify-center">
                  <img
                    src={getImageSource(photos[selectedPhotoIndex])}
                    alt={`${title} Photo ${selectedPhotoIndex + 1}`}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg"
                    onError={(e) => {
                      console.error('Failed to load image:', photos[selectedPhotoIndex]);
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDE5VjVhMiAyIDAgMCAwLTItMkg1YTIgMiAwIDAgMC0yIDJ2MTRhMiAyIDAgMCAwIDIgMmgxNGEyIDIgMCAwIDAgMi0yWiIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNOC41IDE0LjVMMTIgMTFMMTUuNSAxNC41IiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0xMiAxMXYzLjUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+';
                    }}
                  />
                </div>
                
                {/* Action Buttons */}
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => downloadPhoto(photos[selectedPhotoIndex])}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
                
                {/* Thumbnail Navigation */}
                {photos.length > 1 && (
                  <div className="flex justify-center gap-2 mt-4 overflow-x-auto">
                    {photos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedPhotoIndex(index)}
                        className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          index === selectedPhotoIndex
                            ? 'border-blue-500 scale-110'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <img
                          src={getImageSource(photo)}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
