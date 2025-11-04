import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useData } from "@/contexts/DataContext";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { PermissionService } from "@/services/PermissionService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export default function FaultListPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAzureADAuth();
  const { regions, districts } = useData();
  const [faults, setFaults] = useState<(OP5Fault | ControlSystemOutage)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissionService = PermissionService.getInstance();

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: (OP5Fault | ControlSystemOutage)[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${selectedRegion}-${selectedDistrict}-${selectedStatus}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [selectedRegion, selectedDistrict, selectedStatus, searchTerm, user]);

  // Server-side data loading function
  const loadPageData = useCallback(async (page: number = currentPage) => {
    setIsLoadingPage(true);
    setError(null);
    
    try {
      console.log('[FaultListPage] Loading page data:', {
        page,
        pageSize,
        selectedRegion,
        selectedDistrict,
        selectedStatus,
        searchTerm,
        userRole: user?.role
      });

      // Build query params
      const params = new URLSearchParams();
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        params.append('regionId', user.regionId);
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        params.append('districtId', user.districtId);
      }
      
      // Apply user-selected filters
      if (selectedRegion) params.append('regionId', selectedRegion);
      if (selectedDistrict) params.append('districtId', selectedDistrict);
      if (selectedStatus) params.append('status', selectedStatus);
      
      // Apply search term if provided
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Server-side pagination parameters
      const offset = (page - 1) * pageSize;
      params.append('limit', pageSize.toString());
      params.append('offset', offset.toString());
      params.append('sort', 'occurrenceDate');
      params.append('order', 'desc');

      // Get total count from both endpoints
      const countParams = new URLSearchParams(params);
      countParams.append('countOnly', 'true');
      
      console.log('[FaultListPage] Getting count with params:', countParams.toString());
      
      // Get counts from both endpoints
      const [op5CountRes, controlCountRes] = await Promise.all([
        apiRequest(`/api/op5Faults?${countParams.toString()}`),
        apiRequest(`/api/controlOutages?${countParams.toString()}`)
      ]);
      
      const totalCount = (op5CountRes.total || 0) + (controlCountRes.total || 0);
      setTotalItems(totalCount);

      // Fetch page data from both endpoints
      console.log('[FaultListPage] Fetching page data with params:', params.toString());
      const [op5Res, controlRes] = await Promise.all([
        apiRequest(`/api/op5Faults?${params.toString()}`),
        apiRequest(`/api/controlOutages?${params.toString()}`)
      ]);
      
      // Combine and sort results
      const op5Data = op5Res.data || op5Res || [];
      const controlData = controlRes.data || controlRes || [];
      const pageData = [...op5Data, ...controlData];
      
      // Sort by occurrence date (newest first)
      pageData.sort((a, b) => {
        const dateA = new Date(a.occurrenceDate).getTime();
        const dateB = new Date(b.occurrenceDate).getTime();
        return dateB - dateA;
      });
      
      setFaults(pageData);
      
      // Update pagination state
      setHasNextPage(offset + pageSize < totalCount);
      setHasPreviousPage(offset > 0);
      
      console.log('[FaultListPage] Page data loaded:', {
        page,
        pageSize,
        totalCount,
        pageDataCount: pageData.length,
        hasNextPage: offset + pageSize < totalCount,
        hasPreviousPage: offset > 0
      });
      
    } catch (error) {
      console.error('[FaultListPage] Failed to load page data:', error);
      setError('Failed to load faults');
      // Fallback to empty state
      setFaults([]);
      setTotalItems(0);
      setHasNextPage(false);
      setHasPreviousPage(false);
    } finally {
      setIsLoadingPage(false);
    }
  }, [user, selectedRegion, selectedDistrict, selectedStatus, searchTerm, pageSize, currentPage]);

  // Legacy data loading function (kept for compatibility)
  const loadData = useCallback(async (resetPagination = false) => {
    if (resetPagination) {
      setCurrentPage(1);
    }
    await loadPageData(resetPagination ? 1 : currentPage);
  }, [loadPageData, currentPage]);

  // Load data on mount and when filters change
  useEffect(() => {
    console.log('[FaultListPage] useEffect triggered with:', {
      isAuthenticated,
      user: user ? { role: user.role, region: user.region, district: user.district } : null,
      regionsCount: regions.length,
      districtsCount: districts.length,
      selectedRegion,
      selectedDistrict,
      selectedStatus,
      searchTerm
    });

    if (!isAuthenticated) {
      console.log('[FaultListPage] User not authenticated, navigating to login');
      navigate("/login");
      return;
    }

    // Check if user has permission to view faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      console.log('[FaultListPage] User lacks permission, navigating to unauthorized');
      navigate("/unauthorized");
      return;
    }

    // Set initial region and district based on user role
    if (user) {
      console.log('[FaultListPage] Setting initial region/district for user:', user.role);
      if ((user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') && user.region && user.district) {
        const userRegion = regions.find(r => r.name === user.region);
        console.log('[FaultListPage] Found user region:', userRegion);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
          const userDistrict = districts.find(d => d.name === user.district);
          console.log('[FaultListPage] Found user district:', userDistrict);
          if (userDistrict) {
            setSelectedDistrict(userDistrict.id);
          }
        }
      } else if ((user.role === 'regional_engineer' || user.role === 'regional_general_manager') && user.region) {
        const userRegion = regions.find(r => r.name === user.region);
        console.log('[FaultListPage] Found user region for regional role:', userRegion);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
        }
      } else if (user.role === 'ashsubt') {
        // For ashsubt - set default to first allowed Ashanti region
        const ashsubtRegions = regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
        if (ashsubtRegions.length > 0) {
          const defaultRegion = ashsubtRegions[0];
          console.log('[FaultListPage] Setting ashsubt default region:', defaultRegion);
          setSelectedRegion(defaultRegion.id);
        }
      } else if (user.role === 'accsubt') {
        // For accsubt - set default to first allowed Accra region
        const accsubtRegions = regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
        if (accsubtRegions.length > 0) {
          const defaultRegion = accsubtRegions[0];
          console.log('[FaultListPage] Setting accsubt default region:', defaultRegion);
          setSelectedRegion(defaultRegion.id);
        }
      }
    }

    console.log('[FaultListPage] Calling loadData...');
    setCurrentPage(1); // Reset to first page when filters change
    loadPageData(1);
  }, [isAuthenticated, navigate, user, regions, districts, selectedRegion, selectedDistrict, selectedStatus, searchTerm]);
  
  // Load page data when page changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadPageData(currentPage);
    }
  }, [currentPage, isAuthenticated, user]);
  
  // Load initial data when component mounts
  useEffect(() => {
    if (isAuthenticated && user) {
      loadPageData(1);
    }
  }, [isAuthenticated, user]);

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    loadPageData(1);
  }, [loadPageData]);

  // Use server-side filtered data directly
  const filteredFaults = useMemo(() => {
    // Server-side search is already applied, so just return the faults
    return faults;
  }, [faults]);

  const handleCreateFault = () => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
    
    navigate("/faults/report");
  };

  // Check if user has permission to manage faults
  const canManageFaults = user?.role ? permissionService.canAccessFeature(user.role, 'fault_reporting') : false;

  if (!isAuthenticated || loading) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-red-500">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Faults</h1>
              <p className="text-muted-foreground mt-1">
                View and manage all reported faults
              </p>
            </div>
            {canManageFaults && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => loadPageData(currentPage)}
                  disabled={isLoadingPage}
                >
                  {isLoadingPage ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                  ) : (
                    'Refresh'
                  )}
                </Button>
                <Button onClick={handleCreateFault}>Report New Fault</Button>
              </div>
            )}
          </div>

          {/* Loading Overlay */}
          {isLoadingPage && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 mx-auto"></div>
                <div className="text-sm text-muted-foreground">Loading faults...</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={selectedRegion || ""}
                onValueChange={(region) => {
                  console.log('[FaultListPage] Region changed to:', region);
                  console.log('[FaultListPage] Available districts:', districts.map(d => ({ id: d.id, name: d.name, regionId: d.regionId })));
                  setSelectedRegion(region);
                  setSelectedDistrict(null); // Clear district when region changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    console.log('[FaultListPage] Rendering region dropdown:', {
                      regionsCount: regions.length,
                      regionsData: regions.map(r => ({ id: r.id, name: r.name }))
                    });
                    return null;
                  })()}
                  <SelectItem value="">All Regions</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
                              <Label>District/Section</Label>
              <Select
                value={selectedDistrict || ""}
                onValueChange={(district) => {
                  console.log('[FaultListPage] District changed to:', district);
                  setSelectedDistrict(district);
                }}
                disabled={!selectedRegion}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const filteredDistricts = districts.filter(district => !selectedRegion || district.regionId === selectedRegion);
                    console.log('[FaultListPage] Rendering district dropdown:', {
                      selectedRegion,
                      totalDistricts: districts.length,
                      filteredDistricts: filteredDistricts.length,
                      filteredDistrictsData: filteredDistricts.map(d => ({ id: d.id, name: d.name, regionId: d.regionId }))
                    });
                    return null;
                  })()}
                  <SelectItem value="">All Districts</SelectItem>
                  {districts
                    .filter(district => !selectedRegion || district.regionId === selectedRegion)
                    .map(district => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={selectedStatus || ""}
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search faults..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(1);
                    loadPageData(1);
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentPage(1);
                  loadPageData(1);
                }}
              >
                Search
              </Button>
            </div>
          </div>

          {/* Faults List */}
          <div className="grid grid-cols-1 gap-4">
            {isLoadingPage ? (
              // Loading skeleton
              Array.from({ length: pageSize }).map((_, index) => (
                <Card key={`skeleton-${index}`} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-16 bg-gray-200 rounded"></div>
                          <div className="h-4 w-24 bg-gray-200 rounded"></div>
                        </div>
                        <div className="h-5 w-3/4 bg-gray-200 rounded"></div>
                        <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                        <div className="h-4 w-20 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredFaults.length > 0 ? (
              filteredFaults.map((fault) => {
              const isOP5 = 'substationName' in fault;
              const op5Fault = isOP5 ? fault as OP5Fault : null;
              const controlOutage = !isOP5 ? fault as ControlSystemOutage : null;

              return (
                <Card key={fault.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/faults/${fault.id}`)}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={fault.status === "pending" ? "destructive" : "default"}>
                            {fault.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(fault.occurrenceDate), "PPp")}
                          </span>
                        </div>
                        <h3 className="font-semibold">
                          {isOP5 ? op5Fault?.description : controlOutage?.reason}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {regions.find(r => r.id === fault.regionId)?.name || "Unknown"} • {districts.find(d => d.id === fault.districtId)?.name || "Unknown"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {fault.createdBy?.split(" ").map(n => n[0]).join("") || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{fault.createdBy || "Unknown User"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })) : (
              // No faults found
              <Card className="text-center py-8">
                <CardContent>
                  <div className="text-muted-foreground">
                    {error ? (
                      <div className="space-y-2">
                        <div className="text-red-500 font-medium">Error loading faults</div>
                        <div className="text-sm">{error}</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-lg font-medium">No faults found</div>
                        <div className="text-sm">Try adjusting your filters or search terms</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Label>Page Size:</Label>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => handlePageSizeChange(parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!hasPreviousPage || isLoadingPage}
              >
                Previous
              </Button>
              <span className="text-sm">
                {isLoadingPage ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    Loading...
                  </div>
                ) : (
                  `Page ${currentPage} of ${Math.ceil(totalItems / pageSize)}`
                )}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalItems / pageSize), prev + 1))}
                disabled={!hasNextPage || isLoadingPage}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 