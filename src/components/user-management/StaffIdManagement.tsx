import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useData } from "@/contexts/DataContext";
import { toast } from "@/components/ui/sonner";
import { UserRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Plus, Download, Upload, Search, Users, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import LoggingService from "@/services/LoggingService";
import { apiRequest } from '@/lib/api';
import { StaffIdEntry } from '@/lib/types';

export interface StaffIdEntry {
  id: string;
  name: string;
  role: UserRole;
  region: string;
  district: string;
  customId?: string;
  createdAt?: string;
}

export function StaffIdManagement() {
  const { staffIds, setStaffIds, addStaffId, updateStaffId, deleteStaffId, user: currentUser } = useAzureADAuth();
  const { regions, districts } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [newEntry, setNewEntry] = useState<Omit<StaffIdEntry, "id"> & { customId?: string }>({
    name: "",
    role: "technician",
    region: undefined,
    district: undefined,
    customId: undefined
  });
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStaffIds, setFilteredStaffIds] = useState<StaffIdEntry[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [visibleItems, setVisibleItems] = useState(50);
  const tableRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Memoize filtered results for better performance
  const filteredResults = useMemo(() => {
    if (!staffIds) return [];
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    let filtered = staffIds.filter(idObj => {
      const matchesSearch = 
        idObj.id.toLowerCase().includes(lowerCaseSearchTerm) ||
        idObj.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (idObj.region && idObj.region.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (idObj.district && idObj.district.toLowerCase().includes(lowerCaseSearchTerm));

      const matchesRole = roleFilter === "all" || idObj.role === roleFilter;
      const matchesRegion = regionFilter === "all" || idObj.region === regionFilter;
      const matchesDistrict = districtFilter === "all" || idObj.district === districtFilter;

      return matchesSearch && matchesRole && matchesRegion && matchesDistrict;
    });
    // ICT region/district restriction
    if (currentUser?.role === "ict") {
      // Hide global roles from ICT users, but allow them to see other ICT users
      const globalRoles = ["system_admin", "global_engineer"];
      filtered = filtered.filter(idObj => !globalRoles.includes(idObj.role));
      if (currentUser.district) {
        filtered = filtered.filter(idObj => idObj.district === currentUser.district);
      } else if (currentUser.region) {
        filtered = filtered.filter(idObj => idObj.region === currentUser.region);
      }
    }
    return filtered;
  }, [staffIds, searchTerm, roleFilter, regionFilter, districtFilter, currentUser]);

  // Load all staff IDs when searching
  useEffect(() => {
    const loadAllStaffIds = async () => {
      if (searchTerm || roleFilter !== "all" || regionFilter !== "all" || districtFilter !== "all") {
        setIsLoading(true);
        try {
          const params = new URLSearchParams();
          params.append('sort', 'createdAt');
          params.append('order', 'desc');
          params.append('limit', '100');
          params.append('search', searchTerm);
          params.append('role', roleFilter);
          params.append('region', regionFilter);
          params.append('district', districtFilter);
          
          const staffIds = await apiRequest(`/api/staffIds?${params.toString()}`);
          setStaffIds(staffIds);
          setFilteredStaffIds(staffIds);
          setVisibleItems(staffIds.length);
          setHasMore(false);
        } catch (error) {
          console.error("Error loading staff IDs:", error);
          toast.error("Failed to load staff IDs");
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadAllStaffIds();
  }, [searchTerm, roleFilter, regionFilter, districtFilter]);

  // Optimize initial data loading with chunked loading
  useEffect(() => {
    const loadInitialData = async () => {
      if (isInitialLoad && !searchTerm && roleFilter === "all" && regionFilter === "all" && districtFilter === "all") {
        setIsLoading(true);
        try {
          const params = new URLSearchParams();
          params.append('sort', 'createdAt');
          params.append('order', 'desc');
          params.append('limit', '50');
          
          const staffIds = await apiRequest(`/api/staffIds?${params.toString()}`);
          setStaffIds(staffIds);
          setFilteredStaffIds(staffIds);
          setLastVisible(staffIds[staffIds.length - 1]);
          setHasMore(staffIds.length === 50);
        } catch (error) {
          console.error("Error loading staff IDs:", error);
          toast.error("Failed to load staff IDs");
        } finally {
          setIsLoading(false);
          setIsInitialLoad(false);
        }
      }
    };

    loadInitialData();
  }, [isInitialLoad, setStaffIds, searchTerm, roleFilter, regionFilter, districtFilter]);

  // Load more data when scrolling (only when not searching/filtering)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || searchTerm || roleFilter !== "all" || regionFilter !== "all" || districtFilter !== "all") return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
      params.append('limit', '50');
      params.append('startAfter', lastVisible);
      
      const staffIds = await apiRequest(`/api/staffIds?${params.toString()}`);
      const newStaffIds: StaffIdEntry[] = [];
      staffIds.forEach((item: StaffIdEntry) => {
        newStaffIds.push(item);
      });
      
      setStaffIds(prev => [...prev, ...newStaffIds]);
      setFilteredStaffIds(prev => [...prev, ...newStaffIds]);
      setLastVisible(newStaffIds[newStaffIds.length - 1]);
      setHasMore(newStaffIds.length === 50);
      setVisibleItems(prev => prev + 50);
    } catch (error) {
      console.error("Error loading more staff IDs:", error);
      toast.error("Failed to load more staff IDs");
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, lastVisible, setStaffIds, searchTerm, roleFilter, regionFilter, districtFilter]);

  // Handle scroll to load more (only when not searching/filtering)
  useEffect(() => {
    const handleScroll = () => {
      if (tableRef.current && !searchTerm && roleFilter === "all" && regionFilter === "all" && districtFilter === "all") {
        const { scrollTop, scrollHeight, clientHeight } = tableRef.current;
        if (scrollHeight - scrollTop <= clientHeight * 1.5) {
          loadMore();
        }
      }
    };

    const currentRef = tableRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleScroll);
      return () => currentRef.removeEventListener('scroll', handleScroll);
    }
  }, [loadMore, searchTerm, roleFilter, regionFilter, districtFilter]);

  // Update filtered results when filters change
  useEffect(() => {
    setFilteredStaffIds(filteredResults);
    if (searchTerm || roleFilter !== "all" || regionFilter !== "all" || districtFilter !== "all") {
      setVisibleItems(filteredResults.length);
    } else {
      setVisibleItems(50);
    }
  }, [filteredResults, searchTerm, roleFilter, regionFilter, districtFilter]);

  // Optimize add function
  const handleAdd = async () => {
    setError(null);
    if (!validateEntry(newEntry)) return;

    try {
      const staffIdData = {
        ...newEntry,
        customId: newEntry.customId?.trim() || undefined
      };
      
      await addStaffId(staffIdData);
      // Log action
      await LoggingService.getInstance().logAction(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        "add",
        "staff_id",
        staffIdData.customId || staffIdData.name,
        `Added staff ID: ${staffIdData.name}`,
        staffIdData.region,
        staffIdData.district
      );
      setIsAdding(false);
      resetForm();
      toast.success("Staff ID added successfully");
    } catch (error) {
      console.error("Staff ID add error:", error);
      setError(error instanceof Error ? error.message : "Failed to add staff ID");
    }
  };

  // Optimize update function
  const handleUpdate = async (id: string) => {
    setError(null);
    const entry = staffIds.find(e => e.id === id);
    if (!entry) return;

    if (!validateEntry(entry)) return;

    try {
      await updateStaffId(id, {
        name: entry.name,
        role: entry.role,
        region: entry.region,
        district: entry.district
      });
      // Log action
      await LoggingService.getInstance().logAction(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        "edit",
        "staff_id",
        id,
        `Edited staff ID: ${entry.name}`,
        entry.region,
        entry.district
      );
      setIsEditing(null);
      toast.success("Staff ID updated successfully");
    } catch (error) {
      setError((error as Error).message);
    }
  };

  // Optimize delete function
  const handleDelete = async (id: string) => {
    try {
      await deleteStaffId(id);
      // Log action
      const entry = staffIds.find(e => e.id === id);
      await LoggingService.getInstance().logAction(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        "delete",
        "staff_id",
        id,
        `Deleted staff ID: ${entry?.name || id}`,
        entry?.region,
        entry?.district
      );
      setIsDeleting(null);
      toast.success("Staff ID deleted successfully");
    } catch (error) {
      setError((error as Error).message);
    }
  };

  // Validation helper
  const validateEntry = (entry: Omit<StaffIdEntry, "id">) => {
    if (!entry.name) {
      setError("Name is required");
      return false;
    }
    if (!entry.role) {
      setError("Role is required");
      return false;
    }
    if (entry.role !== "global_engineer" && entry.role !== "system_admin" && !entry.region) {
      setError("Region is required for this role");
      return false;
    }
    if ((entry.role === "district_engineer" || entry.role === "technician" || entry.role === "district_manager") && !entry.district) {
      setError("District is required for district engineers, technicians, and district managers");
      return false;
    }
    return true;
  };

  // Reset form helper
  const resetForm = () => {
    setNewEntry({
      name: "",
      role: "technician",
      region: undefined,
      district: undefined,
      customId: undefined
    });
    setIsAdding(false);
    setIsEditing(null);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "district_engineer":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "district_manager":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "regional_engineer":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "regional_general_manager":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "global_engineer":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "system_admin":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "technician":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "ict":
        return "bg-cyan-100 text-cyan-800 hover:bg-cyan-100";
      case "project_engineer":
        return "bg-indigo-100 text-indigo-800 hover:bg-indigo-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "district_engineer":
        return "District Engineer";
      case "district_manager":
        return "District Manager";
      case "regional_engineer":
        return "Regional Engineer";
      case "regional_general_manager":
        return "Regional General Manager";
      case "global_engineer":
        return "Global Engineer";
      case "system_admin":
        return "System Administrator";
      case "technician":
        return "Technician";
      case "ict":
        return "ICT";
      case "project_engineer":
        return "Project Engineer";
      default:
        return "Unknown Role";
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.trim()).filter(row => row);
      
      // Skip header row
      const dataRows = rows.slice(1);
      
      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const duplicateEntries: string[] = [];
      
      // Get existing staff IDs for duplicate checking
      const existingStaffIds = new Set(staffIds.map(s => s.id.toLowerCase()));
      const existingCustomIds = new Set(staffIds.map(s => s.customId?.toLowerCase()).filter(Boolean));
      
      for (const row of dataRows) {
        const [name, role, region, district, customId] = row.split(',').map(cell => cell.trim());
        
        try {
          // Validate role is a valid UserRole
          if (!['system_admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'technician', 'ict'].includes(role)) {
            throw new Error(`Invalid role: ${role}`);
          }

          // Check for duplicate custom ID
          if (customId && existingCustomIds.has(customId.toLowerCase())) {
            duplicateCount++;
            duplicateEntries.push(`${name} (Custom ID: ${customId})`);
            continue;
          }

          // Add the staff ID
          const newStaffId = await addStaffId({
            name,
            role: role as UserRole,
            region,
            district,
            customId: customId || undefined,
            createdAt: new Date().toISOString()
          });

          // Add to existing sets to prevent duplicates within the same file
          if (newStaffId) {
            existingStaffIds.add(newStaffId.toLowerCase());
            if (customId) {
              existingCustomIds.add(customId.toLowerCase());
            }
            successCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Failed to add staff: ${name}`, error);
        }
      }
      
      // Show summary toast with details
      let message = `Upload complete: ${successCount} successful`;
      if (errorCount > 0) {
        message += `, ${errorCount} failed`;
      }
      if (duplicateCount > 0) {
        message += `, ${duplicateCount} duplicates skipped`;
      }
      
      toast.success(message, {
        description: duplicateCount > 0 ? (
          <div className="mt-2">
            <p className="font-medium">Duplicate entries:</p>
            <ul className="list-disc list-inside text-sm">
              {duplicateEntries.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          </div>
        ) : undefined,
        duration: duplicateCount > 0 ? 10000 : 5000, // Show longer if there are duplicates
      });
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process the CSV file');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const downloadSample = () => {
    const sampleData = `name,role,region,district,customId
John Doe,regional_engineer,Greater Accra,,ECG001
Jane Smith,district_engineer,Ashanti,Kumasi,ECG002
Mike Johnson,technician,Western,Takoradi,ECG003
Sarah Williams,global_engineer,,,ECG004
Kwame Asante,technician,Central,Cape Coast,ECG005
Admin User,system_admin,,,ECGADMIN`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_id_sample.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Helper to request storage permission on Android
  async function requestStoragePermission() {
    if (Capacitor.getPlatform() === 'android') {
      try {
        const permStatus = await Filesystem.checkPermissions();
        if (permStatus.publicStorage !== 'granted') {
          const requestResult = await Filesystem.requestPermissions();
          if (requestResult.publicStorage !== 'granted') {
            throw new Error('Storage permission denied');
          }
        }
      } catch (e) {
        console.error('Error requesting permissions:', e);
        throw new Error('Failed to get storage permissions');
      }
    }
  }

  // Diagnostic: Minimal Share API test
  const testShareAPI = async () => {
    try {
      toast.info('Testing Share API...');
      await Share.share({
        title: 'Test Share',
        text: 'This is a test share from ECG NMS app.',
        dialogTitle: 'Share Test'
      });
      toast.success('Share dialog opened!');
    } catch (err) {
      console.error('Error with Share API:', err);
      toast.error('Share API failed: ' + (err?.message || err));
    }
  };

  const exportToCSV = async () => {
    toast.info('Starting export...');
    // Create CSV header
    const headers = ['Staff ID', 'Name', 'Role', 'Region', 'District', 'Custom ID', 'Created At'];
    // Convert staff data to CSV rows
    const rows = staffIds.map(staff => [
      staff.id,
      staff.name,
      staff.role,
      staff.region || '',
      staff.district || '',
      staff.customId || '',
      staff.createdAt || ''
    ]);
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    if (Capacitor.getPlatform() === 'android') {
      try {
        const fileName = `staff_ids_${new Date().toISOString().split('T')[0]}.csv`;
        const base64 = window.btoa(unescape(encodeURIComponent(csvContent)));
        // Save to app-private storage
        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Data,
        });
        // Prompt user to share/move the file
        await Share.share({
          title: 'Export Staff Data',
          text: 'Staff data export',
          url: fileResult.uri,
          dialogTitle: 'Share or Save Staff Data CSV'
        });
        // Show user instructions
        toast.info('To save the file to your device, select "Files" or a file manager in the share dialog.');
      } catch (err) {
        toast.error('Failed to save or share file: ' + (err?.message || err));
      }
    } else {
      // Web fallback
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staff_ids_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('File download started');
    }
  };

  // Add reset filters function
  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setRegionFilter("all");
    setDistrictFilter("all");
  };

  // For ICT users, restrict region/district filter options
  const availableRegions = useMemo(() => {
    if (currentUser?.role === "ict") {
      if (currentUser.region) {
        return regions.filter(r => r.name === currentUser.region);
      }
      return [];
    }
    return regions;
  }, [regions, currentUser]);

  const availableDistricts = useMemo(() => {
    if (currentUser?.role === "ict") {
      if (currentUser.district) {
        return districts.filter(d => d.name === currentUser.district);
      } else if (currentUser.region) {
        return districts.filter(d => d.regionId === regions.find(r => r.name === currentUser.region)?.id);
      }
      return [];
    }
    return districts;
  }, [districts, regions, currentUser]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Staff ID Management</CardTitle>
        <CardDescription className="mb-6">
          Manage staff IDs and their associated information
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* ICT Region Restriction Notice */}
        {currentUser?.role === "ict" && currentUser?.region && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm text-blue-800">
                <strong>Region Restriction:</strong> As an ICT user, you can only view and manage staff IDs from your assigned region: <strong>{currentUser.region}</strong>
                {currentUser.district && ` (District: ${currentUser.district})`}
              </p>
            </div>
          </div>
        )}
        
        <Alert>
          <AlertTitle>CSV Upload Guide</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>You can upload staff information using a CSV file with the following format:</p>
            <ul className="list-disc pl-4">
              <li>First row must be headers: name,role,region,district,customId</li>
              <li>Each subsequent row represents one staff member</li>
              <li>Fields should be separated by commas</li>
              <li>Leave district empty for regional engineers</li>
              <li>Leave region and district empty for global engineers and system administrators</li>
              <li>Custom ID is optional (6-10 alphanumeric characters)</li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={downloadSample} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Download Sample CSV
              </Button>
              {/* Export and Add Buttons */}
              <div className="flex flex-wrap gap-2 justify-end mb-4">
                {currentUser?.role !== "ict" && (
                  <Button variant="outline" onClick={exportToCSV} className="w-full sm:w-auto">
                    Export Staff Data
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                  <Label htmlFor="csv-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </Label>
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search staff IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={resetFilters} disabled={isLoading} className="w-full sm:w-auto">
                Reset Filters
              </Button>
              <Button onClick={() => setIsAdding(true)} className="w-full sm:w-auto">Add New Staff ID</Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-muted-foreground">Filters</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetFilters}
                className="text-xs"
              >
                Reset Filters
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Filter by Role</Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | "all")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="system_admin">System Admin</SelectItem>
                    <SelectItem value="global_engineer">Global Engineer</SelectItem>
                    <SelectItem value="regional_general_manager">Regional General Manager</SelectItem>
                    <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                    <SelectItem value="project_engineer">Project Engineer</SelectItem>
                    <SelectItem value="district_manager">District Manager</SelectItem>
                    <SelectItem value="district_engineer">District Engineer</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="ict">ICT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filter by Region</Label>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {availableRegions?.map(region => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filter by District/Section</Label>
                <Select value={districtFilter} onValueChange={setDistrictFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {availableDistricts?.map(district => (
                      <SelectItem key={district.id} value={district.name}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-md">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm">Total Staff:</span>
              <span className="font-bold text-primary">{staffIds.length}</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/10 px-4 py-2 rounded-md">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Showing:</span>
              <span className="font-bold text-muted-foreground">{filteredStaffIds.length}</span>
              {filteredStaffIds.length !== staffIds.length && (
                <span className="text-sm text-muted-foreground">of {staffIds.length}</span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {isAdding && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-semibold">Add New Staff ID</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Custom Staff ID (Optional)</Label>
                <Input
                  value={newEntry.customId || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, customId: e.target.value })}
                  placeholder="Enter custom ID (6-10 alphanumeric characters)"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to generate an ECGXXX format ID
                </p>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={newEntry.name}
                  onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                  placeholder="Enter name"
                  className="w-full"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={newEntry.role}
                  onValueChange={(value) => setNewEntry({ ...newEntry, role: value as UserRole })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUser?.role === "ict" ? (
                      currentUser.district ? (
                        <>
                          <SelectItem value="technician">Technician</SelectItem>
                          <SelectItem value="district_engineer">District Engineer</SelectItem>
                          <SelectItem value="district_manager">District Manager</SelectItem>
                          <SelectItem value="project_engineer">Project Engineer</SelectItem>
                          <SelectItem value="ict">ICT</SelectItem>
                        </>
                      ) : currentUser.region ? (
                        <>
                          <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                          <SelectItem value="regional_general_manager">Regional General Manager</SelectItem>
                          <SelectItem value="district_engineer">District Engineer</SelectItem>
                          <SelectItem value="district_manager">District Manager</SelectItem>
                          <SelectItem value="project_engineer">Project Engineer</SelectItem>
                          <SelectItem value="technician">Technician</SelectItem>
                          <SelectItem value="ict">ICT</SelectItem>
                        </>
                      ) : null
                    ) : (
                      <>
                        <SelectItem value="system_admin">System Admin</SelectItem>
                        <SelectItem value="global_engineer">Global Engineer</SelectItem>
                        <SelectItem value="regional_general_manager">Regional General Manager</SelectItem>
                        <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                        <SelectItem value="project_engineer">Project Engineer</SelectItem>
                        <SelectItem value="district_manager">District Manager</SelectItem>
                        <SelectItem value="district_engineer">District Engineer</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="ict">ICT</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {newEntry.role !== "global_engineer" && newEntry.role !== "system_admin" && (
                <>
                  <div>
                    <Label>Region</Label>
                    <Select
                      value={newEntry.region}
                      onValueChange={(value) => setNewEntry({ ...newEntry, region: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {availableRegions?.map(region => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(newEntry.role === "district_engineer" || newEntry.role === "technician" || newEntry.role === "district_manager") && newEntry.region && (
                    <div>
                      <Label>District/Section</Label>
                      <Select
                        value={newEntry.district}
                        onValueChange={(value) => setNewEntry({ ...newEntry, district: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select district" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDistricts
                            ?.filter(d => d.regionId === availableRegions?.find(r => r.name === newEntry.region)?.id)
                            ?.map(district => (
                              <SelectItem key={district.id} value={district.name}>
                                {district.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAdding(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleAdd} className="w-full sm:w-auto">Add</Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Registered Staff IDs</h3>
          
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredStaffIds.length === 0 ? (
            <div className="text-center p-10">
              <p className="text-muted-foreground">No staff IDs found</p>
              <p className="text-sm mt-2">Create a new staff ID by clicking the "Add New Staff ID" button above</p>
            </div>
          ) : (
            <div ref={tableRef} className="h-[600px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Staff ID</TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    <TableHead className="whitespace-nowrap">Region</TableHead>
                    <TableHead className="whitespace-nowrap">District/Section</TableHead>
                    <TableHead className="whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaffIds.slice(0, visibleItems).map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">{entry.id}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {isEditing === entry.id ? (
                          <Input
                            value={entry.name}
                            onChange={(e) => {
                              const updatedEntry = { ...entry, name: e.target.value };
                              updateStaffId(entry.id, updatedEntry);
                            }}
                            className="w-full"
                          />
                        ) : (
                          entry.name
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {isEditing === entry.id ? (
                          <Select
                            value={entry.role}
                            onValueChange={(value) => {
                              const updatedEntry = { ...entry, role: value as UserRole };
                              updateStaffId(entry.id, updatedEntry);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {currentUser?.role === "ict" ? (
                                // ICT can only assign technician, district_engineer, district_manager if district is set; or regional_engineer, regional_general_manager if only region is set
                                currentUser.district ? (
                                  <>
                                    <SelectItem value="technician">Technician</SelectItem>
                                    <SelectItem value="district_engineer">District Engineer</SelectItem>
                                    <SelectItem value="district_manager">District Manager</SelectItem>
                                    <SelectItem value="project_engineer">Project Engineer</SelectItem>
                                  </>
                                ) : currentUser.region ? (
                                  <>
                                    <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                                    <SelectItem value="regional_general_manager">Regional General Manager</SelectItem>
                                    <SelectItem value="district_engineer">District Engineer</SelectItem>
                                    <SelectItem value="district_manager">District Manager</SelectItem>
                                    <SelectItem value="project_engineer">Project Engineer</SelectItem>
                                    <SelectItem value="technician">Technician</SelectItem>
                                  </>
                                ) : null
                              ) : (
                                <>
                                  <SelectItem value="system_admin">System Admin</SelectItem>
                                  <SelectItem value="global_engineer">Global Engineer</SelectItem>
                                  <SelectItem value="regional_general_manager">Regional General Manager</SelectItem>
                                  <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                                  <SelectItem value="project_engineer">Project Engineer</SelectItem>
                                  <SelectItem value="district_manager">District Manager</SelectItem>
                                  <SelectItem value="district_engineer">District Engineer</SelectItem>
                                  <SelectItem value="technician">Technician</SelectItem>
                                  <SelectItem value="ict">ICT</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getRoleBadgeColor(entry.role)}>
                            {getRoleLabel(entry.role)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {isEditing === entry.id ? (
                          <Select
                            value={entry.region}
                            onValueChange={(value) => {
                              const updatedEntry = { ...entry, region: value };
                              updateStaffId(entry.id, updatedEntry);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {availableRegions?.map(region => (
                                <SelectItem key={region.id} value={region.name}>
                                  {region.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          entry.region || "-"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {isEditing === entry.id ? (
                          <Select
                            value={entry.district}
                            onValueChange={(value) => {
                              const updatedEntry = { ...entry, district: value };
                              updateStaffId(entry.id, updatedEntry);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select district" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDistricts
                                ?.filter(d => d.regionId === availableRegions?.find(r => r.name === entry.region)?.id)
                                ?.map(district => (
                                  <SelectItem key={district.id} value={district.name}>
                                    {district.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          entry.district || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {isEditing === entry.id ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setIsEditing(null)} className="w-full sm:w-auto">Cancel</Button>
                              <Button size="sm" onClick={() => handleUpdate(entry.id)} className="w-full sm:w-auto">Save</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setIsEditing(entry.id)} className="w-full sm:w-auto">Edit</Button>
                              {currentUser?.role !== "ict" && (
                                <Button variant="destructive" size="sm" onClick={() => setIsDeleting(entry.id)} className="w-full sm:w-auto">Delete</Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {isLoadingMore && (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleting !== null} onOpenChange={() => setIsDeleting(null)}>
          <DialogContent className="w-[95vw] sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Staff ID</DialogTitle>
              <DialogDescription className="text-destructive/90">
                Warning: This action cannot be undone. Deleting a staff ID will permanently remove it from the system.
              </DialogDescription>
            </DialogHeader>
            
            {isDeleting && staffIds.find(s => s.id === isDeleting) && (
              <div className="py-4 space-y-3 border rounded-lg bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  <h4 className="font-semibold">Staff ID Details to be Deleted</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Staff ID:</span> {isDeleting}</p>
                  <p><span className="font-medium">Name:</span> {staffIds.find(s => s.id === isDeleting)?.name}</p>
                  <p><span className="font-medium">Role:</span> {getRoleLabel(staffIds.find(s => s.id === isDeleting)?.role as UserRole)}</p>
                  {staffIds.find(s => s.id === isDeleting)?.region && (
                    <p><span className="font-medium">Region:</span> {staffIds.find(s => s.id === isDeleting)?.region}</p>
                  )}
                  {staffIds.find(s => s.id === isDeleting)?.district && (
                    <p><span className="font-medium">District:</span> {staffIds.find(s => s.id === isDeleting)?.district}</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleting(null)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => isDeleting && handleDelete(isDeleting)}
                className="w-full sm:w-auto"
              >
                Delete Staff ID
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
} 