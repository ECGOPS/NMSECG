import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from '@/contexts/DataContext';
import { PermissionService } from '@/services/PermissionService';
import { toast } from '@/components/ui/sonner';
import { UserRole } from '@/lib/types';

interface AccessControlWrapperProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  regionId?: string;
  districtId?: string;
  assetId?: string;
  inspectionId?: string;
  type?: 'asset' | 'inspection' | 'district_population' | 'analytics_dashboard' | 'analytics' | 'reliability_metrics' | 'performance_reports' | 'control_system_analytics';
}

export function AccessControlWrapper({
  children,
  requiredRole,
  regionId,
  districtId,
  assetId,
  inspectionId,
  type
}: AccessControlWrapperProps) {
  const { user } = useAzureADAuth();
  const { 
    vitAssets,
    vitInspections,
    savedInspections,
    op5Faults,
    regions,
    districts
  } = useData();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = () => {
      console.log('[AccessControlWrapper] 🔍 Checking access for:', { 
        type, 
        userRole: user?.role,
        userRegion: user?.region,
        userDistrict: user?.district,
        userId: user?.id
      });
      
      // Check if user has the required role
      if (requiredRole && user?.role && !permissionService.hasRequiredRole(user.role, requiredRole)) {
        console.log('Access denied: Required role not met');
        toast.error("You don't have permission to access this page");
        setIsAuthorized(false);
        navigate('/');
        return;
      }

      // Check district population access
      if (type === 'district_population') {
        if (!permissionService.canAccessFeature(user?.role || null, 'district_population')) {
          console.log('Access denied: Cannot access district population feature');
          toast.error("You don't have permission to access district population");
          setIsAuthorized(false);
          navigate('/');
          return;
        }
      }

      // Check analytics access
      if (type === 'analytics_dashboard' || type === 'reliability_metrics' || type === 'performance_reports' || type === 'control_system_analytics') {
        if (!permissionService.canAccessFeature(user?.role || null, type)) {
          console.log('Access denied: Cannot access analytics feature');
          toast.error("You don't have permission to access analytics");
          setIsAuthorized(false);
          navigate('/');
          return;
        }
      }

      // Check asset permissions
      if (type === 'asset') {
        // For asset list view, check if user has access to any assets
        if (!assetId) {
          if (!permissionService.canAccessFeature(user?.role || null, 'asset_management')) {
            console.log('Access denied: Cannot access asset management');
            toast.error("You don't have permission to access any assets");
            setIsAuthorized(false);
            navigate('/');
            return;
          }
        }
        // For specific asset view, check if user has access to that asset
        else {
          const asset = vitAssets.find(a => a.id === assetId);
          if (asset) {
            const region = regions.find(r => r.name === asset.region);
            const district = districts.find(d => d.name === asset.district);
            
            // Check view permission
            if (!permissionService.canViewAsset(
              user?.role || null,
              user?.region || null,
              user?.district || null,
              region?.name || '',
              district?.name || ''
            )) {
              console.log('Access denied: Cannot view specific asset');
              toast.error("You don't have permission to access this asset");
              setIsAuthorized(false);
              navigate('/asset-management');
              return;
            }

            // Check edit permission
            if (!permissionService.canUpdateFeature(user?.role || null, 'asset_management')) {
              console.log('Access denied: Cannot edit asset');
              toast.error("You don't have permission to edit this asset");
              setIsAuthorized(false);
              navigate('/asset-management');
              return;
            }
          }
        }
      }

      // Check inspection permissions
      if (type === 'inspection') {
        // For inspection list view, check if user has access to any inspections
        if (!inspectionId) {
          if (!permissionService.canAccessFeature(user?.role || null, 'inspection_management')) {
            console.log('Access denied: Cannot access inspection management');
            toast.error("You don't have permission to access any inspections");
            setIsAuthorized(false);
            navigate('/');
            return;
          }
        }
        // For specific inspection view, check if user has access to that inspection
        else {
          const vitInspection = vitInspections.find(i => i.id === inspectionId);
          const substationInspection = savedInspections?.find(i => i.id === inspectionId);
          
          if (vitInspection) {
            const asset = vitAssets.find(a => a.id === vitInspection.vitAssetId);
            if (asset) {
              const region = regions.find(r => r.name === asset.region);
              const district = districts.find(d => d.name === asset.district);
              
              // Check view permission
              if (!permissionService.canViewInspection(
                user?.role || null,
                user?.region || null,
                user?.district || null,
                region?.name || '',
                district?.name || ''
              )) {
                console.log('Access denied: Cannot view specific VIT inspection');
                toast.error("You don't have permission to access this inspection");
                setIsAuthorized(false);
                navigate('/asset-management');
                return;
              }

              // Check edit permission
              if (!permissionService.canUpdateFeature(user?.role || null, 'inspection_management')) {
                console.log('Access denied: Cannot edit inspection');
                toast.error("You don't have permission to edit this inspection");
                setIsAuthorized(false);
                navigate('/asset-management');
                return;
              }
            }
          }
          
          if (substationInspection) {
            // Check view permission
            if (!permissionService.canViewInspection(
              user?.role || null,
              user?.region || null,
              user?.district || null,
              substationInspection.region,
              substationInspection.district
            )) {
              console.log('Access denied: Cannot view specific substation inspection');
              toast.error("You don't have permission to access this inspection");
              setIsAuthorized(false);
              navigate('/asset-management');
              return;
            }

            // Check edit permission
            if (!permissionService.canUpdateFeature(user?.role || null, 'substation_inspection')) {
              console.log('Access denied: Cannot edit inspection');
              toast.error("You don't have permission to edit this inspection");
              setIsAuthorized(false);
              navigate('/asset-management');
              return;
            }
          }
        }
      }

      console.log('[AccessControlWrapper] ✅ Access granted for type:', type);
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAccess();
    
    // Subscribe to permission changes
    const unsubscribe = permissionService.addPermissionChangeListener(() => {
      console.log('Permission change detected, rechecking access');
      checkAccess();
    });

    return () => {
      unsubscribe();
    };
  }, [user, requiredRole, type, assetId, inspectionId, vitAssets, vitInspections, savedInspections, regions, districts]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
        return null;
  }

  return <>{children}</>;
} 