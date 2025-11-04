import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { LoadMonitoringData } from '@/lib/asset-types';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { DateRange } from "react-day-picker";
import { LoadMonitoringService } from '@/services/LoadMonitoringService';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { DataTable } from "@/components/ui/data-table";
import { Plus } from "lucide-react";
import { columns } from "./columns";
import { LoadMonitoringDialog } from "./LoadMonitoringDialog";
import { PermissionService } from '@/services/PermissionService';
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";
import { Form } from 'antd';

const { Option } = Select;
const { RangePicker } = DatePicker;

const LoadMonitoringPage: React.FC = () => {
  const { 
    loadMonitoringRecords, 
    saveLoadMonitoringRecord, 
    updateLoadMonitoringRecord, 
    deleteLoadMonitoringRecord,
    regions,
    districts,
    setLoadMonitoringRecords,
    canEditLoadMonitoring,
    canDeleteLoadMonitoring,
    initializeLoadMonitoring
  } = useData();
  const { isAuthenticated, user } = useAzureADAuth();
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filter states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LoadMonitoringData | null>(null);
  const [form] = Form.useForm();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: undefined, to: undefined });
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: LoadMonitoringData[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Online/offline status
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(false);

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${dateRange?.from?.toISOString()}-${dateRange?.to?.toISOString()}-${selectedRegion}-${selectedDistrict}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [dateRange, selectedRegion, selectedDistrict, searchTerm, user]);

  // Note: Role-based filtering is handled by the backend
  // Frontend shows user's assigned region/district in UI but doesn't apply as filters
  // This allows users to see their scope while still being able to filter within it

  // Optimize data loading with pagination and caching
  const loadData = useCallback(async (resetPagination = false) => {
    setIsLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        params.append('region', user.region);
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        params.append('district', user.district);
      }
      if (selectedRegion) params.append('region', selectedRegion);
      if (selectedDistrict) params.append('district', selectedDistrict);
      if (selectedStatus) params.append('status', selectedStatus);
      if (searchTerm) params.append('feederName', searchTerm);
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
      params.append('limit', pageSize.toString());
      params.append('offset', ((currentPage - 1) * pageSize).toString());

      // Get total count
      const countParams = new URLSearchParams(params);
      countParams.append('countOnly', 'true');
      const countRes = await apiRequest(`/api/loadMonitoring?${countParams.toString()}`);
      setTotalItems(countRes.count || 0);

      // Fetch data
      const res = await apiRequest(`/api/loadMonitoring?${params.toString()}`);
      setLoadMonitoringData(res);
      setHasMore(res.length === pageSize);
    } catch (error) {
      setError('Failed to load load monitoring data');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedRegion, selectedDistrict, selectedStatus, searchTerm, pageSize, currentPage]);

  // Load data on mount and when filters change
  useEffect(() => {
    if (isAuthenticated) {
      loadData(true);
    }
  }, [isAuthenticated, dateRange, selectedRegion, selectedDistrict, searchTerm]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  }, [isLoading, hasMore, loadData]);

  // Optimize filtered records with useMemo
  const filteredRecords = useMemo(() => {
    if (!loadMonitoringRecords) return [];
    
    // Use PermissionService for role-based filtering
    const permissionService = PermissionService.getInstance();
    if (user?.role && !permissionService.canAccessFeature(user.role, 'load_monitoring')) {
      return [];
    }
    
    let filtered = loadMonitoringRecords;
    
    // Apply role-based filtering
    if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
      filtered = filtered.filter(record => record.region === user.region);
    } else if (user?.role === 'district_engineer' || user?.role === 'technician' || user?.role === 'district_manager') {
      filtered = filtered.filter(record => record.district === user.district && record.region === user.region);
    }
    
    // Apply date range filter
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= dateRange.from! && recordDate <= dateRange.to!;
      });
    } else if (dateRange?.from) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= dateRange.from!;
      });
    } else if (dateRange?.to) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate <= dateRange.to!;
      });
    }
    
    // Apply region filter
    if (selectedRegion) {
      filtered = filtered.filter(record => record.region === selectedRegion);
    }
    
    // Apply district filter
    if (selectedDistrict) {
      filtered = filtered.filter(record => record.district === selectedDistrict);
    }
    
    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.substationName?.toLowerCase().includes(lowerCaseSearchTerm) ||
        record.substationNumber?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    
    return filtered;
  }, [loadMonitoringRecords, user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  // Filter regions and districts based on user role for UI display
  const filteredRegions = useMemo(() => {
    if (!user) return regions;
    
    // System admin and global engineer can see all regions
    if (user.role === 'system_admin' || user.role === 'global_engineer') {
      return regions;
    }
    
    // Regional users can only see their assigned region
    if (user.role === 'regional_engineer' || user.role === 'project_engineer' || user.role === 'regional_general_manager') {
      return regions.filter(r => r.name === user.region);
    }
    
    // District users can only see their assigned region
    if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        return regions.filter(r => r.id === userDistrict.regionId);
      }
    }
    
    return regions;
  }, [regions, districts, user]);

  // Filter districts based on selected region and user role
  const filteredDistricts = useMemo(() => {
    if (!user) return districts;
    
    // System admin and global engineer can see all districts in selected region
    if (user.role === 'system_admin' || user.role === 'global_engineer') {
      if (!selectedRegion) return districts;
      return districts.filter(d => d.regionId === selectedRegion);
    }
    
    // Regional users can see all districts in their region
    if (user.role === 'regional_engineer' || user.role === 'project_engineer' || user.role === 'regional_general_manager') {
      if (!selectedRegion) return districts.filter(d => {
        const userRegion = regions.find(r => r.name === user.region);
        return userRegion ? d.regionId === userRegion.id : false;
      });
      return districts.filter(d => d.regionId === selectedRegion);
    }
    
    // District users can only see their assigned district
    if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
      return districts.filter(d => d.name === user.district);
    }
    
    return districts;
  }, [districts, selectedRegion, regions, user]);

  // Handle add/edit/delete operations
  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: LoadMonitoringData) => {
    if (!canEditLoadMonitoring) {
      toast.error('You do not have permission to edit this record');
      return;
    }
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      date: moment(record.date)
    });
    setIsModalVisible(true);
  };

  const handleDelete = (record: LoadMonitoringData) => {
    if (!canDeleteLoadMonitoring) {
      toast.error('You do not have permission to delete this record');
      return;
    }
    
    // Open confirmation dialog
    const recordName = record.substationName || record.substationNumber || record.id;
    openDeleteDialog(record.id, recordName, 'load monitoring record', record);
  };

  const performDelete = async (id: string, data: any) => {
    const record = data as LoadMonitoringData;
    
    deleteLoadMonitoringRecord(record.id)
      .then(() => {
        toast.success('Record deleted successfully');
      })
      .catch((error) => {
        console.error('Error deleting record:', error);
        toast.error('Failed to delete record');
      });
  };

  // Add effect to handle online/offline status
  useEffect(() => {
    const loadMonitoringService = LoadMonitoringService.getInstance();
    setIsOnline(loadMonitoringService.isInternetAvailable());

    const handleOnlineStatusChange = () => {
      const isOnlineNow = loadMonitoringService.isInternetAvailable();
      setIsOnline(isOnlineNow);
      
      if (isOnlineNow) {
        loadMonitoringService.syncLoadMonitoringRecords();
      }
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  // Add effect to handle pending sync status
  useEffect(() => {
    const loadMonitoringService = LoadMonitoringService.getInstance();
    
    const checkPendingSync = async () => {
      const pendingRecords = await loadMonitoringService.getPendingLoadMonitoringRecords();
      setPendingSync(pendingRecords.length > 0);
    };

    checkPendingSync();
    const interval = setInterval(checkPendingSync, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    try {
      const loadMonitoringService = LoadMonitoringService.getInstance();
      await loadMonitoringService.syncLoadMonitoringRecords();
      toast.success('Load monitoring records synced successfully');
    } catch (error) {
      console.error('Error syncing load monitoring records:', error);
      toast.error('Failed to sync load monitoring records');
    }
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LoadMonitoringData | null>(null);

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await initializeLoadMonitoring();
      } catch (error) {
        console.error("Error loading load monitoring data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [initializeLoadMonitoring]);

  return (
    <AccessControlWrapper type="asset">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">DT Load Monitoring</h1>
          <div className="flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 text-yellow-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>You are offline</span>
              </div>
            )}
            {pendingSync && (
              <button
                onClick={handleSync}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </button>
            )}
            <Button
              onClick={() => {
                setSelectedRecord(null);
                setIsDialogOpen(true);
              }}
              className="inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Record
            </Button>
          </div>
        </div>

        <div className="grid gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={selectedRegion}
                    onValueChange={setSelectedRegion}
                    disabled={user?.role !== 'system_admin' && user?.role !== 'global_engineer'}
                  >
                    <SelectTrigger id="region">
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Regions</SelectItem>
                      {filteredRegions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={setSelectedDistrict}
                    disabled={user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician' || (!selectedRegion && user?.role !== 'regional_engineer' && user?.role !== 'project_engineer' && user?.role !== 'regional_general_manager')}
                  >
                    <SelectTrigger id="district">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Districts</SelectItem>
                      {filteredDistricts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-range">Date Range</Label>
                  <RangePicker
                    allowClear
                    value={dateRange && dateRange.from && dateRange.to ? [dayjs(dateRange.from), dayjs(dateRange.to)] : null}
                    onChange={(dates) => {
                      if (dates && dates[0] && dates[1]) {
                        setDateRange({ from: dates[0].toDate(), to: dates[1].toDate() });
                      } else {
                        setDateRange({ from: undefined, to: undefined });
                      }
                    }}
                    format="YYYY-MM-DD"
                    className="w-full"
                    placeholder={['Start Date', 'End Date']}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable
          columns={columns}
          data={filteredRecords}
          isLoading={isLoading}
          onEdit={canEditLoadMonitoring ? handleEdit : undefined}
          onDelete={canDeleteLoadMonitoring ? handleDelete : undefined}
        />

        <LoadMonitoringDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          record={selectedRecord}
          onSuccess={() => {
            setIsDialogOpen(false);
            setSelectedRecord(null);
          }}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isOpen}
          onClose={closeDeleteDialog}
          onConfirm={() => confirmDelete(performDelete)}
          title="Delete Load Monitoring Record"
          itemName={deleteItem?.name}
          itemType="load monitoring record"
          isLoading={isDeleting}
          warningMessage="This action cannot be undone. This will permanently delete the load monitoring record and remove all associated data from the system."
        />
      </div>
    </AccessControlWrapper>
  );
};

export default LoadMonitoringPage; 