import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { FaultCard } from "@/components/dashboard/FaultCard";
import { PendingFaultsList } from "@/components/faults/PendingFaultsList";
import { ChatBox } from "@/components/chat/ChatBox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertTriangle, ZapOff, RefreshCw, Filter } from "lucide-react";
import { OP5Fault, ControlSystemOutage, FaultType } from "@/lib/types";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { PermissionService } from "@/services/PermissionService";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, isSameDay, isSameMonth, isSameYear } from "date-fns";
import { BroadcastMessage } from "@/components/dashboard/BroadcastMessage";
import { BroadcastMessageForm } from "@/components/dashboard/BroadcastMessageForm";
import { AudioPlayer } from "@/components/dashboard/AudioPlayer";
import { apiRequest } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { dashboardCacheService } from "@/services/DashboardCacheService";

interface FilterBarProps {
  setFilterRegion: (region: string | undefined) => void;
  setFilterDistrict: (district: string | undefined) => void;
  setFilterStatus: (status: "all" | "pending" | "resolved") => void;
  filterStatus: "all" | "pending" | "resolved";
  onRefresh: () => void;
  isRefreshing: boolean;
  setFilterFaultType: (type: string) => void;
  setDateRange: (range: DateRange) => void;
  setSelectedDay: (day: Date | undefined) => void;
  setSelectedMonth: (month: number | undefined) => void;
  setSelectedMonthYear: (year: number | undefined) => void;
  setSelectedYear: (year: number | undefined) => void;
  setDateFilterType: (type: "range" | "day" | "month" | "year") => void;
  filterFaultType: string;
  dateRange: DateRange;
  selectedDay: Date | undefined;
  selectedMonth: number | undefined;
  selectedMonthYear: number | undefined;
  selectedYear: number | undefined;
  dateFilterType: "range" | "day" | "month" | "year";
}

// Add a utility function to check if the environment is production
const isProduction = process.env.NODE_ENV === 'production';

export default function DashboardPage() {
  const { isAuthenticated, user } = useAzureADAuth();
  const { getFilteredFaults, regions, districts, op5Faults, controlSystemOutages } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const permissionService = PermissionService.getInstance();
  const shouldRefreshRef = useRef(false);
  
  // Replace console.log statements with conditional logging
  if (!isProduction) {
  console.log('[Dashboard] Initial render - Auth state:', { isAuthenticated, userRole: user?.role });
  }
  
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "resolved">("pending");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faults, setFaults] = useState<{op5Faults: OP5Fault[], controlOutages: ControlSystemOutage[]}>({
    op5Faults: [],
    controlOutages: []
  });
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  
  // Effective region and district IDs after role-based filtering
  const [effectiveRegionId, setEffectiveRegionId] = useState<string | undefined>(undefined);
  const [effectiveDistrictId, setEffectiveDistrictId] = useState<string | undefined>(undefined);
  
  
  // Advanced filter states
  const [filterFaultType, setFilterFaultType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<"range" | "day" | "month" | "year">("range");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12); // Show 12 items per page (3x4 grid)
  const [activeTab, setActiveTab] = useState<"all" | "op5" | "control">("all");
  
  // Server-side pagination state
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [currentPageData, setCurrentPageData] = useState<{op5Faults: OP5Fault[], controlOutages: ControlSystemOutage[]}>({
    op5Faults: [],
    controlOutages: []
  });
  
  // Complete data for both metrics and pagination (loaded once, used for both)
  const [allData, setAllData] = useState<{op5Faults: OP5Fault[], controlOutages: ControlSystemOutage[]}>({
    op5Faults: [],
    controlOutages: []
  });
  
  // Set initial filter values based on user role
  useEffect(() => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] Auth effect - Checking authentication');
    }
    if (!isAuthenticated) {
      if (!isProduction) {
      console.log('[Dashboard] Not authenticated, redirecting to login');
      }
      navigate("/login");
      return;
    }
    
    if (user) {
      if (!isProduction) {
      console.log('[Dashboard] User data:', { 
        role: user.role, 
        region: user.region, 
        district: user.district 
      });
      }
      
      // Check if user has access to dashboard
      const hasAccess = permissionService.canAccessFeature(user.role, 'analytics_dashboard');
      if (!isProduction) {
      console.log('[Dashboard] User has access to dashboard:', hasAccess);
      }
      
      if (!hasAccess) {
        if (!isProduction) {
        console.log('[Dashboard] User does not have access to dashboard, redirecting');
        }
        navigate("/unauthorized");
        return;
      }
      
      // Only set region/district filters if user is not a system admin or global engineer
      if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
        if (!isProduction) {
        console.log('[Dashboard] Region/District IDs:', { regionId, districtId });
        }
        
        if (regionId) {
          setFilterRegion(regionId);
          setSelectedRegion(regionId);
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
          setSelectedDistrict(districtId);
        }
      }
    }
  }, [isAuthenticated, navigate, user, regions, districts]);
  
  useEffect(() => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] Loading faults with filters:', { 
      filterRegion, 
      filterDistrict, 
      filterStatus,
      filterFaultType,
      dateFilterType,
      dateRange,
      selectedDay,
      selectedMonth,
      selectedMonthYear,
      selectedYear
    });
    }
    // Reset to first page when filters change
    setCurrentPage(1);
    // Load page data with server-side pagination
    loadPageData(1);
  }, [
    filterRegion, 
    filterDistrict, 
    filterStatus, 
    filterFaultType,
    dateFilterType,
    dateRange,
    selectedDay,
    selectedMonth,
    selectedMonthYear,
    selectedYear
  ]);
  
  // REMOVED: useEffect that triggered on context data changes
  // This was causing infinite refetch loops. The dashboard should only fetch when:
  // 1. Filters change (line 165-196)
  // 2. Page changes (line 214-218)
  // 3. User manually refreshes (onRefresh handler)
  // Context data changes should not trigger refetches - the cache service handles stale data intelligently
  
  // Load page data when page changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadPageData(currentPage);
    }
  }, [currentPage]);

  // Check for refresh flag on mount and location change
  useEffect(() => {
    if (isAuthenticated && user && location.pathname === '/dashboard') {
      const refreshFlag = sessionStorage.getItem('dashboardNeedsRefresh');
      if (refreshFlag === 'true') {
        console.log('[Dashboard] Refresh flag detected, refreshing data...');
        sessionStorage.removeItem('dashboardNeedsRefresh');
        // Invalidate cache and refresh data immediately
        dashboardCacheService.invalidateAll().then(() => {
          // Minimal delay to ensure component is fully mounted
          setTimeout(() => {
            loadPageData(1, true); // Always go to page 1 to see new items
          }, 50);
        });
      }
    }
  }, [location.pathname, isAuthenticated, user]);

  // Listen for fault data changes (create/delete) and refresh dashboard
  useEffect(() => {
    const handleFaultDataChanged = async (event: CustomEvent) => {
      const { type, action } = event.detail;
      console.log('[Dashboard] Fault data changed event received:', { type, action });
      // Refresh current page data with force refresh to bypass cache
      if (isAuthenticated && user && location.pathname === '/dashboard') {
        shouldRefreshRef.current = true;
        
        // For create actions, optimistically update UI from DataContext
        let shouldSkipRefresh = false;
        if (action === 'create') {
          if (type === 'op5' && op5Faults.length > 0) {
            // Find the newest fault (most recent createdAt timestamp)
            const latestFault = [...op5Faults].sort((a, b) => 
              new Date(b.createdAt || b.occurrenceDate).getTime() - new Date(a.createdAt || a.occurrenceDate).getTime()
            )[0];
            // Check if it matches current filters - if so, add optimistically
            const matchesFilters = checkIfFaultMatchesFilters(latestFault);
            if (matchesFilters && currentPage === 1) { // Only show on page 1
              setCurrentPageData(prev => ({
                op5Faults: [latestFault, ...prev.op5Faults.slice(0, pageSize - 1)],
                controlOutages: prev.controlOutages
              }));
              setTotalItems(prev => prev + 1);
              // Skip immediate refresh since we showed it optimistically
              // Will refresh on next natural update or when filters change
              shouldSkipRefresh = true;
            }
          } else if (type === 'control' && controlSystemOutages.length > 0) {
            // Find the newest outage (most recent createdAt timestamp)
            const latestOutage = [...controlSystemOutages].sort((a, b) => 
              new Date(b.createdAt || b.occurrenceDate).getTime() - new Date(a.createdAt || a.occurrenceDate).getTime()
            )[0];
            const matchesFilters = checkIfOutageMatchesFilters(latestOutage);
            if (matchesFilters && currentPage === 1) { // Only show on page 1
              setCurrentPageData(prev => ({
                op5Faults: prev.op5Faults,
                controlOutages: [latestOutage, ...prev.controlOutages.slice(0, pageSize - 1)]
              }));
              setTotalItems(prev => prev + 1);
              // Skip immediate refresh since we showed it optimistically
              shouldSkipRefresh = true;
            }
          }
        }
        
        // Only refresh if we didn't optimistically update (or for delete/update actions)
        if (!shouldSkipRefresh || action !== 'create') {
          // Invalidate cache and refresh data in background
          dashboardCacheService.invalidateAll().then(() => {
            loadPageData(currentPage, true);
          });
        } else {
          // For create with optimistic update, just invalidate cache for next natural refresh
          dashboardCacheService.invalidateAll();
        }
      }
    };

    // Helper function to check if fault matches current dashboard filters
    const checkIfFaultMatchesFilters = (fault: OP5Fault): boolean => {
      // Check region filter
      if (effectiveRegionId && fault.regionId !== effectiveRegionId) return false;
      // Check district filter
      if (effectiveDistrictId && fault.districtId !== effectiveDistrictId) return false;
      // Check status filter
      if (filterStatus !== "all" && fault.status !== filterStatus) return false;
      // Check fault type filter
      if (filterFaultType !== "all" && fault.faultType !== filterFaultType) return false;
      // Check date filters (simplified - only check if on current page which is usually recent)
      return true; // Assume matches for optimistic update
    };

    const checkIfOutageMatchesFilters = (outage: ControlSystemOutage): boolean => {
      // Check region filter
      if (effectiveRegionId && outage.regionId !== effectiveRegionId) return false;
      // Check district filter
      if (effectiveDistrictId && outage.districtId !== effectiveDistrictId) return false;
      // Check status filter
      if (filterStatus !== "all" && outage.status !== filterStatus) return false;
      // Check fault type filter
      if (filterFaultType !== "all" && outage.faultType !== filterFaultType) return false;
      return true; // Assume matches for optimistic update
    };

    window.addEventListener('faultDataChanged', handleFaultDataChanged as EventListener);
    
    return () => {
      window.removeEventListener('faultDataChanged', handleFaultDataChanged as EventListener);
    };
  }, [isAuthenticated, user, currentPage, location.pathname, op5Faults, controlSystemOutages, effectiveRegionId, effectiveDistrictId, filterStatus, filterFaultType, pageSize]);
  
  // Server-side data loading function with smart caching
  const loadPageData = async (page: number = currentPage, forceRefresh: boolean = false) => {
    setIsLoadingPage(true);
    
    try {
      // Apply role-based filtering before building query parameters
      let effectiveRegionId = filterRegion === "all" ? undefined : filterRegion;
      let effectiveDistrictId = filterDistrict === "all" ? undefined : filterDistrict;
      
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
      
      // For ashsubt and accsubt, don't force a specific region but allow them to filter
      // The effectiveRegionId will be the one they select from the dropdown
      // The backend will handle filtering based on their role
      if (user?.role === "ashsubt" || user?.role === "accsubt") {
        // Don't override effectiveRegionId - let it be what the user selects
        // The frontend FilterBar will show their allowed regions
      }
      
      console.log('[Dashboard] Role-based filtering applied:', {
        userRole: user?.role,
        userRegion: user?.region,
        userDistrict: user?.district,
        effectiveRegionId,
        effectiveDistrictId,
        originalFilterRegion: filterRegion,
        originalFilterDistrict: filterDistrict
      });
      
      // Update effective region and district IDs for StatsOverview
      setEffectiveRegionId(effectiveRegionId);
      setEffectiveDistrictId(effectiveDistrictId);
      
      
      // Build query parameters for OP5 faults
      const op5Params = new URLSearchParams();
      if (effectiveRegionId) op5Params.append('regionId', effectiveRegionId);
      if (effectiveDistrictId) op5Params.append('districtId', effectiveDistrictId);
      if (filterStatus !== "all") op5Params.append('status', filterStatus);
      if (filterFaultType !== "all") op5Params.append('faultType', filterFaultType);
      
      // Apply date filters (only send supported filters)
      if (dateFilterType === "day" && selectedDay) {
        op5Params.append('date', selectedDay.toISOString().split('T')[0]);
      } else if (dateFilterType === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
        op5Params.append('month', new Date(selectedMonthYear, selectedMonth).toISOString().split('T')[0].substring(0, 7));
      }
      // Note: fromDate/toDate and year filters not yet supported by backend
      
      // Server-side pagination parameters
      const offset = (page - 1) * pageSize;
      op5Params.append('limit', pageSize.toString());
      op5Params.append('offset', offset.toString());
      op5Params.append('sort', 'occurrenceDate');
      op5Params.append('order', 'desc');
      
      // Build query parameters for control outages
      const controlParams = new URLSearchParams();
      if (effectiveRegionId) controlParams.append('regionId', effectiveRegionId);
      if (effectiveDistrictId) controlParams.append('districtId', effectiveDistrictId);
      if (filterStatus !== "all") controlParams.append('status', filterStatus);
      if (filterFaultType !== "all") controlParams.append('faultType', filterFaultType);
      
      // Apply same date filters (only send supported filters)
      if (dateFilterType === "day" && selectedDay) {
        controlParams.append('date', selectedDay.toISOString().split('T')[0]);
      } else if (dateFilterType === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
        controlParams.append('month', new Date(selectedMonthYear, selectedMonth).toISOString().split('T')[0].substring(0, 7));
      }
      // Note: fromDate/toDate and year filters not yet supported by backend
      
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
      
      console.log('[Dashboard] Getting counts with params:', {
        op5: op5CountParams.toString(),
        control: controlCountParams.toString()
      });
      
      // Use cache service for count requests
      const [op5CountRes, controlCountRes] = await Promise.all([
        dashboardCacheService.fetchWithCache(
          '/api/op5Faults',
          op5CountParams,
          () => apiRequest(`/api/op5Faults?${op5CountParams.toString()}`),
          { forceRefresh, maxAge: 30 * 1000, staleAge: 2 * 60 * 1000 }
        ),
        dashboardCacheService.fetchWithCache(
          '/api/controlOutages',
          controlCountParams,
          () => apiRequest(`/api/controlOutages?${controlCountParams.toString()}`),
          { forceRefresh, maxAge: 30 * 1000, staleAge: 2 * 60 * 1000 }
        )
      ]);
      
      console.log('[Dashboard] Count responses:', {
        op5: op5CountRes,
        control: controlCountRes
      });
      
      const op5Total = op5CountRes.total || 0;
      const controlTotal = controlCountRes.total || 0;
      const totalCount = op5Total + controlTotal;
      
      setTotalItems(totalCount);
      
      // Fetch page data
      console.log('[Dashboard] Fetching page data with params:', {
        op5: op5Params.toString(),
        control: controlParams.toString()
      });
      
      // Use cache service for page data requests
      const [op5Res, controlRes] = await Promise.all([
        dashboardCacheService.fetchWithCache(
          '/api/op5Faults',
          op5Params,
          () => apiRequest(`/api/op5Faults?${op5Params.toString()}`),
          { forceRefresh, maxAge: 30 * 1000, staleAge: 2 * 60 * 1000 }
        ),
        dashboardCacheService.fetchWithCache(
          '/api/controlOutages',
          controlParams,
          () => apiRequest(`/api/controlOutages?${controlParams.toString()}`),
          { forceRefresh, maxAge: 30 * 1000, staleAge: 2 * 60 * 1000 }
        )
      ]);
      
      console.log('[Dashboard] Page data responses:', {
        op5: op5Res,
        control: controlRes
      });
      
      const op5Data = op5Res.data || op5Res || [];
      const controlData = controlRes.data || controlRes || [];
      
      // Load all data for both metrics and pagination (no pagination limit)
      const allOp5Params = new URLSearchParams();
      if (effectiveRegionId) allOp5Params.append('regionId', effectiveRegionId);
      if (effectiveDistrictId) allOp5Params.append('districtId', effectiveDistrictId);
      if (filterStatus !== "all") allOp5Params.append('status', filterStatus);
      if (filterFaultType !== "all") allOp5Params.append('faultType', filterFaultType);
      
      // Apply date filters (only send supported filters)
      if (dateFilterType === "day" && selectedDay) {
        allOp5Params.append('date', selectedDay.toISOString().split('T')[0]);
      } else if (dateFilterType === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
        allOp5Params.append('month', new Date(selectedMonthYear, selectedMonth).toISOString().split('T')[0].substring(0, 7));
      }
      
      const allControlParams = new URLSearchParams();
      if (effectiveRegionId) allControlParams.append('regionId', effectiveRegionId);
      if (effectiveDistrictId) allControlParams.append('districtId', effectiveDistrictId);
      if (filterStatus !== "all") allControlParams.append('status', filterStatus);
      if (filterFaultType !== "all") allControlParams.append('faultType', filterFaultType);
      
      // Apply same date filters (only send supported filters)
      if (dateFilterType === "day" && selectedDay) {
        allControlParams.append('date', selectedDay.toISOString().split('T')[0]);
      } else if (dateFilterType === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
        allControlParams.append('month', new Date(selectedMonthYear, selectedMonth).toISOString().split('T')[0].substring(0, 7));
      }
      
      // Get counts for metrics efficiently (same as table pagination)
      const allOp5CountParams = new URLSearchParams(allOp5Params);
      const allControlCountParams = new URLSearchParams(allControlParams);
      allOp5CountParams.append('countOnly', 'true');
      allControlCountParams.append('countOnly', 'true');
      
      // Use cache service for metrics count requests
      const [allOp5CountRes, allControlCountRes] = await Promise.all([
        dashboardCacheService.fetchWithCache(
          '/api/op5Faults',
          allOp5CountParams,
          () => apiRequest(`/api/op5Faults?${allOp5CountParams.toString()}`),
          { forceRefresh, maxAge: 30 * 1000, staleAge: 2 * 60 * 1000 }
        ),
        dashboardCacheService.fetchWithCache(
          '/api/controlOutages',
          allControlCountParams,
          () => apiRequest(`/api/controlOutages?${allControlCountParams.toString()}`),
          { forceRefresh, maxAge: 30 * 1000, staleAge: 2 * 60 * 1000 }
        )
      ]);
      
      const allOp5Count = allOp5CountRes.total || 0;
      const allControlCount = allControlCountRes.total || 0;
      
      // Get ALL filtered data for metrics calculations (same filters as table, but no pagination)
      const allFilteredOp5Params = new URLSearchParams(op5Params);
      const allFilteredControlParams = new URLSearchParams(controlParams);
      
      // Remove pagination parameters for metrics calculations
      allFilteredOp5Params.delete('limit');
      allFilteredOp5Params.delete('offset');
      allFilteredControlParams.delete('limit');
      allFilteredControlParams.delete('offset');
      
      // Set high limit to get all filtered data for metrics
      allFilteredOp5Params.append('limit', '10000');
      allFilteredControlParams.append('limit', '10000');
      
      console.log('[Dashboard] Fetching all filtered data for metrics:', {
        op5: allFilteredOp5Params.toString(),
        control: allFilteredControlParams.toString()
      });
      
      // Use cache service for metrics data requests (these are larger, so longer cache time)
      const [allFilteredOp5Res, allFilteredControlRes] = await Promise.all([
        dashboardCacheService.fetchWithCache(
          '/api/op5Faults',
          allFilteredOp5Params,
          () => apiRequest(`/api/op5Faults?${allFilteredOp5Params.toString()}`),
          { forceRefresh, maxAge: 60 * 1000, staleAge: 3 * 60 * 1000 } // 1 min fresh, 3 min stale
        ),
        dashboardCacheService.fetchWithCache(
          '/api/controlOutages',
          allFilteredControlParams,
          () => apiRequest(`/api/controlOutages?${allFilteredControlParams.toString()}`),
          { forceRefresh, maxAge: 60 * 1000, staleAge: 3 * 60 * 1000 } // 1 min fresh, 3 min stale
        )
      ]);
      
      const allFilteredOp5Data = allFilteredOp5Res.data || allFilteredOp5Res || [];
      const allFilteredControlData = allFilteredControlRes.data || allFilteredControlRes || [];
      
      console.log('[Dashboard] All filtered data for metrics:', {
        totalFaults: allFilteredOp5Data.length + allFilteredControlData.length,
        op5Faults: allFilteredOp5Data.length,
        controlOutages: allFilteredControlData.length,
        sampleFault: allFilteredOp5Data[0]
      });
      
      // Store actual filtered data for metrics calculations
      setAllData({
        op5Faults: allFilteredOp5Data,
        controlOutages: allFilteredControlData
      });
      
      // Update current page data (paginated subset)
      setCurrentPageData({
        op5Faults: op5Data,
        controlOutages: controlData
      });
      
      // Update pagination state
      setHasNextPage(offset + pageSize < totalCount);
      setHasPreviousPage(offset > 0);
      
      console.log('[Dashboard] Page data loaded:', {
        page,
        pageSize,
        totalCount,
        op5Count: op5Data.length,
        controlCount: controlData.length,
        hasNextPage: offset + pageSize < totalCount,
        hasPreviousPage: offset > 0
      });
      
    } catch (error) {
      console.error('[Dashboard] Error loading page data:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to load dashboard data';
      let isRetryable = false;
      
      if (error.message.includes('503') || error.message.includes('Service temporarily unavailable')) {
        errorMessage = 'Backend service is temporarily unavailable. Please try again in a few minutes.';
        isRetryable = true;
      } else if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
        errorMessage = 'Backend service is not responding properly. Please try again later.';
        isRetryable = true;
      } else if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
        errorMessage = 'Backend service is taking too long to respond. Please try again.';
        isRetryable = true;
      } else if (error.message.includes('500') || error.message.includes('Server Error')) {
        errorMessage = 'Backend is experiencing technical difficulties. Please try again later.';
        isRetryable = true;
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'Authentication required. Please log in again.';
        isRetryable = false;
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorMessage = 'Access denied. You do not have permission to view this data.';
        isRetryable = false;
      }
      
      toast.error(errorMessage);
      
      // Show retry option for retryable errors
      if (isRetryable) {
        toast.error('Click here to retry', {
          action: {
            label: 'Retry',
            onClick: () => {
              console.log('[Dashboard] Retrying page data load...');
              loadPageData(page);
            }
          }
        });
      }
      
      // Fallback to legacy client-side loading
      console.log('[Dashboard] Falling back to legacy client-side loading');
      loadFaults();
    } finally {
      setIsLoadingPage(false);
    }
  };
  
  
  // Legacy client-side filtering function (kept for backward compatibility)
  const loadFaults = () => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] loadFaults called');
    }
    console.log('[Dashboard] Current filter states:', { 
      filterRegion, 
      filterDistrict, 
      filterStatus,
      filterFaultType,
      dateFilterType,
      dateRange,
      selectedDay,
      selectedMonth,
      selectedMonthYear,
      selectedYear
    });
    
    // Apply role-based filtering before getting filtered faults
    let effectiveRegionId = filterRegion === "all" ? undefined : filterRegion;
    let effectiveDistrictId = filterDistrict === "all" ? undefined : filterDistrict;
    
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
    
    console.log('[Dashboard] Role-based filtering applied in loadFaults:', {
      userRole: user?.role,
      userRegion: user?.region,
      userDistrict: user?.district,
      effectiveRegionId,
      effectiveDistrictId,
      originalFilterRegion: filterRegion,
      originalFilterDistrict: filterDistrict
    });
    
    // Update effective region and district IDs for StatsOverview
    setEffectiveRegionId(effectiveRegionId);
    setEffectiveDistrictId(effectiveDistrictId);
    
    // Get filtered faults from context using effective region/district
    const filteredFaults = getFilteredFaults(effectiveRegionId, effectiveDistrictId);
    console.log('[Dashboard] Filtered faults from context:', { 
      op5Count: filteredFaults.op5Faults.length,
      controlCount: filteredFaults.controlOutages.length,
      op5Faults: filteredFaults.op5Faults,
      controlOutages: filteredFaults.controlOutages
    });
    
    // Apply status filter
    let statusFilteredOP5 = filteredFaults.op5Faults;
    let statusFilteredControl = filteredFaults.controlOutages;
    
    if (filterStatus !== "all") {
      statusFilteredOP5 = filteredFaults.op5Faults.filter(f => f.status === filterStatus);
      statusFilteredControl = filteredFaults.controlOutages.filter(f => f.status === filterStatus);
    }
    
    // Apply fault type filter
    let typeFilteredOP5 = statusFilteredOP5;
    let typeFilteredControl = statusFilteredControl;
    
    if (filterFaultType !== "all") {
      typeFilteredOP5 = statusFilteredOP5.filter(f => f.faultType === filterFaultType);
      typeFilteredControl = statusFilteredControl.filter(f => f.faultType === filterFaultType);
    }
    
    // Apply date filters
    let dateFilteredOP5 = typeFilteredOP5;
    let dateFilteredControl = typeFilteredControl;
    
    if (dateFilterType === "range" && dateRange.from && dateRange.to) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isWithinInterval(faultDate, { start: dateRange.from, end: dateRange.to });
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isWithinInterval(faultDate, { start: dateRange.from, end: dateRange.to });
      });
    } else if (dateFilterType === "day" && selectedDay) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameDay(faultDate, selectedDay);
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameDay(faultDate, selectedDay);
      });
    } else if (dateFilterType === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameMonth(faultDate, new Date(selectedMonthYear, selectedMonth));
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameMonth(faultDate, new Date(selectedMonthYear, selectedMonth));
      });
    } else if (dateFilterType === "year" && selectedYear !== undefined) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameYear(faultDate, new Date(selectedYear, 0));
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameYear(faultDate, new Date(selectedYear, 0));
      });
    }

    // Remove any duplicates between OP5 and control faults
    const controlIds = new Set(dateFilteredControl.map(f => f.id));
    dateFilteredOP5 = dateFilteredOP5.filter(f => !controlIds.has(f.id));
    
    // Update state with filtered faults
    const updatedFaults = {
      op5Faults: dateFilteredOP5,
      controlOutages: dateFilteredControl
    };
    console.log('[Dashboard] Setting updated faults:', updatedFaults);
    setFaults(updatedFaults);
  };
  
  const handleRefresh = async () => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] Refreshing data - forcing cache bypass');
    }
    setIsRefreshing(true);
    try {
      // Force refresh bypasses cache completely
      await loadPageData(currentPage, true);
      // Optionally invalidate all dashboard cache
      await dashboardCacheService.invalidateAll();
      if (!isProduction) {
      console.log('[Dashboard] Cache invalidated, fresh data loaded');
      }
    } catch (error) {
      console.error('[Dashboard] Error during refresh:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Calculate paginated faults based on active tab using server-side data
  const paginatedFaults = useMemo(() => {
    let filteredFaults: (OP5Fault | ControlSystemOutage)[] = [];
    
    if (activeTab === "all") {
      // For "all" tab, combine both types of faults but ensure uniqueness
      const seenIds = new Set<string>();
      filteredFaults = [...currentPageData.op5Faults, ...currentPageData.controlOutages].filter(fault => {
        if (seenIds.has(fault.id)) {
          return false;
        }
        seenIds.add(fault.id);
        return true;
      });
    } else if (activeTab === "op5") {
      // For "op5" tab, only show OP5 faults
      filteredFaults = currentPageData.op5Faults;
    } else if (activeTab === "control") {
      // For "control" tab, only show control system outages
      filteredFaults = currentPageData.controlOutages;
    }

    // Apply sorting
    filteredFaults.sort((a, b) => {
      const dateA = new Date(a.occurrenceDate).getTime();
      const dateB = new Date(b.occurrenceDate).getTime();
      return dateB - dateA;
    });

    return filteredFaults;
  }, [activeTab, currentPageData.op5Faults, currentPageData.controlOutages]);

  // Calculate total pages based on server-side total
  const totalPages = useMemo(() => {
    return Math.ceil(totalItems / pageSize);
  }, [totalItems, pageSize]);

  // Reset pagination when tab changes or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterRegion, filterDistrict, filterStatus, filterFaultType, dateFilterType, dateRange, selectedDay, selectedMonth, selectedMonthYear, selectedYear]);
  
  
  // Load initial data when component mounts
  useEffect(() => {
    if (isAuthenticated && user) {
      loadPageData(1);
    }
  }, [isAuthenticated, user]);

  // Add debug logging for pagination
  useEffect(() => {
    if (!isProduction) {
    console.log('[Dashboard] Pagination state:', {
      currentPage,
      pageSize,
      totalPages,
      activeTab,
      totalItems,
      currentPageData: {
        op5Count: currentPageData.op5Faults.length,
        controlCount: currentPageData.controlOutages.length
      }
    });
    }
  }, [currentPage, pageSize, totalPages, activeTab, totalItems, currentPageData]);
  
  if (!isAuthenticated) {
    if (!isProduction) {
    console.log('[Dashboard] Not authenticated, returning null');
    }
    return null;
  }
  
  if (!isProduction) {
  console.log('[Dashboard] Rendering with faults:', { 
    op5Count: currentPageData.op5Faults.length,
    controlCount: currentPageData.controlOutages.length,
    totalItems,
    currentPage,
    totalPages
  });
  }
  
  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 px-4 sm:px-6 relative min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Enhanced Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary via-primary/90 to-secondary bg-clip-text text-transparent tracking-tight">
              Pending Faults Dashboard
            </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Monitor and manage critical pending power distribution faults in real-time
            </p>
          </div>
          
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center w-full lg:w-auto">
            {/* Page Size Selector */}
              <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-1.5 shadow-sm">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Per Page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                }}
                  className="text-xs sm:text-sm border-0 bg-transparent focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>
            
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="shadow-sm"
              >
                <RefreshCw size={16} className={`mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
            </Button>
              <Button asChild size="sm" className="shadow-sm">
              <Link to="/report-fault" className="flex items-center">
                <PlusCircle size={16} className="mr-2" />
                  Report Fault
              </Link>
            </Button>
          </div>
        </div>
        
          {/* Broadcast Messages */}
        <BroadcastMessage />
        
          {/* Broadcast Message Form for Admins */}
        {(user?.role === "system_admin" || user?.role === "global_engineer") && (
            <div className="mt-4">
            <BroadcastMessageForm />
          </div>
        )}
        </div>
        
        {/* Stats Overview Section */}
        <div className="mb-6 sm:mb-8">
        <StatsOverview 
          op5Faults={allData.op5Faults} 
          controlOutages={allData.controlOutages} 
          filterRegion={effectiveRegionId}
          filterDistrict={effectiveDistrictId}
        />
        </div>
        
        {/* Pending Faults List */}
        <div className="mb-6 sm:mb-8">
          <PendingFaultsList />
        </div>
        
        {/* Filter Bar */}
        <div className="mb-6 sm:mb-8">
          <FilterBar
            setFilterRegion={setFilterRegion}
            setFilterDistrict={setFilterDistrict}
            setFilterStatus={setFilterStatus}
            filterStatus={filterStatus}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            setFilterFaultType={setFilterFaultType}
            setDateRange={setDateRange}
            setSelectedDay={setSelectedDay}
            setSelectedMonth={setSelectedMonth}
            setSelectedMonthYear={setSelectedMonthYear}
            setSelectedYear={setSelectedYear}
            setDateFilterType={setDateFilterType}
            filterFaultType={filterFaultType}
            dateRange={dateRange}
            selectedDay={selectedDay}
            selectedMonth={selectedMonth}
            selectedMonthYear={selectedMonthYear}
            selectedYear={selectedYear}
            dateFilterType={dateFilterType}
          />
        </div>
        
        {/* Enhanced Tabs Section */}
        <Tabs defaultValue="all" className="mt-6 sm:mt-8" onValueChange={(value) => setActiveTab(value as "all" | "op5" | "control")}>
          <div className="flex justify-center mb-6 sm:mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/50 backdrop-blur-sm p-1 rounded-xl border shadow-sm">
            <TabsTrigger 
              value="all"
                className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 hover:bg-muted"
            >
              All Faults
            </TabsTrigger>
            <TabsTrigger 
              value="op5" 
                className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-muted"
            >
                <AlertTriangle size={14} className="mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">OP5</span>
                <span className="sm:hidden">OP5</span>
            </TabsTrigger>
            <TabsTrigger 
              value="control" 
                className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 hover:bg-muted"
            >
                <ZapOff size={14} className="mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Control</span>
                <span className="sm:hidden">Ctrl</span>
            </TabsTrigger>
          </TabsList>
          </div>
          
          <TabsContent value="all" className="mt-0">
            {isLoadingPage ? (
              <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-xl bg-muted/30 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary border-t-transparent mx-auto mb-4"></div>
                <p className="text-sm sm:text-base font-medium text-muted-foreground">Loading dashboard data...</p>
                <p className="text-xs text-muted-foreground mt-1">Please wait</p>
              </div>
            ) : currentPageData.op5Faults.length === 0 && currentPageData.controlOutages.length === 0 ? (
              <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-xl bg-muted/30 backdrop-blur-sm">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base font-medium text-muted-foreground mb-2">No pending faults found</p>
                <p className="text-xs text-muted-foreground mb-4">Try adjusting your filters</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                  if (!isProduction) {
                  console.log('[Dashboard] Clearing filters for user role:', user?.role);
                  }
                  if (user?.role === "global_engineer") {
                    setFilterRegion(undefined);
                    setFilterDistrict(undefined);
                  } else if (user?.role === "regional_engineer") {
                    setFilterDistrict(undefined);
                  }
                  setFilterStatus("pending");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedFaults.map(fault => {
                    const isOP5Fault = currentPageData.op5Faults.some(f => f.id === fault.id);
                    return (
                    <FaultCard 
                        key={`${activeTab}-${fault.id}`} 
                      fault={fault} 
                        type={isOP5Fault ? "op5" : "control"} 
                    />
                    );
                  })}
                </div>

                {/* Enhanced Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-8 mb-16 sm:mb-20 pt-6 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isLoadingPage}
                      className="min-w-[100px] shadow-sm"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border">
                      <span className="text-sm font-medium">
                        Page <span className="text-primary">{currentPage}</span> of {totalPages}
                    </span>
                      {isLoadingPage && (
                        <div className="ml-2 h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages || isLoadingPage}
                      className="min-w-[100px] shadow-sm"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="op5" className="mt-0">
            {isLoadingPage ? (
              <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-xl bg-muted/30 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-orange-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-sm sm:text-base font-medium text-muted-foreground">Loading OP5 faults...</p>
              </div>
            ) : currentPageData.op5Faults.length === 0 ? (
              <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-xl bg-muted/30 backdrop-blur-sm">
                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base font-medium text-muted-foreground mb-2">No pending OP5 faults found</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                  setFilterRegion(undefined);
                  setFilterDistrict(undefined);
                  setFilterStatus("pending");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedFaults.map(fault => (
                    <FaultCard 
                      key={`${activeTab}-${fault.id}`} 
                      fault={fault} 
                      type="op5" 
                    />
                  ))}
                </div>

                {/* Enhanced Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-8 mb-16 sm:mb-20 pt-6 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isLoadingPage}
                      className="min-w-[100px] shadow-sm"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border">
                      <span className="text-sm font-medium">
                        Page <span className="text-orange-500">{currentPage}</span> of {totalPages}
                    </span>
                      {isLoadingPage && (
                        <div className="ml-2 h-3 w-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages || isLoadingPage}
                      className="min-w-[100px] shadow-sm"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="control" className="mt-0">
            {isLoadingPage ? (
              <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-xl bg-muted/30 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-purple-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-sm sm:text-base font-medium text-muted-foreground">Loading control system outages...</p>
              </div>
            ) : currentPageData.controlOutages.length === 0 ? (
              <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-xl bg-muted/30 backdrop-blur-sm">
                <ZapOff className="h-12 w-12 text-purple-500 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base font-medium text-muted-foreground mb-2">No pending control system outages found</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                  setFilterRegion(undefined);
                  setFilterDistrict(undefined);
                  setFilterStatus("pending");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedFaults.map(fault => (
                    <FaultCard 
                      key={`${activeTab}-${fault.id}`} 
                      fault={fault} 
                      type="control" 
                    />
                  ))}
                </div>

                {/* Enhanced Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-8 mb-16 sm:mb-20 pt-6 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isLoadingPage}
                      className="min-w-[100px] shadow-sm"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border">
                      <span className="text-sm font-medium">
                        Page <span className="text-purple-500">{currentPage}</span> of {totalPages}
                    </span>
                      {isLoadingPage && (
                        <div className="ml-2 h-3 w-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages || isLoadingPage}
                      className="min-w-[100px] shadow-sm"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="fixed bottom-4 right-4 z-50">
          <ChatBox />
        </div>
        <AudioPlayer />
      </div>
    </Layout>
  );
}
