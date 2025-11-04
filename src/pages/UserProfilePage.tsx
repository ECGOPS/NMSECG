import React, { useState, useEffect, useRef } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';
import { useData } from '@/contexts/DataContext';
import { User as UserIcon, Edit, Save, X } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function UserProfilePage() {
  const { user, setUser } = useAzureADAuth();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<User>>({});
  const { regions, districts, regionsLoading, districtsLoading } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await apiRequest(`/api/users/${userId}`);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      toast.error('Failed to load user profile');
    }
  };



  const updateUserProfile = async (userId: string, updates: Partial<User>): Promise<boolean> => {
    try {
      await apiRequest(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      toast.success('Profile updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      toast.error('Failed to update profile');
      return false;
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadUserProfile(user.id);
    }
    // Regions and districts are now loaded globally via context
  }, [user?.id]);

  if (!user) return <div className="p-8">Not logged in.</div>;

  if (!userProfile) return <div className="p-8">Loading user profile...</div>;

  // Lookup region and district names
  const regionName = userProfile.regionId
    ? regions.find(r => r.id === userProfile.regionId)?.name
    : userProfile.region || "N/A";
  const districtName = userProfile.districtId
    ? districts.find(d => d.id === userProfile.districtId)?.name
    : userProfile.district || "N/A";



  // Helper function to get display text for region/district
  const getDisplayText = (value: string | undefined, isLoading: boolean, fallback: string = "N/A") => {
    if (isLoading) return "Loading...";
    if (!value || value === "N/A") return fallback;
    return value;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Update user document in Firestore
        await updateUserProfile(user.id, {
          photoURL: base64String,
          updatedAt: new Date().toISOString()
        });

        // Fetch updated user data
        await loadUserProfile(user.id);

      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const success = await updateUserProfile(user.id, editedProfile);
    if (success) {
      setIsEditing(false);
      await loadUserProfile(user.id);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile({});
  };

  return (
    <Layout>
      <div className="container py-6 px-2 sm:px-4 max-w-lg mx-auto">
        <Card className="shadow-lg border-none">
          <CardHeader className="flex flex-col items-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg pb-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 mb-4">
                {userProfile.photoURL ? (
                  <AvatarImage src={userProfile.photoURL} alt={userProfile.name} />
                ) : (
                  <AvatarFallback className="text-4xl">
                    {userProfile.name?.charAt(0) || userProfile.email?.charAt(0) || "U"}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Edit className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <CardTitle className="text-2xl font-bold mb-1 text-center break-words">{userProfile.name}</CardTitle>
            <div className="text-muted-foreground text-sm text-center break-all">{userProfile.email}</div>
            <div className="mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide text-center">
              {userProfile.role?.replace(/_/g, ' ')}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Staff ID</div>
                <div className="font-medium text-base break-all">{userProfile.staffId || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Region</div>
                <div className="font-medium text-base break-words">
                  {getDisplayText(regionName, regionsLoading)}
                </div>
              </div>
              <div>
                                <div className="text-xs text-muted-foreground mb-1">District/Section</div>
                <div className="font-medium text-base break-words">
                  {getDisplayText(districtName, districtsLoading)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Email</div>
                <div className="font-medium text-base break-all">{userProfile.email}</div>
              </div>
            </div>
            <div className="mt-8 text-center text-xs text-muted-foreground">
              For any changes to your profile, please contact your system administrator.
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 