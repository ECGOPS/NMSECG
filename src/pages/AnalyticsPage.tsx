import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useNavigate, Link } from "react-router-dom";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, parse, startOfWeek, endOfWeek } from "date-fns";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import { Download, FileText, Filter, Eye, Calendar, MapPin, AlertTriangle, BarChart as ChartIcon, ActivityIcon, TrendingUp, Clock, Users, Wrench, Package, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { exportAnalyticsToPDF } from "@/utils/pdfExport";
import { useToast } from "@/components/ui/use-toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { LineChart, Line } from 'recharts';
import { OP5Fault, ControlSystemOutage } from '@/lib/types';
import MaterialsAnalysis from '@/components/analytics/MaterialsAnalysis';
import { calculateOutageDuration, calculateMTTR } from "@/lib/calculations";
import { LoadMonitoringData } from '@/lib/asset-types';
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { AnalyticsData } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiRequest } from '@/lib/api';

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const formatSafeDate = (dateString: string | undefined | null | { seconds: number; nanoseconds: number } | number): string => {
  console.log('[formatSafeDate] Input:', dateString, 'Type:', typeof dateString);
  
  if (!dateString) {
    console.log('[formatSafeDate] No date string provided, returning N/A');
    return 'N/A';
  }
  
  try {
    let date: Date;
    
    // Handle Firestore timestamp object (standard format)
    if (typeof dateString === 'object' && 'seconds' in dateString) {
      console.log('[formatSafeDate] Processing Firestore timestamp (standard):', dateString);
      date = new Date(dateString.seconds * 1000);
    }
    // Handle Firebase timestamp object (with underscore prefix)
    else if (typeof dateString === 'object' && '_seconds' in dateString) {
      console.log('[formatSafeDate] Processing Firebase timestamp (underscore):', dateString);
      date = new Date(dateString._seconds * 1000);
    }
    // Handle Unix timestamp (number)
    else if (typeof dateString === 'number') {
      console.log('[formatSafeDate] Processing Unix timestamp:', dateString);
      // Check if it's in seconds or milliseconds
      if (dateString < 10000000000) { // Less than year 2286 in seconds
        date = new Date(dateString * 1000); // Convert seconds to milliseconds
      } else {
        date = new Date(dateString); // Already in milliseconds
      }
    }
    // Handle string dates
    else if (typeof dateString === 'string') {
      console.log('[formatSafeDate] Processing string date:', dateString);
      
      // Handle ISO string
      if (dateString.includes('T') || dateString.includes('Z')) {
        date = new Date(dateString);
      }
      // Handle Firebase timestamp string format
      else if (dateString.includes('_')) {
        // Try to extract timestamp from Firebase format
        const timestampMatch = dateString.match(/(\d{10,13})/);
        if (timestampMatch) {
          const timestamp = parseInt(timestampMatch[1]);
          date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
        } else {
          date = new Date(dateString);
        }
      }
      // Handle other string formats
      else {
        date = new Date(dateString);
      }
    }
    else {
      console.log('[formatSafeDate] Unknown date format, trying default conversion');
      date = new Date(dateString as any);
    }
    
    console.log('[formatSafeDate] Parsed date:', date);
    
    if (isNaN(date.getTime())) {
      console.log('[formatSafeDate] Invalid date, returning N/A');
      return 'N/A';
    }
    
    const formatted = format(date, 'MMM dd, yyyy HH:mm:ss');
    console.log('[formatSafeDate] Formatted result:', formatted);
    return formatted;
  } catch (error) {
    console.error('[formatSafeDate] Error formatting date:', error, 'Input:', dateString);
    return 'N/A';
  }
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-muted-foreground" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { isAuthenticated, user, users } = useAzureADAuth(); // Get the list of all users
  const navigate = useNavigate();
  const { regions, districts, getFilteredFaults, op5Faults, controlSystemOutages } = useData();
  const [filteredFaults, setFilteredFaults] = useState([]);
  const [allFilteredDataForMTTR, setAllFilteredDataForMTTR] = useState([]);
  const [isLoadingMTTR, setIsLoadingMTTR] = useState(false);
  const [isLoadingReliability, setIsLoadingReliability] = useState(false);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [filterFaultType, setFilterFaultType] = useState<string | undefined>(undefined);
  const [filterSpecificFaultType, setFilterSpecificFaultType] = useState<string | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedFaultType, setSelectedFaultType] = useState<string>("all");
  const [selectedFault, setSelectedFault] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedWeekYear, setSelectedWeekYear] = useState<number | undefined>(undefined);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [startMonth, setStartMonth] = useState<Date | undefined>(undefined);
  const [endMonth, setEndMonth] = useState<Date | undefined>(undefined);
  const [startYear, setStartYear] = useState<Date | undefined>(undefined);
  const [endYear, setEndYear] = useState<Date | undefined>(undefined);
  const [isStartMonthPickerOpen, setIsStartMonthPickerOpen] = useState(false);
  const [isEndMonthPickerOpen, setIsEndMonthPickerOpen] = useState(false);
  const [isStartYearPickerOpen, setIsStartYearPickerOpen] = useState(false);
  const [isEndYearPickerOpen, setIsEndYearPickerOpen] = useState(false);
  const [startWeek, setStartWeek] = useState<number | undefined>(undefined);
  const [endWeek, setEndWeek] = useState<number | undefined>(undefined);
  const [isStartWeekPickerOpen, setIsStartWeekPickerOpen] = useState(false);
  const [isEndWeekPickerOpen, setIsEndWeekPickerOpen] = useState(false);
  const [reliabilityIndices, setReliabilityIndices] = useState<any>(null);
  const [materialsStats, setMaterialsStats] = useState({
    totalMaterials: 0,
    byType: [] as { name: string; value: number }[],
    byMonth: [] as { name: string; value: number }[],
    topMaterials: [] as { name: string; value: number }[]
  });
  const [overviewRecentFaultsTab, setOverviewRecentFaultsTab] = useState<'all' | 'op5' | 'control'>('all');
  
  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<'all' | 'op5' | 'control'>('all');
  const [loadMonitoringRecords, setLoadMonitoringRecords] = useState<LoadMonitoringData[]>([]);
  const [loadStats, setLoadStats] = useState({
    total: 0,
    overloaded: 0,
    okay: 0,
    avgLoad: 0,
    urgent: 0,
  });
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  // Server-side pagination state
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPageData, setCurrentPageData] = useState<{op5Faults: OP5Fault[], controlOutages: ControlSystemOutage[]}>({
    op5Faults: [],
    controlOutages: []
  });
  
  // Complete data for both metrics and pagination (loaded once, used for both)
  const [allData, setAllData] = useState<{op5Faults: OP5Fault[], controlOutages: ControlSystemOutage[]}>({
    op5Faults: [],
    controlOutages: []
  });
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  
  // Add new state for days filter
  const [selectedDays, setSelectedDays] = useState<number>(7);
  
  // Role-based access control initialization
  useEffect(() => {
    if (!user) return;

    console.log("[AnalyticsPage] Initializing with user:", {
      role: user.role,
      region: user.region,
      district: user.district
    });

    // For district engineers, district managers and technicians
    if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.district) {
      const userDistrict = districts.find(d => d.name === user.district);
      console.log("[AnalyticsPage] Found user district:", userDistrict);
      
      if (userDistrict) {
        setFilterDistrict(userDistrict.id);
        setFilterRegion(userDistrict.regionId);
        setSelectedDistrict(userDistrict.id);
        setSelectedRegion(userDistrict.regionId);
        console.log("[AnalyticsPage] Set district and region filters:", {
          districtId: userDistrict.id,
          regionId: userDistrict.regionId
        });
        return;
      }
    }
    
    // For regional engineers, project engineers, and regional general managers
    if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      console.log("[AnalyticsPage] Found user region:", userRegion);
      
      if (userRegion) {
        setFilterRegion(userRegion.id);
        setSelectedRegion(userRegion.id);
        console.log("[AnalyticsPage] Set region filter:", userRegion.id);
      }
      return;
    }
    
    // For ashsubt - set default to first allowed Ashanti region
    if (user.role === "ashsubt") {
      const ashsubtRegions = regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
      if (ashsubtRegions.length > 0) {
        const defaultRegion = ashsubtRegions[0]; // Use first region as default
        console.log("[AnalyticsPage] Setting ashsubt default region:", defaultRegion);
        setFilterRegion(defaultRegion.id);
        setSelectedRegion(defaultRegion.id);
      }
      return;
    }
    
    // For accsubt - set default to first allowed Accra region
    if (user.role === "accsubt") {
      const accsubtRegions = regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
      if (accsubtRegions.length > 0) {
        const defaultRegion = accsubtRegions[0]; // Use first region as default
        console.log("[AnalyticsPage] Setting accsubt default region:", defaultRegion);
        setFilterRegion(defaultRegion.id);
        setSelectedRegion(defaultRegion.id);
      }
      return;
    }
  }, [user, regions, districts]);

  // Filter regions and districts based on user role
  const filteredRegions = regions.filter(region => {
    // Global engineers and system admins can see all regions
    if (user?.role === "global_engineer" || user?.role === "system_admin") return true;
    
    // Regional engineers, project engineers, and regional general managers can only see their assigned region
    if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager") 
      return region.name === user.region;
    
    // Ashsubt users can see all Ashanti regions
    if (user?.role === "ashsubt") 
      return ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(region.id);
    
    // Accsubt users can see all Accra regions
    if (user?.role === "accsubt") 
      return ['subtransmission-accra', 'accra-east', 'accra-west'].includes(region.id);
    
    // District engineers, district managers and technicians can only see their assigned region
    if (user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") {
      const userDistrict = districts.find(d => d.name === user.district);
      return userDistrict ? region.id === userDistrict.regionId : false;
    }
    
    return false;
  });

  const filteredDistricts = (() => {
    if (!selectedRegion) {
      // If no region selected, but user is ashsubt or accsubt, show districts in their allowed regions
      if (user?.role === "ashsubt") {
        return districts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
      }
      if (user?.role === "accsubt") {
        return districts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
      }
      return [];
    }
    
    return districts.filter(district => {
      if (district.regionId !== selectedRegion) return false;
      
      // Global engineers and system admins can see all districts in the selected region
      if (user?.role === "global_engineer" || user?.role === "system_admin") 
        return true;
      
      // Regional engineers, project engineers, regional general managers, ashsubt, and accsubt can see all districts in their region
      if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager" || user?.role === "ashsubt" || user?.role === "accsubt") 
        return true;
      
      // District engineers, district managers and technicians can only see their assigned district
      if (user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") 
        return district.name === user.district;
      
      return false;
    });
  })();

  const [visibleColumns, setVisibleColumns] = useState({
    region: true,
    district: true,
    occurrenceDate: true,
    typeOfOutage: true, // moved before status
    specificFaultType: true, // moved before status
    status: true,
    outageDuration: true,
    repairDuration: true,
    estimatedResolution: true,
    resolutionStatus: true,
    customersAffected: true,
    description: true,
    remarks: true,
    actions: true,
    restorationDate: true
  });

  const columnOptions = [
    { id: 'region', label: 'Region' },
    { id: 'district', label: 'District/Section' },
    { id: 'occurrenceDate', label: 'Occurrence Date' },
    { id: 'typeOfOutage', label: 'Type of Outage' }, // moved before status
    { id: 'specificFaultType', label: 'Specific Outage Category' }, // moved before status
    { id: 'status', label: 'Status' },
    { id: 'outageDuration', label: 'Outage Duration' },
    { id: 'repairDuration', label: 'Repair Duration' },
    { id: 'estimatedResolution', label: 'Estimated Resolution' },
    { id: 'resolutionStatus', label: 'Resolution Time' },
    { id: 'customersAffected', label: 'Customers Affected' },
    { id: 'restorationDate', label: 'Restoration Date' },
    { id: 'description', label: 'Description' },
    { id: 'remarks', label: 'Remarks' },
    { id: 'actions', label: 'Actions' }
  ];

  // Add handler for days change
  const handleDaysChange = (value: string) => {
    setSelectedDays(parseInt(value));
    loadData();
  };
  
  // Use server-side data for paginatedFaults - no client-side filtering needed
  const paginatedFaults = useMemo(() => {
    // Use server-side data directly without additional client-side filtering
    const { op5Faults: op5, controlOutages: control } = currentPageData;
    let faultsToDisplay: (OP5Fault | ControlSystemOutage)[] = [];
    
    if (overviewRecentFaultsTab === 'op5') {
      faultsToDisplay = op5;
    } else if (overviewRecentFaultsTab === 'control') {
      faultsToDisplay = control;
    } else {
      // Show only OP5 faults in the "All Recent" tab
      faultsToDisplay = op5;
    }

    // No client-side filtering - server handles all filtering and pagination
    return faultsToDisplay;
  }, [
    currentPageData,
    overviewRecentFaultsTab
  ]);

  // Calculate total pages based on server-side total count
  const totalPages = useMemo(() => {
    return Math.ceil(totalItems / pageSize);
  }, [
    totalItems,
    pageSize
  ]);


  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    
    // Initialize filters based on user role
    if (user) {
      // Only set region/district filters if user is not a system admin or global engineer
      if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
        
        if (regionId) {
          setFilterRegion(regionId);
          setSelectedRegion(regionId);
          } else {
          // Set to "all" if no specific region
          setFilterRegion(undefined);
          setSelectedRegion("all");
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
          setSelectedDistrict(districtId);
        }
          } else {
        // For system admins and global engineers, set to "all" by default
        setFilterRegion(undefined);
        setSelectedRegion("all");
        setFilterDistrict(undefined);
        setSelectedDistrict("all");
      }
          } else {
      // Set default to "all" when no user role restrictions
      setFilterRegion(undefined);
      setSelectedRegion("all");
    }
  }, [isAuthenticated, user, navigate, regions, districts]);

  // Function to fetch all faults for MTTR calculation
  const fetchAllFaultsForMTTR = async () => {
    try {
      setIsLoadingMTTR(true);
      console.log('[AnalyticsPage] Fetching all faults for MTTR calculation...');
      
      // Build query parameters for OP5 faults
      const op5Params = new URLSearchParams();
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          op5Params.append('regionId', userRegion.id);
        }
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          op5Params.append('regionId', userDistrict.regionId);
          op5Params.append('districtId', userDistrict.id);
        }
      } else {
        if (filterRegion && filterRegion !== "all") op5Params.append('regionId', filterRegion);
        if (filterDistrict && filterDistrict !== "all") op5Params.append('districtId', filterDistrict);
      }
      
      // Apply status filter
      if (filterStatus) {
        op5Params.append('status', filterStatus);
        console.log('[AnalyticsPage] Adding status filter to MTTR OP5:', filterStatus);
      }
      
      // Apply fault type filters
      if (filterFaultType && filterFaultType !== "all") op5Params.append('faultType', filterFaultType);
      if (filterSpecificFaultType && filterSpecificFaultType !== "all") op5Params.append('specificFaultType', filterSpecificFaultType);
      
      // Apply date filtering
    if (dateRange !== "all") {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

        if (dateRange === "custom" && startDate && endDate) {
          start = startOfDay(startDate);
          end = endOfDay(endDate);
        } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
          const yearStart = new Date(selectedWeekYear, 0, 1);
          const firstWeekStart = startOfWeek(yearStart);
          const weekStart = new Date(firstWeekStart);
          weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
          start = startOfWeek(weekStart);
          end = endOfWeek(weekStart);
        } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
          const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
          start = startOfMonth(monthStart);
          end = endOfMonth(monthStart);
        } else if (dateRange === "year" && selectedYear !== undefined) {
          start = startOfYear(new Date(selectedYear, 0, 1));
          end = endOfYear(new Date(selectedYear, 0, 1));
        } else {
      switch (dateRange) {
        case "today":
          start = startOfDay(now);
          break;
            case "yesterday":
              start = startOfDay(subDays(now, 1));
              end = endOfDay(subDays(now, 1));
              break;
            case "7days":
          start = startOfDay(subDays(now, 6));
          break;
            case "30days":
          start = startOfDay(subDays(now, 29));
          break;
            case "90days":
              start = startOfDay(subDays(now, 89));
          break;
        default:
          start = startOfYear(now);
          }
        }
        
        if (start) op5Params.append('startDate', start.toISOString());
        if (end) op5Params.append('endDate', end.toISOString());
      }
      
      // Use chunked aggregation for scalability (handles millions of records)
      // Note: With date filters, this will typically only need 1-5 chunks
      console.log('[AnalyticsPage] Starting chunked MTTR aggregation...');
      
      const CHUNK_SIZE = 5000;
      const MAX_CHUNKS = 200;
      let op5Data: any[] = [];
      let controlData: any[] = [];
      
      // Copy parameters to control params
      const controlParams = new URLSearchParams(op5Params);
      
      // Fetch OP5 faults in chunks
      try {
        let op5ChunkOffset = 0;
        let op5HasMore = true;
        let op5ChunkCount = 0;
        
        while (op5HasMore && op5ChunkCount < MAX_CHUNKS) {
          const op5ChunkParams = new URLSearchParams(op5Params);
          op5ChunkParams.append('limit', CHUNK_SIZE.toString());
          op5ChunkParams.append('offset', op5ChunkOffset.toString());
          
          const op5ChunkRes = await apiRequest(`/api/op5Faults?${op5ChunkParams.toString()}`);
          const op5ChunkData = op5ChunkRes.data || op5ChunkRes || [];
          
          if (op5ChunkData.length === 0) {
            op5HasMore = false;
            break;
          }
          
          op5Data = [...op5Data, ...op5ChunkData];
          
          if (op5ChunkData.length < CHUNK_SIZE) {
            op5HasMore = false;
          } else {
            op5ChunkOffset += CHUNK_SIZE;
            op5ChunkCount++;
          }
        }
        
        console.log(`[AnalyticsPage] OP5 MTTR data: ${op5Data.length} records from ${op5ChunkCount} chunks`);
      } catch (error) {
        console.error('[AnalyticsPage] Error fetching OP5 MTTR data:', error);
      }
      
      // Fetch Control Outages in chunks
      try {
        let controlChunkOffset = 0;
        let controlHasMore = true;
        let controlChunkCount = 0;
        
        while (controlHasMore && controlChunkCount < MAX_CHUNKS) {
          const controlChunkParams = new URLSearchParams(controlParams);
          controlChunkParams.append('limit', CHUNK_SIZE.toString());
          controlChunkParams.append('offset', controlChunkOffset.toString());
          
          const controlChunkRes = await apiRequest(`/api/controlOutages?${controlChunkParams.toString()}`);
          const controlChunkData = controlChunkRes.data || controlChunkRes || [];
          
          if (controlChunkData.length === 0) {
            controlHasMore = false;
            break;
          }
          
          controlData = [...controlData, ...controlChunkData];
          
          if (controlChunkData.length < CHUNK_SIZE) {
            controlHasMore = false;
          } else {
            controlChunkOffset += CHUNK_SIZE;
            controlChunkCount++;
          }
        }
        
        console.log(`[AnalyticsPage] Control MTTR data: ${controlData.length} records from ${controlChunkCount} chunks`);
      } catch (error) {
        console.error('[AnalyticsPage] Error fetching Control MTTR data:', error);
      }
      
      const allFaults = [...op5Data, ...controlData];
      setAllFilteredDataForMTTR(allFaults);
      
      console.log('[AnalyticsPage] All faults for MTTR loaded:', {
        totalFaults: allFaults.length,
        op5Faults: op5Data.length,
        controlOutages: controlData.length,
        op5WithMTTR: op5Data.filter(f => f.repairDate && f.repairEndDate).length,
        controlWithMTTR: controlData.filter(f => f.repairDate && f.repairEndDate).length
      });
      
    } catch (error) {
      console.error('[AnalyticsPage] Error fetching all faults for MTTR:', error);
      setAllFilteredDataForMTTR([]);
    } finally {
      setIsLoadingMTTR(false);
    }
  };

  // Single effect for data loading
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[AnalyticsPage] filteredFaults:', filteredFaults);
      filteredFaults.forEach((fault, idx) => {
        console.log(`[AnalyticsPage] Fault #${idx + 1}:`, fault);
        console.log(`[AnalyticsPage] Fault #${idx + 1} keys:`, Object.keys(fault));
      });
      // Use either 'faultLocation' or 'substationName' to identify OP5 faults
      const op5WithDates = filteredFaults.filter(f => 
        ('faultLocation' in f || 'substationName' in f) && 
        f.repairDate && f.restorationDate
      );
      console.log('[AnalyticsPage] OP5 faults with repairDate and restorationDate:', op5WithDates);
      setCurrentPage(1); // Reset to first page when filters change
      loadPageData(1);
    }
  }, [isAuthenticated, filterRegion, filterDistrict, filterStatus, filterFaultType, filterSpecificFaultType, dateRange, startDate, endDate]);
  
  // Load page data when page changes
  useEffect(() => {
    if (isAuthenticated) {
      loadPageData(currentPage);
    }
  }, [currentPage]);
  
  // Load initial data when component mounts
  useEffect(() => {
    if (isAuthenticated) {
      loadPageData(1);
    }
  }, [isAuthenticated]);

  // Server-side data loading function
  const loadPageData = async (page: number = currentPage) => {
    setIsLoadingPage(true);
    setIsLoadingReliability(true);
    setIsLoadingMaterials(true);
    
    try {
      console.log('[loadPageData] Starting with filters:', {
        filterRegion,
        filterDistrict,
        filterFaultType,
        filterSpecificFaultType,
        filterStatus,
        dateRange,
        startDate,
        endDate,
        selectedRegion,
        selectedMonth,
        selectedYear,
        startWeek,
        endWeek,
        selectedDays,
        page,
        pageSize
      });

      // Build query parameters for OP5 faults
      const op5Params = new URLSearchParams();
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        // Force region filter for regional users
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          op5Params.append('regionId', userRegion.id);
        }
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        // Force district filter for district users
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          op5Params.append('regionId', userDistrict.regionId);
          op5Params.append('districtId', userDistrict.id);
        }
      } else {
        // For global engineers and system admins, use selected filters
      if (filterRegion && filterRegion !== "all") op5Params.append('regionId', filterRegion);
      if (filterDistrict && filterDistrict !== "all") op5Params.append('districtId', filterDistrict);
      }
      if (filterStatus) {
        op5Params.append('status', filterStatus);
        console.log('[AnalyticsPage] Adding status filter to OP5:', filterStatus);
      }
      if (filterFaultType && filterFaultType !== "all") op5Params.append('faultType', filterFaultType);
      if (filterSpecificFaultType && filterSpecificFaultType !== "all") op5Params.append('specificFaultType', filterSpecificFaultType);
      
      // Apply date filters
      if (dateRange !== "all") {
        const now = new Date();
        let start: Date;
        let end: Date = endOfDay(now);

        switch (dateRange) {
          case "days":
            start = startOfDay(subDays(now, selectedDays - 1));
            break;
          case "today":
            start = startOfDay(now);
            break;
          case "week":
            start = startOfDay(subDays(now, 6));
            break;
          case "month":
            start = startOfDay(subDays(now, 29));
            break;
          case "year":
            start = startOfYear(subYears(now, 1));
            end = endOfYear(subYears(now, 1));
            break;
          case "custom":
            if (startDate && endDate) {
              start = startOfDay(startDate);
              end = endOfDay(endDate);
            } else {
              start = startOfYear(now);
            }
            break;
          case "custom-week":
            if (startWeek && endWeek && selectedYear) {
              start = startOfWeek(new Date(selectedYear, 0, 1 + (startWeek - 1) * 7));
              end = endOfWeek(new Date(selectedYear, 0, 1 + (endWeek - 1) * 7));
            } else {
              start = startOfWeek(now);
              end = endOfWeek(now);
            }
            break;
          case "yesterday":
            start = startOfDay(subDays(now, 1));
            end = endOfDay(subDays(now, 1));
            break;
          default:
            start = startOfYear(now);
        }

        if (start) op5Params.append('startDate', start.toISOString());
        if (end) op5Params.append('endDate', end.toISOString());
      }
      
      // Server-side pagination parameters
      const offset = (page - 1) * pageSize;
      op5Params.append('limit', pageSize.toString());
      op5Params.append('offset', offset.toString());
      op5Params.append('sort', 'occurrenceDate');
      op5Params.append('order', 'desc');
      
      // Build query parameters for control outages
      const controlParams = new URLSearchParams();
      
      // Apply role-based filtering (same logic as OP5 faults)
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        // Force region filter for regional users
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          controlParams.append('regionId', userRegion.id);
        }
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        // Force district filter for district users
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          controlParams.append('regionId', userDistrict.regionId);
          controlParams.append('districtId', userDistrict.id);
        }
      } else {
        // For global engineers and system admins, use selected filters
      if (filterRegion && filterRegion !== "all") controlParams.append('regionId', filterRegion);
      if (filterDistrict && filterDistrict !== "all") controlParams.append('districtId', filterDistrict);
      }
      
      console.log('[loadPageData] Role-based filtering applied:', {
        userRole: user?.role,
        userRegion: user?.region,
        userDistrict: user?.district,
        op5Params: op5Params.toString(),
        controlParams: controlParams.toString()
      });
      
      if (filterStatus) {
        controlParams.append('status', filterStatus);
        console.log('[AnalyticsPage] Adding status filter to Control:', filterStatus);
      }
      if (filterFaultType && filterFaultType !== "all") controlParams.append('faultType', filterFaultType);
      if (filterSpecificFaultType && filterSpecificFaultType !== "all") controlParams.append('specificFaultType', filterSpecificFaultType);
      
      // Apply same date filters
      if (dateRange !== "all") {
        const now = new Date();
        let start: Date;
        let end: Date = endOfDay(now);

        switch (dateRange) {
          case "days":
            start = startOfDay(subDays(now, selectedDays - 1));
            break;
          case "today":
            start = startOfDay(now);
            break;
          case "week":
            start = startOfDay(subDays(now, 6));
            break;
          case "month":
            start = startOfDay(subDays(now, 29));
            break;
          case "year":
            start = startOfYear(subYears(now, 1));
            end = endOfYear(subYears(now, 1));
            break;
          case "custom":
            if (startDate && endDate) {
              start = startOfDay(startDate);
              end = endOfDay(endDate);
            } else {
              start = startOfYear(now);
            }
            break;
          case "custom-week":
            if (startWeek && endWeek && selectedYear) {
              start = startOfWeek(new Date(selectedYear, 0, 1 + (startWeek - 1) * 7));
              end = endOfWeek(new Date(selectedYear, 0, 1 + (endWeek - 1) * 7));
            } else {
              start = startOfYear(now);
              end = endOfDay(now);
            }
            break;
          case "yesterday":
            start = startOfDay(subDays(now, 1));
            end = endOfDay(subDays(now, 1));
            break;
          default:
            start = startOfYear(now);
        }

        if (start) controlParams.append('startDate', start.toISOString());
        if (end) controlParams.append('endDate', end.toISOString());
      }
      
      // Server-side pagination parameters
      controlParams.append('limit', pageSize.toString());
      controlParams.append('offset', offset.toString());
      controlParams.append('sort', 'occurrenceDate');
      controlParams.append('order', 'desc');
      
      // Get total counts first
      const op5CountParams = new URLSearchParams(op5Params);
      const controlCountParams = new URLSearchParams(controlParams);
      op5CountParams.append('countOnly', 'true');
      controlCountParams.append('countOnly', 'true');
      
      console.log('[AnalyticsPage] Getting counts with params:', {
        op5: op5CountParams.toString(),
        control: controlCountParams.toString(),
        filterStatus: filterStatus
      });
      
      const [op5CountRes, controlCountRes] = await Promise.all([
        apiRequest(`/api/op5Faults?${op5CountParams.toString()}`),
        apiRequest(`/api/controlOutages?${controlCountParams.toString()}`)
      ]);
      
      const op5Total = op5CountRes.total || 0;
      const controlTotal = controlCountRes.total || 0;
      const totalCount = op5Total + controlTotal;
      
      setTotalItems(totalCount);
      
      // Fetch page data
      console.log('[AnalyticsPage] Fetching page data with params:', {
        op5: op5Params.toString(),
        control: controlParams.toString()
      });
      
      const [op5Res, controlRes] = await Promise.all([
        apiRequest(`/api/op5Faults?${op5Params.toString()}`),
        apiRequest(`/api/controlOutages?${controlParams.toString()}`)
      ]);
      
      const op5Data = op5Res.data || op5Res || [];
      const controlData = controlRes.data || controlRes || [];
      
      // Use the SAME filters as pagination for metrics (ensures consistency)
      const allOp5Params = new URLSearchParams(op5Params);
      const allControlParams = new URLSearchParams(controlParams);
      
      // Remove pagination parameters for metrics (keep only filters)
      allOp5Params.delete('limit');
      allOp5Params.delete('offset');
      allControlParams.delete('limit');
      allControlParams.delete('offset');
      
      // Get counts for metrics efficiently (same as table pagination)
      const allOp5CountParams = new URLSearchParams(allOp5Params);
      const allControlCountParams = new URLSearchParams(allControlParams);
      allOp5CountParams.append('countOnly', 'true');
      allControlCountParams.append('countOnly', 'true');
      
      const [allOp5CountRes, allControlCountRes] = await Promise.all([
        apiRequest(`/api/op5Faults?${allOp5CountParams.toString()}`),
        apiRequest(`/api/controlOutages?${allControlCountParams.toString()}`)
      ]);
      
      const allOp5Count = allOp5CountRes.total || 0;
      const allControlCount = allControlCountRes.total || 0;
      
      // Store counts for metrics (no need to store actual data)
      setAllData({
        op5Faults: Array(allOp5Count).fill({}), // Placeholder array for length
        controlOutages: Array(allControlCount).fill({}) // Placeholder array for length
      });
      
      console.log('[AnalyticsPage] allData loaded for metrics:', {
        op5Count: allOp5Count,
        controlCount: allControlCount,
        dateRange,
        op5CountRes: allOp5CountRes,
        controlCountRes: allControlCountRes
      });
      
      // Update current page data (paginated subset)
      setCurrentPageData({
        op5Faults: op5Data,
        controlOutages: controlData
      });
      
      // Update pagination state
      setHasNextPage(offset + pageSize < totalCount);
      setHasPreviousPage(offset > 0);
      
      console.log('[AnalyticsPage] Page data loaded:', {
        page,
        pageSize,
        totalCount,
        op5Count: op5Data.length,
        controlCount: controlData.length,
        hasNextPage: offset + pageSize < totalCount,
        hasPreviousPage: offset > 0,
        op5Data: op5Data,
        controlData: controlData
      });
      
      console.log('[AnalyticsPage] Metrics should now show:', {
        totalFaults: (op5Data.length || 0) + (controlData.length || 0),
        op5Faults: op5Data.length || 0,
        controlOutages: controlData.length || 0
      });
      
      // Get ALL filtered data for reliability calculations (same filters as table, but no pagination)
      // Note: With date filters (e.g., monthly), totalCount will be much smaller than database total
      // So chunking is a safety net for edge cases, but typically only 1-5 chunks needed for filtered data
      console.log('[AnalyticsPage] Starting metrics aggregation...');
      console.log(`[AnalyticsPage] Filtered dataset size: ${totalCount} records (after applying date/region/district filters)`);
      console.log(`[AnalyticsPage] OP5 faults: ${op5Total}, Control outages: ${controlTotal}`);
      
      // Prepare params for metrics (same filters, no pagination initially)
      const allFilteredOp5Params = new URLSearchParams(op5Params);
      const allFilteredControlParams = new URLSearchParams(controlParams);
      
      // Remove pagination parameters for reliability calculations
      allFilteredOp5Params.delete('limit');
      allFilteredOp5Params.delete('offset');
      allFilteredControlParams.delete('limit');
      allFilteredControlParams.delete('offset');
      
      // Chunk size for processing (balance between memory and API calls)
      const CHUNK_SIZE = 5000; // Process 5000 records at a time
      let allFilteredOp5Data: any[] = [];
      let allFilteredControlData: any[] = [];
      
      // Performance warning for very large filtered datasets
      if (totalCount > 500000) {
        console.warn(`[AnalyticsPage] Large filtered dataset detected (${totalCount} records). Processing may take several minutes.`);
      } else if (totalCount > 50000) {
        console.log(`[AnalyticsPage] Medium dataset (${totalCount} records). Will use chunked fetching.`);
      } else {
        console.log(`[AnalyticsPage] Small dataset (${totalCount} records). Quick fetch expected.`);
      }
      
      // Fetch OP5 faults in chunks
      try {
        let op5ChunkOffset = 0;
        let op5HasMore = true;
        let op5ChunkCount = 0;
        const MAX_CHUNKS = 200; // Safety limit: 200 chunks = 1M records max
        
        while (op5HasMore && op5ChunkCount < MAX_CHUNKS && op5Total > 0) {
          const op5ChunkParams = new URLSearchParams(allFilteredOp5Params);
          op5ChunkParams.append('limit', CHUNK_SIZE.toString());
          op5ChunkParams.append('offset', op5ChunkOffset.toString());
          
          console.log(`[AnalyticsPage] Fetching OP5 chunk ${op5ChunkCount + 1} (offset: ${op5ChunkOffset}, limit: ${CHUNK_SIZE})`);
          
          const op5ChunkRes = await apiRequest(`/api/op5Faults?${op5ChunkParams.toString()}`);
          const op5ChunkData = op5ChunkRes.data || op5ChunkRes || [];
          
          if (op5ChunkData.length === 0) {
            op5HasMore = false;
            break;
          }
          
          allFilteredOp5Data = [...allFilteredOp5Data, ...op5ChunkData];
          
          if (op5ChunkData.length < CHUNK_SIZE) {
            op5HasMore = false;
          } else {
            op5ChunkOffset += CHUNK_SIZE;
            op5ChunkCount++;
          }
          
          if (op5ChunkCount % 10 === 0) {
            console.log(`[AnalyticsPage] Processed ${allFilteredOp5Data.length} OP5 records so far (${Math.round((allFilteredOp5Data.length / op5Total) * 100)}%)...`);
          }
        }
        
        console.log(`[AnalyticsPage] Finished OP5 aggregation: ${allFilteredOp5Data.length} records from ${op5ChunkCount} chunks`);
      } catch (error) {
        console.error('[AnalyticsPage] Error during OP5 chunked aggregation:', error);
        console.log(`[AnalyticsPage] Using partial OP5 data: ${allFilteredOp5Data.length} records`);
      }
      
      // Fetch Control Outages in chunks
      try {
        let controlChunkOffset = 0;
        let controlHasMore = true;
        let controlChunkCount = 0;
        const MAX_CHUNKS = 200; // Safety limit: 200 chunks = 1M records max
        
        while (controlHasMore && controlChunkCount < MAX_CHUNKS && controlTotal > 0) {
          const controlChunkParams = new URLSearchParams(allFilteredControlParams);
          controlChunkParams.append('limit', CHUNK_SIZE.toString());
          controlChunkParams.append('offset', controlChunkOffset.toString());
          
          console.log(`[AnalyticsPage] Fetching Control chunk ${controlChunkCount + 1} (offset: ${controlChunkOffset}, limit: ${CHUNK_SIZE})`);
          
          const controlChunkRes = await apiRequest(`/api/controlOutages?${controlChunkParams.toString()}`);
          const controlChunkData = controlChunkRes.data || controlChunkRes || [];
          
          if (controlChunkData.length === 0) {
            controlHasMore = false;
            break;
          }
          
          allFilteredControlData = [...allFilteredControlData, ...controlChunkData];
          
          if (controlChunkData.length < CHUNK_SIZE) {
            controlHasMore = false;
          } else {
            controlChunkOffset += CHUNK_SIZE;
            controlChunkCount++;
          }
          
          if (controlChunkCount % 10 === 0) {
            console.log(`[AnalyticsPage] Processed ${allFilteredControlData.length} Control records so far (${Math.round((allFilteredControlData.length / controlTotal) * 100)}%)...`);
          }
        }
        
        console.log(`[AnalyticsPage] Finished Control aggregation: ${allFilteredControlData.length} records from ${controlChunkCount} chunks`);
      } catch (error) {
        console.error('[AnalyticsPage] Error during Control chunked aggregation:', error);
        console.log(`[AnalyticsPage] Using partial Control data: ${allFilteredControlData.length} records`);
      }
      
      // Combine both datasets
      const allFilteredData = [...allFilteredOp5Data, ...allFilteredControlData];
      
      // Store filtered data for MTTR calculations
      setAllFilteredDataForMTTR(allFilteredData);
      
      console.log('[AnalyticsPage] All filtered data for reliability:', {
        totalFaults: allFilteredData.length,
        op5Faults: allFilteredOp5Data.length,
        controlOutages: allFilteredControlData.length,
        sampleFault: allFilteredData[0]
      });
      
      // Calculate reliability indices based on ALL filtered data (same as table filters)
      console.log('[AnalyticsPage] Calculating reliability with filtered data:', {
        totalFaults: allFilteredData.length,
        op5Faults: allFilteredData.filter(f => 'faultLocation' in f || 'substationName' in f).length,
        controlOutages: allFilteredData.filter(f => !('faultLocation' in f || 'substationName' in f)).length,
        faultsWithDates: allFilteredData.filter(f => f.occurrenceDate && f.restorationDate).length,
        faultsWithRepairDates: allFilteredData.filter(f => f.repairDate && f.repairEndDate).length,
        sampleFault: allFilteredData[0]
      });
      
      const reliabilityIndices = calculateReliabilityIndicesByLevel(
        allFilteredData, // Use all filtered data (same filters as table)
        districts,
        filterRegion,
        filterDistrict
      );
      setReliabilityIndices(reliabilityIndices);
      setIsLoadingReliability(false);
      setIsLoadingMaterials(false);
      
    } catch (error) {
      console.error('[AnalyticsPage] Failed to load page data:', error);
      setIsLoadingReliability(false);
      setIsLoadingMaterials(false);
      // Fallback to legacy client-side loading
      console.log('[AnalyticsPage] Falling back to legacy client-side loading');
      loadData();
    } finally {
      setIsLoadingPage(false);
    }
  };


  // Legacy client-side data loading function (kept for fallback)
  const loadData = () => {
    console.log('[loadData] Starting with filters:', {
      filterRegion,
      filterDistrict,
      filterFaultType,
      filterSpecificFaultType,
      filterStatus,
      dateRange,
      startDate,
      endDate,
      selectedRegion,
      selectedMonth,
      selectedYear,
      startWeek,
      endWeek,
      selectedDays
    });

    // Get filtered faults for analytics - handle "all" case properly
    // Apply role-based filtering before calling getFilteredFaults
    let effectiveRegionId = selectedRegion === "all" ? undefined : filterRegion;
    let effectiveDistrictId = selectedDistrict === "all" ? undefined : filterDistrict;
    
    // For district engineers, district managers and technicians, force their assigned district
    if ((user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") && user.district) {
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        effectiveRegionId = userDistrict.regionId;
        effectiveDistrictId = userDistrict.id;
      }
    }
    
    // For regional engineers, project engineers, and regional general managers, force their assigned region
    if ((user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager") && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        effectiveRegionId = userRegion.id;
        // Don't force district - let them select from their region
      }
    }
    
    const result = getFilteredFaults(effectiveRegionId, effectiveDistrictId);
    
    console.log('[AnalyticsPage] Role-based filtering applied:', {
      userRole: user?.role,
      userRegion: user?.region,
      userDistrict: user?.district,
      effectiveRegionId,
      effectiveDistrictId,
      resultOp5Count: result?.op5Faults?.length || 0,
      resultControlCount: result?.controlOutages?.length || 0
    });
    
    // Ensure we have valid arrays to prevent "not iterable" errors
    const op5Faults = Array.isArray(result?.op5Faults) ? result.op5Faults : [];
    const controlOutages = Array.isArray(result?.controlOutages) ? result.controlOutages : [];
    
    // Apply date range filter
    let filteredByDate = [...op5Faults, ...controlOutages];

    // Apply fault type filter if needed
    if (filterFaultType && filterFaultType !== "all") {
      filteredByDate = filteredByDate.filter(fault => {
        if ('faultType' in fault) {
          return fault.faultType === filterFaultType;
        }
        return false;
      });
    }

    // Apply specific fault type filter if needed
    if (filterSpecificFaultType && filterSpecificFaultType !== "all") {
      filteredByDate = filteredByDate.filter(fault => {
        if ('specificFaultType' in fault) {
          return fault.specificFaultType === filterSpecificFaultType;
        }
        return false;
      });
    }

    // Apply status filter if needed
    if (filterStatus) {
      filteredByDate = filteredByDate.filter(fault => fault.status === filterStatus);
    }

    // Apply date range filter if needed
    if (dateRange !== "all") {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

      switch (dateRange) {
        case "days":
          // For "Last N Days", we want to show data from N-1 days ago until today
          // For example, if today is March 15 and N=2:
          // - Start: March 14 00:00:00
          // - End: March 15 23:59:59
          start = startOfDay(subDays(now, selectedDays - 1));
          end = endOfDay(now);
          console.log('[loadData] Last N Days range:', {
            selectedDays,
            start: start.toISOString(),
            end: end.toISOString(),
            daysIncluded: selectedDays
          });
          break;
        case "today":
          start = startOfDay(now);
          break;
        case "week":
          start = startOfDay(subDays(now, 6));
          break;
        case "month":
          start = startOfDay(subDays(now, 29));
          break;
        case "year":
          // Set start date to the beginning of last year
          start = startOfYear(subYears(now, 1));
          // Set end date to the end of last year
          end = endOfYear(subYears(now, 1));
          break;
        case "custom":
          if (startDate && endDate) {
            start = startOfDay(startDate);
            end = endOfDay(endDate);
          } else {
            start = startOfYear(now);
          }
          break;
        case "custom-month":
          if (startMonth && endMonth) {
            start = startOfDay(startMonth);
            end = endOfDay(endMonth);
            console.log('[loadData] Custom month range:', {
              start: start.toISOString(),
              end: end.toISOString(),
              startMonth: startMonth.toISOString(),
              endMonth: endMonth.toISOString()
            });
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
          break;
        case "custom-year":
          if (startYear && endYear) {
            start = startOfYear(startYear);
            end = endOfYear(endYear);
          } else if (selectedYear) {
            start = startOfYear(selectedYear);
            end = endOfYear(selectedYear);
          } else {
            start = startOfYear(now);
            end = endOfYear(now);
          }
          break;
        case "custom-week":
          if (startWeek && endWeek && selectedYear) {
            // Convert week numbers to dates
            start = startOfWeek(new Date(selectedYear, 0, 1 + (startWeek - 1) * 7));
            end = endOfWeek(new Date(selectedYear, 0, 1 + (endWeek - 1) * 7));
            console.log('[loadData] Custom week range:', {
              start: start.toISOString(),
              end: end.toISOString(),
              startWeek,
              endWeek,
              year: selectedYear
            });
          } else {
            start = startOfWeek(now);
            end = endOfWeek(now);
          }
          break;
        case "yesterday":
          start = startOfDay(subDays(now, 1));
          end = endOfDay(subDays(now, 1));
          break;
        default:
          start = startOfYear(now);
      }

      console.log('[loadData] Date filter:', {
        dateRange,
          start: start?.toISOString(),
          end: end?.toISOString()
      });

      if (start && end) {
      filteredByDate = filteredByDate.filter(fault => {
        try {
          const faultDate = new Date(fault.occurrenceDate);
          const isInRange = faultDate >= start && faultDate <= end;
          
          if (!isInRange) {
            console.log('[loadData] Fault filtered out:', {
              faultId: fault.id,
              faultDate: faultDate.toISOString(),
                start: start?.toISOString(),
                end: end?.toISOString()
            });
          }
          
          return isInRange;
        } catch (error) {
          console.error('[loadData] Error processing fault date:', {
            faultId: fault.id,
            occurrenceDate: fault.occurrenceDate,
            error
          });
          return false;
        }
      });
      } else {
        console.warn('[loadData] Start or end date is undefined, skipping date filtering for faults');
      }
    }

    console.log('[loadData] Filtered results:', {
      totalFaults: filteredByDate.length,
      op5Faults: filteredByDate.filter(f => 'faultLocation' in f).length,
      controlOutages: filteredByDate.filter(f => !('faultLocation' in f)).length,
      dateRange,
      region: filterRegion,
      district: filterDistrict,
      sampleDates: filteredByDate.slice(0, 3).map(f => ({
        id: f.id,
        date: f.occurrenceDate
      }))
    });

    setFilteredFaults(filteredByDate);
    
    // Store filtered data for MTTR calculations
    setAllFilteredDataForMTTR(filteredByDate);

    // Calculate reliability indices based on ALL filtered data (same as table filters)
    const reliabilityIndices = calculateReliabilityIndicesByLevel(
      filteredByDate, // Use the same filtered data as the table
      districts,
      filterRegion,
      filterDistrict
    );
    setReliabilityIndices(reliabilityIndices);
    setIsLoadingReliability(false);
    setIsLoadingMaterials(false);
  };

  const calculateReliabilityIndicesByLevel = (
    faults: any[],
    districts: any[],
    regionId: string | undefined,
    districtId: string | undefined
  ) => {
    const indices = {
      rural: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      urban: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      metro: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      total: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 }
    };

    // Filter only OP5 faults with valid dates
    const op5Faults = faults.filter(fault => 
      ('faultLocation' in fault || 'substationName' in fault) && 
      fault.occurrenceDate && 
      fault.restorationDate &&
      fault.repairDate &&
      fault.repairEndDate
    );
    
    console.log('[calculateReliabilityIndicesByLevel] Processing faults:', {
      totalFaults: faults.length,
      op5Faults: op5Faults.length,
      faultsWithLocation: faults.filter(f => 'faultLocation' in f || 'substationName' in f).length,
      faultsWithOccurrenceDate: faults.filter(f => f.occurrenceDate).length,
      faultsWithRestorationDate: faults.filter(f => f.restorationDate).length,
      faultsWithRepairDate: faults.filter(f => f.repairDate).length,
      faultsWithRepairEndDate: faults.filter(f => f.repairEndDate).length,
      sampleFault: faults[0]
    });

    // Get total population based on level
    let totalPopulation = { rural: 0, urban: 0, metro: 0 };
    if (districtId) {
      // District level
      const district = districts.find(d => d.id === districtId);
      if (district?.population) {
        totalPopulation = district.population;
      }
    } else if (regionId) {
      // Regional level
      const regionDistricts = districts.filter(d => d.regionId === regionId);
      totalPopulation = regionDistricts.reduce((acc, district) => ({
        rural: acc.rural + (district.population?.rural || 0),
        urban: acc.urban + (district.population?.urban || 0),
        metro: acc.metro + (district.population?.metro || 0)
      }), { rural: 0, urban: 0, metro: 0 });
    } else {
      // Global level
      totalPopulation = districts.reduce((acc, district) => ({
        rural: acc.rural + (district.population?.rural || 0),
        urban: acc.urban + (district.population?.urban || 0),
        metro: acc.metro + (district.population?.metro || 0)
      }), { rural: 0, urban: 0, metro: 0 });
    }

    // Initialize tracking objects
    let customerHoursLost = { rural: 0, urban: 0, metro: 0 };
    let affectedCustomers = { rural: 0, urban: 0, metro: 0 };
    let momentaryInterruptions = { rural: 0, urban: 0, metro: 0 };
    let sustainedInterruptions = { rural: 0, urban: 0, metro: 0 };
    let totalInterruptions = { rural: 0, urban: 0, metro: 0 };

    // Use Maps instead of Sets for tracking distinct customers
    const distinctCustomersByType = {
      rural: new Map<string, number>(),
      urban: new Map<string, number>(),
      metro: new Map<string, number>()
    };

    // Process each fault
    op5Faults.forEach(fault => {
      if (!fault.affectedPopulation) return;

      const { rural, urban, metro } = fault.affectedPopulation;
      const duration = calculateOutageDuration(fault.occurrenceDate, fault.restorationDate);
      const isMomentary = duration < 5; // 5 minutes threshold for momentary interruptions

      // Process each population type
      ['rural', 'urban', 'metro'].forEach(type => {
        const t = type as keyof typeof totalPopulation;
        const affected = fault.affectedPopulation[t] || 0;
        
        if (affected > 0) {
          // Update customer hours lost
          customerHoursLost[t] += duration * affected;
          
          // Update affected customers count
          affectedCustomers[t] += affected;
          
          // Update interruption counts
          if (isMomentary) {
            momentaryInterruptions[t] += affected;
          } else {
            sustainedInterruptions[t] += affected;
          }
          
          // Update total interruptions
          totalInterruptions[t] += affected;

          // Track distinct customers using Map
          const customerKey = `${fault.id}-${t}`;
          distinctCustomersByType[t].set(customerKey, affected);
        }
      });
    });

    // Calculate indices for each population type
    ['rural', 'urban', 'metro'].forEach(type => {
      const t = type as keyof typeof totalPopulation;
      if (totalPopulation[t] > 0) {
        // SAIDI = Total Customer Hours Lost / Total Number of Customers
        indices[t].saidi = Number((customerHoursLost[t] / totalPopulation[t]).toFixed(2));
        
        // SAIFI = Total Customers Affected / Total Number of Customers
        indices[t].saifi = Number((affectedCustomers[t] / totalPopulation[t]).toFixed(2));
        
        // CAIDI = SAIDI / SAIFI
        indices[t].caidi = indices[t].saifi > 0 ? 
          Number((indices[t].saidi / indices[t].saifi).toFixed(2)) : 0;

        // CAIFI = Total Number of Customer Interruptions / Number of Distinct Customers Interrupted
        const distinctCount = distinctCustomersByType[t].size;
        const totalInterruptionCount = totalInterruptions[t];
        
        indices[t].caifi = distinctCount > 0 ? 
          Number((totalInterruptionCount / distinctCount).toFixed(2)) : 0;

        // MAIFI = Number of customers with momentary interruptions / Total Number of Customers
        indices[t].maifi = Number((momentaryInterruptions[t] / totalPopulation[t]).toFixed(2));
      }
    });

    // Calculate total indices
    const totalPopulationAll = totalPopulation.rural + totalPopulation.urban + totalPopulation.metro;
    const totalCustomerHoursLost = customerHoursLost.rural + customerHoursLost.urban + customerHoursLost.metro;
    const totalAffectedCustomers = affectedCustomers.rural + affectedCustomers.urban + affectedCustomers.metro;
    const totalMomentaryInterruptions = momentaryInterruptions.rural + momentaryInterruptions.urban + momentaryInterruptions.metro;
    const totalCustomerInterruptions = totalInterruptions.rural + totalInterruptions.urban + totalInterruptions.metro;
    const totalDistinctCustomers = Object.values(distinctCustomersByType).reduce((sum, map) => sum + map.size, 0);

    if (totalPopulationAll > 0) {
      indices.total.saidi = Number((totalCustomerHoursLost / totalPopulationAll).toFixed(2));
      indices.total.saifi = Number((totalAffectedCustomers / totalPopulationAll).toFixed(2));
      indices.total.caidi = indices.total.saifi > 0 ? 
        Number((indices.total.saidi / indices.total.saifi).toFixed(2)) : 0;
      indices.total.caifi = totalDistinctCustomers > 0 ? 
        Number((totalCustomerInterruptions / totalDistinctCustomers).toFixed(2)) : 0;
      indices.total.maifi = Number((totalMomentaryInterruptions / totalPopulationAll).toFixed(2));
    }

    return indices;
  };

  const handleRegionChange = (value: string) => {
    console.log('[handleRegionChange] New region:', value, 'Previous:', selectedRegion);
    
    if (value === "all") {
      // Clear both region and district filters
      setFilterRegion(undefined);
      setFilterDistrict(undefined);
      setSelectedDistrict("");
    } else {
      // Set new region filter
      setFilterRegion(value);
      // Reset district when changing region
      setFilterDistrict(undefined);
      setSelectedDistrict("");
    }
    setSelectedRegion(value);
  };

  const handleDistrictChange = (value: string) => {
    console.log('[handleDistrictChange] New district:', value);
    
    if (value === "all") {
      setFilterDistrict(undefined);
    } else {
      setFilterDistrict(value);
    }
    setSelectedDistrict(value);
  };
  
  const handleDateRangeChange = (value: string) => {
    console.log('[handleDateRangeChange] New date range:', value);
    
    setDateRange(value);
    // Reset custom date selections when changing date range type
    if (value !== "custom") {
      setStartDate(undefined);
      setEndDate(undefined);
    }
    // Reset time range selections
    setSelectedWeek(undefined);
    setSelectedMonth(undefined);
    setSelectedYear(undefined);
    setSelectedWeekYear(undefined);
    setSelectedMonthYear(undefined);
    // Reset custom period selections
    setStartMonth(undefined);
    setEndMonth(undefined);
    setStartYear(undefined);
    setEndYear(undefined);
    setStartWeek(undefined);
    setEndWeek(undefined);
  };

  // Time range handlers
  const handleWeekChange = (value: string) => {
    console.log('Week changed:', value);
    setSelectedWeek(Number(value));
    loadData();
  };

  const handleWeekYearChange = (value: string) => {
    console.log('Week year changed:', value);
    setSelectedWeekYear(Number(value));
    loadData();
  };

  const handleMonthChange = (value: string) => {
    console.log('Month changed:', value);
    console.log('Month value type:', typeof value);
    console.log('Month value length:', value.length);
    setSelectedMonth(Number(value));
    console.log('Selected month set to:', Number(value));
    console.log('Selected month type:', typeof Number(value));
    loadData();
  };

  const handleMonthYearChange = (value: string) => {
    console.log('Month year changed:', value);
    setSelectedMonthYear(Number(value));
    console.log('Selected month year set to:', Number(value));
    loadData();
  };

  const handleYearChange = (value: string) => {
    console.log('Year changed:', value);
    setSelectedYear(Number(value));
    loadData();
  };

  const handleDateRangePickerChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setStartDate(dates[0].toDate());
      setEndDate(dates[1].toDate());
      loadData();
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  const handleStartMonthSelect = (date: Date | undefined) => {
    setStartMonth(date);
    setIsStartMonthPickerOpen(false);
    // Only load data if we have both start and end months
    if (date && endMonth) {
      if (date > endMonth) {
        // If start month is after end month, swap them
        setStartMonth(endMonth);
        setEndMonth(date);
      }
      loadData();
    }
  };

  const handleEndMonthSelect = (date: Date | undefined) => {
    setEndMonth(date);
    setIsEndMonthPickerOpen(false);
    // Only load data if we have both start and end months
    if (date && startMonth) {
      if (date < startMonth) {
        // If end month is before start month, swap them
        setStartMonth(date);
        setEndMonth(startMonth);
      }
      loadData();
    }
  };

  const handleStartYearSelect = (date: Date | undefined) => {
    setStartYear(date);
    setIsStartYearPickerOpen(false);
    if (date && endYear) {
      loadData();
    }
  };

  const handleEndYearSelect = (date: Date | undefined) => {
    setEndYear(date);
    setIsEndYearPickerOpen(false);
    if (date && startYear) {
      loadData();
    }
  };

  const handleStartWeekSelect = (week: number) => {
    setStartWeek(week);
    if (week && endWeek && selectedYear) {
      loadData();
    }
  };

  const handleEndWeekSelect = (week: number) => {
    setEndWeek(week);
    if (week && startWeek && selectedYear) {
      loadData();
    }
  };

  const handleYearSelect = (date: Date | undefined) => {
    const year = date ? date.getFullYear() : undefined;
    setSelectedYear(year);
    if (date && startWeek && endWeek) {
      loadData();
    }
  };
  
  const handleFaultTypeChange = (value: string) => {
    console.log('[handleFaultTypeChange] New fault type:', value);
    
    if (value === "all") {
      setFilterFaultType(undefined);
    } else {
      setFilterFaultType(value);
    }
    setSelectedFaultType(value);
  };
  
  const handleStatusChange = (value: string) => {
    console.log('[AnalyticsPage] Status filter changed:', { from: filterStatus, to: value, willSet: value === "all" ? undefined : value });
    setFilterStatus(value === "all" ? undefined : value);
  };
  
  // Add useEffect to watch for date range changes
  useEffect(() => {
    if (dateRange === "custom-month" && startMonth && endMonth) {
      loadData();
    } else if (dateRange === "custom-year" && startYear && endYear) {
      loadData();
    } else if (dateRange === "custom-week" && startWeek && endWeek) {
      loadData();
    }
  }, [dateRange, startMonth, endMonth, startYear, endYear, startWeek, endWeek]);
  
  const exportDetailed = async () => {
    try {
      setIsExporting(true);
    const headers = [
      'ID', 'Type', 'Region', 'District/Section', 'Occurrence Date', 'Restoration Date', 
      'Status', 'Outage Category', 'Specific Outage Category', 'Duration (hours)', 'Created By', 'Created At',
      // Common fields for both types
      'Rural Customers Affected', 'Urban Customers Affected', 'Metro Customers Affected',
      // OP5 specific fields
      'Fault Location', 'MTTR', 'SAIDI', 'SAIFI', 'CAIDI',
      // Control outage specific fields
      'Load (MW)', 'Unserved Energy (MWh)', 'Area Affected', 'Reason', 'Control Panel Indications'
    ];
    
    // Fetch all filtered records from database
    const allFilteredData = await fetchAllFilteredRecords();
    
    console.log('[AnalyticsPage] Detailed CSV Export:', {
      allFilteredDataLength: allFilteredData.length,
      paginatedFaultsLength: paginatedFaults.length,
      dataSource: 'all filtered records from database'
    });
    
    const dataRows = allFilteredData.map((fault: any) => {
      // Properly identify the fault type
      const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
      const type = isOP5Fault ? 'OP5 Fault' : 'Control Outage';
      
      // Calculate duration properly
      const duration = fault.occurrenceDate && fault.restorationDate ? 
        calculateOutageDuration(fault.occurrenceDate, fault.restorationDate) : 0;
      const region = regions.find(r => r.id === fault.regionId)?.name || fault.regionId;
      const district = districts.find(d => d.id === fault.districtId)?.name || fault.districtId;
      
      // Common fields
      const row = [
        fault.id,
        type,
        region,
        district,
        formatSafeDate(fault.occurrenceDate),
        fault.restorationDate ? formatSafeDate(fault.restorationDate) : 'N/A',
        fault.status,
        fault.faultType,
        fault.specificFaultType || 'N/A',
        duration.toFixed(2), // Format duration to 2 decimal places
        getUserNameById(fault.createdBy),
        formatSafeDate(fault.createdAt),
        // Population affected
        fault.affectedPopulation?.rural || fault.customersAffected?.rural || 0,
        fault.affectedPopulation?.urban || fault.customersAffected?.urban || 0,
        fault.affectedPopulation?.metro || fault.customersAffected?.metro || 0,
      ];

      // Add OP5 specific fields
      if (isOP5Fault) {
        row.push(
          fault.faultLocation || fault.substationName || 'N/A',
          fault.mttr || 'N/A',
          fault.reliabilityIndices?.saidi || 'N/A',
          fault.reliabilityIndices?.saifi || 'N/A',
          fault.reliabilityIndices?.caidi || 'N/A',
          'N/A', // Load MW
          'N/A', // Unserved Energy
          'N/A', // Area Affected
          'N/A', // Reason
          'N/A'  // Control Panel Indications
        );
      } else {
        // Add Control outage specific fields
        row.push(
          'N/A', // Fault Location
          'N/A', // MTTR
          'N/A', // SAIDI
          'N/A', // SAIFI
          'N/A', // CAIDI
          fault.loadMW || 0,
          fault.unservedEnergyMWh || 0,
          fault.areaAffected || 'N/A',
          fault.reason || 'N/A',
          fault.controlPanelIndications || 'N/A'
        );
      }
      
      // Handle values that might contain commas by wrapping in quotes
      return row.map(value => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          // Escape any existing quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    // Combine headers and data
    const csvContent = [headers.join(','), ...dataRows].join('\n');
    
    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Add filter information to filename
    let filename = `fault-analysis-${format(new Date(), 'yyyy-MM-dd')}`;
    if (selectedRegion !== "all") {
      const regionName = regions.find(r => r.id === selectedRegion)?.name || selectedRegion;
      filename += `-${regionName}`;
    }
    if (selectedDistrict !== "all") {
      const districtName = districts.find(d => d.id === selectedDistrict)?.name || selectedDistrict;
      filename += `-${districtName}`;
    }
    if (selectedFaultType !== "all") {
      filename += `-${selectedFaultType}`;
    }
    if (dateRange !== "all") {
      filename += `-${dateRange}`;
    }
    
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    // Show success toast with breakdown of exported records
    const op5Count = dataRows.filter(row => row[1] === 'OP5 Fault').length;
    const controlCount = dataRows.filter(row => row[1] === 'Control Outage').length;
    toast({
      title: "Export Successful",
      description: `Exported ${dataRows.length} records (${op5Count} OP5, ${controlCount} Control) with current filters applied.`,
    });
    } catch (error) {
      console.error('[AnalyticsPage] Error exporting detailed CSV:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export detailed CSV. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setIsExporting(true);
      // Fetch all filtered records from database
      const allFilteredData = await fetchAllFilteredRecords();
      
      console.log('[AnalyticsPage] PDF Export:', {
        allFilteredDataLength: allFilteredData.length,
        paginatedFaultsLength: paginatedFaults.length,
        dataSource: 'all filtered records from database',
        overviewRecentFaultsTab
      });

      if (allFilteredData.length === 0) {
        toast({
          title: "No Data Available",
          description: "No data matches the current filters to export.",
          variant: "destructive",
        });
        return;
      }

      // Log the initial data being exported
      console.log('Initial export data:', {
        total: allFilteredData.length,
        op5Count: allFilteredData.filter(f => 'faultLocation' in f || 'substationName' in f || 'substationNo' in f).length,
        controlCount: allFilteredData.filter(f => !('faultLocation' in f || 'substationName' in f || 'substationNo' in f)).length,
        sampleFaults: allFilteredData.slice(0, 2)
      });

      // Process the data for export
      const processedData = allFilteredData.map(fault => {
        // Log each fault being processed
        console.log('Processing fault:', {
          id: fault.id,
          hasFaultLocation: 'faultLocation' in fault,
          hasSubstationName: 'substationName' in fault,
          hasSubstationNo: 'substationNo' in fault,
          type: fault.type,
          faultType: fault.faultType,
          rawFault: fault
        });

        // Properly identify the fault type - check for all possible OP5 indicators
        const isOP5Fault = 
          'faultLocation' in fault || 
          'substationName' in fault || 
          'substationNo' in fault || 
          fault.type === 'OP5' ||
          fault.faultType === 'OP5';

        const processedFault = {
          ...fault,
          type: isOP5Fault ? 'OP5 Fault' : 'Control Outage',
          region: regions.find(r => r.id === fault.regionId)?.name || fault.regionId,
          district: districts.find(d => d.id === fault.districtId)?.name || fault.districtId,
          createdBy: getUserNameById(fault.createdBy),
          updatedBy: getUserNameById(fault.updatedBy)
        };

        // Log the processed fault
        console.log('Processed fault:', {
          id: processedFault.id,
          type: processedFault.type,
          isOP5Fault
        });

        return processedFault;
      });

      // Log the final data being exported
      console.log('Final export data:', {
        totalRecords: processedData.length,
        op5Faults: processedData.filter(f => f.type === 'OP5 Fault').length,
        controlOutages: processedData.filter(f => f.type === 'Control Outage').length,
        sampleOP5: processedData.find(f => f.type === 'OP5 Fault'),
        sampleControl: processedData.find(f => f.type === 'Control Outage')
      });

      await exportAnalyticsToPDF(
        processedData,
        reliabilityIndices,
        dateRange,
        startDate,
        endDate,
        selectedRegion,
        selectedDistrict,
        regions,
        districts
      );

      // Show success toast with breakdown of exported records
      const op5Count = processedData.filter(fault => fault.type === 'OP5 Fault').length;
      const controlCount = processedData.filter(fault => fault.type === 'Control Outage').length;
      toast({
        title: "Export Successful",
        description: `Exported ${processedData.length} records (${op5Count} OP5, ${controlCount} Control) to PDF.`,
      });
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  const exportMaterialsToCSV = () => {
    try {
      // Use the same filtered data as reliability calculations (allFilteredDataForMTTR)
      const dataToExport = allFilteredDataForMTTR || [];
      
      console.log('[AnalyticsPage] Materials CSV Export:', {
        allFilteredDataLength: dataToExport.length,
        dataSource: 'allFilteredDataForMTTR'
      });

      // Get all OP5 faults with materials used
      const faultsWithMaterials = dataToExport.filter(fault => {
        const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
        const hasMaterials = Array.isArray(fault.materialsUsed) && fault.materialsUsed.length > 0;
        if (isOP5Fault && hasMaterials) {
          console.log('[MaterialsAnalysis] Fault with materials:', fault);
        }
        return isOP5Fault && hasMaterials;
      });

      if (faultsWithMaterials.length === 0) {
        toast({
          title: "Export Failed",
          description: "No material data found to export",
          variant: "destructive",
        });
        return;
      }

      // Prepare headers
      const headers = [
        'Fault ID',
        'Outage Category',
        'Region',
        'District',
        'Fault Location',
        'Material Type',
        'Material Details',
        'Quantity',
        'Date'
      ];

      // Prepare data rows
      const dataRows = faultsWithMaterials.flatMap(fault => {
        const region = regions.find(r => r.id === fault.regionId)?.name || 'Unknown';
        const district = districts.find(d => d.id === fault.districtId)?.name || 'Unknown';
        const faultType = fault.faultType || 'OP5 Fault'; // Default to 'OP5 Fault' if faultType is not available
        
        return fault.materialsUsed.map(material => {
          let materialDetails = 'N/A';
          let quantity = material.quantity || material.details?.quantity || 1;
          
          // Handle different material types
          switch (material.type) {
            case 'Fuse':
              const rating = material.details?.rating || material.details?.fuseRating || material.rating || 'N/A';
              materialDetails = `Rating: ${rating}A`;
              break;
            case 'Conductor':
              const type = material.details?.type || material.conductorType || 'N/A';
              const length = material.details?.length || material.length || 'N/A';
              materialDetails = `Type: ${type}, Length: ${length}m`;
              break;
            case 'Others':
              materialDetails = material.details?.description || material.description || 'N/A';
              break;
            default:
              materialDetails = 'Unknown material type';
          }

          console.log('Processing material:', {
            faultId: fault.id,
            materialType: material.type,
            quantity: quantity,
            rawMaterial: material
          });

          return [
            fault.id || 'N/A',
            faultType,
            region,
            district,
            fault.faultLocation || 'N/A',
            material.type || 'Unknown',
            materialDetails,
            quantity.toString(),
            formatSafeDate(fault.occurrenceDate)
          ];
        });
      });

      // Create CSV content with proper escaping
      const csvContent = [
        headers.join(','),
        ...dataRows.map(row => 
          row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `materials_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Materials report has been exported",
      });
    } catch (error) {
      console.error('Error exporting materials to CSV:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export materials report",
        variant: "destructive",
      });
    }
  };
  
  const renderMaterialsContent = () => {
    // Use the same filtered data as reliability calculations (allFilteredDataForMTTR)
    const op5Faults = (allFilteredDataForMTTR || []).filter(fault => {
      // Check if it's an OP5 fault and has materials
      const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
      const hasMaterials = Array.isArray(fault.materialsUsed) && fault.materialsUsed.length > 0;
      
      if (isOP5Fault && hasMaterials) {
        console.log('OP5 Fault with materials:', {
          id: fault.id,
          type: fault.type,
          materialsCount: fault.materialsUsed.length,
          materials: fault.materialsUsed
        });
      }
      
      return isOP5Fault && hasMaterials;
    });

    // Calculate materials statistics
    const materialsStats = {
      totalMaterials: op5Faults.reduce((sum, fault) => sum + fault.materialsUsed.length, 0),
      byType: [] as { name: string; value: number }[],
      byMonth: [] as { name: string; value: number }[],
      topMaterials: [] as { name: string; value: number }[]
    };

    // Group materials by type
    const materialsByType = new Map<string, number>();
    const materialsByMonth = new Map<string, number>();
    const materialCounts = new Map<string, number>();

    op5Faults.forEach(fault => {
      try {
        // Use occurrenceDate instead of date
        const faultDate = fault.occurrenceDate ? new Date(fault.occurrenceDate) : null;
        if (!faultDate || isNaN(faultDate.getTime())) {
          console.warn(`Invalid date for fault ${fault.id}:`, {
            occurrenceDate: fault.occurrenceDate,
            type: fault.type
          });
          return;
        }
        
        const month = format(faultDate, 'MMM yyyy');
        
        fault.materialsUsed.forEach(material => {
          // Log the complete material object for debugging
          console.log('Processing material:', {
            type: material.type,
            details: material.details,
            raw: material
          });

          // Count by type
          materialsByType.set(
            material.type,
            (materialsByType.get(material.type) || 0) + 1
          );

          // Count by month
          materialsByMonth.set(
            month,
            (materialsByMonth.get(month) || 0) + 1
          );

          // Count individual materials with safe property access
          let materialKey = material.type;
          
          if (material.type === 'Fuse') {
            // Check both the details object and direct properties
            const rating = material.details?.rating || 
                         material.details?.fuseRating || 
                         material.rating || 
                         material.fuseRating || 
                         'Unknown Rating';
            materialKey = `${material.type} - ${rating}`;
          } else if (material.type === 'Conductor') {
            const type = material.details?.type || 
                        material.type || 
                        'Unknown Type';
            materialKey = `${material.type} - ${type}`;
          } else if (material.type === 'Others') {
            const description = material.details?.description || 
                              material.description || 
                              'Unknown Description';
            materialKey = `${material.type} - ${description}`;
          }

          materialCounts.set(
            materialKey,
            (materialCounts.get(materialKey) || 0) + 1
          );
        });
      } catch (error) {
        console.error(`Error processing fault ${fault.id}:`, error, {
          occurrenceDate: fault.occurrenceDate,
          type: fault.type,
          materials: fault.materialsUsed
        });
      }
    });

    // Convert to arrays for charts
    materialsStats.byType = Array.from(materialsByType.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    materialsStats.byMonth = Array.from(materialsByMonth.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        try {
          const dateA = new Date(a.name);
          const dateB = new Date(b.name);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            console.warn('Invalid date in month sorting:', { a: a.name, b: b.name });
            return 0;
          }
          return dateA.getTime() - dateB.getTime();
        } catch (error) {
          console.error('Error sorting dates:', error);
          return 0;
        }
      });

    materialsStats.topMaterials = Array.from(materialCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    console.log('Materials Analysis Stats:', {
      totalFaults: op5Faults.length,
      totalMaterials: materialsStats.totalMaterials,
      byType: materialsStats.byType,
      byMonth: materialsStats.byMonth,
      topMaterials: materialsStats.topMaterials,
      sampleFault: op5Faults[0] ? {
        id: op5Faults[0].id,
        materials: op5Faults[0].materialsUsed
      } : null
    });

    return (
      <TabsContent value="materials" className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Materials Analysis</h2>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportMaterialsToCSV}
          >
            <Package className="h-4 w-4" />
            <span>Export Materials Report</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                Rural Reliability
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-200">Indices for rural areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-green-900 dark:text-green-100">
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">SAIDI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saidi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">SAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">CAIDI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caidi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-green-700 dark:text-green-200">Avg. Customer Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">CAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-green-700 dark:text-green-200">Customer Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">MAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.rural?.maifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-green-700 dark:text-green-200">Momentary Avg. Interruption Frequency</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-[#20232a] border border-blue-200 dark:border-blue-900 hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                Urban Reliability
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-200">Indices for urban areas</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 text-blue-900 dark:text-blue-100">
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">SAIDI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saidi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">SAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">CAIDI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caidi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Customer Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">CAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-blue-700 dark:text-blue-200">Customer Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">MAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.urban?.maifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-blue-700 dark:text-blue-200">Momentary Avg. Interruption Frequency</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-[#241f2e] border border-purple-200 dark:border-purple-900 hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-purple-800 dark:text-purple-200">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                Metro Reliability
              </CardTitle>
              <CardDescription className="text-purple-700 dark:text-purple-200">Indices for metro areas</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 text-purple-900 dark:text-purple-100">
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">SAIDI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saidi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">SAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">CAIDI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caidi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Customer Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">CAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-purple-700 dark:text-purple-200">Customer Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">MAIFI</Label>
                  {isLoadingReliability ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-xl font-semibold">{reliabilityIndices?.metro?.maifi?.toFixed(2) || 'N/A'}</p>
                  )}
                  <p className="text-xs text-purple-700 dark:text-purple-200">Momentary Avg. Interruption Frequency</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    );
  };
  
  // For district engineers, we restrict them to only see their district data
  const canChangeFilters = user?.role !== "district_engineer";
  
  // Filter the districts based on selected region
  const availableDistricts = filterRegion 
    ? districts.filter(d => d.regionId === filterRegion) 
    : districts;
  
  // Function to get region and district names
  const getRegionName = (regionId: string) => {
    return regions.find(r => r.id === regionId)?.name || regionId;
  };
  
  const getDistrictName = (districtId: string) => {
    return districts.find(d => d.id === districtId)?.name || districtId;
  };
  
  const showFaultDetails = (fault: any) => {
    setSelectedFault(fault);
    setDetailsOpen(true);
    console.log('Selected fault:', fault);
  };
  
  // Function to fetch all filtered records for export
  const fetchAllFilteredRecords = async () => {
    try {
      console.log('[AnalyticsPage] Fetching all filtered records for export...');
      
      // Build query parameters for OP5 faults
      const op5Params = new URLSearchParams();
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          op5Params.append('regionId', userRegion.id);
        }
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          op5Params.append('regionId', userDistrict.regionId);
          op5Params.append('districtId', userDistrict.id);
        }
      } else {
        if (filterRegion && filterRegion !== "all") op5Params.append('regionId', filterRegion);
        if (filterDistrict && filterDistrict !== "all") op5Params.append('districtId', filterDistrict);
      }
      
      // Apply other filters
      if (filterStatus) op5Params.append('status', filterStatus);
      if (filterFaultType && filterFaultType !== "all") op5Params.append('faultType', filterFaultType);
      if (filterSpecificFaultType && filterSpecificFaultType !== "all") op5Params.append('specificFaultType', filterSpecificFaultType);
      
      // Apply date filtering
      if (dateRange !== "all") {
        const now = new Date();
        let start: Date;
        let end: Date = endOfDay(now);

        if (dateRange === "custom" && startDate && endDate) {
          start = startOfDay(startDate);
          end = endOfDay(endDate);
        } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
          const yearStart = new Date(selectedWeekYear, 0, 1);
          const firstWeekStart = startOfWeek(yearStart);
          const weekStart = new Date(firstWeekStart);
          weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
          start = startOfWeek(weekStart);
          end = endOfWeek(weekStart);
        } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
          const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
          start = startOfMonth(monthStart);
          end = endOfMonth(monthStart);
        } else if (dateRange === "year" && selectedYear !== undefined) {
          start = startOfYear(new Date(selectedYear, 0, 1));
          end = endOfYear(new Date(selectedYear, 0, 1));
        } else {
          switch (dateRange) {
            case "today":
              start = startOfDay(now);
              break;
            case "yesterday":
              start = startOfDay(subDays(now, 1));
              end = endOfDay(subDays(now, 1));
              break;
            case "7days":
              start = startOfDay(subDays(now, 6));
              break;
            case "30days":
              start = startOfDay(subDays(now, 29));
              break;
            case "90days":
              start = startOfDay(subDays(now, 89));
              break;
            default:
              start = startOfYear(now);
          }
        }
        
        if (start) op5Params.append('startDate', start.toISOString());
        if (end) op5Params.append('endDate', end.toISOString());
      }
      
      // Set high limit to get all filtered records
      op5Params.append('limit', '10000');
      
      // Copy parameters to control params
      const controlParams = new URLSearchParams(op5Params);
      
      // Fetch all filtered records
      const [op5Res, controlRes] = await Promise.all([
        apiRequest(`/api/op5Faults?${op5Params.toString()}`),
        apiRequest(`/api/controlOutages?${controlParams.toString()}`)
      ]);
      
      const op5Data = op5Res.data || op5Res || [];
      const controlData = controlRes.data || controlRes || [];
      
      const allFilteredData = [...op5Data, ...controlData];
      
      console.log('[AnalyticsPage] All filtered records fetched:', {
        op5Records: op5Data.length,
        controlRecords: controlData.length,
        totalRecords: allFilteredData.length
      });
      
      return allFilteredData;
    } catch (error) {
      console.error('[AnalyticsPage] Error fetching all filtered records:', error);
      return [];
    }
  };
  
  // Function to export all filtered faults (not just the paginated ones)
  const exportRecentFaultsToCSV = async () => {
    try {
      setIsExporting(true);
      // Fetch all filtered records from database
      const allFilteredData = await fetchAllFilteredRecords();
    
    console.log('[AnalyticsPage] CSV Export:', {
      allFilteredDataLength: allFilteredData.length,
      paginatedFaultsLength: paginatedFaults.length,
      overviewRecentFaultsTab,
      dataSource: 'all filtered records from database',
      sampleData: allFilteredData.slice(0, 2)
    });
    
    if (allFilteredData.length === 0) {
      toast({
        title: "No Data Available",
        description: "No data matches the current filters.",
        variant: "destructive",
      });
      return;
    }

    // Create headers based on visible columns
    const headers = [];
    if (visibleColumns.region) headers.push('Region');
    if (visibleColumns.district) headers.push('District');
    if (visibleColumns.occurrenceDate) headers.push('Occurrence Date');
    if (visibleColumns.typeOfOutage) headers.push('Type of Outage'); // moved before status
    if (visibleColumns.specificFaultType) headers.push('Specific Outage Category'); // moved before status
    if (visibleColumns.status) headers.push('Status');
    if (visibleColumns.restorationDate) headers.push('Restoration Date');
    if (visibleColumns.outageDuration) headers.push('Outage Duration');
    if (visibleColumns.repairDuration) headers.push('Repair Duration');
    if (visibleColumns.estimatedResolution) headers.push('Estimated Resolution Time');
    if (visibleColumns.resolutionStatus) headers.push('Resolution Time');
    if (visibleColumns.customersAffected) headers.push('Customers Affected');
    if (visibleColumns.description) headers.push('Description');
    if (visibleColumns.remarks) headers.push('Remarks');

    // Create data rows based on visible columns
    const dataRows = allFilteredData.map((fault: any) => {
      const row = [];
      if (visibleColumns.region) row.push(getRegionName(fault.regionId));
      if (visibleColumns.district) row.push(getDistrictName(fault.districtId));
      if (visibleColumns.occurrenceDate) row.push(formatSafeDate(fault.occurrenceDate));
      if (visibleColumns.typeOfOutage) row.push(fault.faultType || 'N/A'); // moved before status
      if (visibleColumns.specificFaultType) row.push(fault.specificFaultType || 'N/A'); // moved before status
      if (visibleColumns.status) row.push(fault.status === 'resolved' ? 'Resolved' : 'Pending');
      if (visibleColumns.restorationDate) row.push(fault.restorationDate ? formatSafeDate(fault.restorationDate) : 'N/A');
      if (visibleColumns.outageDuration) {
        row.push(fault.occurrenceDate && fault.restorationDate
          ? `${((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
          : 'N/A');
      }
      if (visibleColumns.repairDuration) {
        row.push(fault.repairDate && fault.repairEndDate
          ? `${((new Date(fault.repairEndDate).getTime() - new Date(fault.repairDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
          : 'N/A');
      }
      if (visibleColumns.estimatedResolution) {
        row.push(fault.occurrenceDate && fault.estimatedResolutionTime
          ? `${((new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
          : 'N/A');
      }
      if (visibleColumns.resolutionStatus) {
        if (!fault.occurrenceDate || !fault.restorationDate || !fault.estimatedResolutionTime) {
          row.push('N/A');
        } else {
          const outageDuration = (new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
          const estimatedDuration = (new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
          row.push(outageDuration <= estimatedDuration ? 'Within Estimate' : 'Exceeded Estimate');
        }
      }
      if (visibleColumns.customersAffected) {
        let totalCustomersAffected = 0;
        if (fault.affectedPopulation) {
          totalCustomersAffected = (fault.affectedPopulation.rural || 0) + 
                                 (fault.affectedPopulation.urban || 0) + 
                                 (fault.affectedPopulation.metro || 0);
        } else if (fault.customersAffected) {
          totalCustomersAffected = (fault.customersAffected.rural || 0) + 
                                 (fault.customersAffected.urban || 0) + 
                                 (fault.customersAffected.metro || 0);
        }
        row.push(totalCustomersAffected || 'N/A');
      }
      if (visibleColumns.description) row.push(fault.outageDescription || fault.description || 'N/A');
      if (visibleColumns.remarks) row.push(fault.remarks || 'N/A');
      return row;
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...dataRows.map(row => row.map(cell => {
        // Handle special characters and ensure proper CSV formatting
        if (cell === null || cell === undefined) return '';
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename based on current filters
    let filename = 'fault-report';
    if (selectedRegion && selectedRegion !== 'all') {
      filename += `-${getRegionName(selectedRegion).toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (selectedDistrict && selectedDistrict !== 'all') {
      filename += `-${getDistrictName(selectedDistrict).toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (filterFaultType) {
      filename += `-${filterFaultType.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (dateRange) {
      filename += `-${dateRange}`;
    }
    filename += `-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${allFilteredData.length} records to CSV.`,
    });
    } catch (error) {
      console.error('[AnalyticsPage] Error exporting CSV:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export CSV. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  // Add a helper function to find user name by ID
  const getUserNameById = (userId: string | undefined): string => {
    if (!userId || userId === 'offline_user' || userId === 'unknown') return userId || 'N/A';
    
    // Debug logging
    console.log('[getUserNameById] Looking for user ID:', userId);
    console.log('[getUserNameById] Available users:', users.map(u => ({ id: u.id, uid: u.uid, name: u.name, email: u.email })));
    
    // Try to find user by exact ID match
    let foundUser = users.find(u => u.id === userId);
    
    // If not found by ID, try to find by UID (Azure AD localAccountId)
    if (!foundUser) {
      foundUser = users.find(u => u.uid === userId);
      console.log('[getUserNameById] Found by UID:', foundUser);
    }
    
    // If still not found, try to find by email (in case userId is an email)
    if (!foundUser && userId.includes('@')) {
      foundUser = users.find(u => u.email === userId);
      console.log('[getUserNameById] Found by email:', foundUser);
    }
    
    // If still not found, try partial matching on email
    if (!foundUser && userId.includes('@')) {
      const emailDomain = userId.split('@')[1];
      foundUser = users.find(u => u.email && u.email.includes(emailDomain));
      console.log('[getUserNameById] Found by email domain:', foundUser);
    }
    
    if (foundUser) {
      const userName = foundUser.name || foundUser.displayName || foundUser.email || userId;
      console.log('[getUserNameById] Returning user name:', userName);
      return userName;
    }
    
    console.log('[getUserNameById] User not found, returning original ID:', userId);
    return userId;
  };
  
  // Debug users loading
  useEffect(() => {
    console.log('[AnalyticsPage] Users state changed:', {
      usersCount: users.length,
      users: users.map(u => ({ id: u.id, uid: u.uid, name: u.name, email: u.email }))
    });
  }, [users]);

  // Fetch load monitoring data with role-based filtering
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    async function fetchLoadMonitoring() {
      try {
        // Build query parameters
        const params = new URLSearchParams();
        
        // Apply region filter (use regionId)
        if (selectedRegion && selectedRegion !== "all") {
          params.append('regionId', selectedRegion);
        } else if (user.role === 'regional_engineer') {
          params.append('regionId', user.region);
        }

        // Apply role-based filtering for load monitoring
        if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
          // Force region filter for regional users
          const userRegion = regions.find(r => r.name === user.region);
          if (userRegion) {
            params.append('regionId', userRegion.id);
          }
        } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
          // Force district filter for district users
          const userDistrict = districts.find(d => d.name === user.district);
          if (userDistrict) {
            params.append('regionId', userDistrict.regionId);
            params.append('districtId', userDistrict.id);
          }
        } else {
          // For global engineers and system admins, use selected filters
          if (selectedRegion && selectedRegion !== "all") {
            params.append('regionId', selectedRegion);
          }
        if (selectedDistrict && selectedDistrict !== "all") {
          params.append('districtId', selectedDistrict);
          }
                }
        
        console.log('[AnalyticsPage] Load monitoring role-based filtering:', {
          userRole: user?.role,
          userRegion: user?.region,
          userDistrict: user?.district,
          params: params.toString()
        });

                const response = await apiRequest(`/api/loadMonitoring?${params.toString()}`);
        let records: LoadMonitoringData[] = response?.data || response || [];
        
        // Ensure records is always an array
        if (!Array.isArray(records)) {
          console.warn('[AnalyticsPage] Load monitoring response is not an array:', records);
          records = [];
        }

        // Time range filtering (client-side)
        if (dateRange !== "all") {
          const now = new Date();
          let start: Date;
          let end: Date = endOfDay(now);

          if (dateRange === "custom" && startDate && endDate) {
                start = startOfDay(startDate);
                end = endOfDay(endDate);
          } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
            const yearStart = new Date(selectedWeekYear, 0, 1);
            const firstWeekStart = startOfWeek(yearStart);
            const weekStart = new Date(firstWeekStart);
            weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
            start = startOfWeek(weekStart);
            end = endOfWeek(weekStart);
            console.log('[AnalyticsPage] Load monitoring week calculation:', {
              selectedWeek,
              selectedWeekYear,
              yearStart: yearStart.toISOString(),
              firstWeekStart: firstWeekStart.toISOString(),
              weekStart: weekStart.toISOString(),
              start: start.toISOString(),
              end: end.toISOString()
            });
          } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
            const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
            start = startOfMonth(monthStart);
            end = endOfMonth(monthStart);
            console.log('[AnalyticsPage] Load monitoring month calculation:', {
              selectedMonth,
              selectedMonthYear,
              monthStart: monthStart.toISOString(),
              start: start.toISOString(),
              end: end.toISOString()
            });
          } else if (dateRange === "month") {
            console.log('[AnalyticsPage] Load monitoring month calculation FAILED - missing values:', {
              selectedMonth,
              selectedMonthYear,
              dateRange
            });
          } else if (dateRange === "year" && selectedYear !== undefined) {
            start = startOfYear(new Date(selectedYear, 0, 1));
            end = endOfYear(new Date(selectedYear, 0, 1));
          } else {
            // Fallback to relative date ranges
            switch (dateRange) {
              case "today":
                start = startOfDay(now);
              break;
            case "yesterday":
              start = startOfDay(subDays(now, 1));
              end = endOfDay(subDays(now, 1));
              break;
              case "7days":
                start = startOfDay(subDays(now, 6));
                break;
              case "30days":
                start = startOfDay(subDays(now, 29));
                break;
              case "90days":
                start = startOfDay(subDays(now, 89));
              break;
            default:
              start = startOfYear(now);
          }
          }

          if (start && end) {
            records = records.filter(r => {
              const recordDate = new Date(r.date);
              return recordDate >= start && recordDate <= end;
            });
          }
        }

        setLoadMonitoringRecords(records);
      } catch (error) {
        console.error('Error fetching load monitoring data:', error);
        setLoadMonitoringRecords([]);
      }
    }
    fetchLoadMonitoring();
  }, [
    isAuthenticated,
    user,
    selectedRegion,
    selectedDistrict,
    dateRange,
    startDate,
    endDate,
    startMonth,
    endMonth,
    startYear,
    endYear,
    startWeek,
    endWeek,
    selectedYear
  ]);

  // Compute statistics
  useEffect(() => {
    if (!loadMonitoringRecords.length) {
      setLoadStats({ total: 0, overloaded: 0, okay: 0, avgLoad: 0, urgent: 0 });
      return;
    }
    const total = loadMonitoringRecords.length;
    const overloaded = loadMonitoringRecords.filter(r => r.percentageLoad > 100).length;
    const okay = loadMonitoringRecords.filter(r => r.percentageLoad <= 100).length;
    const avgLoad = total ? Number((loadMonitoringRecords.reduce((sum, r) => sum + (r.percentageLoad || 0), 0) / total).toFixed(2)) : 0;
    const urgent = loadMonitoringRecords.filter(r => r.neutralWarningLevel === 'critical').length;
    setLoadStats({ total, overloaded, okay, avgLoad, urgent });
  }, [loadMonitoringRecords]);
  
  const handleClearFilters = () => {
    // Clear filters while respecting role-based access
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
      // Regional users: keep their assigned region, clear district
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setSelectedRegion(userRegion.id);
        setFilterRegion(userRegion.id);
      }
      setSelectedDistrict("all");
      setFilterDistrict(undefined);
    } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
      // District users: keep their assigned region and district
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        setSelectedRegion(userDistrict.regionId);
        setFilterRegion(userDistrict.regionId);
        setSelectedDistrict(userDistrict.id);
        setFilterDistrict(userDistrict.id);
      }
    } else {
      // System admin and global engineer: clear both
    setSelectedRegion("all");
    setFilterRegion(undefined);
    setSelectedDistrict("all");
    setFilterDistrict(undefined);
    }
    
    // Clear other filters
    setSelectedFaultType("all");
    setFilterFaultType(undefined);
    setFilterSpecificFaultType(undefined);
    setFilterStatus(undefined);
    setDateRange("all");
    setStartDate(null);
    setEndDate(null);
    setStartMonth(undefined);
    setEndMonth(undefined);
    setStartYear(undefined);
    setEndYear(undefined);
    setStartWeek(undefined);
    setEndWeek(undefined);
    setSelectedYear(undefined);
  };
  
  // Set initial filters based on user role
  useEffect(() => {
    if (user?.role === "regional_engineer" && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setFilterRegion(userRegion.id);
        setSelectedRegion(userRegion.id);
      }
    }
  }, [user, regions]);
  
  // Add toggleColumn function
  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId as keyof typeof prev]
    }));
  };
  
  // Set region automatically for project_engineer on load
  useEffect(() => {
    if ((user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') && user.region) {
      const regionObj = regions.find(r => r.name === user.region);
      if (regionObj) {
        setFilterRegion(regionObj.id);
        setSelectedRegion(regionObj.id);
      }
    }
  }, [user, regions]);
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-6 sm:space-y-8">
        {/* Enhanced Page Header */}
        <div className="pb-4 border-b border-border/40">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Analytics & Reporting
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {user?.role === "district_engineer" 
              ? `Analysis for ${user.district}` 
              : user?.role === "regional_engineer"
              ? `Analysis for ${user.region}`
              : "Analyze fault patterns and generate insights for better decision making"}
          </p>
        </div>

        {/* Filters Section */}
        <Card className="p-4 sm:p-6 bg-muted/30 border shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" /> Filters
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="ml-auto"
            >
              Clear Filters
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Region Select */}
            <div>
              <Label htmlFor="region-select" className="text-xs text-muted-foreground">Region</Label>
              <Select
                value={selectedRegion}
                onValueChange={handleRegionChange}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "regional_general_manager" || user?.role === "district_manager" || user?.role === "project_engineer"}
              >
                <SelectTrigger id="region-select" className="mt-1">
                  <SelectValue placeholder="Select Region" />
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
            {/* District Select */}
            <div>
              <Label htmlFor="district-select" className="text-xs text-muted-foreground">District/Section</Label>
              <Select
                value={selectedDistrict}
                onValueChange={handleDistrictChange}
                disabled={(!selectedRegion && !(user?.role === "ashsubt" || user?.role === "accsubt")) || user?.role === "district_engineer" || user?.role === "district_manager"}
              >
                <SelectTrigger id="district-select" className="mt-1">
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  {/* Only show "All Districts" for users who can see multiple districts */}
                  {(user?.role === "global_engineer" || user?.role === "system_admin" || 
                    user?.role === "regional_engineer" || user?.role === "project_engineer" || 
                    user?.role === "regional_general_manager" || user?.role === "ashsubt" || user?.role === "accsubt") && (
                  <SelectItem value="all">All Districts</SelectItem>
                  )}
                  {filteredDistricts.map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {/* Outage Category Select */}
            <div>
               <Label htmlFor="fault-type-select" className="text-xs text-muted-foreground">Outage Category</Label>
              <Select
                value={selectedFaultType}
                onValueChange={handleFaultTypeChange}
              >
                <SelectTrigger id="fault-type-select" className="mt-1">
                  <SelectValue placeholder="Select Outage Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Unplanned">Unplanned</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="ECG Load Shedding">ECG Load Shedding</SelectItem>
                  <SelectItem value="GridCo Outages">GridCo Outages</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specific Outage Category Select */}
            <div>
              <Label htmlFor="specific-fault-type-select" className="text-xs text-muted-foreground">Specific Outage Category</Label>
              <Select
                value={filterSpecificFaultType || "all"}
                onValueChange={setFilterSpecificFaultType}
                disabled={selectedFaultType === "all" || selectedFaultType === "Planned" || selectedFaultType === "ECG Load Shedding" || selectedFaultType === "GridCo Outages"}
              >
                <SelectTrigger id="specific-fault-type-select" className="mt-1">
                  <SelectValue placeholder="Select Specific Outage Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specific Types</SelectItem>
                  {/* Unplanned Fault Types */}
                  <SelectItem value="JUMPER CUT">Jumper Cut</SelectItem>
                  <SelectItem value="CONDUCTOR CUT">Conductor Cut</SelectItem>
                  <SelectItem value="MERGED CONDUCTOR">Merged Conductor</SelectItem>
                  <SelectItem value="HV/LV LINE CONTACT">HV/LV Line Contact</SelectItem>
                  <SelectItem value="VEGETATION">Vegetation</SelectItem>
                  <SelectItem value="CABLE FAULT">Cable Fault</SelectItem>
                  <SelectItem value="TERMINATION FAILURE">Termination Failure</SelectItem>
                  <SelectItem value="BROKEN POLES">Broken Poles</SelectItem>
                  <SelectItem value="BURNT POLE">Burnt Pole</SelectItem>
                  <SelectItem value="FAULTY ARRESTER/INSULATOR">Faulty Arrester/Insulator</SelectItem>
                  <SelectItem value="EQIPMENT FAILURE">Equipment Failure</SelectItem>
                  <SelectItem value="PUNCTURED CABLE">Punctured Cable</SelectItem>
                  <SelectItem value="ANIMAL INTERRUPTION">Animal Interruption</SelectItem>
                  <SelectItem value="BAD WEATHER">Bad Weather</SelectItem>
                  <SelectItem value="TRANSIENT FAULTS">Transient Faults</SelectItem>
                  <SelectItem value="PHASE OFF">Phase Off</SelectItem>
                  <SelectItem value="BURNT PHASE">Burnt Phase</SelectItem>
                  {/* Emergency Fault Types */}
                  <SelectItem value="MEND CABLE">Mend Cable</SelectItem>
                  <SelectItem value="WORK ON EQUIPMENT">Work on Equipment</SelectItem>
                  <SelectItem value="FIRE">Fire</SelectItem>
                  <SelectItem value="IMPROVE HV">Improve HV</SelectItem>
                  <SelectItem value="JUMPER REPLACEMENT">Jumper Replacement</SelectItem>
                  <SelectItem value="MEND BROKEN">Mend Broken</SelectItem>
                  <SelectItem value="MEND JUMPER">Mend Jumper</SelectItem>
                  <SelectItem value="MEND TERMINATION">Mend Termination</SelectItem>
                  <SelectItem value="BROKEN POLE">Broken Pole</SelectItem>
                  <SelectItem value="ANIMAL CONTACT">Animal Contact</SelectItem>
                  <SelectItem value="VEGETATION SAFETY">Vegetation Safety</SelectItem>
                  <SelectItem value="TRANSFER/RESTORE">Transfer/Restore</SelectItem>
                  <SelectItem value="TROUBLE SHOOTING">Trouble Shooting</SelectItem>
                  <SelectItem value="MEND LOOSE">Mend Loose</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="OTHERS">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Status Select */}
            <div>
              <Label htmlFor="status-select" className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={filterStatus || "all"}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger id="status-select" className="mt-1">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Time Range Filters */}
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">Time Range</Label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Select value={dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                  <SelectItem value="week">By Week</SelectItem>
                  <SelectItem value="month">By Month</SelectItem>
                  <SelectItem value="year">By Year</SelectItem>
                </SelectContent>
              </Select>

              {dateRange === "custom" && (
                <DatePicker.RangePicker
                  allowClear
                  value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
                  onChange={handleDateRangePickerChange}
                  format="YYYY-MM-DD"
                  className="w-full"
                />
              )}

              {dateRange === "week" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Week</Label>
                    <Select
                      value={selectedWeek?.toString()}
                      onValueChange={handleWeekChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent>
                        {Array.from({ length: 52 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            Week {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Select
                      value={selectedWeekYear?.toString()}
                      onValueChange={handleWeekYearChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  </div>
                </div>
              )}

              {dateRange === "month" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Month</Label>
                    <Select
                      value={selectedMonth?.toString()}
                      onValueChange={handleMonthChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {format(new Date(2024, i, 1), "MMMM")}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Select
                      value={selectedMonthYear?.toString()}
                      onValueChange={handleMonthYearChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
                </div>
              )}

              {dateRange === "year" && (
                <Select
                  value={selectedYear?.toString()}
                  onValueChange={handleYearChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                    </SelectContent>
                  </Select>
              )}
            </div>
          </div>

          {/* Export Buttons moved here for better grouping */}
          <div className="flex flex-wrap items-center gap-2 mt-6 border-t pt-4">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportDetailed}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
              <FileText className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isExporting ? "Exporting..." : "Export Detailed CSV"}
              </span>
              <span className="sm:hidden">
                {isExporting ? "..." : "CSV"}
              </span>
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportToPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
              <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isExporting ? "Exporting..." : "Export PDF Report"}
              </span>
              <span className="sm:hidden">
                {isExporting ? "..." : "PDF"}
              </span>
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportMaterialsToCSV}
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Export Materials CSV</span>
              <span className="sm:hidden">Materials</span>
            </Button>
          </div>
        </Card>

        {/* Showing data range info - kept subtle */}
        {dateRange !== "all" && (
          <div className="mb-4 sm:mb-6 text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {dateRange === "today" 
                ? `Showing data for today (${format(new Date(), 'MMM dd, yyyy')})`
                : dateRange === "yesterday"
                ? `Showing data for yesterday (${format(subDays(new Date(), 1), 'MMM dd, yyyy')})`
                : dateRange === "custom" && startDate && endDate
                ? `Showing data from ${format(startDate, 'MMM dd, yyyy')} to ${format(endDate, 'MMM dd, yyyy')}`
                : dateRange === "7days"
                ? `Showing data for the last 7 days`
                : dateRange === "30days"
                ? `Showing data for the last 30 days`
                : dateRange === "90days"
                ? `Showing data for the last 90 days`
                : dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined
                ? `Showing data for Week ${selectedWeek + 1}, ${selectedWeekYear}`
                : dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined
                ? `Showing data for ${format(new Date(selectedMonthYear, selectedMonth, 1), 'MMMM yyyy')}`
                : dateRange === "year" && selectedYear !== undefined
                ? `Showing data for ${selectedYear}`
                : ""}
            </span>
          </div>
        )}
        
        {/* Summary Cards Section - Modern Design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
              <div className="space-y-1">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Total Faults</CardTitle>
              </div>
              <div className="h-9 w-9 rounded-xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 dark:group-hover:bg-red-500/30 transition-colors">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {isLoadingPage ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-red-600 dark:text-red-400" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">
                    {(allData.op5Faults?.length || 0) + (allData.controlOutages?.length || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {((allData.op5Faults || []).filter((f: any) => f.status === "pending").length) + 
                     ((allData.controlOutages || []).filter((f: any) => f.status === "pending").length)} pending
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
              <div className="space-y-1">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-none">OP5 Faults</CardTitle>
              </div>
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/30 transition-colors">
                <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {isLoadingPage ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">
                    {allData.op5Faults?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {filterRegion || filterDistrict ? `In selected area` : 'Across all regions'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
              <div className="space-y-1">
                <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Control Outages</CardTitle>
              </div>
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 dark:group-hover:bg-purple-500/30 transition-colors">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {isLoadingPage ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">
                    {allData.controlOutages?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {filterRegion || filterDistrict ? `In selected area` : 'Across all regions'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* MTTR Report Card */}
        <Card className="mb-4 sm:mb-8 border shadow-sm hover:shadow-md transition-shadow duration-200 dark:bg-[#181a1b] dark:border-gray-800">
          <CardHeader className="bg-muted/30 border-b p-4 dark:bg-[#23272e] dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 dark:text-gray-100">
                  <Clock className="h-5 w-5 text-primary dark:text-primary-200" />
                  Mean Time To Repair (MTTR) Report
                  {user?.role === "district_engineer" && user.district && (
                    <span className="text-sm font-normal text-muted-foreground">
                      - {districts.find(d => d.id === user.district)?.name || user.district}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1 dark:text-gray-300">Analysis of repair times for OP5 faults</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs sm:text-sm dark:text-gray-200 dark:border-gray-600">
                {isLoadingMTTR || isLoadingPage ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                    Loading...
                  </>
                ) : (
                  <>
                    {(allFilteredDataForMTTR || []).filter(f => {
                      // Check if it's an OP5 fault (has faultLocation or substationName)
                      const isOP5Fault = 'faultLocation' in f || 'substationName' in f || f.type === 'OP5';
                      // Check if it has both repair dates (not null, not undefined, not empty string)
                      const hasRepairDates = f.repairDate && f.repairEndDate && 
                                             f.repairDate !== 'null' && f.repairEndDate !== 'null' &&
                                             f.repairDate.trim() !== '' && f.repairEndDate.trim() !== '';
                      return isOP5Fault && hasRepairDates;
                    }).length} Faults Analyzed
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-4 sm:mb-6">
              <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                  <div className="space-y-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Average MTTR</CardTitle>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-yellow-500/10 dark:bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/20 dark:group-hover:bg-yellow-500/30 transition-colors">
                    <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {isLoadingMTTR ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-foreground">
                        {(() => {
                          const op5FaultsWithMTTR = (allFilteredDataForMTTR || []).filter(f => 
                            ('faultLocation' in f || 'substationName' in f) && 
                            f.repairDate && 
                            f.repairEndDate
                          );
                          const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => {
                            const repairDate = new Date(fault.repairDate);
                            const repairEndDate = new Date(fault.repairEndDate);
                            const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                            return sum + mttr;
                          }, 0);
                          const averageMTTR = op5FaultsWithMTTR.length > 0 ? totalMTTR / op5FaultsWithMTTR.length : 0;
                          return `${averageMTTR.toFixed(2)} hours`;
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Across all regions
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                  <div className="space-y-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Total Repair Time</CardTitle>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/20 dark:group-hover:bg-orange-500/30 transition-colors">
                    <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {isLoadingMTTR ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-orange-600 dark:text-orange-400" />
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-foreground">
                        {(() => {
                          const op5FaultsWithMTTR = (allFilteredDataForMTTR || []).filter(f => 
                            ('faultLocation' in f || 'substationName' in f) && 
                            f.repairDate && 
                            f.repairEndDate
                          );
                          const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => {
                            const repairDate = new Date(fault.repairDate);
                            const repairEndDate = new Date(fault.repairEndDate);
                            const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                            return sum + mttr;
                          }, 0);
                          return `${totalMTTR.toFixed(2)} hours`;
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Combined repair time
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                  <div className="space-y-1">
                    <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Faults with MTTR</CardTitle>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-slate-500/10 dark:bg-slate-500/20 flex items-center justify-center group-hover:bg-slate-500/20 dark:group-hover:bg-slate-500/30 transition-colors">
                    <ActivityIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {isLoadingMTTR ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-400" />
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-foreground">
                        {(allFilteredDataForMTTR || []).filter(f => 
                          ('faultLocation' in f || 'substationName' in f) && 
                          f.repairDate && 
                          f.repairEndDate
                        ).length}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {isLoadingMTTR ? (
                          "Loading fault data..."
                        ) : (
                          `Out of ${(allFilteredDataForMTTR || []).filter(f => 'faultLocation' in f || 'substationName' in f).length} total OP5 faults`
                        )}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h3 className="text-base font-semibold">
                  {selectedDistrict && selectedDistrict !== "all"
                    ? `MTTR for ${districts.find(d => d.id === selectedDistrict)?.name || selectedDistrict}`
                    : selectedRegion && selectedRegion !== "all"
                      ? `MTTR by District in ${regions.find(r => r.id === selectedRegion)?.name || selectedRegion}`
                      : "MTTR by Region"}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  Average Repair Time (Lower is Better)
                </Badge>
              </div>
              <div className="space-y-4">
                {(() => {
                  let itemsToDisplay: any[] = [];
                  let isDisplayingDistricts = false;

                  if (selectedDistrict && selectedDistrict !== "all") {
                    // Case 1: Specific district selected (by DE or RE)
                    itemsToDisplay = districts.filter(d => d.id === selectedDistrict);
                    isDisplayingDistricts = true;
                  } else if (selectedRegion && selectedRegion !== "all") {
                    // Case 2: Specific region selected, show districts within
                    itemsToDisplay = districts.filter(d => d.regionId === selectedRegion);
                    isDisplayingDistricts = true;
                  } else {
                    // Case 3: No specific region/district, show regions
                    itemsToDisplay = showAllRegions ? regions : regions.slice(0, 1);
                    isDisplayingDistricts = false;
                  }

                  // Filter faults based on the current item (region or district)
                  return itemsToDisplay.map(item => {
                    const itemFaults = allFilteredDataForMTTR.filter(f => 
                      ('faultLocation' in f || 'substationName' in f) && 
                      f.repairDate && 
                      f.repairEndDate && 
                      (isDisplayingDistricts ? f.districtId === item.id : f.regionId === item.id)
                    );
                    const itemMTTR = itemFaults.reduce((sum, fault) => {
                      const repairDate = new Date(fault.repairDate);
                      const repairEndDate = new Date(fault.repairEndDate);
                      const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                      return sum + mttr;
                    }, 0);
                    const avgMTTR = itemFaults.length > 0 ? itemMTTR / itemFaults.length : 0;
                    const totalFaultsInArea = allFilteredDataForMTTR.filter(f => 
                       ('faultLocation' in f) && (isDisplayingDistricts ? f.districtId === item.id : f.regionId === item.id)
                    ).length;
                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            {/* Display item name (region or district) */}
                            <span className="font-medium text-sm sm:text-base">{item.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {itemFaults.length} faults
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="font-medium text-sm sm:text-base">{avgMTTR.toFixed(2)} hours</span>
                            <div className="flex-1 sm:w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ 
                                  width: `${(avgMTTR / 5) * 100}%`,  // Scale for 5 hours max
                                  maxWidth: '100%'
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {itemFaults.length} of {totalFaultsInArea} OP5 faults have MTTR data
                        </div>
                      </div>
                    );
                  });
                })()}
                {/* Only show Expand/Collapse button for the default 'MTTR by Region' view */}
                {regions.length > 1 && !(selectedDistrict && selectedDistrict !== "all") && !(selectedRegion && selectedRegion !== "all") && (
                  <div className="flex justify-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllRegions(v => !v)}
                    >
                      {showAllRegions ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section with enhanced styling and responsiveness */}
        <div className="mt-8 sm:mt-12">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-1 h-auto bg-muted/50 rounded-lg border border-border/50 shadow-sm mb-6">
              <TabsTrigger value="overview" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <ActivityIcon className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="faults" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Faults</span>
              </TabsTrigger>
              <TabsTrigger value="reliability" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <TrendingUp className="h-4 w-4" />
                <span>Reliability</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Clock className="h-4 w-4" />
                <span>Performance</span>
              </TabsTrigger>
              <TabsTrigger value="materials" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Package className="h-4 w-4" />
                <span>Materials</span>
              </TabsTrigger>
            </TabsList>

            {/* Add padding and subtle background to Tab Content areas */}
            <TabsContent value="overview" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-4">
              {/* Nested Tabs for Recent Faults Table - with active color */}
              <Tabs 
                defaultValue="all" 
                value={overviewRecentFaultsTab} 
                onValueChange={(value) => setOverviewRecentFaultsTab(value as 'all' | 'op5' | 'control')} 
                className="w-full"
              >
                {/* Add framing bg/padding to TabsList */}
                <TabsList className="grid w-full grid-cols-3 max-w-sm mx-auto bg-muted p-1 h-auto rounded-md mb-4"> 
                  <TabsTrigger 
                    value="all" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-colors duration-150"
                  >
                    All Recent
                  </TabsTrigger>
                  <TabsTrigger 
                    value="op5" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-orange-600 transition-colors duration-150"
                  >
                    OP5 Recent
                  </TabsTrigger>
                  <TabsTrigger 
                    value="control" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-purple-600 transition-colors duration-150"
                  >
                    Control Recent
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Recent Faults Card - Now uses filtered data */}
              <Card>
                <CardHeader className="pt-2 pb-2">
                  <div className="flex flex-col gap-4">
                    <div className="w-full">
                      <CardTitle className="text-base sm:text-lg font-medium">Recent Faults</CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-1">
                        Latest fault reports based on selected tab
                      </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            <span className="hidden sm:inline">Columns</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="w-[280px] sm:w-[300px] max-h-[400px] overflow-y-auto"
                          side="bottom"
                          sideOffset={5}
                          alignOffset={-10}
                        >
                          <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          {/* Search input */}
                          <div className="px-2 py-2">
                            <Input
                              placeholder="Search columns..."
                              className="h-8"
                              onChange={(e) => {
                                const searchTerm = e.target.value.toLowerCase();
                                const filteredColumns = columnOptions.filter(col => 
                                  col.label.toLowerCase().includes(searchTerm)
                                );
                                // Update visible columns based on search
                                const newVisibleColumns = { ...visibleColumns };
                                Object.keys(newVisibleColumns).forEach(key => {
                                  newVisibleColumns[key as keyof typeof newVisibleColumns] = 
                                    filteredColumns.some(col => col.id === key);
                                });
                                setVisibleColumns(newVisibleColumns);
                              }}
                            />
                          </div>
                          
                          {/* Basic Information */}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                              Basic Information
                            </DropdownMenuLabel>
                            {columnOptions.filter(col => 
                              ['region', 'district', 'occurrenceDate', 'status'].includes(col.id)
                            ).map(col => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                onCheckedChange={() => toggleColumn(col.id)}
                                onSelect={(e) => e.preventDefault()}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                    className="h-4 w-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  />
                                  <span 
                                    className="flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleColumn(col.id);
                                    }}
                                  >
                                    {col.label}
                                  </span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuGroup>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Duration & Impact */}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                              Duration & Impact
                            </DropdownMenuLabel>
                            {columnOptions.filter(col => 
                              ['outageDuration', 'repairDuration', 'estimatedResolution', 'resolutionStatus', 'customersAffected', 'restorationDate'].includes(col.id)
                            ).map(col => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                onCheckedChange={() => toggleColumn(col.id)}
                                onSelect={(e) => e.preventDefault()}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                    className="h-4 w-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  />
                                  <span 
                                    className="flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleColumn(col.id);
                                    }}
                                  >
                                    {col.label}
                                  </span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuGroup>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Additional Details */}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                              Additional Details
                            </DropdownMenuLabel>
                            {columnOptions.filter(col => 
                              ['description', 'typeOfOutage', 'remarks'].includes(col.id)
                            ).map(col => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                onCheckedChange={() => toggleColumn(col.id)}
                                onSelect={(e) => e.preventDefault()}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                    className="h-4 w-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  />
                                  <span 
                                    className="flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleColumn(col.id);
                                    }}
                                  >
                                    {col.label}
                                  </span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuGroup>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Quick Actions */}
                          <div className="px-2 py-2 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const newVisibleColumns = { ...visibleColumns };
                                Object.keys(newVisibleColumns).forEach(key => {
                                  newVisibleColumns[key as keyof typeof newVisibleColumns] = true;
                                });
                                setVisibleColumns(newVisibleColumns);
                              }}
                            >
                              Show All
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const newVisibleColumns = { ...visibleColumns };
                                Object.keys(newVisibleColumns).forEach(key => {
                                  newVisibleColumns[key as keyof typeof newVisibleColumns] = false;
                                });
                                setVisibleColumns(newVisibleColumns);
                              }}
                            >
                              Hide All
                            </Button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {/* Page Size Selector */}
                      <div className="flex items-center gap-2">
                        <Label htmlFor="pageSize" className="text-xs text-muted-foreground hidden sm:inline">Page Size:</Label>
                        <Label htmlFor="pageSize" className="text-xs text-muted-foreground sm:hidden">Size:</Label>
                        <Select
                          value={pageSize.toString()}
                          onValueChange={(value) => {
                            setPageSize(Number(value));
                            setCurrentPage(1);
                            loadPageData(1);
                          }}
                        >
                          <SelectTrigger className="w-[60px] sm:w-[70px] h-8">
                            <SelectValue placeholder={pageSize} />
                          </SelectTrigger>
                          <SelectContent>
                            {[10, 25, 50, 100].map(size => (
                              <SelectItem key={size} value={size.toString()}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button 
                        variant="outline" 
                        size="sm" 
                          className="h-8 px-2 flex-1 sm:flex-none"
                        onClick={exportRecentFaultsToCSV}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                        <Download className="mr-1 h-4 w-4" />
                        )}
                          <span className="hidden sm:inline">
                            {isExporting ? "Exporting..." : "Export Recent"}
                          </span>
                          <span className="sm:hidden">
                            {isExporting ? "..." : "Export"}
                          </span>
                      </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visibleColumns.region && <TableHead className="text-xs sm:text-sm">Region</TableHead>}
                          {visibleColumns.district && <TableHead className="text-xs sm:text-sm">District/Section</TableHead>}
                          {visibleColumns.occurrenceDate && <TableHead className="text-xs sm:text-sm">Occurrence Date</TableHead>}
                          {visibleColumns.typeOfOutage && <TableHead className="text-xs sm:text-sm">Type of Outage</TableHead>} {/* moved before status */}
                          {visibleColumns.specificFaultType && <TableHead className="text-xs sm:text-sm">Specific Outage Category</TableHead>} {/* moved before status */}
                          {visibleColumns.status && <TableHead className="text-xs sm:text-sm">Status</TableHead>}
                          {visibleColumns.restorationDate && <TableHead className="text-xs sm:text-sm">Restoration Date</TableHead>}
                          {visibleColumns.outageDuration && <TableHead className="text-xs sm:text-sm">Outage Duration</TableHead>}
                          {visibleColumns.repairDuration && <TableHead className="text-xs sm:text-sm">Repair Duration</TableHead>}
                          {visibleColumns.estimatedResolution && <TableHead className="text-xs sm:text-sm">Estimated Resolution</TableHead>}
                          {visibleColumns.resolutionStatus && <TableHead className="text-xs sm:text-sm">Resolution Time</TableHead>}
                          {visibleColumns.customersAffected && <TableHead className="text-xs sm:text-sm">Customers Affected</TableHead>}
                          {visibleColumns.description && <TableHead className="text-xs sm:text-sm">Description</TableHead>}
                          {visibleColumns.remarks && <TableHead className="text-xs sm:text-sm">Remarks</TableHead>}
                          {visibleColumns.actions && <TableHead className="text-xs sm:text-sm">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingPage ? (
                          <TableRow>
                            <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading page data...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : paginatedFaults.length > 0 ? (
                          paginatedFaults.map((fault: any) => (
                            <TableRow key={fault.id}>
                              {visibleColumns.region && <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{getRegionName(fault.regionId)}</TableCell>}
                              {visibleColumns.district && <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{getDistrictName(fault.districtId)}</TableCell>}
                              {visibleColumns.occurrenceDate && <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{formatSafeDate(fault.occurrenceDate)}</TableCell>}
                              {visibleColumns.typeOfOutage && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.faultType || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.specificFaultType && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.specificFaultType || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.status && (
                                <TableCell className="py-2 px-2 sm:px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${fault.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {fault.status === 'resolved' ? 'Resolved' : 'Pending'}
                                  </span>
                                </TableCell>
                              )}
                              {visibleColumns.restorationDate && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.restorationDate ? formatSafeDate(fault.restorationDate) : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.outageDuration && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.occurrenceDate && fault.restorationDate
                                    ? `${((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                    : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.repairDuration && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.repairDate && fault.repairEndDate
                                    ? `${((new Date(fault.repairEndDate).getTime() - new Date(fault.repairDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                    : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.estimatedResolution && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.occurrenceDate && fault.estimatedResolutionTime
                                    ? `${((new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                    : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.resolutionStatus && (
                                <TableCell className="py-2 px-2 sm:px-4">
                                  {(() => {
                                    if (!fault.occurrenceDate || !fault.restorationDate || !fault.estimatedResolutionTime) {
                                      return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">N/A</span>;
                                    }
                                    const outageDuration = (new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
                                    const estimatedDuration = (new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
                                    
                                    if (outageDuration <= estimatedDuration) {
                                      return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Within Estimate</span>;
                                    } else {
                                      return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Exceeded Estimate</span>;
                                    }
                                  })()}
                                </TableCell>
                              )}
                              {visibleColumns.customersAffected && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {(() => {
                                    let totalCustomersAffected = 0;
                                    if (fault.affectedPopulation) {
                                      totalCustomersAffected = (fault.affectedPopulation.rural || 0) + 
                                                             (fault.affectedPopulation.urban || 0) + 
                                                             (fault.affectedPopulation.metro || 0);
                                    } else if (fault.customersAffected) {
                                      totalCustomersAffected = (fault.customersAffected.rural || 0) + 
                                                             (fault.customersAffected.urban || 0) + 
                                                             (fault.customersAffected.metro || 0);
                                    }
                                    return totalCustomersAffected || 'N/A';
                                  })()}
                                </TableCell>
                              )}
                              {visibleColumns.description && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.outageDescription || fault.description || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.remarks && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.remarks || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.actions && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  <Button variant="ghost" size="sm" onClick={() => showFaultDetails(fault)}>
                                    View Details
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center text-muted-foreground">
                              No recent faults found for the selected type.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                
                {/* Add pagination controls */}
                {Math.ceil(totalItems / pageSize) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex-1 text-sm text-muted-foreground">
                      {isLoadingPage ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading page data...
                        </div>
                      ) : (
                        `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems} results`
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!hasPreviousPage || isLoadingPage}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalItems / pageSize), prev + 1))}
                        disabled={!hasNextPage || isLoadingPage}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="faults" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              <AnalyticsCharts filteredFaults={filteredFaults} />
            </TabsContent>

            <TabsContent value="reliability" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Rural Reliability Card - Modern Design */}
                <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <CardHeader className="pt-5 px-5 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                      <div className="h-9 w-9 rounded-xl bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/20 dark:group-hover:bg-green-500/30 transition-colors">
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      Rural Reliability
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-2">Indices for rural areas</CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">SAIDI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Interruption Duration</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.rural?.saidi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">SAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.rural?.saifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">CAIDI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Customer Interruption Duration</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.rural?.caidi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">CAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Customer Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.rural?.caifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">MAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Momentary Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.rural?.maifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Urban Reliability Card - Modern Design */}
                <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <CardHeader className="pt-5 px-5 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                      <div className="h-9 w-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/30 transition-colors">
                        <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      Urban Reliability
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-2">Indices for urban areas</CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">SAIDI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Interruption Duration</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.urban?.saidi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">SAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.urban?.saifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">CAIDI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Customer Interruption Duration</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.urban?.caidi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">CAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Customer Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.urban?.caifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">MAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Momentary Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.urban?.maifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Metro Reliability Card - Modern Design */}
                <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <CardHeader className="pt-5 px-5 pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                      <div className="h-9 w-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 dark:group-hover:bg-purple-500/30 transition-colors">
                        <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      Metro Reliability
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-2">Indices for metro areas</CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">SAIDI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Interruption Duration</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.metro?.saidi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">SAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.metro?.saifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">CAIDI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Avg. Customer Interruption Duration</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.metro?.caidi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">CAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Customer Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.metro?.caifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">MAIFI</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Momentary Avg. Interruption Frequency</p>
                        </div>
                        {isLoadingReliability ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <p className="text-lg font-bold text-foreground">{reliabilityIndices?.metro?.maifi?.toFixed(2) || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              {/* Add Performance Content Here */}
              <p>Performance metrics will be displayed here.</p>
            </TabsContent>

            <TabsContent value="materials" className="space-y-6">
              {isLoadingMaterials ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-lg text-muted-foreground">Loading materials data...</span>
                  </div>
                </div>
              ) : (
                <MaterialsAnalysis faults={allFilteredDataForMTTR || []} />
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Fault Details Dialog - Professional Design */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
            {selectedFault && (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                {/* Header Section */}
                <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                        {selectedFault.faultType === 'Unplanned' && <AlertTriangle className="h-6 w-6 text-orange-500" />}
                        {selectedFault.faultType === 'Planned' && <Calendar className="h-6 w-6 text-blue-500" />}
                        {selectedFault.faultType === 'Emergency' && <AlertTriangle className="h-6 w-6 text-red-500" />}
                        {selectedFault.faultType === 'Load Shedding' && <ChartIcon className="h-6 w-6 text-purple-500" />}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {'loadMW' in selectedFault ? 'Control System Outage Details' : 'OP5 Fault Details'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {getRegionName(selectedFault.regionId)}, {getDistrictName(selectedFault.districtId)}
                          </span>
                    </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={selectedFault.status === 'pending' ? 'destructive' : 'default'}
                        className="text-xs font-medium px-3 py-1"
                      >
                        {selectedFault.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {/* Main Content */}
                <div className="p-6 space-y-6">
                  {/* Key Information Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Fault ID Card */}
                    <Card className="p-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                      </div>
                      <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fault ID</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedFault.id}</p>
                        </div>
                      </div>
                    </Card>

                    {/* Fault Type Card */}
                    <Card className="p-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                          {selectedFault.faultType === 'Unplanned' && <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
                          {selectedFault.faultType === 'Planned' && <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                          {selectedFault.faultType === 'Emergency' && <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                          {selectedFault.faultType === 'Load Shedding' && <ChartIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                      </div>
                      <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedFault.faultType}</p>
                      </div>
                      </div>
                    </Card>

                    {/* Location Card */}
                      {'faultLocation' in selectedFault && (
                      <Card className="p-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Location</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedFault.faultLocation}</p>
                        </div>
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Detailed Information Sections */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Fault Information */}
                    <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded">
                          <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        Fault Information
                      </h3>
                      <div className="space-y-4">
                      {'reason' in selectedFault && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Reason</p>
                            <p className="text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                              {selectedFault.reason}
                            </p>
                        </div>
                      )}
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Description</p>
                          <p className="text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                            {selectedFault.description || 'No description provided'}
                          </p>
                    </div>
                  </div>
                    </Card>
                    
                    {/* Time & Impact */}
                    <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded">
                          <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        Time & Impact
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Occurrence Date</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                              {formatSafeDate(selectedFault.occurrenceDate)}
                            </p>
                      </div>
                      {selectedFault.restorationDate && (
                        <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Restoration Date</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                                {formatSafeDate(selectedFault.restorationDate)}
                              </p>
                        </div>
                      )}
                        </div>
                        
                      {'outrageDuration' in selectedFault && selectedFault.outrageDuration && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Duration</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                              {selectedFault.outrageDuration} minutes
                            </p>
                        </div>
                      )}
                        
                      {'affectedPopulation' in selectedFault && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Affected Population</p>
                            <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="text-center">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedFault.affectedPopulation.rural}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Rural</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedFault.affectedPopulation.urban}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Urban</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedFault.affectedPopulation.metro}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Metro</p>
                                </div>
                              </div>
                            </div>
                        </div>
                      )}
                        
                      {'customersAffected' in selectedFault && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Customers Affected</p>
                            <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="text-center">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedFault.customersAffected.rural}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Rural</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedFault.customersAffected.urban}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Urban</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedFault.customersAffected.metro}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">Metro</p>
                                </div>
                              </div>
                            </div>
                        </div>
                      )}
                        
                      {'loadMW' in selectedFault && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Load</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                              {selectedFault.loadMW} MW
                            </p>
                        </div>
                      )}
                        
                      {'unservedEnergyMWh' in selectedFault && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Unserved Energy</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                              {selectedFault.unservedEnergyMWh.toFixed(2)} MWh
                            </p>
                        </div>
                      )}
                    </div>
                    </Card>

                    {/* Feeder/Equipment Details - Only for Control System Outages */}
                    {'feederType' in selectedFault && selectedFault.feederType && (
                      <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                          <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded">
                            <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                          </div>
                          Feeder/Equipment Details
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {'voltageLevel' in selectedFault && selectedFault.voltageLevel && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Voltage Level</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                                {selectedFault.voltageLevel}
                              </p>
                            </div>
                          )}
                          {'feederType' in selectedFault && selectedFault.feederType && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Type of Feeder</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                                {selectedFault.feederType.charAt(0).toUpperCase() + selectedFault.feederType.slice(1)}
                              </p>
                            </div>
                          )}
                          {'feederName' in selectedFault && selectedFault.feederName && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Feeder Name</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                                {selectedFault.feederName}
                              </p>
                            </div>
                          )}
                          {'bspPss' in selectedFault && selectedFault.bspPss && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">BSP/PSS</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                                {selectedFault.bspPss}
                              </p>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                </div>

                  {/* Materials Used Section */}
                  <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded">
                        <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      Materials Used
                    </h3>
                  {selectedFault.materialsUsed && selectedFault.materialsUsed.length > 0 ? (
                    <div className="space-y-4">
                      {selectedFault.materialsUsed.map((material: any, index: number) => (
                          <div key={index} className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100">{material.type}</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Quantity</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {material.quantity || material.details?.quantity || 1}
                                </p>
                            </div>
                            {material.type === 'Fuse' && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Rating</p>
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {material.rating || material.details?.rating || material.details?.fuseRating || 'N/A'}A
                                  </p>
                                </div>
                            )}
                            {material.type === 'Conductor' && (
                              <>
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Type</p>
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                      {material.details?.type || material.conductorType || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Length</p>
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                      {material.details?.length || material.length || 'N/A'}m
                                    </p>
                                </div>
                              </>
                            )}
                            {material.type === 'Others' && (
                                <div className="col-span-full">
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Description</p>
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {material.details?.description || material.description || 'N/A'}
                                  </p>
                              </div>
                            )}
                          </div>
                          </div>
                      ))}
                    </div>
                  ) : (
                      <div className="text-center py-8">
                        <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">No materials used</p>
                      </div>
                    )}
                  </Card>

                  {/* Audit Information */}
                  <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded">
                        <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                      Audit Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Created By</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {(() => {
                            console.log('[AnalyticsPage] Selected fault createdBy:', selectedFault.createdBy);
                            const userName = getUserNameById(selectedFault.createdBy);
                            console.log('[AnalyticsPage] Resolved createdBy name:', userName);
                            return userName;
                          })()}
                        </p>
                    </div>
                      <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Created At</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {(() => {
                            console.log('[AnalyticsPage] Selected fault createdAt:', selectedFault.createdAt);
                            const formattedDate = formatSafeDate(selectedFault.createdAt);
                            console.log('[AnalyticsPage] Formatted createdAt:', formattedDate);
                            return formattedDate;
                          })()}
                        </p>
                    </div>
                      <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Updated By</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {(() => {
                            console.log('[AnalyticsPage] Selected fault updatedBy:', selectedFault.updatedBy);
                            const userName = getUserNameById(selectedFault.updatedBy);
                            console.log('[AnalyticsPage] Resolved updatedBy name:', userName);
                            return userName;
                          })()}
                        </p>
                    </div>
                      <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Updated At</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {(() => {
                            console.log('[AnalyticsPage] Selected fault updatedAt:', selectedFault.updatedAt);
                            const formattedDate = formatSafeDate(selectedFault.updatedAt);
                            console.log('[AnalyticsPage] Formatted updatedAt:', formattedDate);
                            return formattedDate;
                          })()}
                        </p>
                  </div>
                </div>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                      Close
                    </Button>
                    <Button asChild>
                      <Link to={`/dashboard?id=${selectedFault.id}`}>
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    View on Dashboard
                  </Link>
                    </Button>
                </div>
                              </div>
                                  </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
