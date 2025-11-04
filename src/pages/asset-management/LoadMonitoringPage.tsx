import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye, Pencil, Trash2, FileText, RefreshCw, Database, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { LoadMonitoringData } from "@/lib/asset-types";
import { useData } from "@/contexts/DataContext";
import { apiRequest } from "@/lib/api";
import { cache } from "@/utils/cache";
import { useNavigate } from "react-router-dom";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useLoadMonitoringOffline } from "@/contexts/LoadMonitoringOfflineContext";
import { LoadMonitoringOfflineBadge } from "@/components/load-monitoring/LoadMonitoringOfflineBadge";
import { LoggingService } from "@/services/LoggingService";
import { LoadMonitoringOfflinePanel } from "@/components/load-monitoring/LoadMonitoringOfflinePanel";
import { offlineStorageCompat } from "@/utils/offlineStorage";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/utils/calculations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { DatePicker as AntdDatePicker } from 'antd';
import dayjs from 'dayjs';
import { DateRange } from "react-day-picker";

const { RangePicker } = AntdDatePicker;
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";

export default function LoadMonitoringPage() {
  const { user } = useAzureADAuth();
  const { regions, districts, loadMonitoringRecords, deleteLoadMonitoringRecord } = useData();
  const navigate = useNavigate();
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();
  
  // Offline functionality
  const { 
    isOnline, 
    isOffline, 
    saveOffline, 
    startSync,
    pendingRecords,
    isSyncing,
    getPendingRecords
  } = useLoadMonitoringOffline();
  
  // Offline panel state
  const [isOfflinePanelOpen, setIsOfflinePanelOpen] = useState(false);
  
  // Auto-sync state
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  
  // Ref to track previous data to prevent disappearing
  const previousDataRef = useRef<LoadMonitoringData[]>([]);
  
  const formatTimeWithAMPM = (time: string) => {
    if (!time) return '-';
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return time;
    }
  };

  const [formattedPercentageLoads, setFormattedPercentageLoads] = useState<Record<string, string>>({});
  
  // Filter state persistence keys
  const FILTER_KEYS = {
    dateRange: 'loadMonitoring_dateRange',
    selectedRegion: 'loadMonitoring_selectedRegion',
    selectedDistrict: 'loadMonitoring_selectedDistrict',
    searchTerm: 'loadMonitoring_searchTerm',
    selectedLoadStatus: 'loadMonitoring_selectedLoadStatus',
    currentPage: 'loadMonitoring_currentPage',
    pageSize: 'loadMonitoring_pageSize'
  };

  // Load filter states from localStorage
  const loadFilterStates = useCallback(() => {
    try {
      const savedDateRange = localStorage.getItem(FILTER_KEYS.dateRange);
      const savedRegion = localStorage.getItem(FILTER_KEYS.selectedRegion);
      const savedDistrict = localStorage.getItem(FILTER_KEYS.selectedDistrict);
      const savedSearchTerm = localStorage.getItem(FILTER_KEYS.searchTerm);
      const savedLoadStatus = localStorage.getItem(FILTER_KEYS.selectedLoadStatus);
      const savedCurrentPage = localStorage.getItem(FILTER_KEYS.currentPage);
      const savedPageSize = localStorage.getItem(FILTER_KEYS.pageSize);

      // Parse dateRange and convert string dates to Date objects
      let parsedDateRange = { from: undefined, to: undefined };
      if (savedDateRange) {
        const parsed = JSON.parse(savedDateRange);
        parsedDateRange = {
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined
        };
      }

      return {
        dateRange: parsedDateRange,
        selectedRegion: savedRegion || null,
        selectedDistrict: savedDistrict || null,
        searchTerm: savedSearchTerm || "",
        selectedLoadStatus: savedLoadStatus || "all",
        currentPage: savedCurrentPage ? parseInt(savedCurrentPage) : 1,
        pageSize: savedPageSize ? parseInt(savedPageSize) : 100
      };
    } catch (error) {
      console.error('[LoadMonitoringPage] Error loading filter states from localStorage:', error);
      return {
        dateRange: { from: undefined, to: undefined },
        selectedRegion: null,
        selectedDistrict: null,
        searchTerm: "",
        selectedLoadStatus: "all",
        currentPage: 1,
        pageSize: 100
      };
    }
  }, []);

  // Save filter states to localStorage
  const saveFilterStates = useCallback((states: {
    dateRange: DateRange | undefined;
    selectedRegion: string | null;
    selectedDistrict: string | null;
    searchTerm: string;
    selectedLoadStatus: string;
    currentPage: number;
    pageSize: number;
  }) => {
    try {
      if (states.dateRange && (states.dateRange.from || states.dateRange.to)) {
        localStorage.setItem(FILTER_KEYS.dateRange, JSON.stringify(states.dateRange));
      } else {
        localStorage.removeItem(FILTER_KEYS.dateRange);
      }

      if (states.selectedRegion) {
        localStorage.setItem(FILTER_KEYS.selectedRegion, states.selectedRegion);
      } else {
        localStorage.removeItem(FILTER_KEYS.selectedRegion);
      }

      if (states.selectedDistrict) {
        localStorage.setItem(FILTER_KEYS.selectedDistrict, states.selectedDistrict);
      } else {
        localStorage.removeItem(FILTER_KEYS.selectedDistrict);
      }

      if (states.searchTerm) {
        localStorage.setItem(FILTER_KEYS.searchTerm, states.searchTerm);
      } else {
        localStorage.removeItem(FILTER_KEYS.searchTerm);
      }

      localStorage.setItem(FILTER_KEYS.selectedLoadStatus, states.selectedLoadStatus);
      localStorage.setItem(FILTER_KEYS.currentPage, states.currentPage.toString());
      localStorage.setItem(FILTER_KEYS.pageSize, states.pageSize.toString());

      console.log('[LoadMonitoringPage] Filter states saved to localStorage:', states);
    } catch (error) {
      console.error('[LoadMonitoringPage] Error saving filter states to localStorage:', error);
    }
  }, []);

  // Initialize filter states from localStorage
  const initialFilterStates = loadFilterStates();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialFilterStates.dateRange);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const saved = localStorage.getItem('loadMonitoring_selectedMonth');
    return saved ? new Date(saved) : null;
  });
  const [selectedRegion, setSelectedRegion] = useState<string | null>(initialFilterStates.selectedRegion);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(initialFilterStates.selectedDistrict);
  const [searchTerm, setSearchTerm] = useState(initialFilterStates.searchTerm);
  const [selectedLoadStatus, setSelectedLoadStatus] = useState<string>(initialFilterStates.selectedLoadStatus);
  
  // Global data cache to prevent re-mounting issues
  const GLOBAL_CACHE_KEY = 'loadMonitoring_globalCache';
  
  // Load cached data from localStorage on component mount
  const loadCachedData = useCallback(() => {
    try {
      const cachedData = localStorage.getItem(GLOBAL_CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        console.log('[LoadMonitoringPage] Loading cached data from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('[LoadMonitoringPage] Error loading cached data:', error);
    }
    return null;
  }, []);

  // Save data to global cache
  const saveCachedData = useCallback((data: {
    currentPageData: LoadMonitoringData[];
    totalRecords: number;
    currentPage: number;
    pageSize: number;
    lastUpdated: number;
  }) => {
    try {
      const cacheData = {
        ...data,
        lastUpdated: Date.now()
      };
      localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify(cacheData));
      console.log('[LoadMonitoringPage] Saved data to global cache:', cacheData);
    } catch (error) {
      console.error('[LoadMonitoringPage] Error saving to global cache:', error);
    }
  }, []);

  // Check if cached data is still valid (within 5 minutes)
  const isCacheValid = useCallback((cachedData: any) => {
    if (!cachedData || !cachedData.lastUpdated) return false;
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (Date.now() - cachedData.lastUpdated) < fiveMinutes;
  }, []);

  // Initialize with cached data if available
  const cachedData = loadCachedData();
  const [currentPageData, setCurrentPageData] = useState<LoadMonitoringData[]>(
    cachedData && isCacheValid(cachedData) ? cachedData.currentPageData : []
  );
  const [totalRecords, setTotalRecords] = useState(
    cachedData && isCacheValid(cachedData) ? cachedData.totalRecords : 0
  );
  const [isDataFromCache, setIsDataFromCache] = useState(
    cachedData && isCacheValid(cachedData)
  );
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [offlineData, setOfflineData] = useState<LoadMonitoringData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'retrying' | 'error'>('connected');
  
  // Pagination state persistence with localStorage
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('loadMonitoring_currentPage');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('loadMonitoring_pageSize');
    return saved ? parseInt(saved, 10) : 100;
  });
  
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Log initial state for debugging
  useEffect(() => {
    console.log('[LoadMonitoringPage] Initial filter state:', {
      selectedLoadStatus,
      dateRange,
      selectedRegion,
      selectedDistrict,
      searchTerm,
      currentPage,
      pageSize
    });
  }, []);

  // Auto-save filter states to localStorage whenever they change
  useEffect(() => {
    saveFilterStates({
      dateRange,
      selectedRegion,
      selectedDistrict,
      searchTerm,
      selectedLoadStatus,
      currentPage,
      pageSize
    });
    // Save selectedMonth separately
    if (selectedMonth) {
      localStorage.setItem('loadMonitoring_selectedMonth', selectedMonth.toISOString());
    } else {
      localStorage.removeItem('loadMonitoring_selectedMonth');
    }
  }, [dateRange, selectedMonth, selectedRegion, selectedDistrict, searchTerm, selectedLoadStatus, currentPage, pageSize, saveFilterStates]);

  // Auto-save pagination state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('loadMonitoring_currentPage', currentPage.toString());
    console.log('[LoadMonitoringPage] Saved currentPage to localStorage:', currentPage);
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('loadMonitoring_pageSize', pageSize.toString());
    console.log('[LoadMonitoringPage] Saved pageSize to localStorage:', pageSize);
  }, [pageSize]);

  // Check for cached data on component mount and display immediately
  useEffect(() => {
    const cachedData = loadCachedData();
    if (cachedData && isCacheValid(cachedData)) {
      console.log('[LoadMonitoringPage] Component mounted with cached data, displaying immediately');
      setCurrentPageData(cachedData.currentPageData);
      setTotalRecords(cachedData.totalRecords);
      // Don't override pagination state - use persisted values instead
      setIsDataFromCache(true);
      setIsLoadingPage(false);
      
      // Load fresh data in background to ensure it's up to date
      setTimeout(() => {
        console.log('[LoadMonitoringPage] Loading fresh data in background');
        loadPageData(currentPage); // Use persisted currentPage
      }, 100);
    } else {
      console.log('[LoadMonitoringPage] No valid cached data, loading fresh data');
      // Load data normally if no cache
      loadPageData(currentPage); // Use persisted currentPage
    }
  }, []); // Only run on mount

  // Note: Role-based filtering is handled by the backend
  // Frontend shows user's assigned region/district in UI but doesn't apply as filters
  // This allows users to see their scope while still being able to filter within it

  // Function to determine load status based on percentage load
  const getLoadStatus = (percentageLoad: number) => {
    if (percentageLoad >= 100) {
      return { status: "OVERLOAD", color: "bg-red-500" };
    } else if (percentageLoad >= 70) {
      return { status: "Action Required", color: "bg-yellow-500" };
    } else {
      return { status: "OKAY", color: "bg-green-500" };
    }
  };

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
      return [];
    }
    
    // Default: return empty array for unhandled roles
    return [];
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

  // Combine backend data with offline data
  const combinedData = useMemo(() => {
    // Show offline records first, then backend data
    const allRecords = [...offlineData, ...currentPageData];
    
    // Remove duplicates (offline records might have the same data as backend)
    const uniqueRecords = allRecords.filter((record, index, self) => 
      index === self.findIndex(r => r.id === record.id)
    );
    
    return uniqueRecords;
  }, [offlineData, currentPageData]);

  // Server-side pagination - no client-side filtering needed
  const paginatedRecords = combinedData;

  // Generate cache key for current page and filters
  const getCacheKey = useCallback((page: number) => {
    const filterParams = {
      page,
      dateRange: dateRange ? {
        from: dateRange.from?.toISOString().split('T')[0] || null,
        to: dateRange.to?.toISOString().split('T')[0] || null
      } : null,
      month: selectedMonth ? selectedMonth.toISOString().split('T')[0].substring(0, 7) : null,
      region: selectedRegion,
      district: selectedDistrict,
      searchTerm,
      loadStatus: selectedLoadStatus,
      userRole: user?.role,
      userDistrict: user?.district,
      userRegion: user?.region
    };
    return `loadMonitoring_page_${JSON.stringify(filterParams)}`;
  }, [dateRange, selectedMonth, selectedRegion, selectedDistrict, searchTerm, selectedLoadStatus, user?.role, user?.district, user?.region]);

  // Load data for specific page from server with caching and retry logic
  const loadPageData = useCallback(async (page: number, retryCount = 0) => {
    console.log('[LoadMonitoringPage] loadPageData called with page:', page, 'retryCount:', retryCount);
    setIsLoadingPage(true);
    const cacheKey = getCacheKey(page);
    let cached: any = null;
    
    try {
      console.log('[LoadMonitoringPage] Starting loadPageData execution...');
      // Check cache first
      cached = await cache.get(cacheKey) as any;
      if (cached && cached.data && cached.timestamp) {
        const cacheAge = Date.now() - cached.timestamp;
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        if (cacheAge < maxAge) {
          console.log(`[LoadMonitoringPage] Using cached data for page ${page}, age: ${cacheAge}ms`);
          setCurrentPageData(cached.data.records || cached.data);
          previousDataRef.current = cached.data.records || cached.data; // Store in ref
          setTotalRecords(cached.data.total || cached.data.length);
          setIsLoadingPage(false);
          setIsDataFromCache(true);
          return;
        }
      }

      const params = new URLSearchParams();
    
      // Note: Role-based filtering is handled by the backend
      // Frontend only sends user-selected filters
      
      // Apply filters
      if (selectedMonth) {
        // Month filter takes priority - format as YYYY-MM
        params.append('month', selectedMonth.toISOString().split('T')[0].substring(0, 7));
        console.log('[LoadMonitoringPage] Added month filter:', selectedMonth.toISOString().split('T')[0].substring(0, 7));
      } else if (dateRange?.from && dateRange?.to) {
        // Send both dates as separate parameters for date range filtering
        params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
        params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
        console.log('[LoadMonitoringPage] Added date range filter:', dateRange.from.toISOString().split('T')[0], 'to', dateRange.to.toISOString().split('T')[0]);
      } else if (dateRange?.from) {
        // If only start date is provided, use it as a single date filter
        params.append('dateFrom', dateRange.from.toISOString().split('T')[0]);
        console.log('[LoadMonitoringPage] Added dateFrom filter:', dateRange.from.toISOString().split('T')[0]);
      } else if (dateRange?.to) {
        // If only end date is provided, use it as a single date filter
        params.append('dateTo', dateRange.to.toISOString().split('T')[0]);
        console.log('[LoadMonitoringPage] Added dateTo filter:', dateRange.to.toISOString().split('T')[0]);
        }
        if (selectedRegion) {
          const regionName = regions.find(r => r.id === selectedRegion)?.name;
          if (regionName) {
            params.append('region', regionName);
            console.log('[LoadMonitoringPage] Added region filter:', regionName);
          }
        }
        if (selectedDistrict) {
          const districtName = districts.find(d => d.id === selectedDistrict)?.name;
          if (districtName) {
            params.append('district', districtName);
            console.log('[LoadMonitoringPage] Added district filter:', districtName);
          }
        }
        if (searchTerm.trim() !== "") {
          params.append('search', searchTerm.trim());
          console.log('[LoadMonitoringPage] Added search filter:', searchTerm.trim());
        }
        if (selectedLoadStatus && selectedLoadStatus !== "all") {
          params.append('loadStatus', selectedLoadStatus);
          console.log('[LoadMonitoringPage] Added loadStatus filter:', selectedLoadStatus);
        }
        
        // Server-side pagination parameters
        const offset = (page - 1) * pageSize;
        params.append('limit', pageSize.toString());
        params.append('offset', offset.toString());
        params.append('sort', 'date');
        params.append('order', 'desc');
        params.append('countOnly', 'false');
        
        const url = `/api/monitoring?${params.toString()}`;
        console.log('[LoadMonitoringPage] Loading page', page, 'with URL:', url);
        
        // Log all filter parameters for debugging
        console.log('[LoadMonitoringPage] All filter parameters:', {
          dateFrom: dateRange?.from?.toISOString().split('T')[0] || 'none',
          dateTo: dateRange?.to?.toISOString().split('T')[0] || 'none',
          region: selectedRegion ? regions.find(r => r.id === selectedRegion)?.name : 'none',
          district: selectedDistrict ? districts.find(d => d.id === selectedDistrict)?.name : 'none',
          search: searchTerm.trim() || 'none',
          loadStatus: selectedLoadStatus || 'none'
        });
        
        console.log('[LoadMonitoringPage] About to make API request...');
        const response = await apiRequest(url);
        console.log('[LoadMonitoringPage] API Response received:', response);
        console.log('[LoadMonitoringPage] Response type:', typeof response);
        console.log('[LoadMonitoringPage] Response keys:', response ? Object.keys(response) : 'null/undefined');
        
        // Update current page data with improved response structure
        const pageData = response?.data || response || [];
        const total = response?.total || (Array.isArray(response) ? response.length : 0);
        
        console.log('[LoadMonitoringPage] Processed pageData:', pageData);
        console.log('[LoadMonitoringPage] Processed total:', total);
        
        console.log('[LoadMonitoringPage] Setting state with:', {
          pageDataLength: pageData.length,
          total,
          pageDataSample: pageData.slice(0, 2)
        });
        
        // Test state setters
        console.log('[LoadMonitoringPage] Before setCurrentPageData');
        setCurrentPageData(pageData);
        previousDataRef.current = pageData; // Store in ref to prevent disappearing
        console.log('[LoadMonitoringPage] After setCurrentPageData');
        
        console.log('[LoadMonitoringPage] Before setTotalRecords');
        setTotalRecords(total);
        console.log('[LoadMonitoringPage] After setTotalRecords');
        
        setIsDataFromCache(false);
        setConnectionStatus('connected');
        
        console.log('[LoadMonitoringPage] State set successfully');
        
        // Cache the page data
        const cacheData = {
          records: pageData,
          total: total,
          timestamp: Date.now()
        };
        
        await cache.set(cacheKey, cacheData, { maxAge: 5 * 60 * 1000 }); // 5 minutes cache
        console.log(`[LoadMonitoringPage] Cached page ${page} data`);

        // Save to global cache for navigation persistence
        saveCachedData({
          currentPageData: pageData,
          totalRecords: total,
          currentPage: page,
          pageSize: pageSize,
          lastUpdated: Date.now()
        });

        // Also store in offline storage for persistent offline viewing
        try {
          await storeLoadMonitoringForViewing(pageData);
          console.log(`[LoadMonitoringPage] Stored ${pageData.length} load monitoring records in offline storage for offline viewing`);
        } catch (error) {
          console.warn('[LoadMonitoringPage] Failed to store load monitoring records in offline storage:', error);
        }
        
        console.log('[LoadMonitoringPage] Loaded page', page, 'with', pageData.length, 'records. Total:', total);
        console.log('[LoadMonitoringPage] Pagination info:', {
          page: response.page,
          pageSize: response.pageSize,
          totalPages: response.totalPages,
          hasNextPage: response.hasNextPage,
          hasPreviousPage: response.hasPreviousPage
        });
      } catch (error) {
        console.error('Error loading page data:', error);
        
        // Retry logic for intermittent 500 errors
        if (retryCount < 3 && (error.message?.includes('500') || error.message?.includes('Internal Server Error'))) {
          const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[LoadMonitoringPage] Retrying page ${page} in ${retryDelay}ms (attempt ${retryCount + 1}/3)`);
          
          setConnectionStatus('retrying');
          setTimeout(() => {
            loadPageData(page, retryCount + 1);
          }, retryDelay);
          return;
        }
        
        // If we have cached data, show it as fallback
        if (cached && cached.data) {
          console.log('[LoadMonitoringPage] Using cached data as fallback due to server error');
          setCurrentPageData(cached.data.records || cached.data);
          previousDataRef.current = cached.data.records || cached.data; // Store in ref
          setTotalRecords(cached.data.total || cached.data.length);
          setIsDataFromCache(true);
          setConnectionStatus('error');
          toast.error('Server temporarily unavailable. Showing cached data.');
        } else {
          setConnectionStatus('error');
          toast.error('Failed to load page data. Please try again.');
        }
      } finally {
        setIsLoadingPage(false);
      }
    }, [user, dateRange, selectedMonth, selectedRegion, selectedDistrict, searchTerm, selectedLoadStatus, regions, districts, pageSize]);

      // Load offline data
  const loadOfflineData = useCallback(async () => {
    try {
      const pendingRecords = await getPendingRecords();
      const offlineRecords = pendingRecords
        .filter(record => record.action === 'create')
        .map(record => ({
          ...record.record,
          id: record.id, // Use offline ID
          isOffline: true, // Mark as offline
          offlineAction: record.action,
          offlineTimestamp: record.timestamp
        }));
      
      setOfflineData(offlineRecords);
      console.log('[LoadMonitoringPage] Loaded offline data:', offlineRecords.length, 'records');
    } catch (error) {
      console.error('[LoadMonitoringPage] Failed to load offline data:', error);
    }
  }, [getPendingRecords]);

  // Load offline data when component mounts and when pending records change
  useEffect(() => {
    loadOfflineData();
  }, [loadOfflineData, pendingRecords]);

    // Clear cache when filters change
    const clearPageCache = useCallback(async () => {
      try {
        // Clear all load monitoring page caches
        const cacheInfo = await cache.getInfo();
        const pageCacheKeys = cacheInfo
          .filter(info => info.key.startsWith('loadMonitoring_page_'))
          .map(info => info.key);
        
        for (const key of pageCacheKeys) {
          await cache.delete(key);
        }
        console.log('[LoadMonitoringPage] Cleared page cache, removed', pageCacheKeys.length, 'entries');
      } catch (error) {
        console.error('[LoadMonitoringPage] Error clearing cache:', error);
      }
    }, []);

  // Format percentage loads when records change
  useEffect(() => {
    const formatted: Record<string, string> = {};
    currentPageData.forEach(record => {
      formatted[record.id] = typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : "0.00";
    });
    setFormattedPercentageLoads(formatted);
  }, [currentPageData]);

  // Load data when page changes
  useEffect(() => {
    if (user && currentPage) {
      console.log('[LoadMonitoringPage] Page changed, loading page:', currentPage);
      loadPageData(currentPage);
    }
  }, [currentPage, user, loadPageData]);

  // Consolidated data loading effect - handles all data loading scenarios
  useEffect(() => {
    console.log('[LoadMonitoringPage] useEffect triggered with:', {
      user: !!user,
      currentPage,
      pageSize,
      dateRange,
      selectedRegion,
      selectedDistrict,
      searchTerm,
      selectedLoadStatus
    });
    
    if (user) {
      // Only reload data if we don't already have data or if filters changed
      const shouldReload = currentPageData.length === 0 || 
                          (dateRange && (dateRange.from || dateRange.to)) || 
                          selectedRegion !== null || 
                          selectedDistrict !== null || 
                          searchTerm !== "" || 
                          (selectedLoadStatus && selectedLoadStatus !== "all");
      
      console.log('[LoadMonitoringPage] Should reload check:', {
        hasData: currentPageData.length > 0,
        hasDateRangeFilter: dateRange && (dateRange.from || dateRange.to),
        hasRegionFilter: selectedRegion !== null,
        hasDistrictFilter: selectedDistrict !== null,
        hasSearchFilter: searchTerm !== "",
        hasStatusFilter: selectedLoadStatus && selectedLoadStatus !== "all",
        shouldReload
      });
      
      if (shouldReload) {
      console.log('[LoadMonitoringPage] Calling loadPageData...');
      loadPageData(currentPage);
      } else {
        console.log('[LoadMonitoringPage] Skipping reload - data already present and no filter changes');
      }
    }
  }, [user, pageSize, dateRange, selectedRegion, selectedDistrict, searchTerm, selectedLoadStatus, loadPageData, currentPageData.length]);

  // Debug effect to track when data disappears and restore if needed
  useEffect(() => {
    if (currentPageData.length > 0) {
      console.log('[LoadMonitoringPage] Data loaded successfully:', {
        count: currentPageData.length,
        firstRecord: currentPageData[0]?.id,
        lastRecord: currentPageData[currentPageData.length - 1]?.id
      });
    } else if (currentPageData.length === 0 && !isLoadingPage && previousDataRef.current.length > 0) {
      console.log('[LoadMonitoringPage] ⚠️ Data disappeared! Restoring from ref...', {
        totalRecords,
        currentPage,
        pageSize,
        isLoadingPage,
        previousDataLength: previousDataRef.current.length
      });
      
      // Restore data from ref if it disappeared unexpectedly
      setCurrentPageData(previousDataRef.current);
      toast.info('Data restored from previous state');
    }
  }, [currentPageData, isLoadingPage, totalRecords, currentPage, pageSize]);

  // Monitor state changes for debugging
  useEffect(() => {
    console.log('[LoadMonitoringPage] State changed:', {
      currentPageDataLength: currentPageData.length,
      totalRecords,
      isLoadingPage,
      pageSize
    });
  }, [currentPageData, totalRecords, isLoadingPage, pageSize]);

  // Load stored viewing data when offline and no server data
  useEffect(() => {
    if (isOffline && currentPageData.length === 0) {
      offlineStorageCompat.getStoredLoadMonitoringForViewing().then(data => {
        if (data.length > 0) {
          console.log('[LoadMonitoringPage] Loaded stored viewing data for offline viewing:', data.length);
          setCurrentPageData(data);
          setTotalRecords(data.length);
        }
      }).catch(error => {
        console.warn('[LoadMonitoringPage] Failed to load stored viewing data:', error);
      });
    }
  }, [currentPageData, isOffline]);

  // Load stored viewing data when going offline (initial load)
  useEffect(() => {
    const loadStoredViewingData = async () => {
      if (isOffline && currentPageData.length === 0) {
        try {
          const storedData = await offlineStorageCompat.getStoredLoadMonitoringForViewing();
          if (storedData.length > 0) {
            console.log('[LoadMonitoringPage] Loaded stored viewing data for offline viewing:', storedData.length);
            setCurrentPageData(storedData);
            setTotalRecords(storedData.length);
          }
        } catch (error) {
          console.warn('[LoadMonitoringPage] Failed to load stored viewing data:', error);
        }
      }
    };
    loadStoredViewingData();
  }, [isOffline, currentPageData.length]);

  // Handle online status changes and auto-sync
  useEffect(() => {
    const handleOnlineStatusChange = async () => {
      if (navigator.onLine) {
        console.log('Device is back online, checking for offline items to sync...');
        await loadPageData(currentPage); // First refresh the data to get current state
        if (pendingRecords > 0) {
          console.log(`Found ${pendingRecords} offline items, starting automatic sync...`);
          toast.success(`Device is back online! Automatically syncing ${pendingRecords} offline items...`);
          setIsAutoSyncing(true);
          try {
            await startSync();
          } catch (error) {
            console.error('Automatic sync failed:', error);
            toast.error('Automatic sync failed. Please use manual sync button.');
          } finally {
            setIsAutoSyncing(false);
          }
        } else {
          console.log('No offline items to sync');
          toast.success('Device is back online! All data is up to date.');
        }
      }
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnlineStatusChange);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
    };
  }, [pendingRecords, currentPage, loadPageData, startSync]);

  // Listen for offline sync completion
  useEffect(() => {
    const handleOfflineSyncCompleted = async (event: CustomEvent) => {
      console.log('[LoadMonitoringPage] Offline sync completed:', event.detail);
      setIsAutoSyncing(false);
      toast.success(`Successfully synced ${event.detail.syncedRecords || 0} offline items!`);
      await loadPageData(currentPage); // Refresh data after sync
    };

    window.addEventListener('offlineSyncCompleted', handleOfflineSyncCompleted as EventListener);
    
    return () => {
      window.removeEventListener('offlineSyncCompleted', handleOfflineSyncCompleted as EventListener);
    };
  }, [currentPage, loadPageData]);

  // Handle filter changes - reset to first page and clear cache
  useEffect(() => {
    console.log('[LoadMonitoringPage] Filters changed, resetting to page 1 and clearing cache');
    console.log('[LoadMonitoringPage] Current filter values:', {
      dateRange: dateRange ? {
        from: dateRange.from?.toISOString().split('T')[0] || 'none',
        to: dateRange.to?.toISOString().split('T')[0] || 'none'
      } : 'none',
      selectedRegion: selectedRegion || 'none',
      selectedDistrict: selectedDistrict || 'none',
      searchTerm: searchTerm || 'none',
      selectedLoadStatus: selectedLoadStatus || 'none'
    });
    
    setCurrentPage(1);
    clearPageCache(); // Clear cache when filters change
  }, [dateRange, selectedMonth, selectedRegion, selectedDistrict, searchTerm, selectedLoadStatus, clearPageCache]);

  const handleView = (id: string) => {
    navigate(`/asset-management/load-monitoring/details/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/asset-management/load-monitoring/edit/${id}`);
  };

  const handleDelete = (id: string) => {
    const record = currentPageData.find(r => r.id === id);
    if (!record) return;

    // Check if user has permission to delete
    const canDelete = 
      (user?.role === 'global_engineer' || user?.role === 'system_admin') ||
      (user?.role === 'regional_engineer' && record.region === user.region) ||
      ((user?.role === 'district_engineer' || user?.role === 'technician') && record.district === user.district);

    if (!canDelete) {
      toast.error("You don't have permission to delete this record");
      return;
    }

    // Open confirmation dialog
    const recordName = record.substationName || record.substationNumber || id;
    openDeleteDialog(id, recordName, 'load monitoring record', record);
  };

  const performDelete = async (id: string, data: any) => {
    const record = data as LoadMonitoringData;
    
    // Log the delete action before deleting
    await LoggingService.getInstance().logDeleteAction(
      user?.id || 'unknown',
      user?.name || 'unknown',
      user?.role || 'unknown',
      'load_monitoring',
      id,
      record, // deleted data
      `Deleted load monitoring record: ${record.substationName || record.substationNumber || id}`,
      record.region,
      record.district
    );

    await deleteLoadMonitoringRecord(id);
    toast.success("Load monitoring record deleted successfully");
    
    // Clear page cache after deleting record
    await clearPageCache();
    
    // Reload current page to show updated data
    await loadPageData(currentPage);
  };

  const handleExportToPDF = async (record: LoadMonitoringData) => {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      
      // Load fonts
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Define layout constants
      const { width, height } = page.getSize();
      const margin = 50;
      const lineHeight = 20;
      const sectionSpacing = 30;
      
      let currentY = height - margin;
      
      // Add header
      page.drawText('LOAD MONITORING REPORT', {
        x: margin,
        y: currentY,
        size: 24,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight * 2;

      // Add report metadata
      page.drawText(`Report Date: ${formatDate(record.date)}`, {
        x: margin,
        y: currentY,
        size: 12,
        color: rgb(0.2, 0.2, 0.2),
        font: regularFont,
      });
      currentY -= lineHeight;

      // Add basic information
      const basicInfoY = currentY;
      await page.drawText("Basic Information:", { x: 50, y: currentY, size: 12, font: boldFont });
      currentY -= 20;
      await page.drawText(`Date: ${formatDate(record.date)}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Time: ${record.time}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Substation: ${record.substationName}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Number: ${record.substationNumber}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Region: ${record.region}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`District: ${record.district}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Location: ${record.location}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Rating: ${record.rating} KVA`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Ownership: ${(record as any).ownership || 'N/A'}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Voltage Level: ${record.voltageLevel || 'N/A'}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Peak Load Status: ${record.peakLoadStatus}`, { x: 50, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Created By: ${record.createdBy?.name || 'Unknown'}`, { x: 50, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`GPS Location: ${record.gpsLocation || 'N/A'}`, { x: 50, y: currentY, size: 10 });
      currentY -= 25;

      // Add feeder legs information
      currentY -= sectionSpacing;
      page.drawText('Feeder Legs Information:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      record.feederLegs.forEach((leg, index) => {
        if (currentY < margin + lineHeight * 5) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - margin;
        }

        page.drawText(`Feeder Leg ${index + 1}:`, {
          x: margin,
          y: currentY,
          size: 12,
          color: rgb(0.2, 0.2, 0.2),
          font: boldFont,
        });
        currentY -= lineHeight;

        const legInfo = [
          ['Red Phase Current', `${typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent.toFixed(2) : '0.00'} A`],
          ['Yellow Phase Current', `${typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent.toFixed(2) : '0.00'} A`],
          ['Blue Phase Current', `${typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent.toFixed(2) : '0.00'} A`],
          ['Neutral Current', `${typeof leg.neutralCurrent === 'number' ? leg.neutralCurrent.toFixed(2) : '0.00'} A`]
        ];

        legInfo.forEach(([label, value]) => {
          page.drawText(`${label}: ${value}`, {
            x: margin + 20,
            y: currentY,
            size: 12,
            color: rgb(0.2, 0.2, 0.2),
            font: regularFont,
          });
          currentY -= lineHeight;
        });

        currentY -= lineHeight;
      });

      // Add calculated load information
      currentY -= sectionSpacing;
      page.drawText('Calculated Load Information:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      const loadInfo = [
        ['Rated Load', `${typeof record.ratedLoad === 'number' ? record.ratedLoad.toFixed(2) : '0.00'} A`],
        ['Red Phase Bulk Load', `${typeof record.redPhaseBulkLoad === 'number' ? record.redPhaseBulkLoad.toFixed(2) : '0.00'} A`],
        ['Yellow Phase Bulk Load', `${typeof record.yellowPhaseBulkLoad === 'number' ? record.yellowPhaseBulkLoad.toFixed(2) : '0.00'} A`],
        ['Blue Phase Bulk Load', `${typeof record.bluePhaseBulkLoad === 'number' ? record.bluePhaseBulkLoad.toFixed(2) : '0.00'} A`],
        ['Average Current', `${typeof record.averageCurrent === 'number' ? record.averageCurrent.toFixed(2) : '0.00'} A`],
        ['Percentage Load', `${typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '0.00'}%`],
        ['Percentage Loading', `${typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '0.00'}%`],
        ['10% Rated Neutral', `${typeof record.tenPercentFullLoadNeutral === 'number' ? record.tenPercentFullLoadNeutral.toFixed(2) : '0.00'} A`],
        ['Calculated Neutral', `${typeof record.calculatedNeutral === 'number' ? record.calculatedNeutral.toFixed(2) : '0.00'} A`]
      ];

      loadInfo.forEach(([label, value]) => {
        page.drawText(`${label}: ${value}`, {
          x: margin,
          y: currentY,
          size: 12,
          color: rgb(0.2, 0.2, 0.2),
          font: regularFont,
        });
        currentY -= lineHeight;
      });

      // Add load status
      currentY -= lineHeight;
      const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
      page.drawText(`Economical Load Status: ${loadStatus.status}`, {
        x: margin,
        y: currentY,
        size: 14,
        color: loadStatus.status === "OVERLOAD" ? rgb(0.8, 0.2, 0.2) : 
               loadStatus.status === "Action Required" ? rgb(0.8, 0.6, 0.2) : 
               rgb(0.2, 0.6, 0.2),
        font: boldFont,
      });

      // Add Percentage Loading status
      currentY -= lineHeight;
      const maxFullLoadStatus = typeof record.percentageLoad === 'number' && record.percentageLoad >= 100 ? "OVERLOAD" : "OKAY";
      page.drawText(`Percentage Loading Status: ${maxFullLoadStatus}`, {
        x: margin,
        y: currentY,
        size: 14,
        color: maxFullLoadStatus === "OVERLOAD" ? rgb(0.8, 0.2, 0.2) : rgb(0.2, 0.6, 0.2),
        font: boldFont,
      });

      // Add footer with page numbers
      const pages = pdfDoc.getPages();
      pages.forEach((page, index) => {
        page.drawText(`Page ${index + 1} of ${pages.length}`, {
          x: width - margin - 50,
          y: margin - 20,
          size: 10,
          color: rgb(0.5, 0.5, 0.5),
          font: regularFont,
        });
      });

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `load-monitoring-${record.substationNumber}-${formatDate(record.date)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  const handleExportToCSV = (record: LoadMonitoringData) => {
    // Create CSV content
    const csvContent = [
      ["Load Monitoring Report"],
      ["Date", formatDate(record.date)],
      ["Time", record.time],
      ["Substation Name", record.substationName],
      ["Substation Number", record.substationNumber],
      ["Region", record.region],
      ["District", record.district],
      ["Location", record.location],
      ["Ownership", (record as any).ownership || ''],
      ["Voltage Level", record.voltageLevel || ''],
      ["Rating (kVA)", record.rating],
      ["Peak Load Status", record.peakLoadStatus],
      [],
      ["Feeder Legs Information"],
      ["Leg", "Red Phase (A)", "Yellow Phase (A)", "Blue Phase (A)", "Neutral (A)"]
    ];

    // Add feeder legs data
    record.feederLegs.forEach((leg, index) => {
      csvContent.push([
        `Leg ${index + 1}`,
        typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent.toFixed(2) : '0.00',
        typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent.toFixed(2) : '0.00',
        typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent.toFixed(2) : '0.00',
        typeof leg.neutralCurrent === 'number' ? leg.neutralCurrent.toFixed(2) : '0.00'
      ]);
    });

    csvContent.push(
      [],
      ["Calculated Load Information"],
      ["Metric", "Value"],
      ["Rated Load (A)", typeof record.ratedLoad === 'number' ? record.ratedLoad.toFixed(2) : '0.00'],
      ["Red Phase Bulk Load (A)", typeof record.redPhaseBulkLoad === 'number' ? record.redPhaseBulkLoad.toFixed(2) : '0.00'],
      ["Yellow Phase Bulk Load (A)", typeof record.yellowPhaseBulkLoad === 'number' ? record.yellowPhaseBulkLoad.toFixed(2) : '0.00'],
      ["Blue Phase Bulk Load (A)", typeof record.bluePhaseBulkLoad === 'number' ? record.bluePhaseBulkLoad.toFixed(2) : '0.00'],
      ["Average Current (A)", typeof record.averageCurrent === 'number' ? record.averageCurrent.toFixed(2) : '0.00'],
      ["Percentage Load (%)", typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '0.00'],
      ["10% Rated Neutral (A)", typeof record.tenPercentFullLoadNeutral === 'number' ? record.tenPercentFullLoadNeutral.toFixed(2) : '0.00'],
      ["Calculated Neutral (A)", typeof record.calculatedNeutral === 'number' ? record.calculatedNeutral.toFixed(2) : '0.00']
    );

    // Add load status
    const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
    csvContent.push(
      [],
      ["Load Status", loadStatus.status]
    );

    // Convert to CSV string
    const csvString = csvContent.map(row => row.join(",")).join("\n");
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `load-monitoring-${record.substationNumber}-${formatDate(record.date)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV report generated successfully");
  };

  const handleExportAllToCSV = () => {
    console.log('[Export All CSV] Starting export with', currentPageData.length, 'records');
    
    // Find the maximum number of legs across all records to determine column count
    const maxLegs = Math.max(...currentPageData.map(record => record.feederLegs?.length || 0));
    console.log('[Export All CSV] Maximum legs found:', maxLegs);
    
    // Define headers for professional horizontal format with feeder legs after Peak Load Status
    const baseHeaders = [
      "Record ID",
      "Date",
      "Time",
      "Substation Name",
      "Substation Number",
      "Region",
      "District",
      "Location",
      "Ownership",
      "Rating (kVA)",
      "Peak Load Status"
    ];

    // Add dynamic leg headers based on maximum legs (right after Peak Load Status)
    const legHeaders: string[] = [];
    for (let i = 1; i <= maxLegs; i++) {
      legHeaders.push(
        `Leg ${i} Red Phase (A)`,
        `Leg ${i} Yellow Phase (A)`,
        `Leg ${i} Blue Phase (A)`,
        `Leg ${i} Neutral (A)`
      );
    }

    // Add remaining headers after feeder legs
    const remainingHeaders = [
      "Rated Load (A)",
      "Red Phase Bulk Load (A)",
      "Yellow Phase Bulk Load (A)",
      "Blue Phase Bulk Load (A)",
      "Average Current (A)",
      "Percentage Load (%)",
      "10% Rated Neutral (A)",
      "Calculated Neutral (A)",
      "Load Status",
      "Created By"
    ];

    const headers = [...baseHeaders, ...legHeaders, ...remainingHeaders];

    // Create rows with horizontal leg data
    const rows: string[][] = [];
    
    currentPageData.forEach((record, recordIndex) => {
      console.log(`[Export All CSV] Processing record ${recordIndex + 1}:`, record.id, 'with', record.feederLegs?.length || 0, 'legs');
      
      const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
      
      // Base record data (before feeder legs)
      const baseRecordData = [
        record.id || '',
        formatDate(record.date),
        formatTimeWithAMPM(record.time),
        record.substationName || '',
        record.substationNumber || '',
        record.region || '',
        record.district || '',
        record.location || '',
        (record as any).ownership || '',
        record.rating || '',
        record.peakLoadStatus || ''
      ];

      // Remaining record data (after feeder legs)
      const remainingRecordData = [
        typeof record.ratedLoad === 'number' ? record.ratedLoad.toFixed(2) : '',
        typeof record.redPhaseBulkLoad === 'number' ? record.redPhaseBulkLoad.toFixed(2) : '',
        typeof record.yellowPhaseBulkLoad === 'number' ? record.yellowPhaseBulkLoad.toFixed(2) : '',
        typeof record.bluePhaseBulkLoad === 'number' ? record.bluePhaseBulkLoad.toFixed(2) : '',
        typeof record.averageCurrent === 'number' ? record.averageCurrent.toFixed(2) : '',
        typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '',
        typeof record.tenPercentFullLoadNeutral === 'number' ? record.tenPercentFullLoadNeutral.toFixed(2) : '',
        typeof record.calculatedNeutral === 'number' ? record.calculatedNeutral.toFixed(2) : '',
        loadStatus.status,
        record.createdBy?.name || 'Unknown'
      ];

      // Create leg data array for all possible legs
      const legData: string[] = [];
      
      if (record.feederLegs && record.feederLegs.length > 0) {
        // Add data for existing legs
        record.feederLegs.forEach((leg, legIndex) => {
          console.log(`[Export All CSV] Adding leg ${legIndex + 1} data for record ${record.id}:`, {
            red: leg.redPhaseCurrent,
            yellow: leg.yellowPhaseCurrent,
            blue: leg.bluePhaseCurrent,
            neutral: leg.neutralCurrent
          });
          
          legData.push(
            typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent.toFixed(2) : '0.00',
            typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent.toFixed(2) : '0.00',
            typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent.toFixed(2) : '0.00',
            typeof leg.neutralCurrent === 'number' ? leg.neutralCurrent.toFixed(2) : '0.00'
          );
        });
        
        // Fill remaining leg columns with empty values if this record has fewer legs than max
        const remainingLegs = maxLegs - record.feederLegs.length;
        for (let i = 0; i < remainingLegs; i++) {
          legData.push('', '', '', ''); // Empty values for missing legs
        }
      } else {
        console.log(`[Export All CSV] No feeder legs found for record ${record.id}`);
        // Fill all leg columns with empty values
        for (let i = 0; i < maxLegs; i++) {
          legData.push('', '', '', ''); // Empty values for all legs
        }
      }
      
      // Combine base record data, leg data, and remaining record data
      const fullRow = [...baseRecordData, ...legData, ...remainingRecordData];
      
        // Handle values that might contain commas or quotes
      const processedRow = fullRow.map(value => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      
      rows.push(processedRow);
    });

    console.log('[Export All CSV] Generated', rows.length, 'total rows with', maxLegs, 'legs per record');

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `DT_Load_Monitoring_All_Records_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`CSV report generated successfully (${rows.length} records, up to ${maxLegs} legs each)`);
  };

  // Filter change handlers
  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    setCurrentPage(1);
  };

  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    setCurrentPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedMonth(null);
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setSearchTerm("");
    setSelectedLoadStatus("all");
    setCurrentPage(1); // Reset to first page
    clearPageCache(); // Clear cache when filters are reset
    
    // Clear localStorage
    try {
      Object.values(FILTER_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      // Also clear pagination state
      localStorage.removeItem('loadMonitoring_currentPage');
      localStorage.removeItem('loadMonitoring_pageSize');
      // Also clear global cache
      localStorage.removeItem(GLOBAL_CACHE_KEY);
      localStorage.removeItem('loadMonitoring_selectedMonth');
      console.log('[LoadMonitoringPage] All filter states, pagination state, and global cache cleared from localStorage');
    } catch (error) {
      console.error('[LoadMonitoringPage] Error clearing localStorage:', error);
    }
  };

  // Store load monitoring data for offline viewing
  const storeLoadMonitoringForViewing = async (loadMonitoringData: LoadMonitoringData[]) => {
    try {
      for (const record of loadMonitoringData) {
        const offlineViewKey = `offline_view_loadmonitoring_${record.id}`;
        await offlineStorageCompat.storeLoadMonitoringForViewing(offlineViewKey, {
          ...record,
          storedForOfflineViewing: true,
          storedAt: Date.now()
        });
      }
      console.log(`[LoadMonitoringPage] Successfully stored ${loadMonitoringData.length} load monitoring records for offline viewing`);
    } catch (error) {
      console.error('[LoadMonitoringPage] Failed to store load monitoring records for offline viewing:', error);
      throw error;
    }
  };


  return (
    <AccessControlWrapper type="asset">
      <Layout>
        <div className="container mx-auto p-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">DT Load Monitoring</h1>
              
              
              {isDataFromCache && (
                <p className="text-sm text-blue-600 mt-1">
                  📋 Showing cached data
                </p>
              )}
              
              {/* Offline Status and Controls */}
              <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <LoadMonitoringOfflineBadge showDetails={true} showSyncButton={true} />
                
                {/* Auto-sync status indicator */}
                {isAutoSyncing && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
                    <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
                    <span>Auto-syncing offline data...</span>
                  </div>
                )}
                
                {pendingRecords > 0 && !isAutoSyncing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOfflinePanelOpen(true)}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    View Offline Operations ({pendingRecords})
                  </Button>
                )}
                
                {isOffline && (
                  <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                    <WifiOff className="h-4 w-4" />
                    <span className="text-sm">Working offline. Changes will be saved locally and synced when online.</span>
                  </div>
                )}
              </div>
              {connectionStatus === 'retrying' && (
                <p className="text-sm text-yellow-600 mt-1">
                  🔄 Retrying connection... Please wait
                </p>
              )}
              {connectionStatus === 'error' && (
                <p className="text-sm text-red-600 mt-1">
                  ⚠️ Connection issues detected. Some data may be from cache.
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={handleExportAllToCSV} variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export All to CSV
              </Button>
              <Button onClick={() => navigate('/asset-management/create-load-monitoring')} className="w-full sm:w-auto">
                Add New Record
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  await clearPageCache();
                  setConnectionStatus('connected');
                  await loadPageData(currentPage);
                  toast.success("Data refreshed");
                }}
                disabled={isLoadingPage}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingPage ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {connectionStatus === 'error' && (
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    setConnectionStatus('connected');
                    await loadPageData(currentPage);
                  }}
                  disabled={isLoadingPage}
                  className="border-red-500 text-red-600 hover:bg-red-50"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Connection
                </Button>
              )}
            </div>
          </div>

          {/* Filters Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <RangePicker
                allowClear
                value={dateRange && dateRange.from && dateRange.to ? [dayjs(dateRange.from), dayjs(dateRange.to)] : null}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange({ from: dates[0].toDate(), to: dates[1].toDate() });
                    setSelectedMonth(null); // Clear month when date range is selected
                  } else {
                    setDateRange({ from: undefined, to: undefined });
                  }
                }}
                format="YYYY-MM-DD"
                className="w-full"
                placeholder={['Start Date', 'End Date']}
                disabled={!!selectedMonth} // Disable date range when month is selected
              />
            </div>
            
            <div className="space-y-2">
              <Label>Month</Label>
              <DatePicker
                value={selectedMonth}
                onChange={(date) => {
                  setSelectedMonth(date);
                  if (date) {
                    setDateRange({ from: undefined, to: undefined }); // Clear date range when month is selected
                    localStorage.setItem('loadMonitoring_selectedMonth', date.toISOString());
                  } else {
                    localStorage.removeItem('loadMonitoring_selectedMonth');
                  }
                }}
                picker="month"
              />
            </div>
            
            {/* Region Filter Dropdown - disabled for all roles except system admin, global engineer, ashsubt, and accsubt */}
            <div className="space-y-2">
              <Label>Region</Label>
              <div className="w-full">
                <Select
                  value={selectedRegion}
                  onValueChange={handleRegionChange}
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
            
            {/* District Filter Dropdown - show for all roles but with role-based options */}
            <div className="space-y-2">
              <Label>District/Section</Label>
              <div className="w-full">
                <Select
                  value={selectedDistrict}
                  onValueChange={handleDistrictChange}
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

                {/* Page Size Selector and Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Records per page:</Label>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              if (value === 'all') {
                setPageSize(10000); // Large number to show all records
              } else {
                const newPageSize = parseInt(value);
                setPageSize(newPageSize);
              }
              setCurrentPage(1); // Reset to first page when changing page size
              loadPageData(1); // Reload first page with new size
            }}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue>
                {pageSize >= 10000 ? 'All' : pageSize.toString()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
              <SelectItem value="500">500</SelectItem>
              <SelectItem value="1000">1000</SelectItem>
              <SelectItem value="2000">2000</SelectItem>
              <SelectItem value="5000">5000</SelectItem>
              <SelectItem value="all">Show All</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Quick Load All Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              console.log('[LoadMonitoringPage] Load All button clicked');
              setPageSize(10000);
              setCurrentPage(1);
              // Add a small delay to ensure state updates before loading data
              setTimeout(() => {
                loadPageData(1);
              }, 100);
            }}
            className="ml-2"
          >
            🚀 Load All
          </Button>
          
          {/* Warning for large datasets */}
          {pageSize >= 1000 && (
            <span className="text-xs text-orange-600 ml-2">
              ⚠️ Large datasets may take longer to load
            </span>
          )}
        </div>
            
            <div className="flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search by substation, number, region, district, or location..."
              value={searchTerm}
                onChange={e => {
                  console.log('[LoadMonitoringPage] Search term changed from', searchTerm, 'to', e.target.value);
                  setSearchTerm(e.target.value);
                }}
                className="border rounded px-3 py-2 w-full focus:outline-none focus:ring focus:border-blue-300"
              />
            </div>
          </div>

          {/* Reset Filters Button */}
          <div className="flex justify-end mb-4 gap-2">
            <Select
              value={selectedLoadStatus || "all"}
              onValueChange={(value) => {
                console.log('[LoadMonitoringPage] Status filter changed from', selectedLoadStatus, 'to', value);
                setSelectedLoadStatus(value);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Economical Load Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OVERLOAD">Overload (≥100%)</SelectItem>
                <SelectItem value="Action Required">Action Required (70-99%)</SelectItem>
                <SelectItem value="OKAY">Okay (&lt;70%)</SelectItem>
              </SelectContent>
            </Select>
            

            
            <Button
              variant="outline"
              onClick={handleResetFilters}
              disabled={!(dateRange && (dateRange.from || dateRange.to)) && !selectedMonth && !selectedRegion && !selectedDistrict && !searchTerm && selectedLoadStatus === "all"}
              className="w-full sm:w-auto"
            >
              Reset Filters
            </Button>
          </div>

          {/* Table Section */}
          <Card>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto relative">
                <Table>
                                  <TableCaption>
                  <div className="flex flex-col items-center gap-2">
                    <span>List of load monitoring records</span>
                    <div className="text-sm text-muted-foreground">
                      {isLoadingPage ? (
                        <span className="text-blue-600">🔄 Loading {pageSize >= 10000 ? 'all' : pageSize} records...</span>
                      ) : (
                        <>
                          Showing {paginatedRecords.length} of {totalRecords.toLocaleString()} records
                          {offlineData.length > 0 && (
                            <span className="ml-2 text-yellow-600">📱 {offlineData.length} offline records included</span>
                          )}
                          {pageSize >= 10000 && totalRecords > 0 && (
                            <span className="ml-2 text-green-600">✨ All records loaded</span>
                          )}
                          {pageSize < 10000 && totalRecords > pageSize && (
                            <span className="ml-2 text-gray-600">📄 Use pagination or increase page size to see more</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </TableCaption>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Time</TableHead>
                      <TableHead className="whitespace-nowrap">Region</TableHead>
                      <TableHead className="whitespace-nowrap">District/Section</TableHead>
                      <TableHead className="whitespace-nowrap">Substation</TableHead>
                      <TableHead className="whitespace-nowrap">Rating (kVA)</TableHead>
                      <TableHead className="whitespace-nowrap">Voltage Level</TableHead>
                      <TableHead className="whitespace-nowrap">Percentage Loading</TableHead>
                      <TableHead className="whitespace-nowrap">Full Load Status</TableHead>
                      <TableHead className="whitespace-nowrap">Peak Status</TableHead>
                      <TableHead className="whitespace-nowrap">Created By</TableHead>
                      <TableHead className="whitespace-nowrap sticky right-0 bg-background">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record) => {
                      // Use direct values for consistency with view details
                      const region = record.region || regions.find(r => r.id === record.regionId)?.name || 'Unknown';
                      const district = record.district || districts.find(d => d.id === record.districtId)?.name || 'Unknown';
                      const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
                      
                      return (
                        <TableRow 
                          key={record.id}
                          className={`hover:bg-muted/50 ${
                            record.isOffline ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
                          }`}
                        >
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {record.isOffline && (
                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                  📱 Offline
                                </Badge>
                              )}
                              {format(new Date(record.date), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatTimeWithAMPM(record.time)}</TableCell>
                          <TableCell className="whitespace-nowrap">{region}</TableCell>
                          <TableCell className="whitespace-nowrap">{district}</TableCell>
                          <TableCell className="whitespace-nowrap">{
                            record.substationName && record.substationNumber
                              ? `${record.substationName} (${record.substationNumber})`
                              : record.substationName || record.substationNumber || "-"
                          }</TableCell>
                          <TableCell className="whitespace-nowrap">{record.rating}</TableCell>
                          <TableCell className="whitespace-nowrap">{record.voltageLevel || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge className={getLoadStatus(Number(formattedPercentageLoads[record.id]) || 0).color}>
                              {formattedPercentageLoads[record.id] ?? "0.00"}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getLoadStatus(Number(formattedPercentageLoads[record.id]) || 0).color}>
                              {getLoadStatus(Number(formattedPercentageLoads[record.id]) || 0).status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{record.peakLoadStatus}</TableCell>
                          <TableCell className="whitespace-nowrap">{record.createdBy?.name || 'Unknown'}</TableCell>
                          <TableCell className="sticky right-0 bg-background">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleView(record.id)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportToPDF(record)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Export to PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportToCSV(record)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Export to CSV
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEdit(record.id)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(record.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex-1 text-sm text-muted-foreground">
                      {isLoadingPage ? (
                        "Loading..."
                      ) : (
                        <>
                          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} results
                          {isDataFromCache && (
                            <span className="ml-2 text-blue-600">📋 Cached</span>
                          )}
                          {connectionStatus === 'retrying' && (
                            <span className="ml-2 text-yellow-600">🔄 Retrying</span>
                          )}
                          {connectionStatus === 'error' && (
                            <span className="ml-2 text-red-600">⚠️ Connection Error</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || isLoadingPage}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || isLoadingPage}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Offline Panel */}
        <LoadMonitoringOfflinePanel
          isOpen={isOfflinePanelOpen}
          onClose={() => setIsOfflinePanelOpen(false)}
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
      </Layout>
    </AccessControlWrapper>
  );
}
