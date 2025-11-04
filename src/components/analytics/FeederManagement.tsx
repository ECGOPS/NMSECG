import React, { useState, useEffect, useMemo } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Upload, Download, X } from "lucide-react";
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
import { FeederInfo } from "@/lib/types";
import { toast } from "sonner";
import Papa from 'papaparse';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getUserRegionAndDistrict } from "@/utils/user-utils";

import { PermissionService } from "@/services/PermissionService";
import LoggingService from "@/services/LoggingService";
import { OfflineStorageService } from "@/services/OfflineStorageService";
import { FeederService } from "@/services/FeederService";
import { apiRequest } from '@/lib/api';
import { SafeText } from '@/components/ui/safe-display';

interface CSVFeederData {
  'Region': string;
  'District'?: string;
  'Feeder Name': string;
  'Alias'?: string;
  'BSP/PSS': string;
  'Voltage Level'?: string;
  'Feeder Type'?: string;
}

export function FeederManagement() {
  const { regions, districts } = useData();
  const [feeders, setFeeders] = useState<FeederInfo[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFeeder, setSelectedFeeder] = useState<FeederInfo | null>(null);
  const [newFeeder, setNewFeeder] = useState<Partial<FeederInfo>>({
    name: "",
    alias: "",
    bspPss: "",
    region: "",
    district: "",
    voltageLevel: "",
    feederType: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { user } = useAzureADAuth();
  const permissionService = PermissionService.getInstance();
  const feederService = FeederService.getInstance();
  const offlineService = OfflineStorageService.getInstance();

  // Fetch feeders using FeederService
  useEffect(() => {
    const fetchFeeders = async () => {
      setIsLoading(true);
      try {
        const feedersData = await feederService.getAllFeeders();
        setFeeders(feedersData);
      } catch (error) {
        console.error("Error fetching feeders:", error);
        toast.error("Failed to load feeders");
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeeders();
  }, [feederService]);

  // Function to download CSV template
  const downloadCSVTemplate = () => {
    const headers = ['Region', 'District/Section', 'Feeder Name', 'Alias', 'BSP/PSS', 'Voltage Level', 'Feeder Type'];
    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'feeder_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to check for duplicates
  const isDuplicateFeeder = (name: string | undefined, bspPss: string | undefined, excludeId?: string): boolean => {
    // Return false if either name or bspPss is undefined or empty
    if (!name?.trim() || !bspPss?.trim()) return false;

    return feeders.some(feeder => {
      // Skip if feeder is missing required properties
      if (!feeder?.name || !feeder?.bspPss) return false;
      
      return feeder.name.toLowerCase() === name.toLowerCase() &&
             feeder.bspPss.toLowerCase() === bspPss.toLowerCase() &&
             (!excludeId || feeder.id !== excludeId);
    });
  };

  // Function to handle CSV upload
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const { data, errors } = Papa.parse<CSVFeederData>(text, {
        header: true,
        skipEmptyLines: true
      });

      if (errors.length > 0) {
        throw new Error('CSV parsing error: ' + errors[0].message);
      }

      if (!data || data.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Check if required headers are present
      const requiredHeaders = ['Region', 'Feeder Name', 'BSP/PSS'];
      const headers = Object.keys(data[0]);
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      // Validate data - only check required fields
      const validData = data.filter((row) => {
        const isValid = row['Feeder Name'] && 
                       row['BSP/PSS'] && 
                       row['Region'];
        
        if (!isValid) {
          console.warn('Invalid row:', row);
        }
        return isValid;
      });

      if (validData.length === 0) {
        throw new Error('No valid data found in CSV. Please check that all required fields (Region, Feeder Name, BSP/PSS) are filled.');
      }

      // Get region and district IDs
      const regionMap = new Map(regions.map(r => [r.name, r.id]));
      const districtMap = new Map(districts.map(d => [d.name, d.id]));

      // Prepare batch write
      const batch = writeBatch(db);
      const feedersRef = collection(db, "feeders");
      let skippedRows = 0;
      let duplicateRows = 0;

      for (const row of validData) {
        const regionId = regionMap.get(row['Region']);
        const districtId = row['District'] ? districtMap.get(row['District']) : null;

        if (!regionId) {
          console.warn(`Skipping feeder ${row['Feeder Name']}: Invalid region`);
          skippedRows++;
          continue;
        }

        // Check for duplicates
        if (isDuplicateFeeder(row['Feeder Name'], row['BSP/PSS'])) {
          console.warn(`Skipping duplicate feeder: ${row['Feeder Name']} (${row['BSP/PSS']})`);
          duplicateRows++;
          continue;
        }

        const feederData = {
          name: row['Feeder Name'],
          alias: row['Alias'] || '',
          bspPss: row['BSP/PSS'],
          region: row['Region'],
          district: row['District'] || '',
          regionId,
          districtId: districtId || '',
          voltageLevel: row['Voltage Level'] || '',
          feederType: row['Feeder Type'] || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const docRef = doc(feedersRef);
        batch.set(docRef, feederData);
      }

      if (skippedRows > 0) {
        toast.warning(`${skippedRows} rows were skipped due to invalid region names`);
      }

      if (duplicateRows > 0) {
        toast.warning(`${duplicateRows} rows were skipped because they are duplicates`);
      }

      await batch.commit();
      toast.success(`Successfully uploaded ${validData.length - skippedRows - duplicateRows} feeders`);
      
      // Refresh feeders list
      const querySnapshot = await getDocs(feedersRef);
      const feedersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeederInfo[];
      setFeeders(feedersData);

    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast.error('Failed to upload CSV: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleAddFeeder = async () => {
    if (!newFeeder.name || !newFeeder.bspPss || !newFeeder.region) {
      toast.error("Please fill all required fields");
      return;
    }

    // Check for duplicates
    if (isDuplicateFeeder(newFeeder.name, newFeeder.bspPss)) {
      toast.error("A feeder with this name and BSP/PSS already exists");
      return;
    }

    try {
      const regionId = regions.find(r => r.name === newFeeder.region)?.id;

      if (!regionId) {
        toast.error("Invalid region");
        return;
      }

      const feederData = {
        ...newFeeder,
        regionId,
        districtId: newFeeder.district ? districts.find(d => d.name === newFeeder.district)?.id || '' : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Use FeederService for offline support
      const newId = await feederService.addFeeder(feederData);
      const newFeederWithId = { id: newId, ...feederData } as FeederInfo;
      
      setFeeders([...feeders, newFeederWithId]);
      setIsAddDialogOpen(false);
      setNewFeeder({
        name: "",
        alias: "",
        bspPss: "",
        region: "",
        district: "",
        voltageLevel: "",
        feederType: ""
      });

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[Add] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id: newId,
          feederName: newFeeder.name,
          bspPss: newFeeder.bspPss,
          region: newFeeder.region,
          district: newFeeder.district
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Create",
          "Feeder",
          newId,
          `Created new feeder ${newFeeder.name} in ${newFeeder.region}${newFeeder.district ? `, ${newFeeder.district}` : ''}`,
          newFeeder.region,
          newFeeder.district
        );
      }

      toast.success("Feeder added successfully");
    } catch (error) {
      console.error("Error adding feeder:", error);
      toast.error("Failed to add feeder");
    }
  };

  const handleEditFeeder = async () => {
    if (!selectedFeeder) return;

    // Ensure all required fields are present and non-empty
    if (!selectedFeeder.name?.trim() || !selectedFeeder.bspPss?.trim() || !selectedFeeder.region?.trim()) {
      toast.error("Please fill all required fields");
      return;
    }

    // Check for duplicates, excluding the current feeder
    if (isDuplicateFeeder(selectedFeeder.name, selectedFeeder.bspPss, selectedFeeder.id)) {
      toast.error("A feeder with this name and BSP/PSS already exists");
      return;
    }

    try {
      const updateData = {
        ...selectedFeeder,
        updatedAt: new Date().toISOString()
      };
      
      // Use FeederService for offline support
      await feederService.updateFeeder(selectedFeeder.id, updateData);

      // Log the edit action with before/after values
      if (user?.uid && user?.name && user?.role) {
        // Find the original feeder data for comparison
        const originalFeeder = feeders.find(f => f.id === selectedFeeder.id);
        
        if (originalFeeder) {
          await LoggingService.getInstance().logEditAction(
            user.uid,
            user.name,
            user.role,
            'feeder',
            selectedFeeder.id,
            originalFeeder, // old values
            updateData, // new values
            `Updated feeder ${selectedFeeder.name} in ${selectedFeeder.region}${selectedFeeder.district ? `, ${selectedFeeder.district}` : ''}`,
            selectedFeeder.region,
            selectedFeeder.district
          );
        }
      }

      setFeeders(feeders.map(f => f.id === selectedFeeder.id ? selectedFeeder : f));
      setIsEditDialogOpen(false);
      setSelectedFeeder(null);
      toast.success("Feeder updated successfully");
    } catch (error) {
      console.error("Error updating feeder:", error);
      toast.error("Failed to update feeder");
    }
  };

  const handleDeleteFeeder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feeder?")) return;

    try {
      // Get the feeder data before deleting
      const feederToDelete = feeders.find(f => f.id === id);
      if (!feederToDelete) {
        throw new Error("Feeder not found");
      }

      // Use FeederService for offline support
      await feederService.deleteFeeder(id);
      setFeeders(feeders.filter(f => f.id !== id));

      // Log the delete action with complete data preservation
      if (user?.uid && user?.name && user?.role) {
        await LoggingService.getInstance().logDeleteAction(
          user.uid,
          user.name,
          user.role,
          'feeder',
          id,
          feederToDelete, // deleted data
          `Deleted feeder ${feederToDelete.name} from ${feederToDelete.region}${feederToDelete.district ? `, ${feederToDelete.district}` : ''}`,
          feederToDelete.region,
          feederToDelete.district
        );
      }

      toast.success("Feeder deleted successfully");
    } catch (error) {
      console.error("Error deleting feeder:", error);
      toast.error("Failed to delete feeder");
    }
  };

  const handleDeleteRegionFeeders = async () => {
    if (selectedRegion === "all") {
      toast.error("Please select a specific region to delete feeders");
      return;
    }

    try {
      const feedersToDelete = feeders.filter(f => f.regionId === selectedRegion);
      const batch = writeBatch(db);
      const regionName = regions.find(r => r.id === selectedRegion)?.name || '';

      feedersToDelete.forEach(feeder => {
        const feederRef = doc(db, "feeders", feeder.id);
        batch.delete(feederRef);
      });

      await batch.commit();
      setFeeders(feeders.filter(f => f.regionId !== selectedRegion));

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[BulkDelete] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          regionId: selectedRegion,
          regionName,
          deletedCount: feedersToDelete.length
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "BulkDelete",
          "Feeder",
          selectedRegion,
          `Deleted ${feedersToDelete.length} feeders from region ${regionName}`,
          regionName,
          ""
        );
      }

      toast.success(`Successfully deleted all feeders in ${regionName} region`);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting region feeders:", error);
      toast.error("Failed to delete region feeders");
    }
  };

  const filteredFeeders = useMemo(() => {
    let filtered = feeders;
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer') {
      filtered = filtered.filter(feeder => feeder.region === user.region);
    }
    // First apply region filter
    if (selectedRegion && selectedRegion !== "all" && filtered.some(feeder => feeder.regionId !== selectedRegion)) {
      filtered = filtered.filter(feeder => feeder.regionId === selectedRegion);
    }


    // Then apply search filter if there's a search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(feeder => (
        feeder.name.toLowerCase().includes(query) ||
        (feeder.alias && feeder.alias.toLowerCase().includes(query)) ||
        feeder.bspPss.toLowerCase().includes(query) ||
        feeder.region.toLowerCase().includes(query) ||
        feeder.district.toLowerCase().includes(query) ||
        feeder.voltageLevel.toLowerCase().includes(query) ||
        feeder.feederType.toLowerCase().includes(query)
      ));
    }

    return filtered;
  }, [feeders, user, selectedRegion, searchQuery]);

  // Calculate pagination
  const totalItems = filteredFeeders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = filteredFeeders.slice(startIndex, endIndex);

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate start and end of visible pages
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if at the start
      if (currentPage <= 2) {
        end = 4;
      }
      // Adjust if at the end
      if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }
      
      // Add ellipsis if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRegion]);

  useEffect(() => {
    if (user) {
      if (user.role === 'regional_engineer' || user.role === 'project_engineer') {
        // Set the region for regional/project engineers
        const { regionId } = getUserRegionAndDistrict(user, regions, districts);
        if (regionId) {
          setSelectedRegion(regionId);
        } else {
          setSelectedRegion("all");
        }
      } else if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
        if (regionId) {
          setSelectedRegion(regionId);
        } else {
          setSelectedRegion("all");
        }

      } else {
        setSelectedRegion("all");

      }
    } else {
      setSelectedRegion("all");
    }
  }, [user, regions, districts]);

  // Set region automatically for project_engineer on load
  useEffect(() => {
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
      const regionObj = regions.find(r => r.name === user.region);
      if (regionObj) {
        setSelectedRegion(regionObj.id);
      }
    }
  }, [user, regions]);

  // Initialize new feeder with user's region and district
  useEffect(() => {
    if (user) {
      const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
      
      if (user.role === 'district_engineer' || user.role === 'regional_engineer' || user.role === 'project_engineer' || user.role === 'district_manager' || user.role === 'regional_general_manager') {
        // For district and regional engineers, set their assigned region
        if (regionId) {
          const regionName = regions.find(r => r.id === regionId)?.name;
          if (regionName) {
            setNewFeeder(prev => ({ ...prev, region: regionName }));
          }
        }
        

      }
    }
  }, [user, regions, districts]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Feeder Management</CardTitle>
            <CardDescription>View and manage feeders across regions</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={downloadCSVTemplate} title="Download CSV Template" className="flex items-center px-2 md:px-4">
              <Download className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Download Sample</span>
            </Button>
            <div className="relative">
              <Input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                id="csv-upload"
                disabled={isUploading}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('csv-upload')?.click()}
                disabled={isUploading}
                className="flex items-center px-2 md:px-4"
              >
                <Upload className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{isUploading ? "Uploading..." : "Upload CSV"}</span>
              </Button>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Feeder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Feeder</DialogTitle>
                  <DialogDescription>Enter the details for the new feeder</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="region" className="text-right">Region</Label>
                    <Select
                      value={newFeeder.region}
                      onValueChange={(value) => setNewFeeder({ ...newFeeder, region: value })}
                      disabled={user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'regional_general_manager'}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="district" className="text-right">District/Section</Label>
                    <Select
                      value={newFeeder.district}
                      onValueChange={(value) => setNewFeeder({ ...newFeeder, district: value })}
                      disabled={user?.role === 'district_engineer' || user?.role === 'district_manager'}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select district/section" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts
                          .filter((district) => district.regionId === regions.find(r => r.name === newFeeder.region)?.id)
                          .map((district) => (
                            <SelectItem key={district.id} value={district.name}>
                              {district.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Feeder Name</Label>
                    <Input
                      id="name"
                      value={newFeeder.name}
                      onChange={(e) => setNewFeeder({ ...newFeeder, name: e.target.value })}
                      className="col-span-3"
                      placeholder="Enter feeder name"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="alias" className="text-right">Alias</Label>
                    <Input
                      id="alias"
                      value={newFeeder.alias || ""}
                      onChange={(e) => setNewFeeder({ ...newFeeder, alias: e.target.value })}
                      className="col-span-3"
                      placeholder="Enter feeder alias (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bspPss" className="text-right">BSP/PSS</Label>
                    <Input
                      id="bspPss"
                      value={newFeeder.bspPss}
                      onChange={(e) => setNewFeeder({ ...newFeeder, bspPss: e.target.value })}
                      className="col-span-3"
                      placeholder="Enter Bulk Supply Point or Primary SS"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="voltageLevel" className="text-right">Voltage Level</Label>
                    <Select
                      value={newFeeder.voltageLevel}
                      onValueChange={(value) => setNewFeeder({ ...newFeeder, voltageLevel: value })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select voltage level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="11kv">11kV</SelectItem>
                        <SelectItem value="33kv">33kV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="feederType" className="text-right">Feeder Type</Label>
                    <Select
                      value={newFeeder.feederType}
                      onValueChange={(value) => setNewFeeder({ ...newFeeder, feederType: value })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select feeder type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="underground">Underground</SelectItem>
                        <SelectItem value="overhead">Overhead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddFeeder}>Add Feeder</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="w-full sm:w-1/3">
            <Label>Region</Label>
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <Select
                value={selectedRegion}
                onValueChange={setSelectedRegion}
                disabled={user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'regional_general_manager'}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  {(user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager')
                    ? regions.filter(r => r.name === user.region).map(region => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))
                    : [<SelectItem value="all" key="all">All Regions</SelectItem>,
                       ...regions.map(region => (
                         <SelectItem key={region.id} value={region.id}>
                           {region.name}
                         </SelectItem>
                       ))]}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    setSelectedRegion("all");
            
                    setCurrentPage(1);
                  }}
                  title="Clear filters"
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={
                    selectedRegion === "all" || 
                    user?.role === 'regional_engineer' || 
                    user?.role === 'project_engineer' || 
                    user?.role === 'district_engineer' || 
                    user?.role === 'district_manager' || 
                    user?.role === 'regional_general_manager' ||
                    !permissionService.canAccessFeature(user?.role || null, 'feeder_management_delete_all')
                  }
                  title="Delete all feeders in selected region"
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

        </div>

        <div className="rounded-md border">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search feeders..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="max-w-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead>District/Section</TableHead>
                <TableHead>Feeder Name</TableHead>
                <TableHead>Alias</TableHead>
                <TableHead>BSP/PSS</TableHead>
                <TableHead>Voltage Level</TableHead>
                <TableHead>Feeder Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.map((feeder) => (
                <TableRow key={feeder.id}>
                  <TableCell><SafeText content={feeder.region} /></TableCell>
                  <TableCell><SafeText content={feeder.district} /></TableCell>
                  <TableCell><SafeText content={feeder.name} /></TableCell>
                  <TableCell><SafeText content={feeder.alias || '-'} /></TableCell>
                  <TableCell><SafeText content={feeder.bspPss} /></TableCell>
                  <TableCell><SafeText content={feeder.voltageLevel} /></TableCell>
                  <TableCell><SafeText content={feeder.feederType || '-'} /></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedFeeder(feeder);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteFeeder(feeder.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Data Summary */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {endIndex} of {totalItems} feeders
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Feeder</DialogTitle>
              <DialogDescription>Update the feeder details</DialogDescription>
            </DialogHeader>
            {selectedFeeder && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">Feeder Name</Label>
                  <Input
                    id="edit-name"
                    value={selectedFeeder.name}
                    onChange={(e) => setSelectedFeeder({ ...selectedFeeder, name: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-alias" className="text-right">Alias</Label>
                  <Input
                    id="edit-alias"
                    value={selectedFeeder.alias || ""}
                    onChange={(e) => setSelectedFeeder({ ...selectedFeeder, alias: e.target.value })}
                    className="col-span-3"
                    placeholder="Enter feeder alias (optional)"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-bspPss" className="text-right">BSP/PSS</Label>
                  <Input
                    id="edit-bspPss"
                    value={selectedFeeder.bspPss}
                    onChange={(e) => setSelectedFeeder({ ...selectedFeeder, bspPss: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-region" className="text-right">Region</Label>
                  <Select
                    value={selectedFeeder.region}
                    onValueChange={(value) => setSelectedFeeder({ ...selectedFeeder, region: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.name}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-district" className="text-right">District/Section</Label>
                  <Select
                    value={selectedFeeder.district}
                    onValueChange={(value) => setSelectedFeeder({ ...selectedFeeder, district: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts
                        .filter((district) => district.regionId === regions.find(r => r.name === selectedFeeder.region)?.id)
                        .map((district) => (
                          <SelectItem key={district.id} value={district.name}>
                            {district.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-voltageLevel" className="text-right">Voltage Level</Label>
                  <Select
                    value={selectedFeeder.voltageLevel}
                    onValueChange={(value) => setSelectedFeeder({ ...selectedFeeder, voltageLevel: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select voltage level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11kv">11kV</SelectItem>
                      <SelectItem value="33kv">33kV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-feederType" className="text-right">Feeder Type</Label>
                  <Select
                    value={selectedFeeder.feederType}
                    onValueChange={(value) => setSelectedFeeder({ ...selectedFeeder, feederType: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select feeder type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="underground">Underground</SelectItem>
                      <SelectItem value="overhead">Overhead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEditFeeder}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Region Warning Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Region Feeders</DialogTitle>
              <DialogDescription>
                You are about to delete all feeders in the {regions.find(r => r.id === selectedRegion)?.name} region.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-destructive/10 p-4 rounded-lg">
                <h4 className="font-medium text-destructive mb-2">Warning</h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>This will permanently delete all feeders in the selected region</li>
                  <li>This action cannot be undone</li>
                  <li>Any associated data with these feeders will also be affected</li>
                  <li>Please ensure you have a backup if needed</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteRegionFeeders}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete All Feeders
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
} 