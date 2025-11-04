import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { VITAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { PermissionService } from '@/services/PermissionService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { Search, Edit, Eye, Trash2, MapPin, Zap, Settings, Plus } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { SafeText } from '@/components/ui/safe-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FeederService } from "@/services/FeederService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, FileText, Download, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportVITAssetToPDF } from "@/utils/pdfExport";
import { PhotoService } from "@/services/PhotoService";

// Helper function to format dates
const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch (error) {
    return 'Invalid Date';
  }
};

// Helper function to check if an asset is offline
const isOfflineAsset = (assetId: string): boolean => {
  return assetId.startsWith('asset_');
};

interface VITAssetsTableProps {
  assets?: VITAsset[];
  onAddAsset: () => void;
  onEditAsset: (asset: VITAsset) => void;
  onInspect?: (assetId: string) => void;
  selectedRegion?: string;
  selectedDistrict?: string;
  onRegionChange?: (region: string) => void;
  onDistrictChange?: (district: string) => void;
}

export function VITAssetsTable({ 
  assets: propAssets, 
  onAddAsset, 
  onEditAsset, 
  onInspect,
  selectedRegion: propSelectedRegion = "all",
  selectedDistrict: propSelectedDistrict = "all",
  onRegionChange,
  onDistrictChange
}: VITAssetsTableProps) {
  const { vitAssets, deleteVITAsset, regions, districts, isLoadingVITAssets, refreshVITAssets } = useData();
  
  const sourceAssets = propAssets || vitAssets;
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>(propSelectedRegion);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(propSelectedDistrict);
  const [assetToDelete, setAssetToDelete] = useState<VITAsset | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [feederAliasMap, setFeederAliasMap] = useState<Map<string, string>>(new Map());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch feeders to build alias lookup map
  useEffect(() => {
    const feederService = FeederService.getInstance();
    feederService.getAllFeeders().then(feeders => {
      const aliasMap = new Map<string, string>();
      feeders.forEach(feeder => {
        if (feeder.alias) {
          aliasMap.set(feeder.name, feeder.alias);
        }
      });
      setFeederAliasMap(aliasMap);
    }).catch(err => {
      console.warn('[VITAssetsTable] Error fetching feeders for alias lookup:', err);
    });
  }, []);

  // Get regions with counts
  const regionsWithCounts = useMemo(() => {
    const regionCounts = new Map<string, number>();
    const sourceAssets = propAssets || vitAssets;
    sourceAssets.forEach(asset => {
      if (asset.region) {
        regionCounts.set(asset.region, (regionCounts.get(asset.region) || 0) + 1);
      }
    });
    return regions?.map(region => ({
      ...region,
      count: regionCounts.get(region.name) || 0
    })) || [];
  }, [regions, propAssets, vitAssets]);

  // Get districts with counts
  const districtsWithCounts = useMemo(() => {
    const districtCounts = new Map<string, number>();
    const sourceAssets = propAssets || vitAssets;
    sourceAssets.forEach(asset => {
      if (asset.district) {
        districtCounts.set(asset.district, (districtCounts.get(asset.district) || 0) + 1);
      }
    });
    
    // Filter districts based on selected region
    let filteredDistricts = districts || [];
    if (selectedRegion && selectedRegion !== "all") {
      // Find the selected region by name to get its ID
      const selectedRegionObj = regions?.find(region => region.name === selectedRegion);
      if (selectedRegionObj) {
        // Filter districts that belong to the selected region using regionId
        filteredDistricts = districts?.filter(district => district.regionId === selectedRegionObj.id) || [];
      }
    }
    
    return filteredDistricts.map(district => ({
      ...district,
      count: districtCounts.get(district.name) || 0
    }));
  }, [districts, regions, selectedRegion, propAssets, vitAssets]);

  // Update internal state when props change
  useEffect(() => {
    setSelectedRegion(propSelectedRegion);
  }, [propSelectedRegion]);

  useEffect(() => {
    setSelectedDistrict(propSelectedDistrict);
  }, [propSelectedDistrict]);

  // Handle region change
  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    if (onRegionChange) {
      onRegionChange(region);
    }
  };

  // Handle district change
  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    if (onDistrictChange) {
      onDistrictChange(district);
    }
  };

  // Filter assets based on search term and region/district filters
  const filteredAssets = useMemo(() => {
    const sourceAssets = propAssets || vitAssets;
    
    const filtered = sourceAssets.filter(asset => {
      // Filter by search term
      if (searchTerm && !asset.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filter by region
      if (selectedRegion && selectedRegion !== "all" && asset.region !== selectedRegion) {
        return false;
      }
      
      // Filter by district
      if (selectedDistrict && selectedDistrict !== "all" && asset.district !== selectedDistrict) {
        return false;
      }
      
      return true;
    });
    
    return filtered;
  }, [propAssets, vitAssets, searchTerm, selectedRegion, selectedDistrict]);

  // Calculate total pages based on pagination type
  const totalPages = useMemo(() => {
    // Always use client-side pagination
    return Math.ceil(filteredAssets.length / pageSize);
  }, [filteredAssets.length, pageSize]);

  // Calculate paginated assets for client-side pagination
  const paginatedAssets = useMemo(() => {
    // Always use client-side pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const result = filteredAssets.slice(startIndex, endIndex);
    return result;
  }, [filteredAssets, currentPage, pageSize]);

  // Use prop assets if available, otherwise load from API
  useEffect(() => {
    // Component logic handled automatically
  }, [propAssets, filteredAssets]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRegion, selectedDistrict]);

  // Load more assets - only for client-side pagination
  useEffect(() => {
    // Client-side pagination active, no API calls needed
  }, [currentPage, pageSize]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Operational":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Under Maintenance":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Faulty":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "Decommissioned":
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
      default:
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    }
  };

  const handleDeleteClick = (asset: VITAsset) => {
    setAssetToDelete(asset);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (assetToDelete) {
      try {
        await deleteVITAsset(assetToDelete.id);
        setIsDeleteDialogOpen(false);
        setAssetToDelete(null);
      } catch (error) {
        console.error("Error deleting asset:", error);
      }
    }
  };

  const handleViewDetails = (assetId: string) => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  const handleExportPDF = async (asset: VITAsset) => {
    try {
      await exportVITAssetToPDF(asset);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRegion("all");
    setSelectedDistrict("all");
    if (onRegionChange) {
      onRegionChange("all");
    }
    if (onDistrictChange) {
      onDistrictChange("all");
    }
  };

  const exportToCsv = () => {
    // Create headers row matching the table columns
    const headers = [
      "Created At",
      "Region",
      "District",
      "Serial Number",
      "Type",
      "Voltage",
      "Feeder Name",
      "Feeder Alias",
      "Location",
      "GPS Coordinates",
      "Photo URL",
      "Status"
    ];

    // Create data rows matching the table columns and formatting
    const csvData = (propAssets && propAssets.length > 0 ? filteredAssets : vitAssets).map(asset => [
      formatDate(asset.createdAt),
      asset.region || "Unknown Region",
      asset.district || "Unknown District",
      asset.serialNumber,
      asset.typeOfUnit,
      asset.voltageLevel,
      asset.feederName || "Not specified",
      asset.feederName ? (feederAliasMap.get(asset.feederName) || "") : "",
      asset.location || "Not specified",
      asset.gpsCoordinates || "Not specified",
      asset.photoUrl || "No photo",
      asset.status
    ]);

    // Properly quote all values to handle commas and special characters
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(value => `"${(value ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `vit-assets-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );

  // Show loading skeleton when loading or no data
  if (isLoadingVITAssets || !vitAssets || vitAssets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
                    <h2 className="text-2xl font-bold">Switchgear Assets</h2>
        <p className="text-gray-600">Manage and monitor switchgear assets</p>
          </div>
          <Button onClick={onAddAsset} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {isLoadingVITAssets && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Loading switchgear assets...
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full sm:w-[250px]"
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={selectedRegion} onValueChange={handleRegionChange}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions ({propAssets?.length || vitAssets.length})</SelectItem>
                {regionsWithCounts.map((region) => (
                  <SelectItem key={region.id} value={region.name}>
                    {region.name} ({region.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedDistrict} onValueChange={handleDistrictChange}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Districts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts ({propAssets?.length || vitAssets.length})</SelectItem>
                {districtsWithCounts.map((district) => (
                  <SelectItem key={district.id} value={district.name}>
                    {district.name} ({district.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {(searchTerm || (selectedRegion && selectedRegion !== "all") || (selectedDistrict && selectedDistrict !== "all")) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="flex-1 sm:flex-none"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={exportToCsv}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={refreshVITAssets}
            disabled={isLoadingVITAssets}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingVITAssets ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button 
            size="sm" 
            className="flex-1 sm:flex-none"
            onClick={onAddAsset}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Filter Summary */}
      {(searchTerm || (selectedRegion && selectedRegion !== "all") || (selectedDistrict && selectedDistrict !== "all")) && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-md">
          <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
          {searchTerm && (
            <Badge variant="secondary" className="text-xs">
              Search: "{searchTerm}"
            </Badge>
          )}
          {selectedRegion && selectedRegion !== "all" && (
            <Badge variant="secondary" className="text-xs">
              Region: {selectedRegion}
            </Badge>
          )}
          {selectedDistrict && selectedDistrict !== "all" && (
            <Badge variant="secondary" className="text-xs">
              District: {selectedDistrict}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs"
          >
            Clear All
          </Button>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Created At</TableHead>
              <TableHead className="font-medium">Region</TableHead>
                                  <TableHead className="font-medium">District/Section</TableHead>
              <TableHead className="font-medium">Serial Number</TableHead>
              <TableHead className="font-medium">Type</TableHead>
              <TableHead className="font-medium">Voltage</TableHead>
              <TableHead className="font-medium">Feeder Name</TableHead>
              <TableHead className="font-medium">Feeder Alias</TableHead>
              <TableHead className="font-medium">Location</TableHead>
              <TableHead className="font-medium">GPS Coordinates</TableHead>
              <TableHead className="font-medium">Photo</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="text-right font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-10 text-muted-foreground">
                  {searchTerm || selectedRegion !== "all" || selectedDistrict !== "all"
                    ? "No assets found matching your filter criteria. Try adjusting your filters."
                    : "No switchgear assets found. Add some to get started!"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedAssets.map((asset, index) => (
                <TableRow
                  key={`vit-asset-${asset.id}-${index}`}
                  onClick={() => handleViewDetails(asset.id)}
                  className="cursor-pointer hover:bg-muted transition-colors"
                >
                                      <TableCell>{formatDate(asset.createdAt)}</TableCell>
                    <TableCell><SafeText content={asset.region || "Unknown Region"} /></TableCell>
                    <TableCell><SafeText content={asset.district || "Unknown District"} /></TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <SafeText content={asset.serialNumber} />
                      {isOfflineAsset(asset.id) && (
                        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                          Offline
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                                     <TableCell><SafeText content={asset.typeOfUnit} /></TableCell>
                   <TableCell><SafeText content={asset.voltageLevel} /></TableCell>
                   <TableCell><SafeText content={asset.feederName || "Not specified"} /></TableCell>
                   <TableCell><SafeText content={asset.feederName ? (feederAliasMap.get(asset.feederName) || "-") : "-"} /></TableCell>
                  <TableCell className="max-w-[250px]">
                    <div className="truncate" title={asset.location}>
                                             <SafeText content={asset.location || "Not specified"} />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[150px]">
                    <div className="truncate" title={asset.gpsCoordinates}>
                                             <SafeText content={asset.gpsCoordinates || "Not specified"} />
                    </div>
                  </TableCell>
                  <TableCell>
                    {asset.photoUrl ? (
                      <div className="flex items-center gap-2">
                        <img 
                          src={PhotoService.getInstance().convertToProxyUrl(asset.photoUrl)} 
                          alt="Asset photo" 
                          className="w-8 h-8 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Photo</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No photo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(asset.status)}>
                                             <SafeText content={asset.status} />
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(asset.id);
                        }}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onEditAsset(asset);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Asset
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onInspect && onInspect(asset.id);
                        }}>
                          <FileText className="h-4 w-4 mr-2" />
                          Add Inspection
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportPDF(asset);
                        }}>
                          <Download className="h-4 w-4 mr-2" />
                          Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(asset);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground hidden sm:block">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAssets.length)} of {filteredAssets.length} assets
          </p>
          <p className="text-sm text-muted-foreground sm:hidden">
            {filteredAssets.length} assets
          </p>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="hidden sm:inline-flex"
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{currentPage}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="hidden sm:inline-flex"
          >
            Last
          </Button>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
                             Are you sure you want to delete the switchgear asset "<SafeText content={assetToDelete?.serialNumber} />"? This will also delete all associated inspection records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
