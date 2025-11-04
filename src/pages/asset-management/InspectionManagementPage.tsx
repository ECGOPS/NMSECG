import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubstationInspection } from "@/lib/asset-types";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { toast } from "@/components/ui/sonner";
import { Eye, Pencil, Trash2, FileText, Download, MoreHorizontal, RefreshCw, Wifi, WifiOff, Save, Database } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useOffline } from "@/contexts/OfflineContext";
import { formatDate } from "@/utils/calculations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportSubstationInspectionToPDF } from "@/utils/pdfExport";
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionService } from '@/services/PermissionService';
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { offlineStorageCompat } from "@/utils/offlineStorage";
import { useOptimizedPagination } from "@/hooks/useOptimizedPagination";
import { PaginationControls } from "@/components/optimization/PaginationControls";
import { OfflineBadge } from "@/components/common/OfflineBadge";
import { DateRange } from "react-day-picker";
import { DatePicker as AntdDatePicker } from 'antd';
import dayjs from 'dayjs';
import { DatePicker } from "@/components/ui/date-picker";

const { RangePicker } = AntdDatePicker;

export default function InspectionManagementPage() {
  const { user } = useAzureADAuth();
  const { regions, districts, savedInspections, deleteInspection, refreshInspections } = useData();
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();
  const { 
    isOnline, 
    isOffline, 
    startSync,
    pendingInspections,
    pendingPhotos,
    totalOfflineItems,
    isInitialized,
    getOfflineInspections
  } = useOffline();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const saved = localStorage.getItem('inspectionManagement_selectedMonth');
    return saved ? new Date(saved) : null;
  });
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedSubstationType, setSelectedSubstationType] = useState<string | null>(null);

  // Offline data state
  const [offlineInspections, setOfflineInspections] = useState<any[]>([]);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  const pageSize = 20; // Optimized page size

  // Load offline data when component mounts
  useEffect(() => {
    const loadOfflineData = async () => {
      if (!isInitialized) return;
      
      try {
        const offlineData = await getOfflineInspections();
        setOfflineInspections(offlineData);
        console.log('[InspectionManagementPage] Loaded offline inspections:', offlineData.length);
      } catch (error) {
        console.error('[InspectionManagementPage] Failed to load offline data:', error);
      }
    };

    loadOfflineData();
  }, [isInitialized, getOfflineInspections]);

  // Create fetch function for optimized pagination hook
  const fetchPage = useCallback(async (page: number, limit: number, offset: number) => {
    const params = new URLSearchParams();
    
    // Apply role-based filtering
    if (user && user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        params.append('district', user.district || '');
      } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        params.append('region', user.region || '');
      }
    }
    
    // Apply filters
    if (selectedMonth) {
      // Month filter takes priority - format as YYYY-MM
      params.append('month', selectedMonth.toISOString().split('T')[0].substring(0, 7));
      console.log('[InspectionManagementPage] Added month filter:', selectedMonth.toISOString().split('T')[0].substring(0, 7));
    } else if (dateRange?.from && dateRange?.to) {
      // Send both dates as separate parameters for date range filtering
      params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
      params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
      console.log('[InspectionManagementPage] Added date range filter:', dateRange.from.toISOString().split('T')[0], 'to', dateRange.to.toISOString().split('T')[0]);
    } else if (dateRange?.from) {
      // If only start date is provided, use it as a single date filter
      params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
      console.log('[InspectionManagementPage] Added dateFrom filter:', dateRange.from.toISOString().split('T')[0]);
    } else if (dateRange?.to) {
      // If only end date is provided, use it as a single date filter
      params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
      console.log('[InspectionManagementPage] Added dateTo filter:', dateRange.to.toISOString().split('T')[0]);
    }
    if (selectedRegion) {
      const regionName = regions.find(r => r.id === selectedRegion)?.name;
      if (regionName) params.append('region', regionName);
    }
    if (selectedDistrict) {
      const districtName = districts.find(d => d.id === selectedDistrict)?.name;
      if (districtName) params.append('district', districtName);
    }
    if (selectedSubstationType) {
      params.append('substationType', selectedSubstationType);
    }
    if (searchTerm) {
      params.append('search', searchTerm);
    }
    
    // Server-side pagination parameters
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    params.append('sort', 'createdAt');
    params.append('order', 'desc');
    params.append('countOnly', 'false');
    
    const apiUrl = `/api/substations?${params.toString()}`;
    const response = await apiRequest(apiUrl);
    
    // Store in offline storage for offline viewing
    const pageData = response?.data || response || [];
    if (isInitialized && pageData.length > 0) {
      try {
        for (const inspection of pageData) {
          const offlineViewKey = `offline_view_${inspection.id}`;
          await offlineStorageCompat.storeInspectionForViewing(offlineViewKey, {
            ...inspection,
            storedForOfflineViewing: true,
            storedAt: Date.now()
          });
        }
      } catch (error) {
        console.warn('[InspectionManagementPage] Failed to store inspections in offline storage:', error);
      }
    }
    
    // Return in expected format
    return {
      data: pageData,
      total: response?.total || (Array.isArray(response) ? response.length : 0)
    };
  }, [user, dateRange, selectedMonth, selectedRegion, selectedDistrict, selectedSubstationType, searchTerm, regions, districts, isInitialized]);

  // Use optimized pagination hook
  const {
    data: currentPageData,
    loading: isLoadingPage,
    total: totalRecords,
    totalPages,
    currentPage,
    goToPage,
    refresh,
    clearCache,
    isOffline: isPaginatedOffline,
    isFromCache: isDataFromCache
  } = useOptimizedPagination<SubstationInspection>({
    fetchPage,
    pageSize,
    cacheKey: 'substationInspections',
    filters: {
      searchTerm,
      dateRange: dateRange ? {
        from: dateRange.from?.toISOString().split('T')[0] || null,
        to: dateRange.to?.toISOString().split('T')[0] || null
      } : null,
      month: selectedMonth ? selectedMonth.toISOString().split('T')[0].substring(0, 7) : null,
      selectedRegion,
      selectedDistrict,
      selectedSubstationType,
      userRole: user?.role,
      userDistrict: user?.district,
      userRegion: user?.region
    },
    enablePrefetch: true,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    debounceDelay: 300,
    enableOffline: true,
    initialPage: 1
  });


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
    
    // Ashsubt users can see all Ashanti regions
    if (user.role === 'ashsubt') {
      return regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
    }
    
    // Accsubt users can see all Accra regions
    if (user.role === 'accsubt') {
      return regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
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
    if (user.role === 'regional_engineer' || user.role === 'project_engineer' || user.role === 'regional_general_manager' || user.role === 'ashsubt' || user.role === 'accsubt') {
      // For ashsubt and accsubt, show districts based on selected region
      if (user.role === 'ashsubt' || user.role === 'accsubt') {
        if (!selectedRegion) {
          // Show all districts in their allowed regions
          if (user.role === 'ashsubt') {
            return districts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
          }
          if (user.role === 'accsubt') {
            return districts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
          }
        }
        return districts.filter(d => d.regionId === selectedRegion);
      }
      // For regional engineers, project engineers, and regional general managers (single assigned region)
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

  // Combine server data with offline data for display
  const allInspections = useMemo(() => {
    const serverInspections = currentPageData.map(inspection => ({
      ...inspection,
      isOffline: false,
      offlineId: null,
      syncStatus: 'synced' as const
    }));
    
    const offlineInspectionsFormatted = offlineInspections.map(inspection => {
      // Determine inspection type and ensure proper structure
      const isSecondary = inspection.data.substationType === 'secondary' || 
                         (inspection.data as any).transformer || 
                         (inspection.data as any).areaFuse || 
                         (inspection.data as any).arrestors || 
                         (inspection.data as any).switchgear || 
                         (inspection.data as any).distributionEquipment ||
                         (inspection.data as any).paintWork;
      
      // Create a properly structured inspection object
      const formattedInspection = {
        ...inspection.data,
        id: inspection.id,
        isOffline: true,
        offlineId: inspection.id,
        syncStatus: inspection.syncStatus,
        // Ensure offline inspections have required fields
        substationNo: inspection.data.substationNo || 'Offline',
        region: inspection.data.region || 'Offline',
        district: inspection.data.district || 'Offline',
        date: inspection.data.date || inspection.data.createdAt?.split('T')[0] || 'Offline',
        status: inspection.data.status || 'Pending',
        substationType: inspection.data.substationType || (isSecondary ? 'secondary' : 'primary'),
        type: inspection.data.type || (isSecondary ? 'secondary' : 'primary'),
        // Ensure items array exists for consistency
        items: inspection.data.items || []
      };
      
      return formattedInspection;
    });
    
    // Combine and sort by date (newest first)
    const combined = [...serverInspections, ...offlineInspectionsFormatted];
    return combined.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [currentPageData, offlineInspections]);

  // Reset all filters
  const handleResetFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedMonth(null);
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setSearchTerm("");
    setSelectedSubstationType(null);
    localStorage.removeItem('inspectionManagement_selectedMonth');
    goToPage(1); // Reset to first page
    clearCache(); // Clear cache when filters are reset
  };

  const handleView = (id: string) => {
    navigate(`/asset-management/inspection-details/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/asset-management/edit-inspection/${id}`);
  };

  const handleDelete = (id: string) => {
    console.log('handleDelete called with id:', id);
    // Try to find in currentPageData first (for new inspections), then savedInspections
    const inspectionToDelete = currentPageData.find(i => i.id === id) || 
                                savedInspections.find(i => i.id === id);
    
    if (!inspectionToDelete) {
      console.log('Inspection not found for id:', id);
      console.log('Searching in currentPageData:', currentPageData.length, 'items');
      console.log('Searching in savedInspections:', savedInspections.length, 'items');
      
      // Still allow delete even if not found in local state
      const inspectionName = 'This Inspection Record';
      openDeleteDialog(id, inspectionName, 'inspection', null);
      return;
    }

    console.log('Opening delete dialog for inspection:', inspectionToDelete);
    // Open confirmation dialog - use substation name or a more descriptive name
    const inspectionName = inspectionToDelete.substationName || 
                          inspectionToDelete.substationNo || 
                          `Inspection ${inspectionToDelete.inspectionDate || inspectionToDelete.date || 'Record'}` ||
                          'Inspection Record';
    openDeleteDialog(id, inspectionName, 'inspection', inspectionToDelete);
  };

  const performDelete = async (id: string, data: any) => {
    deleteInspection(id);
    toast.success("Inspection deleted successfully");
  };

  const handleExportToPDF = async (inspection: SubstationInspection) => {
    try {
      console.log('Attempting to export inspection to PDF:', inspection.id);
      await exportSubstationInspectionToPDF(inspection);
      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error("Error in handleExportToPDF:", error);
      if (error instanceof Error) {
        toast.error(`Failed to generate PDF: ${error.message}`);
      } else {
        toast.error("Failed to generate PDF report. Please check the console for details.");
      }
    }
  };

  const handleExportToCSV = (inspection: SubstationInspection) => {
    // Create CSV content
    const csvContent = [
      ["Substation Inspection Report"],
      ["Date", formatDate(inspection.date)],
      ["Substation No", inspection.substationNo],
      ["Substation Name", inspection.substationName || "Not specified"],
      ["Region", inspection.region],
      ["District", inspection.district],
      ["Type", inspection.type],
      ["Substation Type", inspection.substationType || "primary"],
      ["Location", inspection.location || "Not specified"],
      ["GPS Location", inspection.gpsLocation || "Not specified"],
      ["Voltage Level", inspection.voltageLevel || "Not specified"],
      ["Inspected By", inspection.inspectedBy || "Not specified"],
      [],
      ["Inspection Items"],
      ["Category", "Item", "Status", "Remarks"]
    ];

    // Add inspection items based on substation type
    if (inspection.substationType === "secondary") {
      // Handle secondary substation items
      const categories = [
        { name: "Site Condition", items: inspection.siteCondition || [] },
        { name: "Transformer", items: (inspection as any).transformer || [] },
        { name: "Area Fuse", items: (inspection as any).areaFuse || [] },
        { name: "Arrestors", items: (inspection as any).arrestors || [] },
        { name: "Switchgear", items: (inspection as any).switchgear || [] },
        { name: "Distribution Equipment", items: (inspection as any).distributionEquipment || [] },
        { name: "Paint Work", items: (inspection as any).paintWork || [] }
      ];

      categories.forEach(category => {
        if (category.items && category.items.length > 0) {
          category.items.forEach(item => {
            if (item && item.name) {  // Add null check for item and item.name
              csvContent.push([
                category.name,
                item.name,
                item.status || "Not specified",
                item.remarks || ""
              ]);
            }
          });
        }
      });
    } else {
      // Handle primary substation items
      const categories = [
        { name: "Site Condition", items: inspection.siteCondition || [] },
        { name: "General Building", items: inspection.generalBuilding || [] },
        { name: "Control Equipment", items: inspection.controlEquipment || [] },
        { name: "Basement", items: inspection.basement || [] },
        { name: "Power Transformer", items: inspection.powerTransformer || [] },
        { name: "Outdoor Equipment", items: inspection.outdoorEquipment || [] }
      ];

      categories.forEach(category => {
        if (category.items && category.items.length > 0) {
          category.items.forEach(item => {
            if (item && item.name) {  // Add null check for item and item.name
              csvContent.push([
                category.name,
                item.name,
                item.status || "Not specified",
                item.remarks || ""
              ]);
            }
          });
        }
      });
    }

    // Add remarks if available
    if (inspection.remarks) {
      csvContent.push([]);
      csvContent.push(["Remarks"]);
      csvContent.push([inspection.remarks]);
    }

    // Convert to CSV string
    const csvString = csvContent.map(row => row.join(",")).join("\n");
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const downloadUrl = URL.createObjectURL(blob);
    link.setAttribute("href", downloadUrl);
    link.setAttribute("download", `substation-inspections-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV report generated successfully");
  };

  // Export loading states
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportAllToCSV = async () => {
    setIsExportingCSV(true);
    try {
      // Fetch all data for export (not just current page)
      const params = new URLSearchParams();
      
      // Apply role-based filtering
      if (user && user.role !== "system_admin" && user.role !== "global_engineer") {
        if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
          params.append('district', user.district || '');
        } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
          params.append('region', user.region || '');
        }
      }
      
      // Apply filters
      if (selectedMonth) {
        // Month filter takes priority - format as YYYY-MM
        params.append('month', selectedMonth.toISOString().split('T')[0].substring(0, 7));
      } else if (dateRange?.from && dateRange?.to) {
        params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
        params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
      } else if (dateRange?.from) {
        params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
      } else if (dateRange?.to) {
        params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
      }
      if (selectedRegion) {
        const regionName = regions.find(r => r.id === selectedRegion)?.name;
        if (regionName) params.append('region', regionName);
      }
      if (selectedDistrict) {
        const districtName = districts.find(d => d.id === selectedDistrict)?.name;
        if (districtName) params.append('district', districtName);
      }
      if (selectedSubstationType) {
        params.append('substationType', selectedSubstationType);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Get all data for export (no pagination)
      params.append('limit', '10000'); // Large limit to get all data
      params.append('offset', '0');
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
      params.append('countOnly', 'false');
      
      const apiUrl = `/api/substations?${params.toString()}`;
      const response = await apiRequest(apiUrl);
      const allInspections = response?.data || response || [];
      
    // Create CSV content with headers
    const headers = [
      "Inspection No",
      "Date",
      "Substation No",
      "Substation Name",
      "Region",
      "District",
      "Type",
      "Substation Type",
      "Location",
      "GPS Location",
      "Voltage Level",
      "Inspected By",
      "Category",
      "Item",
      "Status",
      "Remarks",
      "Overall Condition"
    ];

    // Initialize rows array with headers
    const rows = [headers];

    // Add each inspection as rows
      allInspections.forEach((inspection, index) => {
      // Get all items based on substation type
      const isSecondary = inspection.substationType === 'secondary' ||
                          ((inspection as any).transformer && (inspection as any).transformer.length > 0) ||
                          ((inspection as any).areaFuse && (inspection as any).areaFuse.length > 0) ||
                          ((inspection as any).arrestors && (inspection as any).arrestors.length > 0) ||
                          ((inspection as any).switchgear && (inspection as any).switchgear.length > 0) ||
                          ((inspection as any).distributionEquipment && (inspection as any).distributionEquipment.length > 0) ||
                          ((inspection as any).paintWork && (inspection as any).paintWork.length > 0);

      const items = isSecondary
        ? [
            ...(inspection.siteCondition || []).map(item => ({ ...item, category: "Site Condition" })),
            ...((inspection as any).transformer || []).map(item => ({ ...item, category: "Transformer" })),
            ...((inspection as any).areaFuse || []).map(item => ({ ...item, category: "Area Fuse" })),
            ...((inspection as any).arrestors || []).map(item => ({ ...item, category: "Arrestors" })),
            ...((inspection as any).switchgear || []).map(item => ({ ...item, category: "Switchgear" })),
            ...((inspection as any).distributionEquipment || []).map(item => ({ ...item, category: "Distribution Equipment" })),
            ...((inspection as any).paintWork || []).map(item => ({ ...item, category: "Paint Work" }))
          ]
        : [
            ...(inspection.siteCondition || []).map(item => ({ ...item, category: "Site Condition" })),
            ...(inspection.generalBuilding || []).map(item => ({ ...item, category: "General Building" })),
            ...(inspection.controlEquipment || []).map(item => ({ ...item, category: "Control Equipment" })),
            ...(inspection.basement || []).map(item => ({ ...item, category: "Basement" })),
            ...(inspection.powerTransformer || []).map(item => ({ ...item, category: "Power Transformer" })),
            ...(inspection.outdoorEquipment || []).map(item => ({ ...item, category: "Outdoor Equipment" }))
          ];

      // Calculate overall condition
      const goodItems = items.filter(item => item?.status === "good").length;
      const totalItems = items.length;
      const percentageGood = totalItems > 0 ? (goodItems / totalItems) * 100 : 0;
      const overallCondition = percentageGood >= 80 ? "Excellent" : percentageGood >= 60 ? "Good" : "Needs Attention";

      // Add a row for each item
      items.forEach(item => {
        if (item && item.name) {
          rows.push([
            (index + 1).toString(),
            formatDate(inspection.date),
            inspection.substationNo,
            inspection.substationName || "Not specified",
            inspection.region,
            inspection.district,
            inspection.type,
            inspection.substationType || (isSecondary ? 'secondary' : 'primary'),
            inspection.location || "Not specified",
            inspection.gpsLocation || "Not specified",
            inspection.voltageLevel || "Not specified",
            inspection.inspectedBy || "Not specified",
            item.category,
            item.name,
            item.status || "Not specified",
            item.remarks || "",
            overallCondition
          ]);
        }
      });

      // If there are no items, add at least one row with basic information
      if (items.length === 0) {
        rows.push([
          (index + 1).toString(),
          formatDate(inspection.date),
          inspection.substationNo,
          inspection.substationName || "Not specified",
          inspection.region,
          inspection.district,
          inspection.type,
          inspection.substationType || (isSecondary ? 'secondary' : 'primary'),
          inspection.location || "Not specified",
          inspection.gpsLocation || "Not specified",
          inspection.voltageLevel || "Not specified",
          inspection.inspectedBy || "Not specified",
          "No Items",
          "No Items",
          "Not specified",
          inspection.remarks || "",
          "Not specified"
        ]);
      }
    });

    // Calculate summary statistics
      const totalInspections = allInspections.length;
      const totalItems = allInspections.reduce((sum, inspection) => {
      const isSecondary = inspection.substationType === 'secondary' ||
                          (inspection.transformer && inspection.transformer.length > 0) ||
                          (inspection.areaFuse && inspection.areaFuse.length > 0) ||
                          (inspection.arrestors && inspection.arrestors.length > 0) ||
                          (inspection.switchgear && inspection.switchgear.length > 0) ||
                          (inspection.distributionEquipment && inspection.distributionEquipment.length > 0) ||
                          (inspection.paintWork && inspection.paintWork.length > 0);

      const items = isSecondary
        ? [...(inspection.siteCondition || []), ...(inspection.transformer || []),
           ...(inspection.areaFuse || []), ...(inspection.arrestors || []),
           ...(inspection.switchgear || []), ...(inspection.distributionEquipment || []), ...(inspection.paintWork || [])]
        : [...(inspection.siteCondition || []), ...(inspection.generalBuilding || []),
           ...(inspection.controlEquipment || []), ...(inspection.basement || []),
           ...(inspection.powerTransformer || []), ...(inspection.outdoorEquipment || [])];
      return sum + items.length;
    }, 0);

      const totalGoodItems = allInspections.reduce((sum, inspection) => {
      const isSecondary = inspection.substationType === 'secondary' ||
                          (inspection.transformer && inspection.transformer.length > 0) ||
                          (inspection.areaFuse && inspection.areaFuse.length > 0) ||
                          (inspection.arrestors && inspection.arrestors.length > 0) ||
                          (inspection.switchgear && inspection.switchgear.length > 0) ||
                          (inspection.distributionEquipment && inspection.distributionEquipment.length > 0) ||
                          (inspection.paintWork && inspection.paintWork.length > 0);

      const items = isSecondary
        ? [...(inspection.siteCondition || []), ...(inspection.transformer || []),
           ...(inspection.areaFuse || []), ...(inspection.arrestors || []),
           ...(inspection.switchgear || []), ...(inspection.distributionEquipment || []), ...(inspection.paintWork || [])]
        : [...(inspection.siteCondition || []), ...(inspection.generalBuilding || []),
           ...(inspection.controlEquipment || []), ...(inspection.basement || []),
           ...(inspection.powerTransformer || []), ...(inspection.outdoorEquipment || [])];
      return sum + items.filter(item => item?.status === "good").length;
    }, 0);

    const totalBadItems = totalItems - totalGoodItems;
    const overallPercentageGood = totalItems > 0 ? (totalGoodItems / totalItems) * 100 : 0;

    // Add summary rows
    rows.push(
      ["SUMMARY STATISTICS", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Total Inspections", totalInspections.toString(), "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Total Items Checked", totalItems.toString(), "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Items in Good Condition", `${totalGoodItems} (${overallPercentageGood.toFixed(1)}%)`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Items Requiring Attention", `${totalBadItems} (${(100 - overallPercentageGood).toFixed(1)}%)`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Overall Condition", overallPercentageGood >= 80 ? "Excellent" : overallPercentageGood >= 60 ? "Good" : "Needs Attention", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    );

    // Convert to CSV string
    const csvString = rows.map(row => 
      row.map(cell => {
        const stringCell = String(cell);
        // Enclose fields with commas, double quotes, or newlines in double quotes
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          // Escape double quotes within the field by doubling them
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(',')
    ).join('\n');
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
      const downloadUrl = URL.createObjectURL(blob);
      link.setAttribute("href", downloadUrl);
    link.setAttribute("download", `substation-inspections-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("All inspections exported to CSV successfully");
    } catch (error) {
      toast.error("Failed to generate CSV report");
      console.error("Error generating CSV:", error);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportAllToPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Fetch all data for export (not just current page)
      const params = new URLSearchParams();
      
      // Apply role-based filtering
      if (user && user.role !== "system_admin" && user.role !== "global_engineer") {
        if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
          params.append('district', user.district || '');
        } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
          params.append('region', user.region || '');
        }
      }
      
      // Apply filters
      if (selectedMonth) {
        // Month filter takes priority - format as YYYY-MM
        params.append('month', selectedMonth.toISOString().split('T')[0].substring(0, 7));
      } else if (dateRange?.from && dateRange?.to) {
        params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
        params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
      } else if (dateRange?.from) {
        params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
      } else if (dateRange?.to) {
        params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
      }
      if (selectedRegion) {
        const regionName = regions.find(r => r.id === selectedRegion)?.name;
        if (regionName) params.append('region', regionName);
      }
      if (selectedDistrict) {
        const districtName = districts.find(d => d.id === selectedDistrict)?.name;
        if (districtName) params.append('district', districtName);
      }
      if (selectedSubstationType) {
        params.append('substationType', selectedSubstationType);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Get all data for export (no pagination)
      params.append('limit', '10000'); // Large limit to get all data
      params.append('offset', '0');
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
      params.append('countOnly', 'false');
      
      const apiUrl = `/api/substations?${params.toString()}`;
      const response = await apiRequest(apiUrl);
      const allInspections = response?.data || response || [];
      
      // Create a single PDF with all inspections
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]); // A4 size
      const { width, height } = page.getSize();
      const fontSize = 11;
      const lineHeight = fontSize * 1.5;
      const margin = 40;
      const contentWidth = width - (margin * 2);
      let y = height - margin;

      // Embed fonts
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await doc.embedFont(StandardFonts.Helvetica);

      // Add header with title
      page.drawText("ECG ASSET MANAGEMENT SYSTEM", {
        x: margin,
        y,
        size: 18,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });

      page.drawText("SUBSTATION INSPECTION REPORT", {
        x: margin,
        y: y - lineHeight,
        size: 14,
        color: rgb(0.3, 0.3, 0.3),
        font: regularFont,
      });

      y -= lineHeight * 2;

      // Add report metadata
      const metadata = [
        { label: "Report Generated", value: new Date().toLocaleString() },
        { label: "Total Inspections", value: allInspections.length.toString() },
        { label: "Report Period", value: `${formatDate(allInspections[0]?.date)} to ${formatDate(allInspections[allInspections.length - 1]?.date)}` },
      ];

      metadata.forEach(item => {
        page.drawText(item.label + ":", {
          x: margin,
          y,
          size: fontSize,
          color: rgb(0.3, 0.3, 0.3),
          font: boldFont,
        });

        page.drawText(item.value, {
          x: margin + 150,
          y,
          size: fontSize,
          color: rgb(0, 0, 0),
          font: regularFont,
        });
        y -= lineHeight;
      });

      y -= lineHeight * 2;

      // Add executive summary
      page.drawText("EXECUTIVE SUMMARY", {
        x: margin,
        y,
        size: fontSize + 2,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });

      y -= lineHeight * 1.5;

      // Calculate overall statistics
      const pdfTotalItems = allInspections.reduce((sum, inspection) => sum + inspection.items.length, 0);
      const pdfTotalGoodItems = allInspections.reduce((sum, inspection) => 
        sum + inspection.items.filter(item => item.status === "good").length, 0);
      const pdfTotalBadItems = allInspections.reduce((sum, inspection) => 
        sum + inspection.items.filter(item => item.status === "bad").length, 0);
      const overallPercentageGood = pdfTotalItems > 0 ? (pdfTotalGoodItems / pdfTotalItems) * 100 : 0;

      const summaryText = [
        `Total Substations Inspected: ${allInspections.length}`,
        `Total Items Checked: ${pdfTotalItems}`,
        `Items in Good Condition: ${pdfTotalGoodItems} (${overallPercentageGood.toFixed(1)}%)`,
        `Items Requiring Attention: ${pdfTotalBadItems} (${(100 - overallPercentageGood).toFixed(1)}%)`,
      ];

      summaryText.forEach(text => {
        page.drawText(text, {
          x: margin + 20,
          y,
          size: fontSize,
          color: rgb(0, 0, 0),
          font: regularFont,
        });
        y -= lineHeight;
      });

      y -= lineHeight * 2;

      // Add each inspection
      for (const inspection of allInspections) {
        // Check if we need a new page
        if (y < margin + 200) {
          const newPage = doc.addPage([595.28, 841.89]);
          y = height - margin;
        }

        // Add inspection header
        page.drawText(`SUBSTATION INSPECTION: ${inspection.substationNo}`, {
          x: margin,
          y,
          size: fontSize + 2,
          color: rgb(0, 0.2, 0.4),
          font: boldFont,
        });
        y -= lineHeight * 1.5;

        // Add inspection details
        const details = [
          { label: "Date", value: formatDate(inspection.date) },
          { label: "Region", value: inspection.region },
          { label: "District/Section", value: inspection.district },
          { label: "Type", value: inspection.type },
          { label: "Substation Name", value: inspection.substationName || "Not specified" },
          { label: "Inspected By", value: inspection.createdBy || "Unknown" },
          { label: "Inspection Date", value: inspection.createdAt ? new Date(inspection.createdAt).toLocaleString() : "Unknown" },
        ];

        details.forEach(detail => {
          page.drawText(detail.label + ":", {
            x: margin,
            y,
            size: fontSize,
            color: rgb(0.3, 0.3, 0.3),
            font: boldFont,
          });

          page.drawText(detail.value, {
            x: margin + 150,
            y,
            size: fontSize,
            color: rgb(0, 0, 0),
            font: regularFont,
          });
          y -= lineHeight;
        });

        y -= lineHeight;

        // Add checklist items by category
        const categories = Array.from(new Set(inspection.items.map(item => item.category))) as string[];
        
        categories.forEach((category: string) => {
          // Check if we need a new page for this category
          if (y < margin + 150) {
            const newPage = doc.addPage([595.28, 841.89]);
            y = height - margin;
          }

          // Add category header
          page.drawText(category.toUpperCase(), {
            x: margin,
            y,
            size: fontSize + 1,
            color: rgb(0, 0.2, 0.4),
            font: boldFont,
          });
          y -= lineHeight * 1.2;

          const categoryItems = inspection.items.filter(item => item.category === category);
          categoryItems.forEach(item => {
            // Check if we need a new page for this item
            if (y < margin + 100) {
              const newPage = doc.addPage([595.28, 841.89]);
              y = height - margin;
            }

            const status = item.status === "good" ? "[PASS]" : "[FAIL]";
            const statusColor = item.status === "good" ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0);
            
            page.drawText(status, {
              x: margin,
              y,
              size: fontSize,
              color: statusColor,
              font: boldFont,
            });

            page.drawText(item.name, {
              x: margin + 60,
              y,
              size: fontSize,
              color: rgb(0, 0, 0),
              font: regularFont,
            });
            y -= lineHeight;

            if (item.remarks) {
              page.drawText(`Remarks: ${item.remarks}`, {
                x: margin + 60,
                y,
                size: fontSize - 1,
                color: rgb(0.3, 0.3, 0.3),
                font: regularFont,
              });
              y -= lineHeight;
            }
          });

          y -= lineHeight;
        });

        // Add inspection summary
        page.drawText("INSPECTION SUMMARY", {
          x: margin,
          y,
          size: fontSize + 1,
          color: rgb(0, 0.2, 0.4),
          font: boldFont,
        });
        y -= lineHeight * 1.2;

        const goodItems = inspection.items.filter(item => item.status === "good").length;
        const badItems = inspection.items.filter(item => item.status === "bad").length;
        const totalItems = inspection.items.length;
        const percentageGood = totalItems > 0 ? (goodItems / totalItems) * 100 : 0;

        const summaryDetails = [
          `Items in Good Condition: ${goodItems} (${percentageGood.toFixed(1)}%)`,
          `Items Requiring Attention: ${badItems} (${(100 - percentageGood).toFixed(1)}%)`,
          `Overall Condition: ${percentageGood >= 80 ? "Excellent" : percentageGood >= 60 ? "Good" : "Needs Attention"}`,
        ];

        summaryDetails.forEach(detail => {
          page.drawText(detail, {
            x: margin + 20,
            y,
            size: fontSize,
            color: rgb(0, 0, 0),
            font: regularFont,
          });
          y -= lineHeight;
        });

        y -= lineHeight * 2;
      }

      // Add footer with page numbers
      const pages = doc.getPages();
      pages.forEach((page, index) => {
        const { width } = page.getSize();
        page.drawText(`Page ${index + 1} of ${pages.length}`, {
          x: width - margin - 50,
          y: margin - 20,
          size: fontSize - 1,
          color: rgb(0.3, 0.3, 0.3),
          font: regularFont,
        });
      });

      // Save the PDF
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `substation-inspections-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pdfUrl);

      toast.success("All inspections exported to PDF successfully");
    } catch (error) {
      toast.error("Failed to generate PDF report");
      console.error("Error generating PDF:", error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Check if user can edit an inspection
  const canEditInspection = (inspection: SubstationInspection) => {
    return permissionService.canUpdateFeature(user?.role || null, 'substation_inspection');
  };

  // Check if user can delete an inspection (admin-controllable via dynamic features)
  const canDeleteInspection = (inspection: SubstationInspection) => {
    return permissionService.canDeleteFeature(user?.role || null, 'substation_inspection');
  };

  // Add online status listener
  useEffect(() => {
    const handleOnlineStatusChange = async () => {
      if (navigator.onLine) {
        console.log('Device is back online, checking for offline items to sync...');
        
        // First refresh the data to get current state
        await refreshInspections();
        
        // Check if there are offline items to sync
        if (totalOfflineItems > 0) {
          console.log(`Found ${totalOfflineItems} offline items, starting automatic sync...`);
          
          // Show toast notification
          toast.success(`Device is back online! Automatically syncing ${totalOfflineItems} offline items...`);
          
          // Set auto-syncing state
          setIsAutoSyncing(true);
          
          // Start automatic sync
          try {
            await startSync();
          } catch (error) {
            console.error('Automatic sync failed:', error);
            toast.error('Automatic sync failed. Please use manual sync button.');
          } finally {
            // Clear auto-syncing state
            setIsAutoSyncing(false);
          }
        } else {
          console.log('No offline items to sync');
          toast.success('Device is back online! All data is up to date.');
        }
      }
    };

    // Listen for sync completion event
    const handleSyncCompleted = () => {
      console.log('Sync completed, refreshing data...');
      refreshInspections();
    };

    // Listen for offline sync completion event
    const handleOfflineSyncCompleted = (event: CustomEvent) => {
      console.log('Offline sync completed:', event.detail);
      setIsAutoSyncing(false);
      
      if (event.detail.syncedInspections > 0) {
        toast.success(`Successfully synced ${event.detail.syncedInspections} offline items!`);
      }
      
      // Refresh data to show updated sync status
      refreshInspections();
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('substationInspectionSyncCompleted', handleSyncCompleted);
    window.addEventListener('offlineSyncCompleted', handleOfflineSyncCompleted as EventListener);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('substationInspectionSyncCompleted', handleSyncCompleted);
      window.removeEventListener('offlineSyncCompleted', handleOfflineSyncCompleted as EventListener);
    };
  }, [refreshInspections, totalOfflineItems, startSync]);

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
          <h1 className="text-3xl font-bold tracking-tight">Substation Inspections</h1>
            <p className="text-muted-foreground">
              Manage and monitor substation inspection records
            </p>
          </div>
          
          {/* Offline Status Indicators */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <OfflineBadge showDetails={true} />
            
            {isOffline && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-md border border-yellow-200">
                <WifiOff className="h-4 w-4 flex-shrink-0" />
                <span>Working offline</span>
              </div>
            )}
            
            {isAutoSyncing && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
                <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
                <span>Auto-syncing offline data...</span>
              </div>
            )}
            
            {totalOfflineItems > 0 && !isAutoSyncing && (
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-md border border-orange-200">
                <Database className="h-4 w-4 flex-shrink-0" />
                <span>{totalOfflineItems} items pending sync</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
            <Button 
              onClick={() => navigate("/asset-management/substation-inspection")}
              variant="default"
            >
              New Inspection
            </Button>
          <Button
            onClick={() => {
              goToPage(1);
              refresh();
            }}
            variant="outline"
            disabled={isLoadingPage}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingPage ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
            <Button
              onClick={handleExportAllToCSV}
              variant="outline"
            disabled={isExportingCSV}
          >
            {isExportingCSV ? (
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
              Export All to CSV
            </Button>
          <Button
            onClick={handleExportAllToPDF}
            variant="outline"
            disabled={isExportingPDF}
          >
            {isExportingPDF ? (
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Export All to PDF
            </Button>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Date Range filter */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <RangePicker
              allowClear
              value={dateRange && dateRange.from && dateRange.to ? [dayjs(dateRange.from), dayjs(dateRange.to)] : null}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange({ from: dates[0].toDate(), to: dates[1].toDate() });
                  setSelectedMonth(null); // Clear month when date range is selected
                  localStorage.removeItem('inspectionManagement_selectedMonth');
                } else {
                  setDateRange({ from: undefined, to: undefined });
                }
              }}
              className="w-full"
              disabled={!!selectedMonth} // Disable date range when month is selected
            />
          </div>
          
          {/* Month filter */}
          <div className="space-y-2">
            <Label>Month</Label>
            <DatePicker
              value={selectedMonth}
              onChange={(date) => {
                setSelectedMonth(date);
                if (date) {
                  setDateRange({ from: undefined, to: undefined }); // Clear date range when month is selected
                  localStorage.setItem('inspectionManagement_selectedMonth', date.toISOString());
                } else {
                  localStorage.removeItem('inspectionManagement_selectedMonth');
                }
              }}
              picker="month"
            />
          </div>
          
          {/* Region filter - enabled for system admin, global engineer, ashsubt, and accsubt */}
          <div className="space-y-2">
            <Label>Region</Label>
            <div className="w-full">
              <Select
                value={selectedRegion}
                onValueChange={setSelectedRegion}
                disabled={user?.role !== 'system_admin' && user?.role !== 'global_engineer' && user?.role !== 'ashsubt' && user?.role !== 'accsubt'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRegions.map(region => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* District filter - disabled for district users, enabled for others */}
          <div className="space-y-2">
            <Label>District/Section</Label>
            <div className="w-full">
              <Select
                value={selectedDistrict}
                onValueChange={setSelectedDistrict}
                disabled={user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician' || (!selectedRegion && user?.role !== 'regional_engineer' && user?.role !== 'project_engineer' && user?.role !== 'regional_general_manager' && user?.role !== 'ashsubt' && user?.role !== 'accsubt')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDistricts.map(district => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Substation Type Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="space-y-2">
            <Label>Substation Type</Label>
            <div className="w-full">
              <Select
                value={selectedSubstationType}
                onValueChange={setSelectedSubstationType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Reset Filters Button */}
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            onClick={handleResetFilters}
            disabled={!(dateRange && (dateRange.from || dateRange.to)) && !selectedMonth && !selectedRegion && !selectedDistrict && !searchTerm && !selectedSubstationType}
          >
            Reset Filters
          </Button>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle>Search Inspections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
            <Input
              placeholder="Search by substation number, region or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
                disabled={isLoadingPage}
              />
              {isLoadingPage && (
                <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="rounded-md border">
          <Table>
            <TableCaption>
              {isLoadingPage ? (
                <div className="flex flex-col items-center gap-2">
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span>List of all substation inspections</span>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>📊 Server: {totalRecords} records</span>
                    {offlineInspections.length > 0 && (
                      <span>💾 Offline: {offlineInspections.length} pending</span>
                    )}
                    <span>📋 Total: {allInspections.length} inspections</span>
                  </div>
                </div>
              )}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Substation No</TableHead>
                <TableHead>Region</TableHead>
                                    <TableHead>District/Section</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Substation Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPage ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-lg">Loading substation inspections...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : allInspections.length > 0 ? (
                allInspections.map((inspection) => {
                  // Determine if the inspection is offline
                  const isOffline = inspection.isOffline;
                  
                  // Calculate counts for online inspections
                  let goodItems = 0;
                  let badItems = 0;
                  let statusSummary = null;
                  
                  if (!isOffline && inspection.items && Array.isArray(inspection.items)) {
                    goodItems = inspection.items.filter(item => item?.status === "good").length;
                    badItems = inspection.items.filter(item => item?.status === "bad").length;
                    statusSummary = (
                    <div className="flex items-center gap-1">
                      <span className="text-green-600 font-medium">{goodItems} good</span>
                      <span>/</span>
                      <span className="text-red-600 font-medium">{badItems} bad</span>
                    </div>
                  );
                  } else if (isOffline) {
                    // For offline inspections, show offline status
                    statusSummary = (
                      <div className="text-gray-500 text-sm">
                        Offline Data
                      </div>
                    );
                  }
                  
                  const syncStatus = isOffline ? (
                    <div className="flex items-center gap-1">
                      {inspection.syncStatus === 'pending' ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          <WifiOff className="h-3 w-3 mr-1" />
                          Offline Pending
                        </Badge>
                      ) : inspection.syncStatus === 'failed' ? (
                        <Badge variant="destructive">
                          <WifiOff className="h-3 w-3 mr-1" />
                          Sync Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <WifiOff className="h-3 w-3 mr-1" />
                          Offline
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                      <Wifi className="h-3 w-3 mr-1" />
                      Online
                    </Badge>
                  );
                  
                  return (
                    <TableRow
                      key={inspection.id}
                      onClick={e => {
                        // Prevent row click if clicking inside the Actions cell
                        if ((e.target as HTMLElement).closest('td')?.classList.contains('actions-cell')) return;
                        navigate(`/asset-management/inspection-details/${inspection.id}`);
                      }}
                      className="cursor-pointer hover:bg-muted transition-colors"
                    >
                      <TableCell>{formatDate(inspection.date)}</TableCell>
                      <TableCell>{inspection.substationNo}</TableCell>
                      <TableCell>{inspection.region}</TableCell>
                      <TableCell>{inspection.district}</TableCell>
                      <TableCell className="capitalize">{inspection.type || 'N/A'}</TableCell>
                      <TableCell className="capitalize">
                        {inspection.substationType === 'secondary' ||
                         ((inspection as any).transformer && Array.isArray((inspection as any).transformer) && (inspection as any).transformer.length > 0) ||
                         ((inspection as any).areaFuse && Array.isArray((inspection as any).areaFuse) && (inspection as any).areaFuse.length > 0) ||
                         ((inspection as any).arrestors && Array.isArray((inspection as any).arrestors) && (inspection as any).arrestors.length > 0) ||
                         ((inspection as any).switchgear && Array.isArray((inspection as any).switchgear) && (inspection as any).switchgear.length > 0) ||
                         ((inspection as any).distributionEquipment && Array.isArray((inspection as any).distributionEquipment) && (inspection as any).distributionEquipment.length > 0) ||
                         ((inspection as any).paintWork && Array.isArray((inspection as any).paintWork) && (inspection as any).paintWork.length > 0) ?
                         'secondary' : 'primary'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            inspection.status === 'Completed'
                              ? 'bg-green-500'
                              : inspection.status === 'In Progress'
                              ? 'bg-yellow-500 text-black'
                              : inspection.status === 'Pending'
                              ? 'bg-gray-500'
                              : ''
                          }
                        >
                          {inspection.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>{syncStatus}</TableCell>
                      <TableCell className="text-right actions-cell">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigate(`/asset-management/inspection-details/${inspection.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportToPDF(inspection)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Export to PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportToCSV(inspection)}>
                              <Download className="mr-2 h-4 w-4" />
                              Export to CSV
                            </DropdownMenuItem>
                            {canEditInspection(inspection) && (
                              <DropdownMenuItem onClick={() => navigate(`/asset-management/edit-inspection/${inspection.id}`)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDeleteInspection(inspection) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Delete button clicked for inspection:', inspection.id);
                                    handleDelete(inspection.id);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center space-y-2">
                      <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-lg font-medium text-gray-900">No inspections found</div>
                      <div className="text-sm text-gray-500">
                        {searchTerm || (dateRange && (dateRange.from || dateRange.to)) || selectedMonth || selectedRegion || selectedDistrict || selectedSubstationType
                          ? "Try adjusting your filters or search terms"
                          : "No substation inspections have been created yet"}
                      </div>
                      {offlineInspections.length > 0 && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-800">
                            <WifiOff className="h-5 w-5" />
                            <span className="font-medium">Offline Inspections Available</span>
                          </div>
                          <p className="text-sm text-blue-700 mt-1">
                            You have {offlineInspections.length} inspection(s) saved offline. 
                            They will appear in the table above when you're online or after syncing.
                          </p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Optimized Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t">
            <div className="flex flex-col gap-2 mb-2">
              <div className="text-sm text-muted-foreground">
                {isLoadingPage ? (
                  "Loading..."
                ) : (
                  <>
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} server results
                    {offlineInspections.length > 0 && (
                      <span className="ml-2 text-blue-600">💾 +{offlineInspections.length} offline</span>
                    )}
                  </>
                )}
              </div>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              loading={isLoadingPage}
              onPageChange={goToPage}
              onRefresh={refresh}
              isOffline={isPaginatedOffline}
              isFromCache={isDataFromCache}
            />
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isOpen}
          onClose={closeDeleteDialog}
          onConfirm={() => confirmDelete(performDelete)}
          title="Delete Inspection"
          itemName={deleteItem?.name}
          itemType="inspection"
          isLoading={isDeleting}
          warningMessage="This action cannot be undone. This will permanently delete the inspection record and remove all associated data from the system."
        />
      </div>
    </Layout>
  );
}
