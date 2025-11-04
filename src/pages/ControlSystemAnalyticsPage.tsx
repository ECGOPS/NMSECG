import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { Download, FileText, Filter, AlertTriangle, Users, Zap, Clock, TrendingUp, Table, BarChart3, Loader2 } from 'lucide-react';
import { SafeText } from '@/components/ui/safe-display';
import { Layout } from "@/components/layout/Layout";
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
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
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { FeederManagement } from "@/components/analytics/FeederManagement";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { calculateOutageDuration } from "@/utils/calculations";

import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { ControlSystemOutageData } from '@/lib/validation-schemas';
import { toast } from '@/components/ui/sonner';

const { RangePicker } = DatePicker;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ControlSystemAnalyticsPage() {
  const { user, isAuthenticated } = useAzureADAuth();
  const { controlSystemOutages, regions, districts } = useData();
  
  // Ensure arrays are always arrays to prevent "not iterable" errors
  // But preserve the actual data when available for metrics calculation
  const safeControlSystemOutages = Array.isArray(controlSystemOutages) ? controlSystemOutages : [];
  const safeRegions = Array.isArray(regions) ? regions : [];
  const safeDistricts = Array.isArray(districts) ? districts : [];
  
  // Check if data is actually loaded (not just empty arrays)
  const isDataLoaded = Array.isArray(controlSystemOutages) && controlSystemOutages.length > 0;
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  // Filter regions and districts based on user role (same as Fault Analysis page)
  const filteredRegions = useMemo(() => {
    return safeRegions.filter(region => {
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
        const userDistrict = safeDistricts.find(d => d.name === user.district);
        return userDistrict ? region.id === userDistrict.regionId : false;
      }
      
      return false;
    });
  }, [user, safeRegions, safeDistricts]);

  const filteredDistricts = useMemo(() => {
    if (!filterRegion) {
      // If no region selected, but user is ashsubt or accsubt, show districts in their allowed regions
      if (user?.role === "ashsubt") {
        return safeDistricts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
      }
      if (user?.role === "accsubt") {
        return safeDistricts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
      }
      return [];
    }
    
    return safeDistricts.filter(district => {
      if (district.regionId !== filterRegion) return false;
      
      // Global engineers and system admins can see all districts in the selected region
      if (user?.role === "global_engineer" || user?.role === "system_admin") 
        return true;
      
      // Regional engineers, project engineers, and regional general managers can see all districts in their region
      if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager") 
        return true;
      
      // ashsubt and accsubt can see all districts in the selected region
      if (user?.role === "ashsubt" || user?.role === "accsubt")
        return true;
      
      // District engineers, district managers and technicians can only see their assigned district
      if (user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") 
        return district.name === user.district;
      
      return false;
    });
  }, [filterRegion, user, safeDistricts]);
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedWeekYear, setSelectedWeekYear] = useState<number | undefined>(undefined);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [outageType, setOutageType] = useState<'all' | 'sustained' | 'momentary'>('all');
  const [filterFaultType, setFilterFaultType] = useState<string>("all");
  const [filterSpecificFaultType, setFilterSpecificFaultType] = useState<string>("all");
  const [minTripCount, setMinTripCount] = useState<number>(1); // Changed default to 1
  const [selectedFeederName, setSelectedFeederName] = useState<string>("all");
  const [uniqueFeederNames, setUniqueFeederNames] = useState<string[]>([]);
  const [view, setView] = useState<'charts' | 'table'>('charts');
  const [sortField, setSortField] = useState<string>('occurrenceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>("overview");
  const navigate = useNavigate();

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [currentPageData, setCurrentPageData] = useState<any[]>([]);
  const [allFilteredDataForMetrics, setAllFilteredDataForMetrics] = useState<any[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsProgress, setMetricsProgress] = useState<{ current: number; total: number } | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Page size options
  const pageSizeOptions = [10, 25, 50, 100];

  // Add column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    occurrenceDate: true,
    region: true,
    district: true,
    faultType: true,
    specificFaultType: true,
    description: true,
    feederName: true,
    voltageLevel: true,
    ruralCustomers: true,
    urbanCustomers: true,
    metroCustomers: true,
    totalCustomers: true,
    ruralCID: true,
    urbanCID: true,
    metroCID: true,
    customerInterruptionDuration: true,
    ruralCIF: true,
    urbanCIF: true,
    metroCIF: true,
    customerInterruptionFrequency: true,
    totalFeederCustomers: true,
    unservedEnergy: true,
    repairDuration: true,
    outageDuration: true,
    load: true,
    status: true,
    controlPanelIndications: true,
    areaAffected: true,
    restorationDateTime: true
  });

  // Add a new state for filtered data
  const [filteredTableData, setFilteredTableData] = useState<ControlSystemOutageData[]>([]);

  // Add a new state for tracking the current data
  const [currentData, setCurrentData] = useState<ControlSystemOutageData[]>([]);

  // Add clear filters function
  const clearFilters = () => {
    // Clear filters while respecting role-based access
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
      // Regional users: keep their assigned region, clear district
      const regionObj = regions.find(r => r.name === user.region);
      if (regionObj) {
        setFilterRegion(regionObj.id);
      }
      setFilterDistrict("all");
    } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
      // District users: keep their assigned region and district
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        setFilterRegion(userDistrict.regionId);
        setFilterDistrict(userDistrict.id);
      }
    } else {
      // System admin and global engineer: clear both
    setFilterRegion("all");
    setFilterDistrict("all");
    }
    
    // Clear other filters
    setDateRange("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedWeek(undefined);
    setSelectedWeekYear(undefined);
    setOutageType("all");
    setFilterFaultType("all");
    setFilterSpecificFaultType("all");
    setMinTripCount(1);
    setSelectedFeederName("all");
    setCurrentPage(1);
    loadPageData(1);
  };

  // Column definitions
  const columns = [
    { id: 'occurrenceDate', label: 'Occurrence Date', sortField: 'occurrenceDate' },
    { id: 'region', label: 'Region', sortField: 'regionId' },
    { id: 'district', label: 'District/Section', sortField: 'districtId' },
    { id: 'faultType', label: 'Outage Category', sortField: 'faultType' },
    { id: 'specificFaultType', label: 'Specific Outage Category', sortField: 'specificFaultType' },
    { id: 'description', label: 'Description', sortField: 'description' },
    { id: 'feederName', label: 'Feeder Name', sortField: 'feederName' },
    { id: 'voltageLevel', label: 'Voltage Level', sortField: 'voltageLevel' },
    { id: 'ruralCustomers', label: 'Rural Customers Affected', sortField: 'customersAffected.rural' },
    { id: 'urbanCustomers', label: 'Urban Customers Affected', sortField: 'customersAffected.urban' },
    { id: 'metroCustomers', label: 'Metro Customers Affected', sortField: 'customersAffected.metro' },
    { id: 'totalCustomers', label: 'Total Customers Affected', sortField: 'customersAffected' },
    { id: 'ruralCID', label: 'Rural CID (hrs)', sortField: 'customerInterruptionDuration.rural' },
    { id: 'urbanCID', label: 'Urban CID (hrs)', sortField: 'customerInterruptionDuration.urban' },
    { id: 'metroCID', label: 'Metro CID (hrs)', sortField: 'customerInterruptionDuration.metro' },
    { id: 'customerInterruptionDuration', label: 'Total CID (hrs)', sortField: 'customerInterruptionDuration' },
    { id: 'ruralCIF', label: 'Rural CIF', sortField: 'customerInterruptionFrequency.rural' },
    { id: 'urbanCIF', label: 'Urban CIF', sortField: 'customerInterruptionFrequency.urban' },
    { id: 'metroCIF', label: 'Metro CIF', sortField: 'customerInterruptionFrequency.metro' },
    { id: 'customerInterruptionFrequency', label: 'Total CIF', sortField: 'customerInterruptionFrequency' },
    { id: 'totalFeederCustomers', label: 'Total Feeder Customers', sortField: 'feederCustomers' },
    { id: 'repairDuration', label: 'Repair Duration (hrs)', sortField: 'repairStartDate' },
    { id: 'outageDuration', label: 'Outage Duration (hrs)', sortField: 'restorationDate' },
    { id: 'load', label: 'Load (MW)', sortField: 'loadMW' },
    { id: 'unservedEnergy', label: 'Unserved Energy (MWh)', sortField: 'unservedEnergyMWh' },
    { id: 'status', label: 'Status' },
    { id: 'controlPanelIndications', label: 'Indications on Control Panel', sortField: 'controlPanelIndications' },
    { id: 'areaAffected', label: 'Area Affected', sortField: 'areaAffected' },
    { id: 'restorationDateTime', label: 'Restoration Date & Time', sortField: 'restorationDate' }
  ];

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId as keyof typeof prev]
    }));
  };

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${filterRegion}-${filterDistrict}-${dateRange}-${outageType}-${filterFaultType}-${user?.role}-${user?.region}-${user?.district}`;
  }, [filterRegion, filterDistrict, dateRange, outageType, filterFaultType, user]);

  // Server-side data loading function
  const loadPageData = async (page: number = currentPage, resetPagination = false) => {
    console.log('[ControlSystemAnalyticsPage] loadPageData called with page:', page);
    console.log('[ControlSystemAnalyticsPage] Current state when loadPageData called:', {
      dateRange,
      startDate,
      endDate,
      selectedWeek,
      selectedMonth,
      selectedYear,
      selectedWeekYear,
      selectedMonthYear,
      filterRegion,
      filterDistrict,
      outageType,
      filterFaultType,
      filterSpecificFaultType
    });
    
    // Get the current outageType value to avoid closure issues
    const currentOutageType = outageType;
    console.log('[ControlSystemAnalyticsPage] Current outageType value:', currentOutageType);
    setIsLoadingPage(true);
    
    try {
      // Build query params
      const params = new URLSearchParams();
      
      // Role-based filtering - only apply if no user-selected filters
      let roleBasedRegionId = null;
      let roleBasedDistrictId = null;
      
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        // Force region filter for regional users
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          roleBasedRegionId = userRegion.id;
        }
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        // Force district filter for district users
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          roleBasedRegionId = userDistrict.regionId;
          roleBasedDistrictId = userDistrict.id;
        }
      }
      
      // Apply filters - use user-selected filters if available, otherwise use role-based
      const finalRegionId = (filterRegion && filterRegion !== "all") ? filterRegion : roleBasedRegionId;
      const finalDistrictId = (filterDistrict && filterDistrict !== "all") ? filterDistrict : roleBasedDistrictId;
      
      if (finalRegionId) params.append('regionId', finalRegionId);
      if (finalDistrictId) params.append('districtId', finalDistrictId);
      
      // Handle date filtering for all date range options
      let startDateParam: Date | undefined;
      let endDateParam: Date | undefined;
      
      if (dateRange !== "all") {
        const now = new Date();
        
        if (dateRange === "today") {
          startDateParam = startOfDay(now);
          endDateParam = endOfDay(now);
        } else if (dateRange === "yesterday") {
          const yesterday = subDays(now, 1);
          startDateParam = startOfDay(yesterday);
          endDateParam = endOfDay(yesterday);
        } else if (dateRange === "7days") {
          startDateParam = startOfDay(subDays(now, 7));
          endDateParam = endOfDay(now);
        } else if (dateRange === "30days") {
          startDateParam = startOfDay(subDays(now, 30));
          endDateParam = endOfDay(now);
        } else if (dateRange === "90days") {
          startDateParam = startOfDay(subDays(now, 90));
          endDateParam = endOfDay(now);
        } else if (dateRange === "custom" && startDate && endDate) {
          startDateParam = startOfDay(startDate);
          endDateParam = endOfDay(endDate);
        } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
          const yearStart = new Date(selectedWeekYear, 0, 1);
          const firstWeekStart = startOfWeek(yearStart);
          const weekStart = new Date(firstWeekStart);
          weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
          startDateParam = startOfWeek(weekStart);
          endDateParam = endOfWeek(weekStart);
        } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
          const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
          startDateParam = startOfMonth(monthStart);
          endDateParam = endOfMonth(monthStart);
        } else if (dateRange === "year" && selectedYear !== undefined) {
          startDateParam = startOfYear(new Date(selectedYear, 0, 1));
          endDateParam = endOfYear(new Date(selectedYear, 0, 1));
        }
        
        // Add date parameters to API call if we have valid dates
        if (startDateParam && endDateParam) {
          params.append('startDate', startDateParam.toISOString());
          params.append('endDate', endDateParam.toISOString());
          console.log('[ControlSystemAnalyticsPage] ✅ Adding date filter:', {
            dateRange,
            startDate: startDateParam.toISOString(),
            endDate: endDateParam.toISOString()
          });
        } else {
          console.log('[ControlSystemAnalyticsPage] ❌ No date filter added:', {
            dateRange,
            startDateParam: startDateParam?.toISOString(),
            endDateParam: endDateParam?.toISOString(),
            startDate,
            endDate,
            selectedWeek,
            selectedMonth,
            selectedYear,
            selectedWeekYear,
            selectedMonthYear
          });
        }
      }
      
      if (outageType && outageType !== "all") params.append('outageType', outageType);
      if (filterFaultType && filterFaultType !== "all") params.append('faultType', filterFaultType);
      if (filterSpecificFaultType && filterSpecificFaultType !== "all") {
        params.append('specificFaultType', filterSpecificFaultType);
        console.log('[ControlSystemAnalyticsPage] Adding specificFaultType filter:', filterSpecificFaultType);
      }
      
      // Debug logging for all applied filters
      console.log('[ControlSystemAnalyticsPage] Applied filters:', {
        filterRegion,
        filterDistrict,
        dateRange,
        startDate: startDateParam?.toISOString(),
        endDate: endDateParam?.toISOString(),
        outageType,
        filterFaultType,
        filterSpecificFaultType
      });
      
      // Sorting
      params.append('sort', sortField);
      params.append('order', sortDirection);
      
      // Server-side pagination parameters
      const pageOffset = (page - 1) * pageSize;
      params.append('limit', pageSize.toString());
      params.append('offset', pageOffset.toString());
      
      // Get total count first
      const countParams = new URLSearchParams(params);
      countParams.append('countOnly', 'true');
      
      console.log('[ControlSystemAnalyticsPage] Getting count with params:', countParams.toString());
      const countRes = await apiRequest(`/api/outages?${countParams.toString()}`);
      const totalCount = countRes.total || 0;
      
      setTotalItems(totalCount);
      
      // Fetch page data first
      const finalUrl = `/api/outages?${params.toString()}`;
      
      console.log('[ControlSystemAnalyticsPage] Fetching page data:', finalUrl);
      
      // Fetch page data
      const pageRes = await apiRequest(finalUrl);
      
      // For metrics: Use chunked aggregation for scalability (handles millions of records)
      // Note: With date filters (e.g., monthly), totalCount will be much smaller than database total
      // So chunking is a safety net for edge cases, but typically only 1-5 chunks needed for filtered data
      console.log('[ControlSystemAnalyticsPage] Starting metrics aggregation...');
      console.log(`[ControlSystemAnalyticsPage] Filtered dataset size: ${totalCount} records (after applying date/region/district filters)`);
      
      setIsLoadingMetrics(true);
      setMetricsProgress({ current: 0, total: totalCount });
      
      // Prepare params for metrics (same filters, no pagination initially)
      const allFilteredParams = new URLSearchParams(params);
      allFilteredParams.delete('limit');
      allFilteredParams.delete('offset');
      
      // Chunk size for processing (balance between memory and API calls)
      const CHUNK_SIZE = 5000; // Process 5000 records at a time
      let allFilteredData: any[] = [];
      let chunkOffset = 0;
      let hasMore = true;
      let chunkCount = 0;
      const MAX_CHUNKS = 200; // Safety limit: 200 chunks = 1M records max
      
      // Performance warning for very large filtered datasets
      if (totalCount > 500000) {
        console.warn(`[ControlSystemAnalyticsPage] Large filtered dataset detected (${totalCount} records). Processing may take several minutes.`);
      } else if (totalCount > 50000) {
        console.log(`[ControlSystemAnalyticsPage] Medium dataset (${totalCount} records). Will use chunked fetching.`);
      } else {
        console.log(`[ControlSystemAnalyticsPage] Small dataset (${totalCount} records). Quick fetch expected.`);
      }
      
      try {
        while (hasMore && chunkCount < MAX_CHUNKS) {
          // Set chunk pagination
          const chunkParams = new URLSearchParams(allFilteredParams);
          chunkParams.append('limit', CHUNK_SIZE.toString());
          chunkParams.append('offset', chunkOffset.toString());
          
          console.log(`[ControlSystemAnalyticsPage] Fetching metrics chunk ${chunkCount + 1} (offset: ${chunkOffset}, limit: ${CHUNK_SIZE})`);
          
          // Update progress
          setMetricsProgress({ current: chunkOffset + CHUNK_SIZE, total: totalCount });
          
          const chunkRes = await apiRequest(`/api/outages?${chunkParams.toString()}`);
          const chunkData = chunkRes.data || chunkRes || [];
          
          if (chunkData.length === 0) {
            hasMore = false;
            break;
          }
          
          // Accumulate data
          allFilteredData = [...allFilteredData, ...chunkData];
          
          // Check if we got fewer records than requested (last chunk)
          if (chunkData.length < CHUNK_SIZE) {
            hasMore = false;
            setMetricsProgress({ current: chunkOffset + chunkData.length, total: totalCount });
          } else {
            chunkOffset += CHUNK_SIZE;
            chunkCount++;
          }
          
          // If we have a lot of data, log progress periodically
          if (chunkCount % 10 === 0) {
            console.log(`[ControlSystemAnalyticsPage] Processed ${allFilteredData.length} records so far (${Math.round((allFilteredData.length / totalCount) * 100)}%)...`);
          }
          
          // Add small delay for very large datasets to prevent overwhelming the browser
          if (totalCount > 100000 && chunkCount % 20 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms pause every 20 chunks
          }
        }
        
        if (chunkCount >= MAX_CHUNKS) {
          console.warn(`[ControlSystemAnalyticsPage] Hit safety limit (${MAX_CHUNKS} chunks = ${MAX_CHUNKS * CHUNK_SIZE} records). Metrics may be incomplete for very large datasets.`);
          console.warn('[ControlSystemAnalyticsPage] Consider implementing backend aggregation for better scalability.');
        }
        
        setMetricsProgress(null);
        console.log(`[ControlSystemAnalyticsPage] Finished chunked aggregation: ${allFilteredData.length} total records from ${chunkCount} chunks`);
      } catch (error) {
        console.error('[ControlSystemAnalyticsPage] Error during chunked aggregation:', error);
        // Continue with whatever data we've collected so far
        console.log(`[ControlSystemAnalyticsPage] Using partial data: ${allFilteredData.length} records`);
        setMetricsProgress(null);
      } finally {
        setIsLoadingMetrics(false);
      }
      
      // Process paginated data
      // Debug the response structure
      console.log('[ControlSystemAnalyticsPage] API Response:', {
        responseType: typeof pageRes,
        hasData: 'data' in pageRes,
        dataLength: pageRes.data?.length || pageRes.length,
        sampleRecord: pageRes.data?.[0] || pageRes[0],
        allKeys: pageRes.data?.[0] ? Object.keys(pageRes.data[0]) : pageRes[0] ? Object.keys(pageRes[0]) : []
      });
      
      // Handle response structure (could be array or object with data property)
      let pageData = pageRes.data || pageRes || [];
      
      // Debug: Log the outageType value
      console.log('[ControlSystemAnalyticsPage] Checking outage type filter:', {
        outageType: currentOutageType,
        outageTypeType: typeof currentOutageType,
        shouldFilter: currentOutageType && currentOutageType !== "all",
        pageDataLength: pageData.length
      });
      
      // Apply client-side outage type filtering if needed
      if (currentOutageType && currentOutageType !== "all") {
        console.log('[ControlSystemAnalyticsPage] Applying client-side outage type filter:', currentOutageType);
        
        // Store original data for reference
        const originalData = pageData;
        
        // Filter the data
        const filteredData = pageData.filter((outage: any) => {
          if (!outage.occurrenceDate || !outage.restorationDate) {
            console.log('[ControlSystemAnalyticsPage] Skipping record without both dates:', {
              id: outage.id,
              occurrenceDate: outage.occurrenceDate,
              restorationDate: outage.restorationDate
            });
            return false; // Skip records without both dates
          }
          
          // Calculate duration in minutes
          const occurrenceTime = new Date(outage.occurrenceDate).getTime();
          const restorationTime = new Date(outage.restorationDate).getTime();
          const durationMinutes = (restorationTime - occurrenceTime) / (1000 * 60);
          
          console.log('[ControlSystemAnalyticsPage] Duration calculation:', {
            id: outage.id,
            occurrenceDate: outage.occurrenceDate,
            restorationDate: outage.restorationDate,
            occurrenceTime,
            restorationTime,
            durationMinutes,
            outageType: currentOutageType,
            isSustained: durationMinutes > 5,
            isMomentary: durationMinutes <= 5
          });
          
          if (currentOutageType === 'sustained') {
            return durationMinutes > 5; // Sustained = more than 5 minutes
          } else if (currentOutageType === 'momentary') {
            return durationMinutes <= 5; // Momentary = 5 minutes or less
          }
          
          return true;
        });
        
        // Take only the first pageSize records to maintain consistent pagination
        pageData = filteredData.slice(0, pageSize);
        
        console.log('[ControlSystemAnalyticsPage] After client-side outage type filter:', {
          originalCount: originalData.length,
          filteredCount: filteredData.length,
          pageDataCount: pageData.length,
          outageType: currentOutageType,
          note: `Showing first ${pageSize} of ${filteredData.length} filtered records`
        });
        
        // Update the total count to reflect the filtered data
        // This is an approximation - in a real system, you'd want to get the exact count
        if (filteredData.length < originalData.length) {
          console.log('[ControlSystemAnalyticsPage] Note: Total count may not be accurate due to client-side filtering');
        }
      }
      
      setCurrentPageData(pageData);
      
      // Update pagination state
      setHasNextPage(pageOffset + pageSize < totalCount);
      setHasPreviousPage(pageOffset > 0);
      
      console.log('[ControlSystemAnalyticsPage] Page data loaded:', {
        page,
        pageSize,
        totalCount,
        returnedRecords: pageData.length,
        hasNextPage: pageOffset + pageSize < totalCount,
        hasPreviousPage: pageOffset > 0
      });
      
      // Process all filtered data for metrics (already aggregated from chunks above)
      
      // Apply client-side outage type filtering to all filtered data if needed
      if (currentOutageType && currentOutageType !== "all") {
        allFilteredData = allFilteredData.filter((outage: any) => {
          if (!outage.occurrenceDate || !outage.restorationDate) {
            return false;
          }
          
          const occurrenceTime = new Date(outage.occurrenceDate).getTime();
          const restorationTime = new Date(outage.restorationDate).getTime();
          const durationMinutes = (restorationTime - occurrenceTime) / (1000 * 60);
          
          if (currentOutageType === 'sustained') {
            return durationMinutes > 5;
          } else if (currentOutageType === 'momentary') {
            return durationMinutes <= 5;
          }
          
          return true;
        });
      }
      
      setAllFilteredDataForMetrics(allFilteredData);
      
      console.log('[ControlSystemAnalyticsPage] All filtered data for metrics loaded:', {
        totalOutages: allFilteredData.length,
        sampleOutage: allFilteredData[0]
      });
      
    } catch (error) {
      console.error('[ControlSystemAnalyticsPage] Failed to load page data:', error);
    } finally {
      setIsLoadingPage(false);
    }
  };

  // Update the effect to reload data when filters change (with debounce)
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[ControlSystemAnalyticsPage] Filter change detected, reloading data...');
    setCurrentPage(1); // Reset to first page when filters change
      
      // Debounce the API call to prevent too many rapid requests
      const timeoutId = setTimeout(() => {
    loadPageData(1);
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    filterRegion,
    filterDistrict,
    dateRange,
    startDate,
    endDate,
    selectedWeek,
    selectedMonth,
    selectedYear,
    selectedWeekYear,
    selectedMonthYear,
    filterFaultType,
    filterSpecificFaultType,
    outageType,
    minTripCount,
    sortField,
    sortDirection,
    pageSize,
    user
  ]);
  
  // Load page data when page changes (separate from filter changes)
  useEffect(() => {
    if (isAuthenticated && user && currentPage > 1) {
      console.log('[ControlSystemAnalyticsPage] Page change detected, loading page:', currentPage);
      loadPageData(currentPage);
    }
  }, [currentPage]);
  
  // Load initial data when component mounts
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[ControlSystemAnalyticsPage] Initial load...');
      loadPageData(1);
    }
  }, [isAuthenticated, user]);

  // Load next page
  const loadNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Load previous page
  const loadPreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Define all possible outage categories
  const faultTypes = [
    "Planned",
    "Unplanned",
    "Emergency",
    "ECG Load Shedding",
    "GridCo Outages"
  ];

  // Define specific outage categories
  const specificFaultTypes = [
    "JUMPER CUT",
    "CONDUCTOR CUT",
    "MERGED CONDUCTOR",
    "HV/LV LINE CONTACT",
    "VEGETATION",
    "CABLE FAULT",
    "TERMINATION FAILURE",
    "BROKEN POLES",
    "BURNT POLE",
    "FAULTY ARRESTER/INSULATOR",
    "EQIPMENT FAILURE",
    "PUNCTURED CABLE",
    "ANIMAL INTERRUPTION",
    "BAD WEATHER",
    "TRANSIENT FAULTS",
    "OTHERS"
  ];

  // Filter outages based on selected criteria
  // Use actual data when available, fallback to safe array for safety
  const dataToFilter = isDataLoaded ? controlSystemOutages : safeControlSystemOutages;
  
  // Debug logging to understand data state
  console.log('[ControlSystemAnalyticsPage] Data state:', {
    isDataLoaded,
    actualDataLength: controlSystemOutages?.length || 0,
    safeDataLength: safeControlSystemOutages.length,
    dataToFilterLength: dataToFilter.length
  });
  
  const filteredOutages = dataToFilter.filter(outage => {
    // Apply region filter
    if (filterRegion && filterRegion !== "all" && outage.regionId !== filterRegion) {
      return false;
    }

    // Apply district filter
    if (filterDistrict && filterDistrict !== "all" && outage.districtId !== filterDistrict) {
      return false;
    }

    // Apply outage category filter
    if (filterFaultType && filterFaultType !== "all" && outage.faultType !== filterFaultType) {
      return false;
    }

    // Apply specific outage category filter
    if (filterSpecificFaultType && filterSpecificFaultType !== "all" && outage.specificFaultType !== filterSpecificFaultType) {
      return false;
    }
    
    if (dateRange !== "all") {
      const now = new Date();
      let start, end;
      
      if (dateRange === "today") {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (dateRange === "yesterday") {
        const yesterday = subDays(now, 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
      } else if (dateRange === "7days") {
        start = startOfDay(subDays(now, 7));
        end = endOfDay(now);
      } else if (dateRange === "30days") {
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
      } else if (dateRange === "90days") {
        start = startOfDay(subDays(now, 90));
        end = endOfDay(now);
      } else if (dateRange === "custom" && startDate && endDate) {
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
      }

      const outageDate = new Date(outage.occurrenceDate);
      if (outageDate < start || outageDate > end) {
        return false;
      }
    }

    // Filter by outage type (sustained/momentary)
    if (outageType !== 'all' && outage.occurrenceDate && outage.restorationDate) {
      const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60); // duration in minutes
      if (outageType === 'sustained' && duration <= 5) return false; // Sustained = >5 minutes, so exclude ≤5
      if (outageType === 'momentary' && duration > 5) return false;  // Momentary = ≤5 minutes, so exclude >5
    }
    
    return true;
  }) || [];

  // Fetch unique feeder names from server-side filtered data (matching the outage table filters)
  useEffect(() => {
    // First, populate immediately from currentPageData if available (fast fallback)
    if (currentPageData.length > 0) {
      const feeders = new Set<string>();
      currentPageData.forEach(outage => {
        if (outage.feederName && outage.feederName.trim() !== '') {
          feeders.add(outage.feederName);
        }
      });
      const currentPageFeeders = Array.from(feeders).sort();
      if (currentPageFeeders.length > 0) {
        setUniqueFeederNames(currentPageFeeders);
        console.log('[ControlSystemAnalyticsPage] Populated feeder names from currentPageData (immediate):', currentPageFeeders.length);
      }
    }

    const fetchUniqueFeederNames = async () => {
      try {
        // Build query params with same filters as loadPageData
        const params = new URLSearchParams();
        
        // Role-based filtering
        let roleBasedRegionId = null;
        let roleBasedDistrictId = null;
        
        if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
          const userRegion = regions.find(r => r.name === user.region);
          if (userRegion) {
            roleBasedRegionId = userRegion.id;
          }
        } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
          const userDistrict = districts.find(d => d.name === user.district);
          if (userDistrict) {
            roleBasedRegionId = userDistrict.regionId;
            roleBasedDistrictId = userDistrict.id;
          }
        }
        
        const finalRegionId = (filterRegion && filterRegion !== "all") ? filterRegion : roleBasedRegionId;
        const finalDistrictId = (filterDistrict && filterDistrict !== "all") ? filterDistrict : roleBasedDistrictId;
        
        if (finalRegionId) params.append('regionId', finalRegionId);
        if (finalDistrictId) params.append('districtId', finalDistrictId);
        
        // Date filtering
        if (dateRange !== "all") {
          const now = new Date();
          let startDateParam: Date | undefined;
          let endDateParam: Date | undefined;
          
          if (dateRange === "today") {
            startDateParam = startOfDay(now);
            endDateParam = endOfDay(now);
          } else if (dateRange === "yesterday") {
            const yesterday = subDays(now, 1);
            startDateParam = startOfDay(yesterday);
            endDateParam = endOfDay(yesterday);
          } else if (dateRange === "7days") {
            startDateParam = startOfDay(subDays(now, 7));
            endDateParam = endOfDay(now);
          } else if (dateRange === "30days") {
            startDateParam = startOfDay(subDays(now, 30));
            endDateParam = endOfDay(now);
          } else if (dateRange === "90days") {
            startDateParam = startOfDay(subDays(now, 90));
            endDateParam = endOfDay(now);
          } else if (dateRange === "custom" && startDate && endDate) {
            startDateParam = startOfDay(startDate);
            endDateParam = endOfDay(endDate);
          } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
            const yearStart = new Date(selectedWeekYear, 0, 1);
            const firstWeekStart = startOfWeek(yearStart);
            const weekStart = new Date(firstWeekStart);
            weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
            startDateParam = startOfWeek(weekStart);
            endDateParam = endOfWeek(weekStart);
          } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
            const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
            startDateParam = startOfMonth(monthStart);
            endDateParam = endOfMonth(monthStart);
          } else if (dateRange === "year" && selectedYear !== undefined) {
            startDateParam = startOfYear(new Date(selectedYear, 0, 1));
            endDateParam = endOfYear(new Date(selectedYear, 0, 1));
          }
          
          if (startDateParam && endDateParam) {
            params.append('startDate', startDateParam.toISOString());
            params.append('endDate', endDateParam.toISOString());
          }
        }
        
        if (outageType && outageType !== "all") params.append('outageType', outageType);
        if (filterFaultType && filterFaultType !== "all") params.append('faultType', filterFaultType);
        if (filterSpecificFaultType && filterSpecificFaultType !== "all") {
          params.append('specificFaultType', filterSpecificFaultType);
        }
        
        // Fetch a large dataset to get all unique feeder names (limit to 10000 records)
        params.append('limit', '10000');
        params.append('offset', '0');
        
        const response = await apiRequest(`/api/outages?${params.toString()}`);
        const data = response.data || response || [];
        
        // Extract unique feeder names
        const feeders = new Set<string>();
        data.forEach((outage: any) => {
          if (outage.feederName && outage.feederName.trim() !== '') {
            feeders.add(outage.feederName);
          }
        });
        
        const sortedFeeders = Array.from(feeders).sort();
        setUniqueFeederNames(sortedFeeders);
        
        console.log('[ControlSystemAnalyticsPage] Fetched unique feeder names from server:', sortedFeeders.length);
      } catch (error) {
        console.error('[ControlSystemAnalyticsPage] Error fetching unique feeder names:', error);
        // Fallback to current page data
        const feeders = new Set<string>();
        currentPageData.forEach(outage => {
          if (outage.feederName && outage.feederName.trim() !== '') {
            feeders.add(outage.feederName);
          }
        });
        setUniqueFeederNames(Array.from(feeders).sort());
      }
    };

    // Fetch from server to get all feeders matching the filters
    // This will update the list with all available feeders, not just current page
    if (isDataLoaded) {
      fetchUniqueFeederNames();
    }
  }, [
    filterRegion, filterDistrict, dateRange, startDate, endDate, selectedWeek, selectedWeekYear,
    selectedMonth, selectedMonthYear, selectedYear, outageType, filterFaultType, filterSpecificFaultType,
    user, regions, districts, isDataLoaded, currentPageData
  ]);

  // Calculate metrics
  const calculateMetrics = () => {
    // Debug logging for metrics calculation
    console.log('[ControlSystemAnalyticsPage] Metrics calculation:', {
      allFilteredDataLength: allFilteredDataForMetrics.length,
      currentPageDataLength: currentPageData.length,
      totalItems,
      minTripCount,
      isDataLoaded
    });
    
    // Use all filtered data from backend for metrics calculation (not paginated data)
    // This ensures metrics are calculated on all filtered data, not just the current page
    let dataForMetrics = [...allFilteredDataForMetrics];
    
    // If no filtered data is loaded yet, fall back to current page data or filtered outages
    if (dataForMetrics.length === 0) {
      if (currentPageData.length > 0) {
        dataForMetrics = [...currentPageData];
        console.log('[ControlSystemAnalyticsPage] Using current page data for metrics (fallback):', dataForMetrics.length);
      } else if (isDataLoaded) {
      dataForMetrics = [...filteredOutages];
      console.log('[ControlSystemAnalyticsPage] Using filtered outages for metrics (fallback):', dataForMetrics.length);
      }
    }
    
    // Apply feeder name filter to metrics data
    if (selectedFeederName && selectedFeederName !== "all") {
      dataForMetrics = dataForMetrics.filter(outage => 
        outage.feederName === selectedFeederName
      );
      console.log('[ControlSystemAnalyticsPage] After selectedFeederName filter:', {
        originalCount: currentPageData.length,
        filteredCount: dataForMetrics.length,
        selectedFeederName
      });
    }
    
    // Apply feeder trip count filter to metrics data
    if (minTripCount > 1) {
      // Count trips per feeder
      const feederTripCounts = dataForMetrics.reduce((acc, outage) => {
        if (outage.feederName) {
          acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter outages to only include those from feeders with enough trips
      dataForMetrics = dataForMetrics.filter(outage => 
        !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount
      );
      
      console.log('[ControlSystemAnalyticsPage] After minTripCount filter:', {
        originalCount: currentPageData.length,
        filteredCount: dataForMetrics.length,
        minTripCount
      });
    }

    const totalOutages = dataForMetrics.length;
    const totalCustomersAffected = dataForMetrics.reduce((sum, outage) => {
      const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
      return sum + rural + urban + metro;
    }, 0);
    
    const totalUnservedEnergy = dataForMetrics.reduce((sum, outage) => 
      sum + (outage.unservedEnergyMWh || 0), 0
    );
    
    const avgOutageDuration = dataForMetrics.reduce((sum, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime();
        return sum + duration;
      }
      return sum;
    }, 0) / (totalOutages || 1);

    // Calculate Total Outage Duration (sum of all outage durations in hours)
    const totalOutageDuration = dataForMetrics.reduce((sum, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60); // hours
        return sum + duration;
      }
      return sum;
    }, 0);

    // Calculate Customer Interruption Duration (CID)
    const customerInterruptionDuration = dataForMetrics.reduce((sum, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60); // hours
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return sum + (duration * (rural + urban + metro));
      }
      return sum;
    }, 0);

    // Calculate Customer Interruption Frequency (CIF)
    // CIF = Total Customer Interruptions / Total Customers
    // Total Customer Interruptions = Sum of all affected customers across all outages
    
    // Calculate total customer interruptions per customer type (sum of affected customers)
    // IMPORTANT: When the same feeder has multiple outages:
    // - Each outage is counted separately (same customer can be interrupted multiple times)
    // - Example: If Feeder A has 2 outages affecting 100 customers each:
    //   - Total interruptions = 100 + 100 = 200 (not 100)
    //   - This correctly reflects that customers experienced 2 separate interruption events
    let totalMetroInterruptions = 0;
    let totalUrbanInterruptions = 0;
    let totalRuralInterruptions = 0;
    
    dataForMetrics.forEach(outage => {
      const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
      
      // Sum affected customers (each affected customer in each outage = 1 interruption)
      // Multiple outages from same feeder are counted separately (correct for SAIFI/CIF)
      totalMetroInterruptions += metro;
      totalUrbanInterruptions += urban;
      totalRuralInterruptions += rural;
    });
    
    // Calculate total customer interruptions (sum of all affected customers)
    const totalCustomerInterruptions = totalMetroInterruptions + totalUrbanInterruptions + totalRuralInterruptions;
    
    // Calculate total feeder customers (sum across all outages, using max per feeder if grouped by feeder)
    // IMPORTANT: When the same feeder has multiple outages:
    // - Feeder customers (total customers served) remain constant across outages
    // - We use a Map to track unique feeders and take max value per feeder
    // - This prevents double-counting customers when same feeder has multiple outages
    // - Example: If Feeder A appears in 3 outages with 1000 customers each:
    //   - We count 1000 customers (not 3000) - correct for SAIFI/SAIDI denominator
    const feederCustomersMap = new Map<string, { metro: number; urban: number; rural: number }>();
    
    dataForMetrics.forEach(outage => {
      if (outage.feederName && outage.feederCustomers) {
        const feederName = outage.feederName;
        const existing = feederCustomersMap.get(feederName) || { metro: 0, urban: 0, rural: 0 };
        const feederCustomers = outage.feederCustomers;
        
        // Use maximum values per feeder (feeder customers don't change per outage, so take max)
        // This ensures each unique feeder is counted only once, regardless of number of outages
        feederCustomersMap.set(feederName, {
          metro: Math.max(existing.metro, feederCustomers.metro || 0),
          urban: Math.max(existing.urban, feederCustomers.urban || 0),
          rural: Math.max(existing.rural, feederCustomers.rural || 0)
        });
      }
    });
    
    // Sum up unique feeder customers
    let totalMetroCustomers = 0;
    let totalUrbanCustomers = 0;
    let totalRuralCustomers = 0;
    
    feederCustomersMap.forEach(customers => {
      totalMetroCustomers += customers.metro;
      totalUrbanCustomers += customers.urban;
      totalRuralCustomers += customers.rural;
    });
    
    // If no feeder customers data, fallback to sum all feeder customers from outages
    if (totalMetroCustomers === 0 && totalUrbanCustomers === 0 && totalRuralCustomers === 0) {
      dataForMetrics.forEach(outage => {
        if (outage.feederCustomers) {
          totalMetroCustomers += outage.feederCustomers.metro || 0;
          totalUrbanCustomers += outage.feederCustomers.urban || 0;
          totalRuralCustomers += outage.feederCustomers.rural || 0;
        }
      });
    }
    
    // Ensure total customers is exactly the sum of individual customer types
    const totalCustomers = totalMetroCustomers + totalUrbanCustomers + totalRuralCustomers;
    
    // Calculate CIF per customer type and total
    // CIF = Total Customer Interruptions / Total Customers
    const metroCIF = totalMetroCustomers > 0 ? totalMetroInterruptions / totalMetroCustomers : 0;
    const urbanCIF = totalUrbanCustomers > 0 ? totalUrbanInterruptions / totalUrbanCustomers : 0;
    const ruralCIF = totalRuralCustomers > 0 ? totalRuralInterruptions / totalRuralCustomers : 0;
    
    // Calculate SAIDI (System Average Interruption Duration Index) for each area type
    // SAIDI = Sum of Customer Interruption Durations / Total Customers Served
    // Sum of Customer Interruption Durations = Affected Customers × Outage Duration (for each outage)
    // 
    // IMPORTANT: When the same feeder has multiple outages with different durations:
    // - Each outage is processed separately
    // - Customer-hours are summed: Outage1(customers × duration1) + Outage2(customers × duration2) + ...
    // - Example: If Feeder A has 2 outages:
    //   - Outage 1: 100 customers × 5 hours = 500 customer-hours
    //   - Outage 2: 100 customers × 10 hours = 1000 customer-hours
    //   - Total = 1500 customer-hours (correctly accounts for different durations)
    // 
    // The total feeder customers (denominator) is calculated once per unique feeder using max values,
    // so multiple outages from the same feeder don't double-count the customer base.
    let metroCustomerHoursLost = 0;
    let urbanCustomerHoursLost = 0;
    let ruralCustomerHoursLost = 0;
    
    dataForMetrics.forEach(outage => {
      if (outage.occurrenceDate && outage.restorationDate) {
        // Calculate outage duration using utility function (in hours)
        // Formula: (Restoration Date - Occurrence Date) / (1000 ms × 60 sec × 60 min)
        // This converts milliseconds difference to hours
        // Example: 
        //   - Occurrence: "2024-01-01T10:00:00Z"
        //   - Restoration: "2024-01-01T20:00:00Z"
        //   - Duration: (20:00 - 10:00) = 10 hours
        const duration = calculateOutageDuration(outage.occurrenceDate, outage.restorationDate);
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        // Each outage contributes its customer-hours based on its specific duration
        // Multiple outages with different durations are correctly summed
        // Customer-hours = Duration (hours) × Affected Customers
        metroCustomerHoursLost += duration * metro;
        urbanCustomerHoursLost += duration * urban;
        ruralCustomerHoursLost += duration * rural;
      }
    });
    
    const metroSAIDI = totalMetroCustomers > 0 ? metroCustomerHoursLost / totalMetroCustomers : 0;
    const urbanSAIDI = totalUrbanCustomers > 0 ? urbanCustomerHoursLost / totalUrbanCustomers : 0;
    const ruralSAIDI = totalRuralCustomers > 0 ? ruralCustomerHoursLost / totalRuralCustomers : 0;
    
    // Calculate CAIDI (Customer Average Interruption Duration Index) for each area type
    // CAIDI = SAIDI / SAIFI
    // Note: SAIFI = CIF (System Average Interruption Frequency Index)
    const metroCAIDI = metroCIF > 0 ? metroSAIDI / metroCIF : 0;
    const urbanCAIDI = urbanCIF > 0 ? urbanSAIDI / urbanCIF : 0;
    const ruralCAIDI = ruralCIF > 0 ? ruralSAIDI / ruralCIF : 0;
    
    // Total CIF = Total Interruptions / Total Customers (should match weighted average)
    // Verify: Total CIF should equal (Metro Interruptions + Urban Interruptions + Rural Interruptions) / (Metro Customers + Urban Customers + Rural Customers)
    const customerInterruptionFrequency = totalCustomers > 0 ? totalCustomerInterruptions / totalCustomers : 0;
    
    // Verification: Calculate expected Total CIF as weighted average
    const weightedCIF = totalCustomers > 0 
      ? ((metroCIF * totalMetroCustomers) + (urbanCIF * totalUrbanCustomers) + (ruralCIF * totalRuralCustomers)) / totalCustomers
      : 0;
    
    // Log individual values for easy inspection
    console.log('=== CIF CALCULATION BREAKDOWN ===');
    console.log('Metro:', {
      interruptions: totalMetroInterruptions,
      customers: totalMetroCustomers,
      cif: metroCIF.toFixed(3),
      formula: `${totalMetroInterruptions} / ${totalMetroCustomers} = ${metroCIF.toFixed(3)}`
    });
    console.log('Urban:', {
      interruptions: totalUrbanInterruptions,
      customers: totalUrbanCustomers,
      cif: urbanCIF.toFixed(3),
      formula: `${totalUrbanInterruptions} / ${totalUrbanCustomers} = ${urbanCIF.toFixed(3)}`
    });
    console.log('Rural:', {
      interruptions: totalRuralInterruptions,
      customers: totalRuralCustomers,
      cif: ruralCIF.toFixed(3),
      formula: `${totalRuralInterruptions} / ${totalRuralCustomers} = ${ruralCIF.toFixed(3)}`
    });
    console.log('TOTAL CIF:', {
      totalInterruptions: totalCustomerInterruptions,
      totalCustomers: totalCustomers,
      cif: customerInterruptionFrequency.toFixed(3),
      formula: `${totalCustomerInterruptions} / ${totalCustomers} = ${customerInterruptionFrequency.toFixed(3)}`,
      note: 'This is a WEIGHTED average based on customer counts, not a simple average'
    });
    console.log('===================================');
    
    // Verify calculation across different events (multiple outages)
    console.log('[ControlSystemAnalyticsPage] CIF Calculation DETAILED (checking why values don\'t tally):', {
      totalOutages,
      totalCustomerInterruptions: {
        metro: totalMetroInterruptions,
        urban: totalUrbanInterruptions,
        rural: totalRuralInterruptions,
        total: totalCustomerInterruptions,
        calculation: `Metro (${totalMetroInterruptions}) + Urban (${totalUrbanInterruptions}) + Rural (${totalRuralInterruptions}) = ${totalCustomerInterruptions}`
      },
      totalCustomers: {
        metro: totalMetroCustomers,
        urban: totalUrbanCustomers,
        rural: totalRuralCustomers,
        total: totalCustomers,
        verification: `Metro (${totalMetroCustomers}) + Urban (${totalUrbanCustomers}) + Rural (${totalRuralCustomers}) = ${totalCustomers}`
      },
      cif: {
        metroCIF: {
          value: metroCIF,
          calculation: `${totalMetroInterruptions} / ${totalMetroCustomers} = ${metroCIF.toFixed(3)}`
        },
        urbanCIF: {
          value: urbanCIF,
          calculation: `${totalUrbanInterruptions} / ${totalUrbanCustomers} = ${urbanCIF.toFixed(3)}`
        },
        ruralCIF: {
          value: ruralCIF,
          calculation: `${totalRuralInterruptions} / ${totalRuralCustomers} = ${ruralCIF.toFixed(3)}`
        },
        totalCIF: {
          directCalculation: customerInterruptionFrequency,
          formula: `${totalCustomerInterruptions} / ${totalCustomers} = ${customerInterruptionFrequency.toFixed(3)}`,
          weightedAverage: weightedCIF,
          weightedFormula: `((${metroCIF.toFixed(3)} × ${totalMetroCustomers}) + (${urbanCIF.toFixed(3)} × ${totalUrbanCustomers}) + (${ruralCIF.toFixed(3)} × ${totalRuralCustomers})) / ${totalCustomers} = ${weightedCIF.toFixed(3)}`,
          matches: Math.abs(customerInterruptionFrequency - weightedCIF) < 0.001,
          difference: Math.abs(customerInterruptionFrequency - weightedCIF)
        }
      },
      breakdownByOutage: dataForMetrics.map(outage => {
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        const { rural: feederRural = 0, urban: feederUrban = 0, metro: feederMetro = 0 } = outage.feederCustomers || {};
        return {
          id: outage.id,
          feederName: outage.feederName,
          affectedCustomers: { metro, urban, rural },
          feederCustomers: { metro: feederMetro, urban: feederUrban, rural: feederRural },
          totalAffected: metro + urban + rural,
          totalFeederCustomers: feederMetro + feederUrban + feederRural
        };
      }),
      explanation: {
        note: 'Total CIF is a WEIGHTED average, not a simple average',
        simpleAverage: ((metroCIF + urbanCIF + ruralCIF) / 3).toFixed(3),
        weightedAverage: customerInterruptionFrequency.toFixed(3),
        whyDifferent: 'Total CIF weights each customer type by the number of customers in that category'
      }
    });

    // Calculate Repair Durations
    const repairDurations = dataForMetrics.reduce((sum, outage) => {
      if (outage.repairStartDate && outage.repairEndDate) {
        const duration = new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime();
        return sum + duration;
      }
      return sum;
    }, 0) / (totalOutages || 1);

    // Calculate outage category metrics
    const faultTypeMetrics = dataForMetrics.reduce((acc, outage) => {
      const type = outage.faultType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('[ControlSystemAnalyticsPage] Metrics calculated:', {
      totalOutages,
      totalCustomersAffected,
      totalUnservedEnergy,
      customerInterruptionDuration,
      customerInterruptionFrequency,
      repairDurations: repairDurations / (1000 * 60 * 60),
      faultTypeMetrics
    });

    return {
      totalOutages,
      totalCustomersAffected,
      totalUnservedEnergy,
      avgOutageDuration: avgOutageDuration / (1000 * 60 * 60), // Convert to hours
      totalOutageDuration, // Total outage duration in hours
      customerInterruptionDuration,
      customerInterruptionFrequency, // Total CIF
      metroCIF, // Metro CIF across all outages (same as Metro SAIFI)
      urbanCIF, // Urban CIF across all outages (same as Urban SAIFI)
      ruralCIF, // Rural CIF across all outages (same as Rural SAIFI)
      // SAIFI (System Average Interruption Frequency Index) - same as CIF
      metroSAIFI: metroCIF,
      urbanSAIFI: urbanCIF,
      ruralSAIFI: ruralCIF,
      // SAIDI (System Average Interruption Duration Index)
      metroSAIDI,
      urbanSAIDI,
      ruralSAIDI,
      // CAIDI (Customer Average Interruption Duration Index)
      metroCAIDI,
      urbanCAIDI,
      ruralCAIDI,
      repairDurations: repairDurations / (1000 * 60 * 60), // Convert to hours
      faultTypeMetrics
    };
  };

  const metrics = useMemo(() => calculateMetrics(), [
    allFilteredDataForMetrics,
    currentPageData,
    isDataLoaded,
    filteredOutages,
    selectedFeederName,
    minTripCount
  ]);

  // Add state for feeder pagination
  const [feederPage, setFeederPage] = useState(1);
  const feedersPerPage = 5;

  // Prepare chart data
  const prepareChartData = () => {
    // Use all filtered data from backend for chart calculation (not paginated data)
    // This ensures charts reflect all filtered data, not just the current page
    let dataForCharts = [...allFilteredDataForMetrics];
    
    // If no filtered data is loaded yet, fall back to current page data or filtered outages
    if (dataForCharts.length === 0) {
      if (currentPageData.length > 0) {
        dataForCharts = [...currentPageData];
        console.log('[ControlSystemAnalyticsPage] Using current page data for charts (fallback):', dataForCharts.length);
      } else if (isDataLoaded) {
      dataForCharts = [...filteredOutages];
      console.log('[ControlSystemAnalyticsPage] Using filtered outages for charts (fallback):', dataForCharts.length);
      }
    }
    
    // Apply feeder name filter to chart data
    if (selectedFeederName && selectedFeederName !== "all") {
      dataForCharts = dataForCharts.filter(outage => 
        outage.feederName === selectedFeederName
      );
      console.log('[ControlSystemAnalyticsPage] Chart data after selectedFeederName filter:', {
        originalCount: currentPageData.length,
        filteredCount: dataForCharts.length,
        selectedFeederName
      });
    }
    
    // Apply feeder trip count filter to chart data
    if (minTripCount > 1) {
      // Count trips per feeder
      const feederTripCounts = dataForCharts.reduce((acc, outage) => {
        if (outage.feederName) {
          acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter outages to only include those from feeders with enough trips
      dataForCharts = dataForCharts.filter(outage => 
        !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount
      );
      
      console.log('[ControlSystemAnalyticsPage] Chart data after minTripCount filter:', {
        originalCount: currentPageData.length,
        filteredCount: dataForCharts.length,
        minTripCount
      });
    }

    // Outages by category
    const outagesByType = dataForCharts.reduce((acc, outage) => {
      const faultType = outage.faultType || 'Unknown';
      acc[faultType] = (acc[faultType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Outages by voltage level
    const outagesByVoltage = dataForCharts.reduce((acc, outage) => {
      acc[outage.voltageLevel || 'Unknown'] = (acc[outage.voltageLevel || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Monthly trend
    const monthlyTrend = dataForCharts.reduce((acc, outage) => {
      const month = format(new Date(outage.occurrenceDate), 'MMM yyyy');
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Add repair duration by category
    const repairDurationByType = dataForCharts.reduce((acc, outage) => {
      if (outage.repairStartDate && outage.repairEndDate) {
        const duration = (new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60); // hours
        const faultType = outage.faultType || 'Unknown';
        acc[faultType] = (acc[faultType] || 0) + duration;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate average repair duration by category
    const averageRepairDurationByType = Object.entries(repairDurationByType).reduce((acc, [type, totalDuration]) => {
      const count = outagesByType[type] || 1;
      acc[type] = Number(((totalDuration as number) / count).toFixed(2));
      return acc;
    }, {} as Record<string, number>);

    // Add customer interruption duration by category
    const customerInterruptionDurationByType = dataForCharts.reduce((acc, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60); // hours
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        const totalCustomers = rural + urban + metro;
        const faultType = outage.faultType || 'Unknown';
        acc[faultType] = (acc[faultType] || 0) + (duration * totalCustomers);
      }
      return acc;
    }, {} as Record<string, number>);

    // Count feeder trips
    const feederTripCount = dataForCharts.reduce((acc, outage) => {
      if (outage.feederName) {
        if (!acc[outage.feederName]) {
          acc[outage.feederName] = {
            count: 0,
            details: []
          };
        }
        acc[outage.feederName].count += 1;
        acc[outage.feederName].details.push({
          date: format(new Date(outage.occurrenceDate), 'yyyy-MM-dd HH:mm'),
          type: outage.faultType || 'Unknown',
          description: outage.description || '',
          status: outage.status || '',
          voltageLevel: outage.voltageLevel || '',
          region: safeRegions.find(r => r.id === outage.regionId)?.name || 'Unknown',
          district: safeDistricts.find(d => d.id === outage.districtId)?.name || 'Unknown'
        });
      }
      return acc;
    }, {} as Record<string, { count: number; details: any[] }>);

    // Convert to array and sort by trip count
    const mostTrippedFeeders = Object.entries(feederTripCount)
      .filter(([_, data]) => (data as { count: number; details: any[] }).count >= 2) // Always filter for 2 or more trips
      .map(([name, data]) => {
        const typedData = data as { count: number; details: any[] };
        return {
          name,
          count: typedData.count,
          details: typedData.details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        };
      })
      .sort((a, b) => b.count - a.count);

    // Calculate pagination
    const totalFeeders = mostTrippedFeeders.length;
    const totalPages = Math.ceil(totalFeeders / feedersPerPage);
    const startIndex = (feederPage - 1) * feedersPerPage;
    const paginatedFeeders = mostTrippedFeeders.slice(startIndex, startIndex + feedersPerPage);

    console.log('[ControlSystemAnalyticsPage] Chart data prepared:', {
      dataSource: 'currentPageData',
      dataLength: dataForCharts.length,
      outagesByType: Object.keys(outagesByType).length,
      outagesByVoltage: Object.keys(outagesByVoltage).length,
      monthlyTrend: Object.keys(monthlyTrend).length,
      totalFeeders,
      paginatedFeeders: paginatedFeeders.length
    });

    return {
      byType: Object.entries(outagesByType).map(([name, value]) => ({ name, value })),
      byVoltage: Object.entries(outagesByVoltage).map(([name, value]) => ({ name, value })),
      monthlyTrend: Object.entries(monthlyTrend).map(([name, value]) => ({ name, value })),
      repairDurationByType: Object.entries(averageRepairDurationByType).map(([name, value]) => ({ name, value })),
      customerInterruptionDurationByType: Object.entries(customerInterruptionDurationByType).map(([name, value]) => ({ name, value })),
      frequentFeeders: paginatedFeeders,
      feederPagination: {
        totalFeeders,
        totalPages,
        currentPage: feederPage
      }
    };
  };

  const chartData = useMemo(() => prepareChartData(), [
    allFilteredDataForMetrics,
    currentPageData,
    isDataLoaded,
    filteredOutages,
    selectedFeederName,
    minTripCount
  ]);

  // Export functions
  const exportToCSV = async () => {
    const formatDate = (dateString: string | undefined | null) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd HH:mm');
    };

    // Define all possible headers with their corresponding data accessors
    const allColumns = [
      { id: 'occurrenceDate', label: 'Occurrence Date', accessor: (outage: any) => formatDate(outage.occurrenceDate) },
          { id: 'region', label: 'Region', accessor: (outage: any) => safeRegions.find(r => r.id === outage.regionId)?.name || '' },
          { id: 'district', label: 'District/Section', accessor: (outage: any) => safeDistricts.find(d => d.id === outage.districtId)?.name || '' },
      { id: 'faultType', label: 'Outage Category', accessor: (outage: any) => outage.faultType || '' },
      { id: 'specificFaultType', label: 'Specific Outage Category', accessor: (outage: any) => outage.specificFaultType || '' },
      { id: 'description', label: 'Description', accessor: (outage: any) => outage.description || '' },
      { id: 'feederName', label: 'Feeder Name', accessor: (outage: any) => outage.feederName || '' },
      { id: 'voltageLevel', label: 'Voltage Level', accessor: (outage: any) => outage.voltageLevel || '' },
      { id: 'ruralCustomers', label: 'Rural Customers Affected', accessor: (outage: any) => (outage.customersAffected?.rural || 0).toString() },
      { id: 'urbanCustomers', label: 'Urban Customers Affected', accessor: (outage: any) => (outage.customersAffected?.urban || 0).toString() },
      { id: 'metroCustomers', label: 'Metro Customers Affected', accessor: (outage: any) => (outage.customersAffected?.metro || 0).toString() },
      { id: 'totalCustomers', label: 'Total Customers Affected', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return (rural + urban + metro).toString();
      }},
      { id: 'ruralCID', label: 'Rural CID (hrs)', accessor: (outage: any) => {
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * (outage.customersAffected?.rural || 0)).toFixed(2);
      }},
      { id: 'urbanCID', label: 'Urban CID (hrs)', accessor: (outage: any) => {
      const outageDuration = outage.occurrenceDate && outage.restorationDate
        ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * (outage.customersAffected?.urban || 0)).toFixed(2);
      }},
      { id: 'metroCID', label: 'Metro CID (hrs)', accessor: (outage: any) => {
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
          : 0;
        return (outageDuration * (outage.customersAffected?.metro || 0)).toFixed(2);
      }},
      { id: 'customerInterruptionDuration', label: 'Total CID (hrs)', accessor: (outage: any) => {
      const totalCustomers = (outage.customersAffected?.rural || 0) + 
                           (outage.customersAffected?.urban || 0) + 
                           (outage.customersAffected?.metro || 0);
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * totalCustomers).toFixed(2);
      }},
      { id: 'ruralCIF', label: 'Rural CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.rural > 0 ? '1' : '0');
      }},
      { id: 'urbanCIF', label: 'Urban CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.urban > 0 ? '1' : '0');
      }},
      { id: 'metroCIF', label: 'Metro CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.metro > 0 ? '1' : '0');
      }},
      { id: 'customerInterruptionFrequency', label: 'Total CIF', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        // Total CIF = 1 per interruption (if at least one customer type was affected)
        return (rural > 0 || urban > 0 || metro > 0) ? '1' : '0';
      }},
      { id: 'totalFeederCustomers', label: 'Total Feeder Customers', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.feederCustomers || {};
        return (rural + urban + metro).toString();
      }},
      { id: 'repairDuration', label: 'Repair Duration (hrs)', accessor: (outage: any) => {
        if (outage.repairStartDate && outage.repairEndDate) {
          return ((new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)).toFixed(2);
        }
        return '0.00';
      }},
      { id: 'outageDuration', label: 'Outage Duration (hrs)', accessor: (outage: any) => {
        if (outage.occurrenceDate && outage.restorationDate) {
          return ((new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2);
        }
        return '0.00';
      }},
      { id: 'load', label: 'Load (MW)', accessor: (outage: any) => outage.loadMW?.toFixed(2) || '' },
      { id: 'unservedEnergy', label: 'Unserved Energy (MWh)', accessor: (outage: any) => outage.unservedEnergyMWh?.toFixed(2) || '0.00' },
      { id: 'status', label: 'Status', accessor: (outage: any) => outage.status || '' },
      { id: 'controlPanelIndications', label: 'Indications on Control Panel', accessor: (outage: any) => outage.controlPanelIndications || '' },
      { id: 'areaAffected', label: 'Area Affected', accessor: (outage: any) => outage.areaAffected || '' },
      { id: 'restorationDateTime', label: 'Restoration Date & Time', accessor: (outage: any) => formatDate(outage.restorationDate) }
    ];

    // Filter columns based on visibility
    const visibleColumnDefinitions = allColumns.filter(col => visibleColumns[col.id as keyof typeof visibleColumns]);

    // Get headers from visible columns
    const headers = visibleColumnDefinitions.map(col => col.label);

    // For CSV export, we need to handle two cases:
    // 1. If minTripCount filter is applied: Fetch ALL server-side filtered data to properly count trips per feeder
    //    This ensures exported data matches the server-side filters (region, district, outage category, etc.)
    // 2. Otherwise: Use currentPageData to match what's displayed in the table
    let dataToExport: any[] = [];
    
    if (minTripCount > 1) {
      try {
        // Fetch ALL data with current server-side filters applied (no pagination)
        // Build query params same as loadPageData but without pagination
        const params = new URLSearchParams();
        
        // Role-based filtering
        let roleBasedRegionId = null;
        let roleBasedDistrictId = null;
        
        if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
          const userRegion = regions.find(r => r.name === user.region);
          if (userRegion) {
            roleBasedRegionId = userRegion.id;
          }
        } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
          const userDistrict = districts.find(d => d.name === user.district);
          if (userDistrict) {
            roleBasedRegionId = userDistrict.regionId;
            roleBasedDistrictId = userDistrict.id;
          }
        }
        
        const finalRegionId = (filterRegion && filterRegion !== "all") ? filterRegion : roleBasedRegionId;
        const finalDistrictId = (filterDistrict && filterDistrict !== "all") ? filterDistrict : roleBasedDistrictId;
        
        if (finalRegionId) params.append('regionId', finalRegionId);
        if (finalDistrictId) params.append('districtId', finalDistrictId);
        
        // Date filtering
        if (dateRange !== "all") {
          const now = new Date();
          let startDateParam: Date | undefined;
          let endDateParam: Date | undefined;
          
          if (dateRange === "today") {
            startDateParam = startOfDay(now);
            endDateParam = endOfDay(now);
          } else if (dateRange === "yesterday") {
            const yesterday = subDays(now, 1);
            startDateParam = startOfDay(yesterday);
            endDateParam = endOfDay(yesterday);
          } else if (dateRange === "7days") {
            startDateParam = startOfDay(subDays(now, 7));
            endDateParam = endOfDay(now);
          } else if (dateRange === "30days") {
            startDateParam = startOfDay(subDays(now, 30));
            endDateParam = endOfDay(now);
          } else if (dateRange === "90days") {
            startDateParam = startOfDay(subDays(now, 90));
            endDateParam = endOfDay(now);
          } else if (dateRange === "custom" && startDate && endDate) {
            startDateParam = startOfDay(startDate);
            endDateParam = endOfDay(endDate);
          } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
            const yearStart = new Date(selectedWeekYear, 0, 1);
            const firstWeekStart = startOfWeek(yearStart);
            const weekStart = new Date(firstWeekStart);
            weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
            startDateParam = startOfWeek(weekStart);
            endDateParam = endOfWeek(weekStart);
          } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
            const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
            startDateParam = startOfMonth(monthStart);
            endDateParam = endOfMonth(monthStart);
          } else if (dateRange === "year" && selectedYear !== undefined) {
            startDateParam = startOfYear(new Date(selectedYear, 0, 1));
            endDateParam = endOfYear(new Date(selectedYear, 0, 1));
          }
          
          if (startDateParam && endDateParam) {
            params.append('startDate', startDateParam.toISOString());
            params.append('endDate', endDateParam.toISOString());
          }
        }
        
        if (outageType && outageType !== "all") params.append('outageType', outageType);
        if (filterFaultType && filterFaultType !== "all") params.append('faultType', filterFaultType);
        if (filterSpecificFaultType && filterSpecificFaultType !== "all") {
          params.append('specificFaultType', filterSpecificFaultType);
        }
        
        // Fetch ALL data (no pagination) - use a large limit
        params.append('limit', '10000'); // Large limit to get all data
        params.append('offset', '0');
        
        console.log('[ControlSystemAnalyticsPage] CSV Export - Fetching all data with filters:', params.toString());
        
        const response = await apiRequest(`/api/outages?${params.toString()}`);
        const allFilteredData = response.data || response || [];
        
        console.log('[ControlSystemAnalyticsPage] CSV Export - Fetched all filtered data:', allFilteredData.length);
        
        // Apply feeder name filter first (if set)
        let filteredByFeeder = allFilteredData;
        if (selectedFeederName && selectedFeederName !== "all") {
          filteredByFeeder = allFilteredData.filter((outage: any) => 
            outage.feederName === selectedFeederName
          );
          console.log('[ControlSystemAnalyticsPage] CSV Export - Applied selectedFeederName filter:', {
            allFilteredCount: allFilteredData.length,
            filteredByFeederCount: filteredByFeeder.length,
            selectedFeederName
          });
        }
        
        // Count trips per feeder across filtered data (after feeder name filter if applied)
        const feederTripCounts = filteredByFeeder.reduce((acc: Record<string, number>, outage: any) => {
          if (outage.feederName) {
            acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        // Filter outages to only include those from feeders with enough trips
        dataToExport = filteredByFeeder.filter((outage: any) => {
          if (minTripCount <= 1) return true;
          return !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount;
        });
        
        console.log('[ControlSystemAnalyticsPage] CSV Export - Applied minTripCount filter:', {
          allFilteredCount: allFilteredData.length,
          filteredByFeederCount: filteredByFeeder.length,
          filteredCount: dataToExport.length,
          minTripCount,
          selectedFeederName,
          feedersWithEnoughTrips: Object.keys(feederTripCounts).filter(f => feederTripCounts[f] >= minTripCount).length
        });
      } catch (error) {
        console.error('[ControlSystemAnalyticsPage] Error fetching data for CSV export:', error);
        // Fallback to current page data
        dataToExport = currentPageData.length > 0 ? [...currentPageData] : [];
        toast.error('Failed to fetch all data for export. Exporting current page only.');
      }
    } else {
      // No minTripCount filter - export current page data to match what's displayed
      dataToExport = currentPageData.length > 0 ? [...currentPageData] : [...filteredOutages];
      
      // Apply feeder name filter if set
      if (selectedFeederName && selectedFeederName !== "all") {
        dataToExport = dataToExport.filter(outage => 
          outage.feederName === selectedFeederName
        );
        console.log('[ControlSystemAnalyticsPage] CSV Export - Applied selectedFeederName filter (no minTripCount):', {
          originalCount: currentPageData.length || filteredOutages.length,
          filteredCount: dataToExport.length,
          selectedFeederName
        });
      }
    }
    
    console.log('[ControlSystemAnalyticsPage] CSV Export:', {
      currentPageDataLength: currentPageData.length,
      filteredOutagesLength: filteredOutages.length,
      dataToExportLength: dataToExport.length,
      minTripCount,
      visibleColumns: Object.keys(visibleColumns).filter(key => visibleColumns[key as keyof typeof visibleColumns])
    });

    // Check if we have data to export
    if (dataToExport.length === 0) {
      toast.error('No data available to export. Please check your filters.');
      console.warn('[ControlSystemAnalyticsPage] No data to export');
      return;
    }

    // Generate data rows
    const dataRows = dataToExport.map(outage => {
      return visibleColumnDefinitions
        .map(col => `"${col.accessor(outage)}"`)
        .join(',');
    });

    const csvContent = [headers.join(','), ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `control-system-outages-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  const renderChart = (data: any[], dataKey: string = 'value', nameKey: string = 'name') => {
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={400} className="min-h-[400px] md:min-h-[300px]">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={nameKey} 
              tickFormatter={(value) => `${value} (${data.find(d => d[nameKey] === value)?.[dataKey] || 0})`}
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const value = payload[0].value as number;
                  const total = data.reduce((sum, item) => sum + item.value, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{label}</p>
                      <p>Total Outages: {value}</p>
                      <p>Percentage: {percentage}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar 
              dataKey={dataKey} 
              fill="#8884d8"
              label={{ 
                position: 'top',
                fill: 'hsl(var(--foreground))',
                fontSize: 12,
                fontWeight: 500,
                formatter: (value: any) => {
                  const total = data.reduce((sum, item) => sum + item.value, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${value} (${percentage}%)`;
                }
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400} className="min-h-[400px] md:min-h-[300px]">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={nameKey} 
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={400} className="min-h-[400px] md:min-h-[300px]">
          <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey={dataKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  // Update the getSortedAndFilteredData function
  const getSortedAndFilteredData = () => {
    // Start with the filtered outages instead of paginated outages
    let data = [...filteredOutages];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(outage => 
        outage.faultType?.toLowerCase().includes(query) ||
        outage.description?.toLowerCase().includes(query) ||
        outage.feederName?.toLowerCase().includes(query) ||
        outage.voltageLevel?.toLowerCase().includes(query)
      );
    }

    // Apply feeder trip count filter only if minTripCount is greater than 1
    if (minTripCount > 1) {
      // Count trips per feeder
      const feederTripCounts = data.reduce((acc, outage) => {
        if (outage.feederName) {
          acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter outages to only include those from feeders with enough trips
      data = data.filter(outage => 
        !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount
      );
    }

    // Apply date filters
    if (dateRange !== "all") {
      const now = new Date();
      let start, end;
      
      if (dateRange === "today") {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (dateRange === "yesterday") {
        const yesterday = subDays(now, 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
      } else if (dateRange === "7days") {
        start = startOfDay(subDays(now, 7));
        end = endOfDay(now);
      } else if (dateRange === "30days") {
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
      } else if (dateRange === "90days") {
        start = startOfDay(subDays(now, 90));
        end = endOfDay(now);
      } else if (dateRange === "custom" && startDate && endDate) {
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
      }

      data = data.filter(outage => {
        const outageDate = new Date(outage.occurrenceDate);
        return outageDate >= start && outageDate <= end;
      });
    }

    // Apply sorting
    data.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle date fields
      if (sortField === 'occurrenceDate' || sortField === 'restorationDate' || 
          sortField === 'repairStartDate' || sortField === 'repairEndDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle customer affected fields
      if (sortField === 'customersAffected') {
        const aTotal = (a.customersAffected?.rural || 0) + (a.customersAffected?.urban || 0) + (a.customersAffected?.metro || 0);
        const bTotal = (b.customersAffected?.rural || 0) + (b.customersAffected?.urban || 0) + (b.customersAffected?.metro || 0);
        aValue = aTotal;
        bValue = bTotal;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Update pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = data.slice(startIndex, endIndex);
    
    return paginatedData;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Update the renderTable function to use server-side data
  const renderTable = () => {
    // Start with server-side data
    let tableData = [...currentPageData];
    
    // Apply feeder name filter (same pattern as Outage Category filter)
    if (selectedFeederName && selectedFeederName !== "all") {
      tableData = tableData.filter(outage => 
        outage.feederName === selectedFeederName
      );
      console.log('[ControlSystemAnalyticsPage] Table data after selectedFeederName filter:', {
        originalCount: currentPageData.length,
        filteredCount: tableData.length,
        selectedFeederName
      });
    }
    
    // Apply feeder trip count filter (same pattern as Outage Category filter)
    // This matches the filter applied to metrics and charts
    if (minTripCount > 1) {
      // Count trips per feeder
      const feederTripCounts = tableData.reduce((acc, outage) => {
        if (outage.feederName) {
          acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter outages to only include those from feeders with enough trips
      tableData = tableData.filter(outage => 
        !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount
      );
      
      console.log('[ControlSystemAnalyticsPage] Table data after minTripCount filter:', {
        originalCount: currentPageData.length,
        filteredCount: tableData.length,
        minTripCount
      });
    }
    
    const totalCount = totalItems;

    return (
      <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                <Input
                  placeholder="Search outages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:max-w-sm"
                />
                
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="pageSize" className="text-sm hidden sm:inline">Page Size:</Label>
                  <Label htmlFor="pageSize" className="text-sm sm:hidden">Size:</Label>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1);
                      loadPageData(1);
                    }}
                  >
                    <SelectTrigger className="w-[70px] sm:w-[80px]">
                      <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizeOptions.map(size => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
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
                      const filteredColumns = columns.filter(col => 
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
                  {columns.filter(col => 
                    ['occurrenceDate', 'region', 'district', 'faultType', 'specificFaultType', 'description'].includes(col.id)
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
                
                {/* Technical Details */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Technical Details
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['feederName', 'voltageLevel', 'load', 'unservedEnergy', 'controlPanelIndications', 'areaAffected'].includes(col.id)
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
                
                {/* Customer Impact */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Customer Impact
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['ruralCustomers', 'urbanCustomers', 'metroCustomers', 'totalCustomers', 
                     'ruralCID', 'urbanCID', 'metroCID', 'customerInterruptionDuration',
                     'ruralCIF', 'urbanCIF', 'metroCIF', 'customerInterruptionFrequency',
                     'totalFeederCustomers'].includes(col.id)
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
                
                {/* Duration & Status */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Duration & Status
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['repairDuration', 'outageDuration', 'status', 'restorationDateTime'].includes(col.id)
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
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={exportToCSV}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export to CSV</span>
              <span className="sm:hidden">Export CSV</span>
          </Button>
        </div>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <TableComponent>
            <TableHeader>
              <TableRow>
                {columns.map((column) => 
                  visibleColumns[column.id as keyof typeof visibleColumns] && (
                    <TableHead 
                      key={column.id}
                      className={column.sortField ? "cursor-pointer" : ""}
                      onClick={() => column.sortField && handleSort(column.sortField)}
                    >
                      {column.label}
                      {column.sortField && sortField === column.sortField && (
                        sortDirection === 'asc' ? ' ↑' : ' ↓'
                      )}
                    </TableHead>
                  )
                )}
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
              ) : tableData.length > 0 ? (
                tableData.map((outage) => {
                  const totalCustomers = (outage.customersAffected?.rural || 0) + 
                                      (outage.customersAffected?.urban || 0) + 
                                      (outage.customersAffected?.metro || 0);
                
                  const outageDuration = outage.occurrenceDate && outage.restorationDate
                    ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
                    : 0;

                  const customerInterruptionDuration = outage.occurrenceDate && outage.restorationDate
                    ? (outageDuration * totalCustomers)
                    : 0;

                  // Total CIF = 1 per interruption (if at least one customer type was affected)
                  const customerInterruptionFrequency = 
                    ((outage.customersAffected?.rural > 0 || 
                      outage.customersAffected?.urban > 0 || 
                      outage.customersAffected?.metro > 0) ? 1 : 0);

                  const totalFeederCustomers = (outage.feederCustomers?.rural || 0) + 
                                            (outage.feederCustomers?.urban || 0) + 
                                            (outage.feederCustomers?.metro || 0);

                  return (
                    <TableRow key={outage.id}>
                      {visibleColumns.occurrenceDate && (
                        <TableCell>{format(new Date(outage.occurrenceDate), 'yyyy-MM-dd HH:mm')}</TableCell>
                      )}
                      {visibleColumns.region && (
                        <TableCell>{safeRegions.find(r => r.id === outage.regionId)?.name || '-'}</TableCell>
                      )}
                      {visibleColumns.district && (
                        <TableCell>{safeDistricts.find(d => d.id === outage.districtId)?.name || '-'}</TableCell>
                      )}
                      {visibleColumns.faultType && (
                        <TableCell>{outage.faultType || '-'}</TableCell>
                      )}
                      {visibleColumns.specificFaultType && (
                        <TableCell>{outage.specificFaultType || '-'}</TableCell>
                      )}
                      {visibleColumns.description && (
                        <TableCell className="max-w-[200px] truncate" title={outage.description || ''}>
                          {outage.description || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.feederName && (
                        <TableCell>{outage.feederName || '-'}</TableCell>
                      )}
                      {visibleColumns.voltageLevel && (
                        <TableCell>{outage.voltageLevel || '-'}</TableCell>
                      )}
                      {visibleColumns.ruralCustomers && (
                        <TableCell>{outage.customersAffected?.rural || 0}</TableCell>
                      )}
                      {visibleColumns.urbanCustomers && (
                        <TableCell>{outage.customersAffected?.urban || 0}</TableCell>
                      )}
                      {visibleColumns.metroCustomers && (
                        <TableCell>{outage.customersAffected?.metro || 0}</TableCell>
                      )}
                      {visibleColumns.totalCustomers && (
                        <TableCell>{totalCustomers}</TableCell>
                      )}
                      {visibleColumns.ruralCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.rural || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.urbanCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.urban || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.metroCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.metro || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.customerInterruptionDuration && (
                        <TableCell>{customerInterruptionDuration.toFixed(2)}</TableCell>
                      )}
                      {visibleColumns.ruralCIF && (
                        <TableCell>
                          {outage.customersAffected?.rural > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.urbanCIF && (
                        <TableCell>
                          {outage.customersAffected?.urban > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.metroCIF && (
                        <TableCell>
                          {outage.customersAffected?.metro > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.customerInterruptionFrequency && (
                        <TableCell>{customerInterruptionFrequency}</TableCell>
                      )}
                      {visibleColumns.totalFeederCustomers && (
                        <TableCell>{totalFeederCustomers}</TableCell>
                      )}
                      {visibleColumns.repairDuration && (
                        <TableCell>
                          {outage.repairStartDate && outage.repairEndDate 
                            ? ((new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.outageDuration && (
                        <TableCell>{outageDuration.toFixed(2)}</TableCell>
                      )}
                      {visibleColumns.load && (
                        <TableCell>{outage.loadMW?.toFixed(2) || '-'}</TableCell>
                      )}
                      {visibleColumns.unservedEnergy && (
                        <TableCell>{outage.unservedEnergyMWh?.toFixed(2) || '0.00'}</TableCell>
                      )}
                      {visibleColumns.status && (
                        <TableCell>
                          <Badge variant={outage.status === 'resolved' ? 'default' : 'destructive'}>
                            {outage.status}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.controlPanelIndications && (
                        <TableCell className="max-w-[200px] truncate" title={outage.controlPanelIndications || ''}>
                          {outage.controlPanelIndications || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.areaAffected && (
                        <TableCell className="max-w-[200px] truncate" title={outage.areaAffected || ''}>
                          {outage.areaAffected || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.restorationDateTime && (
                        <TableCell>
                          {outage.restorationDate ? format(new Date(outage.restorationDate), 'yyyy-MM-dd HH:mm') : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center text-muted-foreground">
                    No outages found matching the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </TableComponent>
        </div>
        
        {/* Update pagination controls */}
        {totalItems > 0 && (
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
                onClick={loadPreviousPage}
                disabled={!hasPreviousPage || isLoadingPage}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadNextPage}
                disabled={!hasNextPage || isLoadingPage}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
        } else {
          // Set to "all" if no specific region
          setFilterRegion(undefined);
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
        }
      } else {
        // For system admins and global engineers, set to "all" by default
        setFilterRegion(undefined);
        setFilterDistrict(undefined);
      }
    } else {
      // Set default to "all" when no user role restrictions
      setFilterRegion(undefined);
    }
  }, [isAuthenticated, user, navigate, regions, districts]);

  useEffect(() => {
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
      const regionObj = safeRegions.find(r => r.name === user.region);
      if (regionObj) {
        setFilterRegion(regionObj.id);
      }
    } else if (user?.role === 'ashsubt') {
      // Set default to first allowed Ashanti region
      const ashsubtRegions = safeRegions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
      if (ashsubtRegions.length > 0) {
        setFilterRegion(ashsubtRegions[0].id);
      }
    } else if (user?.role === 'accsubt') {
      // Set default to first allowed Accra region
      const accsubtRegions = safeRegions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
      if (accsubtRegions.length > 0) {
        setFilterRegion(accsubtRegions[0].id);
      }
    }
  }, [user, safeRegions]);

  // Region filter handler that triggers data reload
  const handleRegionChange = (value: string) => {
    console.log('Region filter changed:', value);
    const newRegion = value === 'all' ? undefined : value;
    setFilterRegion(newRegion);
    // Reset district when changing region
    setFilterDistrict(undefined);
    // Set loading state immediately for better UX
    setIsLoadingPage(true);
  };

  // Update the district filter handler
  const handleDistrictChange = (value: string) => {
    console.log('District filter changed:', value);
    const newDistrict = value === 'all' ? undefined : value;
    setFilterDistrict(newDistrict);
    // Set loading state immediately for better UX
    setIsLoadingPage(true);
  };

  // Date range filter handler
  const handleDateRangeChange = (value: string) => {
    console.log('[ControlSystemAnalyticsPage] Date range filter changed:', value);
    console.log('[ControlSystemAnalyticsPage] Current date state:', {
      dateRange: value,
      startDate,
      endDate,
      selectedWeek,
      selectedMonth,
      selectedYear,
      selectedWeekYear,
      selectedMonthYear
    });
    setDateRange(value);
    // Set loading state immediately for better UX
    setIsLoadingPage(true);
  };

  // Outage type filter handler
  const handleOutageTypeChange = (value: 'all' | 'sustained' | 'momentary') => {
    console.log('Outage type filter changed:', value);
    setOutageType(value);
    // Set loading state immediately for better UX
    setIsLoadingPage(true);
  };

  // Fault type filter handler
  const handleFaultTypeChange = (value: string) => {
    console.log('Fault type filter changed:', value);
    setFilterFaultType(value);
    // Reset specific fault type when changing fault type
    setFilterSpecificFaultType("all");
    // Set loading state immediately for better UX
    setIsLoadingPage(true);
  };

  // Specific fault type filter handler
  const handleSpecificFaultTypeChange = (value: string) => {
    console.log('Specific fault type filter changed:', value);
    setFilterSpecificFaultType(value);
    // Set loading state immediately for better UX
    setIsLoadingPage(true);
  };

  // Date range picker handler
  const handleDateRangePickerChange = (dates: any) => {
    console.log('Date range picker changed:', dates);
    if (dates && dates[0] && dates[1]) {
      setStartDate(dates[0].toDate());
      setEndDate(dates[1].toDate());
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
    }
    // Force a data reload
    setCurrentPage(1);
    loadPageData(1);
  };

  // Week selector handler
  const handleWeekChange = (value: string) => {
    console.log('Week changed:', value);
    setSelectedWeek(Number(value));
    // Force a data reload
    setCurrentPage(1);
    loadPageData(1);
  };

  // Week year selector handler
  const handleWeekYearChange = (value: string) => {
    console.log('Week year changed:', value);
    setSelectedWeekYear(Number(value));
    // Force a data reload
    setCurrentPage(1);
    loadPageData(1);
  };

  // Month selector handler
  const handleMonthChange = (value: string) => {
    console.log('Month changed:', value);
    setSelectedMonth(Number(value));
    // Force a data reload
    setCurrentPage(1);
    loadPageData(1);
  };

  // Month year selector handler
  const handleMonthYearChange = (value: string) => {
    console.log('Month year changed:', value);
    setSelectedMonthYear(Number(value));
    // Force a data reload
    setCurrentPage(1);
    loadPageData(1);
  };

  // Year selector handler
  const handleYearChange = (value: string) => {
    console.log('Year changed:', value);
    setSelectedYear(Number(value));
    // Force a data reload
    setCurrentPage(1);
    loadPageData(1);
  };

  return (
    <Layout>
      <div className="px-4 md:container md:mx-auto py-6 md:py-8 space-y-6 md:space-y-8 bg-gradient-to-b from-background to-muted/20 min-h-screen">
        {/* Header Section - Classic Professional Design */}
        <div className="border-b border-border/40 pb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Situational Report Analytics</h1>
              <p className="text-sm md:text-base text-muted-foreground font-light">Comprehensive analysis of system outages and reliability metrics</p>
          </div>
          <Button 
            variant="outline" 
              className="flex items-center gap-2 w-full md:w-auto border-2 hover:border-primary/50 transition-all shadow-sm hover:shadow"
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export to CSV</span>
            <span className="sm:hidden">Export CSV</span>
          </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 border-2 shadow-sm">
            <TabsTrigger value="overview" className="text-base font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Overview</TabsTrigger>
            <TabsTrigger value="feeder" className="text-base font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              <span className="block md:hidden">Feeder</span>
              <span className="hidden md:inline">Feeder Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Filters Section - Classic Professional Design */}
            <Card className="p-6 border-2 shadow-lg bg-card/50 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-border/40">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-foreground">Data Filters</h3>
                  <p className="text-sm text-muted-foreground font-light">Refine your analysis by selecting specific criteria</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="flex items-center gap-2 border-2 hover:border-primary/50 transition-all shadow-sm hover:shadow"
                >
                  <Filter className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select
                    value={filterRegion || ""}
                    onValueChange={handleRegionChange}
                    disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "district_manager" || user?.role === "regional_general_manager" || user?.role === "technician"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Regions" />
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
                <div className="space-y-2">
                  <Label>District/Section</Label>
                  <Select
                    value={filterDistrict || "all"}
                    onValueChange={handleDistrictChange}
                    disabled={(!filterRegion && !(user?.role === "ashsubt" || user?.role === "accsubt")) || user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only show "All Districts" for users who can see multiple districts */}
                      {(user?.role === "global_engineer" || user?.role === "system_admin" || 
                        user?.role === "regional_engineer" || user?.role === "project_engineer" || 
                        user?.role === "regional_general_manager" || user?.role === "ashsubt" || user?.role === "accsubt") && (
                      <SelectItem value="all">All Districts</SelectItem>
                      )}
                      {filteredDistricts.map(district => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select value={dateRange} onValueChange={handleDateRangeChange}>
                    <SelectTrigger>
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
                    <RangePicker
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
                <div className="space-y-2">
                  <Label>Outage Type</Label>
                  <Select 
                    value={outageType} 
                    onValueChange={handleOutageTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outage type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outages</SelectItem>
                      <SelectItem value="sustained">Sustained ({'>'}5 min)</SelectItem>
                      <SelectItem value="momentary">Momentary (≤5 min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Outage Category</Label>
                  <Select value={filterFaultType} onValueChange={handleFaultTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select outage category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outage Categories</SelectItem>
                      {faultTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Specific Outage Category</Label>
                  <Select 
                    value={filterSpecificFaultType} 
                    onValueChange={handleSpecificFaultTypeChange}
                    disabled={filterFaultType === "all" || filterFaultType === "Planned" || filterFaultType === "ECG Load Shedding" || filterFaultType === "GridCo Outages"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select specific outage category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Specific Types</SelectItem>
                      {specificFaultTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Most Trip Feeder Count</Label>
                  <Select 
                    value={minTripCount.toString()} 
                    onValueChange={(value) => setMinTripCount(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select feeder count" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">All Feeders</SelectItem>
                      <SelectItem value="2">2 or more trips</SelectItem>
                      <SelectItem value="3">3 or more trips</SelectItem>
                      <SelectItem value="4">4 or more trips</SelectItem>
                      <SelectItem value="5">5 or more trips</SelectItem>
                      <SelectItem value="10">10 or more trips</SelectItem>
                      <SelectItem value="20">20 or more trips</SelectItem>
                      <SelectItem value="50">50 or more trips</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Feeder Name</Label>
                  <Select 
                    value={selectedFeederName} 
                    onValueChange={(value) => setSelectedFeederName(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={uniqueFeederNames.length > 0 ? "Select feeder name" : "Loading feeders..."} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Feeders</SelectItem>
                      {uniqueFeederNames.length > 0 ? (
                        uniqueFeederNames.map(feederName => (
                          <SelectItem key={feederName} value={feederName}>
                            {feederName}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="all" disabled>No feeders found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Summary Cards - Modern Design */}
            <div className="space-y-8">
              {/* Primary Metrics Section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-6">Key Performance Indicators</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Total Outages</CardTitle>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/30 transition-colors">
                        <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.totalOutages}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Customers Affected</CardTitle>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/20 dark:group-hover:bg-green-500/30 transition-colors">
                        <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-green-600 dark:text-green-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.totalCustomersAffected}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Customer Interruption Duration</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">CID (hrs)</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 dark:group-hover:bg-purple-500/30 transition-colors">
                        <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.customerInterruptionDuration.toFixed(2)}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Customer Interruption Frequency</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">CIF</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/20 dark:group-hover:bg-orange-500/30 transition-colors">
                        <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-orange-600 dark:text-orange-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.customerInterruptionFrequency.toFixed(3)}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-rose-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Average Repair Duration</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">Avg. Repair (hrs)</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center group-hover:bg-rose-500/20 dark:group-hover:bg-rose-500/30 transition-colors">
                        <Clock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-rose-600 dark:text-rose-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.repairDurations.toFixed(2)}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-cyan-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Total Unserved Energy</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">MWh</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 dark:group-hover:bg-cyan-500/30 transition-colors">
                        <Zap className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.totalUnservedEnergy.toFixed(2)}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Total Outage Duration</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">Total Duration (hrs)</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/20 dark:group-hover:bg-indigo-500/30 transition-colors">
                        <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {isLoadingPage ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                      ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.totalOutageDuration.toFixed(2)}</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              {/* Reliability Indices Section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-6">Reliability Indices by Area Type</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* CIF by Customer Type (Consolidated) */}
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-teal-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Customer Interruption Frequency</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">CIF (interruptions/customer)</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center group-hover:bg-teal-500/20 dark:group-hover:bg-teal-500/30 transition-colors">
                        <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-teal-600 dark:text-teal-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Metro:</span>
                            <span className="text-base font-bold text-foreground">{metrics.metroCIF.toFixed(3)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Urban:</span>
                            <span className="text-base font-bold text-foreground">{metrics.urbanCIF.toFixed(3)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Rural:</span>
                            <span className="text-base font-bold text-foreground">{metrics.ruralCIF.toFixed(3)}</span>
                          </div>
                        </div>
                  )}
                </CardContent>
              </Card>
                  
                  {/* SAIFI by Area Type (Consolidated) */}
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">System Average Interruption Frequency</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">SAIFI (interruptions/customer)</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-slate-500/10 dark:bg-slate-500/20 flex items-center justify-center group-hover:bg-slate-500/20 dark:group-hover:bg-slate-500/30 transition-colors">
                        <BarChart3 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Metro:</span>
                            <span className="text-base font-bold text-foreground">{metrics.metroSAIFI.toFixed(3)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Urban:</span>
                            <span className="text-base font-bold text-foreground">{metrics.urbanSAIFI.toFixed(3)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Rural:</span>
                            <span className="text-base font-bold text-foreground">{metrics.ruralSAIFI.toFixed(3)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* SAIDI by Area Type (Consolidated) */}
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-violet-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">System Average Interruption Duration</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">SAIDI (hrs/customer)</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 dark:group-hover:bg-violet-500/30 transition-colors">
                        <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {isLoadingPage ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Metro:</span>
                            <span className="text-base font-bold text-foreground">{metrics.metroSAIDI.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Urban:</span>
                            <span className="text-base font-bold text-foreground">{metrics.urbanSAIDI.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Rural:</span>
                            <span className="text-base font-bold text-foreground">{metrics.ruralSAIDI.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* CAIDI by Area Type (Consolidated) */}
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Customer Average Interruption Duration</CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">CAIDI (hrs/interruption)</CardDescription>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-pink-500/10 dark:bg-pink-500/20 flex items-center justify-center group-hover:bg-pink-500/20 dark:group-hover:bg-pink-500/30 transition-colors">
                        <AlertTriangle className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {isLoadingPage ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-pink-600 dark:text-pink-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Metro:</span>
                            <span className="text-base font-bold text-foreground">{metrics.metroCAIDI.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Urban:</span>
                            <span className="text-base font-bold text-foreground">{metrics.urbanCAIDI.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">Rural:</span>
                            <span className="text-base font-bold text-foreground">{metrics.ruralCAIDI.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              {/* Outage Categories Section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-6">Outage Categories</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Planned</CardTitle>
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-500/30 transition-colors">
                        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {isLoadingPage ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                      ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.faultTypeMetrics['Planned'] || 0}</div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Unplanned</CardTitle>
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
                        <div className="text-3xl font-bold text-foreground">{metrics.faultTypeMetrics['Unplanned'] || 0}</div>
                  )}
                </CardContent>
              </Card>
              
              {/* Emergency, Load Shedding, and Grid Outages */}
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <CardTitle className="text-xs font-medium text-muted-foreground leading-none">Emergency</CardTitle>
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 dark:group-hover:bg-amber-500/30 transition-colors">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.faultTypeMetrics['Emergency'] || 0}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <CardTitle className="text-xs font-medium text-muted-foreground leading-none">ECG Load Shed</CardTitle>
                      <div className="h-9 w-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/20 dark:group-hover:bg-indigo-500/30 transition-colors">
                        <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.faultTypeMetrics['ECG Load Shedding'] || 0}</div>
                  )}
                </CardContent>
              </Card>
                  <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-violet-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
                      <CardTitle className="text-xs font-medium text-muted-foreground leading-none">GridCo</CardTitle>
                      <div className="h-9 w-9 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 dark:group-hover:bg-violet-500/30 transition-colors">
                        <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                </CardHeader>
                    <CardContent className="px-5 pb-5">
                  {isLoadingPage ? (
                    <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                        <div className="text-3xl font-bold text-foreground">{metrics.faultTypeMetrics['GridCo Outages'] || 0}</div>
                  )}
                </CardContent>
              </Card>
                </div>
              </div>
            </div>

            {/* Charts Section - Classic Professional Design */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/40">Visual Analytics</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 border-2 shadow-lg bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-4 border-b border-border/30">
                    <CardTitle className="text-lg font-semibold text-foreground">Outages by Category</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">Distribution of outage categories</CardDescription>
                </CardHeader>
                  <CardContent className="pt-6">
                  {isLoadingPage ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Loading chart...</span>
                      </div>
                    </div>
                  ) : (
                    renderChart(chartData.byType)
                  )}
                </CardContent>
              </Card>
                <Card className="p-6 border-2 shadow-lg bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-4 border-b border-border/30">
                    <CardTitle className="text-lg font-semibold text-foreground">Outages by Voltage Level</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">Distribution by voltage level</CardDescription>
                </CardHeader>
                  <CardContent className="pt-6">
                  {isLoadingPage ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Loading chart...</span>
                      </div>
                    </div>
                  ) : (
                    renderChart(chartData.byVoltage)
                  )}
                </CardContent>
              </Card>
                <Card className="p-6 border-2 shadow-lg bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-4 border-b border-border/30">
                    <CardTitle className="text-lg font-semibold text-foreground">Repair Duration by Category</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">Average repair duration for each outage category</CardDescription>
                </CardHeader>
                  <CardContent className="pt-6">
                  {isLoadingPage ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Loading chart...</span>
                      </div>
                    </div>
                  ) : (
                    renderChart(chartData.repairDurationByType)
                  )}
                </CardContent>
              </Card>
                <Card className="p-6 border-2 shadow-lg bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-4 border-b border-border/30">
                    <CardTitle className="text-lg font-semibold text-foreground">Most Trip Feeders</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                    Showing feeders with {minTripCount} or more trips • {((feederPage - 1) * feedersPerPage) + 1} to {Math.min(feederPage * feedersPerPage, chartData.feederPagination.totalFeeders)} of {chartData.feederPagination.totalFeeders} feeders
                  </CardDescription>
                </CardHeader>
                  <CardContent className="pt-6">
                  {isLoadingPage ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading feeders...</span>
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-4">
                    {chartData.frequentFeeders.length > 0 ? (
                      <>
                        {chartData.frequentFeeders.map((feeder) => (
                          <div key={feeder.name} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">{feeder.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {feeder.details[0]?.voltageLevel} • {feeder.details[0]?.region} • {feeder.details[0]?.district}
                                </p>
                              </div>
                              <Badge variant="destructive">Tripped {feeder.count} times</Badge>
                            </div>
                            <div className="space-y-2">
                              {feeder.details.slice(0, 3).map((detail, index) => (
                                <div key={index} className="text-sm text-muted-foreground border-t pt-2">
                                  <div className="flex items-center gap-2">
                                    <span>{detail.date}</span>
                                    <Badge variant={detail.status === 'resolved' ? 'default' : 'destructive'}>
                                      {detail.status}
                                    </Badge>
                                  </div>
                                  <div className="mt-1">
                                    <span className="font-medium">{detail.type}</span>
                                    {detail.description && (
                                      <p className="text-xs mt-1">{detail.description}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {feeder.details.length > 3 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full text-muted-foreground"
                                  onClick={() => {
                                    // TODO: Implement modal or expandable view for all trips
                                    console.log('Show all trips for', feeder.name);
                                  }}
                                >
                                  Show {feeder.details.length - 3} more trips
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFeederPage(prev => Math.max(1, prev - 1))}
                            disabled={feederPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {feederPage} of {chartData.feederPagination.totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFeederPage(prev => Math.min(chartData.feederPagination.totalPages, prev + 1))}
                            disabled={feederPage === chartData.feederPagination.totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center">No feeders with multiple trips</p>
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>

            {/* Table Section - Classic Professional Design */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold text-foreground">Outage Details Table</h2>
                  <p className="text-sm text-muted-foreground font-light">Comprehensive view of all outage records with detailed information</p>
              </div>
              </div>
              <Card className="border-2 shadow-lg bg-card/50 backdrop-blur-sm">
              {renderTable()}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="feeder">
            <FeederManagement />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
} 