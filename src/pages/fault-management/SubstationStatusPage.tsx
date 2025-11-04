import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Filter, Download, Eye, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { DateRange } from "react-day-picker";

const { RangePicker } = DatePicker;
import { useToast } from "@/components/ui/use-toast";
import { SubstationStatusForm } from "@/components/fault-management/SubstationStatusForm";
import { SubstationStatusTable } from "@/components/fault-management/SubstationStatusTable";
import { SubstationStatusViewDialog } from "@/components/fault-management/SubstationStatusViewDialog";
import { SubstationStatus } from "@/lib/types";
import { apiRequest } from "@/lib/api";
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { OfflineBadge } from '@/components/common/OfflineBadge';
import { Layout } from "@/components/layout/Layout";
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";

export default function SubstationStatusPage() {
  const [substationStatuses, setSubstationStatuses] = useState<SubstationStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStatus, setEditingStatus] = useState<SubstationStatus | null>(null);
  const [viewingStatus, setViewingStatus] = useState<SubstationStatus | null>(null);
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: undefined, to: undefined });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  
  const { toast } = useToast();
  const { regions, districts } = useData();
  const { user } = useAzureADAuth();
  const isDistrictScopedUser = !!user && (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician');

  // Role-based filtering for regions and districts
  const [filteredRegions, setFilteredRegions] = useState<typeof regions>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<typeof districts>([]);

  // Role-based filtering logic
  useEffect(() => {
    if (user) {
      let availableRegions = regions;
      let availableDistricts = districts;

      // Apply role-based filtering
      if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        // Regional users can only see their assigned region
        const regionId = user.regionId || (user.region ? (regions.find(r => r.id === user.region || r.name === user.region)?.id) : undefined);
        availableRegions = regionId ? regions.filter(region => region.id === regionId) : regions;
        availableDistricts = regionId ? districts.filter(district => district.regionId === regionId) : districts;
        
        // Set default region filter
        if (filterRegion === "all" && regionId) {
          setFilterRegion(regionId);
        }
      } else if (user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") {
        // District users can only see their assigned district
        const regionId = user.regionId || (user.region ? (regions.find(r => r.id === user.region || r.name === user.region)?.id) : undefined);
        const districtId = user.districtId || (user.district ? (districts.find(d => d.id === user.district || d.name === user.district)?.id) : undefined);
        availableRegions = regionId ? regions.filter(region => region.id === regionId) : regions;
        availableDistricts = districtId ? districts.filter(district => district.id === districtId) : (regionId ? districts.filter(d => d.regionId === regionId) : districts);
        
        // Set default filters
        if (filterRegion === "all" && regionId) {
          setFilterRegion(regionId);
        }
        if (filterDistrict === "all" && districtId) {
          setFilterDistrict(districtId);
        }
      } else if (user.role === "ashsubt") {
        // Ashsubt users can see all Ashanti regions
        availableRegions = regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
        availableDistricts = districts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
        
        // Set default region filter to first allowed region
        if (filterRegion === "all" && availableRegions.length > 0) {
          setFilterRegion(availableRegions[0].id);
        }
      } else if (user.role === "accsubt") {
        // Accsubt users can see all Accra regions
        availableRegions = regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
        availableDistricts = districts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
        
        // Set default region filter to first allowed region
        if (filterRegion === "all" && availableRegions.length > 0) {
          setFilterRegion(availableRegions[0].id);
        }
      }

      setFilteredRegions(availableRegions);
      setFilteredDistricts(availableDistricts);
    }
  }, [user, regions, districts]);

  // Update district filter when region changes
  useEffect(() => {
    if (filterRegion && filterRegion !== "all") {
      const regionDistricts = districts.filter(d => d.regionId === filterRegion);
      setFilteredDistricts(regionDistricts);
      
      // Reset district filter if it's not in the new region
      if (!regionDistricts.find(d => d.id === filterDistrict)) {
        setFilterDistrict("all");
      }
    } else if (filterRegion === "all") {
      // Show all districts based on user role
      if (user) {
        if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
          const regionId = user.regionId || (user.region ? (regions.find(r => r.id === user.region || r.name === user.region)?.id) : undefined);
          setFilteredDistricts(regionId ? districts.filter(d => d.regionId === regionId) : districts);
        } else if (user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") {
          const districtId = user.districtId || (user.district ? (districts.find(d => d.id === user.district || d.name === user.district)?.id) : undefined);
          setFilteredDistricts(districtId ? districts.filter(d => d.id === districtId) : districts);
        } else {
          setFilteredDistricts(districts);
        }
      }
    }
  }, [filterRegion, districts, filterDistrict, user, regions]);

  useEffect(() => {
    loadSubstationStatuses();
  }, []);

     // Reset to first page when filters change
   useEffect(() => {
     setCurrentPage(1);
   }, [filterRegion, filterDistrict, filterStatus, dateRange]);

   // Reload data when filters change (debounced to avoid excessive API calls)
   useEffect(() => {
     if (user) {
       const timeoutId = setTimeout(() => {
         loadSubstationStatuses();
       }, 300); // 300ms delay
       
       return () => clearTimeout(timeoutId);
     }
   }, [filterRegion, filterDistrict, filterStatus, dateRange, user, currentPage]);

  const loadSubstationStatuses = async () => {
    try {
      setIsLoading(true);
      
      // Build query parameters based on user role and filters
      const params = new URLSearchParams();
      
      // Note: Role-based filtering is now handled by the backend
      // Frontend only sends user-selected filters
      
      // Add filter parameters if they're not "all"
      if (filterRegion && filterRegion !== "all") {
        // Convert region ID to region name for backend
        const region = regions.find(r => r.id === filterRegion);
        if (region) {
          params.append('filterRegion', region.name);
        }
      }
      if (filterDistrict && filterDistrict !== "all") {
        // Convert district ID to district name for backend
        const district = districts.find(d => d.id === filterDistrict);
        if (district) {
          params.append('filterDistrict', district.name);
        }
      }
      if (filterStatus && filterStatus !== "all") {
        params.append('filterStatus', filterStatus);
      }
      
      // Add date range filters (send only the date part, not time)
      if (dateRange?.from) {
        const fromDate = dateRange.from.toISOString().split('T')[0];
        params.append('dateFrom', fromDate);
      }
      if (dateRange?.to) {
        const toDate = dateRange.to.toISOString().split('T')[0];
        params.append('dateTo', toDate);
      }
      
      // Add pagination parameters
      params.append('page', currentPage.toString());
      params.append('pageSize', pageSize.toString());
      
      const queryString = params.toString();
      const url = queryString ? `/api/substation-status?${queryString}` : '/api/substation-status';
      
      console.log('[SubstationStatusPage] Loading data with URL:', url);
      console.log('[SubstationStatusPage] User info:', {
        role: user?.role,
        region: user?.region,
        district: user?.district
      });
      console.log('[SubstationStatusPage] Filter values:', {
        filterRegion,
        filterDistrict,
        filterStatus,
        dateFrom: dateRange?.from,
        dateTo: dateRange?.to
      });
      
      const response = await apiRequest(url, {
        method: 'GET'
      });

      console.log('[SubstationStatusPage] API Response:', response);

      if (response.success) {
        setSubstationStatuses(response.data || []);
        // Extract pagination data from response
        if (response.totalRecords !== undefined) {
          setTotalRecords(response.totalRecords);
          setTotalPages(Math.ceil(response.totalRecords / pageSize));
        }
        console.log('[SubstationStatusPage] Loaded data:', {
          count: response.data?.length || 0,
          totalRecords: response.totalRecords,
          data: response.data
        });
      } else {
        console.error('Failed to load substation statuses:', response.error);
        toast({
          title: "Error",
          description: "Failed to load substation statuses",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading substation statuses:', error);
      toast({
        title: "Error",
        description: "Failed to load substation statuses",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (substationStatus: SubstationStatus) => {
    console.log('🔄 Parent handleSubmit called with:', substationStatus);
    try {
      if (editingStatus) {
        // Update existing
        const response = await apiRequest(`/api/substation-status/${editingStatus.id}`, {
          method: 'PUT',
          body: JSON.stringify(substationStatus)
        });

        if (response.success) {
          setSubstationStatuses(prev => 
            prev.map(status => 
              status.id === editingStatus.id ? { ...substationStatus, id: editingStatus.id } : status
            )
          );
          toast({
            title: "Success",
            description: "Substation status updated successfully",
          });
        } else {
          throw new Error(response.error || "Failed to update");
        }
      } else {
        // Create new - use the data passed from the form (already contains database ID)
        console.log('📥 Parent received substation status:', substationStatus);
        
        // Add the new record to local state immediately (at the beginning for better UX)
        setSubstationStatuses(prev => [substationStatus, ...prev]);
        
          toast({
            title: "Success",
            description: "Substation status created successfully",
          });
        
        // No need to make another API call - the form already did that
        // The record is already in local state, so no refresh needed
        // loadSubstationStatuses(); // Removed to prevent overwriting local state
      }

      setShowForm(false);
      setEditingStatus(null);
      // loadSubstationStatuses(); // Removed - not needed for new submissions
    } catch (error: any) {
      console.error('Error submitting substation status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit substation status",
        variant: "destructive"
      });
    }
  };

  const handleView = (status: SubstationStatus) => {
    setViewingStatus(status);
  };

  const handleEdit = (status: SubstationStatus) => {
    setEditingStatus(status);
    setShowForm(true);
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const status = substationStatuses.find(s => s.id === id);
      if (!status) return;

      const response = await apiRequest(`/api/substation-status/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...status,
          status: newStatus,
          updatedAt: new Date().toISOString()
        })
      });

      if (response.success) {
        setSubstationStatuses(prev =>
          prev.map(s => s.id === id ? { ...s, status: newStatus } : s)
        );
        toast({
          title: "Success",
          description: "Status updated successfully",
        });
      } else {
        throw new Error(response.error || "Failed to update");
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive"
      });
    }
  };

  const handleDelete = (id: string) => {
    const status = substationStatuses.find(s => s.id === id);
    if (!status) return;

    // Open confirmation dialog
    const statusName = status.substationName || status.id;
    openDeleteDialog(id, statusName, 'substation status', status);
  };

  const performDelete = async (id: string, data: any) => {
    try {
      const response = await apiRequest(`/api/substation-status/${id}`, {
        method: 'DELETE'
      });

      if (response.success) {
        setSubstationStatuses(prev => prev.filter(status => status.id !== id));
        toast({
          title: "Success",
          description: "Substation status deleted successfully",
        });
      } else {
        throw new Error(response.error || "Failed to delete");
      }
    } catch (error: any) {
      console.error('Error deleting substation status:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete substation status",
        variant: "destructive"
      });
    }
  };

     const handleCancel = () => {
     setShowForm(false);
     setEditingStatus(null);
   };

   const handlePageChange = (newPage: number) => {
     setCurrentPage(newPage);
   };

     // Filter substation statuses based on search only (filters are handled on the backend)
   const filteredStatuses = substationStatuses.filter(status => {
     const matchesSearch = searchTerm === "" || 
       status.substationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       status.substationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
       status.location?.toLowerCase().includes(searchTerm.toLowerCase());
     
     return matchesSearch;
   });



  if (showForm) {
    return (
      <Layout>
        <SubstationStatusForm
          substationStatus={editingStatus}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </Layout>
    );
  }

  return (
    <Layout>
             <div className="container mx-auto p-2 sm:p-4 max-w-7xl">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
           <h1 className="text-2xl sm:text-3xl font-bold">Substation Status Management</h1>
           <p className="text-muted-foreground text-sm sm:text-base">Monitor and manage substation inspection statuses</p>
        </div>
        <OfflineBadge />
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
          <CardDescription>Filter substation statuses by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by name, number, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

                         <div>
               <Label htmlFor="filterRegion">Region</Label>
               <Select value={filterRegion} onValueChange={setFilterRegion} disabled={isDistrictScopedUser}>
                 <SelectTrigger>
                   <SelectValue placeholder="All regions" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All regions</SelectItem>
                   {filteredRegions.map(region => (
                     <SelectItem key={region.id} value={region.id}>
                       {region.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             <div>
               <Label htmlFor="filterDistrict">District/Section</Label>
               <Select value={filterDistrict} onValueChange={setFilterDistrict} disabled={isDistrictScopedUser}>
                 <SelectTrigger>
                   <SelectValue placeholder="All districts/sections" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All districts/sections</SelectItem>
                   {filteredDistricts.map(district => (
                     <SelectItem key={district.id} value={district.id}>
                       {district.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

                         <div>
               <Label htmlFor="filterStatus">Status</Label>
               <Select value={filterStatus} onValueChange={setFilterStatus}>
                 <SelectTrigger>
                   <SelectValue placeholder="All statuses" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All statuses</SelectItem>
                   <SelectItem value="pending">Pending</SelectItem>
                   <SelectItem value="in-progress">In Progress</SelectItem>
                   <SelectItem value="completed">Completed</SelectItem>
                   <SelectItem value="rejected">Rejected</SelectItem>
                 </SelectContent>
               </Select>
             </div>

            <div>
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

            <div className="flex items-end">
                             <Button
                 onClick={() => {
                   setSearchTerm("");
                   setDateRange({ from: undefined, to: undefined });
                   // Reset to role-based defaults
                   if (user) {
                     if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
                       const userRegion = regions.find(r => r.name === user.region);
                       if (userRegion) {
                         setFilterRegion(userRegion.id);
                       } else {
                         setFilterRegion("all");
                       }
                       setFilterDistrict("all");
                     } else if (user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") {
                       const userDistrict = districts.find(d => d.name === user.district);
                       if (userDistrict) {
                         setFilterRegion(userDistrict.regionId);
                         setFilterDistrict(userDistrict.id);
                       } else {
                         setFilterRegion("all");
                         setFilterDistrict("all");
                       }
                     } else {
                       setFilterRegion("all");
                       setFilterDistrict("all");
                     }
                   } else {
                     setFilterRegion("all");
                     setFilterDistrict("all");
                   }
                   setFilterStatus("all");
                 }}
                 variant="outline"
                 className="w-full"
               >
                 Clear Filters
               </Button>
            </div>
          </div>
        </CardContent>
      </Card>

             {/* Actions */}
               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
         <div className="flex items-center gap-2">
           {/* Only show create button if user has permission */}
           {(user?.role === 'system_admin' || 
             user?.role === 'admin' || 
             user?.role === 'global_engineer' || 
             user?.role === 'regional_engineer' || 
             user?.role === 'district_engineer' || 
             user?.role === 'senior_technician' || 
             user?.role === 'technician' || 
             user?.role === 'assistant_technician' || 
             user?.role === 'ashsubt' || 
             user?.role === 'accsubt') && (
              <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 w-full sm:w-auto">
               <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Substation Status</span>
                <span className="sm:hidden">New</span>
             </Button>
           )}
         </div>


      </div>

      {/* Substation Statuses Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
      ) : (
        <SubstationStatusTable
          substationStatuses={filteredStatuses}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
          onStatusUpdate={handleStatusUpdate}
          userRole={user?.role}
          regions={regions}
          districts={districts}
          // Pagination props
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      )}
       
                         </div>

        {/* View Dialog */}
        <SubstationStatusViewDialog
          substationStatus={viewingStatus}
          isOpen={!!viewingStatus}
          onClose={() => setViewingStatus(null)}
          regions={regions}
          districts={districts}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isOpen}
          onClose={closeDeleteDialog}
          onConfirm={() => confirmDelete(performDelete)}
          title="Delete Substation Status"
          itemName={deleteItem?.name}
          itemType="substation status"
          isLoading={isDeleting}
          warningMessage="This action cannot be undone. This will permanently delete the substation status record and remove all associated data from the system."
        />
     </Layout>
   );
 }
