import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useVITData } from '@/hooks/useVITData';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { VITAssetList } from '@/components/asset-management/VITAssetList';
import { Skeleton } from '@/components/ui/skeleton';

import { VITAsset } from '@/lib/types';
import { apiRequest } from '@/lib/api';

export function VITAssetManagementPage() {
  const { user } = useAzureADAuth();
  const { regions, districts } = useData();
  const { vitAssets, isLoading: isVITLoading, error: vitError } = useVITData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if VIT assets are still loading from the independent hook
  const isDataLoading = isVITLoading || !vitAssets || vitAssets.length === 0;

  // Pagination state for client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Optimize filtered assets with useMemo
  const filteredAssets = useMemo(() => {
    console.log('[VITAssetManagementPage] VIT assets state:', {
      vitAssetsLength: vitAssets?.length || 0,
      userRole: user?.role,
      userRegion: user?.region,
      userDistrict: user?.district,
      selectedRegion,
      selectedDistrict,
      searchTerm
    });

    if (!vitAssets || vitAssets.length === 0) {
      console.log('[VITAssetManagementPage] No VIT assets available');
      return [];
    }
    
    let filtered = vitAssets;
    
    // Apply role-based filtering
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer') {
      filtered = filtered.filter(asset => asset.region === user.region);
      console.log('[VITAssetManagementPage] Applied regional filter:', {
        originalCount: vitAssets.length,
        filteredCount: filtered.length,
        userRegion: user.region
      });
    } else if (user?.role === 'district_engineer' || user?.role === 'technician') {
      filtered = filtered.filter(asset => asset.district === user.district);
      console.log('[VITAssetManagementPage] Applied district filter:', {
        originalCount: vitAssets.length,
        filteredCount: filtered.length,
        userDistrict: user.district
      });
    }
    
    // For project engineers, ignore selectedRegion
    if (user?.role !== 'project_engineer' && selectedRegion) {
      filtered = filtered.filter(asset => asset.region === selectedRegion);
      console.log('[VITAssetManagementPage] Applied selected region filter:', {
        filteredCount: filtered.length,
        selectedRegion
      });
    }
    
    // Apply district filter
    if (selectedDistrict) {
      filtered = filtered.filter(asset => asset.district === selectedDistrict);
      console.log('[VITAssetManagementPage] Applied selected district filter:', {
        filteredCount: filtered.length,
        selectedDistrict
      });
    }
    
    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.serialNumber?.toLowerCase().includes(lowerCaseSearchTerm) ||
        asset.location?.toLowerCase().includes(lowerCaseSearchTerm) ||
        asset.typeOfUnit?.toLowerCase().includes(lowerCaseSearchTerm)
      );
      console.log('[VITAssetManagementPage] Applied search filter:', {
        filteredCount: filtered.length,
        searchTerm
      });
    }
    
    console.log('[VITAssetManagementPage] Final filtered assets:', filtered.length);
    return filtered;
  }, [vitAssets, user, selectedRegion, selectedDistrict, searchTerm]);

  // Calculate pagination
  const totalItems = filteredAssets.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);
  const hasMore = currentPage < totalPages;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRegion, selectedDistrict, searchTerm]);

  // For project engineers, always use their assigned region for filtering
  useEffect(() => {
    if (user?.role === 'project_engineer' && user.region) {
      setSelectedRegion(user.region);
    }
  }, [user]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  if (isLoading || isDataLoading) {
    return (
      <AccessControlWrapper type="asset">
        <div className="container mx-auto p-4">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </AccessControlWrapper>
    );
  }

  if (error) {
    return (
      <AccessControlWrapper type="asset">
        <div className="container mx-auto p-4">
          <div className="text-red-500">{error}</div>
        </div>
      </AccessControlWrapper>
    );
  }

  return (
    <AccessControlWrapper type="asset">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
                      <h1 className="text-2xl font-bold">Outdoor Switchgear Asset Management</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                console.log('🧪 Testing cache from Switchgear Assets page...');
                // Simple cache test
                console.log('Switchgear Assets in memory:', vitAssets.length);
                console.log('Regions loaded:', regions.length);
                console.log('Districts loaded:', districts.length);
                alert(`Cache Test Results:\n- Switchgear Assets: ${vitAssets.length}\n- Regions: ${regions.length}\n- Districts: ${districts.length}`);
              }}
            >
              🧪 Test Cache
            </Button>
            <Button asChild>
              <Link to="/asset-management/add">Add New Asset</Link>
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          {/* Only show region filter if not project engineer */}
          {user?.role !== 'project_engineer' && (
            <select
              value={selectedRegion || ''}
              onChange={e => {
                setSelectedRegion(e.target.value || null);
                setSelectedDistrict(null); // Clear district when region changes
              }}
              className="border rounded px-2 py-1"
            >
              <option value="">All Regions</option>
              {regions.map(region => (
                <option key={region.id} value={region.name}>{region.name}</option>
              ))}
            </select>
          )}
          <select
            value={selectedDistrict || ''}
            onChange={e => setSelectedDistrict(e.target.value || null)}
            disabled={!selectedRegion}
            className="border rounded px-2 py-1"
          >
            <option value="">All Districts</option>
            {districts
              .filter(district => !selectedRegion || district.name === selectedRegion || districts.find(d => d.name === selectedRegion)?.regionId === district.regionId)
              .map(district => (
                <option key={district.id} value={district.name}>{district.name}</option>
              ))}
          </select>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by serial, location, type..."
            className="border rounded px-2 py-1"
          />
        </div>
        
        <VITAssetList 
          assets={paginatedAssets} 
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          isLoading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          totalPages={totalPages}
          totalItems={totalItems}
        />
      </div>
    </AccessControlWrapper>
  );
} 