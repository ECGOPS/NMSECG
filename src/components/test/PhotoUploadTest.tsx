import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhotoService } from '@/services/PhotoService';
import { toast } from 'sonner';

export function PhotoUploadTest() {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handleTestUpload = async () => {
    setUploading(true);
    try {
      // Create a test image (1x1 pixel)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 1, 1);
      }
      
      const base64Data = canvas.toDataURL('image/jpeg');
      const testAssetId = `test-${Date.now()}`;
      
      const photoService = PhotoService.getInstance();
      const result = await photoService.uploadPhoto(base64Data, testAssetId, 'test');
      
      if (result.success && result.url) {
        setUploadedUrl(result.url);
        toast.success('Test upload successful!');
      } else {
        toast.error(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Test upload error:', error);
      toast.error('Test upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Photo Upload Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleTestUpload} 
          disabled={uploading}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Test Photo Upload'}
        </Button>
        
        {uploadedUrl && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploaded URL:</p>
            <p className="text-xs text-muted-foreground break-all">{uploadedUrl}</p>
            <img 
              src={uploadedUrl} 
              alt="Test upload" 
              className="w-full h-32 object-cover rounded border"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
} 