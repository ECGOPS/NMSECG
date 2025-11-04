import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Loader2, FileText } from 'lucide-react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from '@/contexts/DataContext';
import { apiRequest } from '@/lib/api';

interface ReportUploadFormProps {
  onUploadSuccess?: () => void;
}

/**
 * ReportUploadForm Component
 * 
 * Allows users to upload reports based on their role:
 * - District users: Upload for their district only
 * - Regional admins: Upload for their region
 * - Admin: Upload for any region/district
 */
export function ReportUploadForm({ onUploadSuccess }: ReportUploadFormProps) {
  const { user } = useAzureADAuth();
  const { regions, districts } = useData();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    report_type: 'Weekly' as 'Weekly' | 'Monthly',
    region_id: '',
    district_id: '',
  });

  // Get user's region and district
  const userRegion = user?.region || null;
  const userDistrict = user?.district || null;
  const isAdmin = user?.role === 'system_admin' || user?.role === 'global_engineer';
  const isRegionalAdmin = user?.role === 'regional_engineer' || user?.role === 'regional_general_manager';
  const isDistrictUser = user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician';

  // Filter districts based on selected region
  const filteredDistricts = formData.region_id
    ? districts.filter(d => d.regionId === formData.region_id)
    : [];

  // Auto-fill region/district based on user role
  React.useEffect(() => {
    if (isDistrictUser && userDistrict) {
      // Find district to get region
      const district = districts.find(d => d.id === userDistrict);
      if (district) {
        setFormData(prev => ({
          ...prev,
          district_id: userDistrict,
          region_id: district.regionId || '',
        }));
      }
    } else if (isRegionalAdmin && userRegion) {
      setFormData(prev => ({
        ...prev,
        region_id: userRegion,
        district_id: '',
      }));
    }
  }, [userDistrict, userRegion, isDistrictUser, isRegionalAdmin, districts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File size must be less than 100MB');
      e.target.value = ''; // Clear input
      return;
    }

    if (file.size === 0) {
      toast.error('File is empty');
      e.target.value = '';
      return;
    }

    // Validate file extension
    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (!extension || !allowedExtensions.includes(extension)) {
      toast.error(`File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`);
      e.target.value = '';
      return;
    }

    // Validate file type against extension
    const allowedMimeTypes: Record<string, string[]> = {
      'pdf': ['application/pdf'],
      'doc': ['application/msword'],
      'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      'xls': ['application/vnd.ms-excel'],
      'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      'ppt': ['application/vnd.ms-powerpoint'],
      'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      'txt': ['text/plain'],
      'csv': ['text/csv', 'application/vnd.ms-excel'],
      'jpg': ['image/jpeg'],
      'jpeg': ['image/jpeg'],
      'png': ['image/png'],
      'gif': ['image/gif'],
    };

    const allowedMimes = allowedMimeTypes[extension];
    if (allowedMimes && !allowedMimes.includes(file.type)) {
      toast.error(`File type ${file.type} does not match extension ${extension}`);
      e.target.value = '';
      return;
    }

    // Check for dangerous file names
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      toast.error('Invalid file name');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    // Validate and sanitize inputs
    const title = formData.title.trim();
    if (!title || title.length === 0) {
      toast.error('Please enter a title');
      return;
    }

    if (title.length > 500) {
      toast.error('Title must be less than 500 characters');
      return;
    }

    // Check for dangerous patterns in title
    if (/<script|javascript:|vbscript:|on\w+=/i.test(title)) {
      toast.error('Title contains invalid characters');
      return;
    }

    if (formData.description && formData.description.length > 5000) {
      toast.error('Description must be less than 5000 characters');
      return;
    }

    try {
      setIsUploading(true);

      // Create FormData for multipart/form-data upload
      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('report_type', formData.report_type);
      
      if (formData.region_id) {
        formDataToSend.append('region_id', formData.region_id);
      }
      
      if (formData.district_id) {
        formDataToSend.append('district_id', formData.district_id);
      }

      // Use apiRequest with FormData
      // Note: apiRequest will automatically detect FormData and not set Content-Type header
      await apiRequest('/api/reports', {
        method: 'POST',
        body: formDataToSend,
      });

      toast.success('Report uploaded successfully');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        report_type: 'Weekly',
        region_id: userRegion || '',
        district_id: userDistrict || '',
      });
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      onUploadSuccess?.();
    } catch (error: any) {
      console.error('[ReportUploadForm] Upload error:', error);
      toast.error(error.message || 'Failed to upload report');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Report
        </CardTitle>
        <CardDescription>
          Upload a weekly or monthly report for your district or region
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report_type">Report Type *</Label>
              <Select
                value={formData.report_type}
                onValueChange={(value: 'Weekly' | 'Monthly') =>
                  setFormData({ ...formData, report_type: value })
                }
                required
              >
                <SelectTrigger id="report_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="region_id">Region (Optional)</Label>
                <Select
                  value={formData.region_id || '__all__'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, region_id: value === '__all__' ? '' : value, district_id: '' })
                  }
                >
                  <SelectTrigger id="region_id">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Regions</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isAdmin && formData.region_id && (
              <div className="space-y-2">
                <Label htmlFor="district_id">District (Optional)</Label>
                <Select
                  value={formData.district_id || '__all__'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, district_id: value === '__all__' ? '' : value })
                  }
                >
                  <SelectTrigger id="district_id">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Districts</SelectItem>
                    {filteredDistricts.map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter report title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter report description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">File *</Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="cursor-pointer"
                required
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{selectedFile.name}</span>
                  <span className="text-xs">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT (Max 100MB)
            </p>
          </div>

          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Report
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

