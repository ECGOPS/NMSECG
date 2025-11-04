import React, { useState, useEffect } from 'react';
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import 'react-day-picker/dist/style.css';
import { CalendarIcon, FilterIcon, XIcon, Filter, RefreshCw } from "lucide-react";
import { format, getYear, getMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { FilterBarProps } from "@/lib/types";
import { DateRange } from "react-day-picker";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

// Define available fault types
const FAULT_TYPES = [
  "Planned",
  "Unplanned",
  "Emergency",
  "Load Shedding",
  "GridCo Outages"
] as const;

// Define type for date filter granularity
type DateFilterType = "range" | "day" | "month" | "year";

// Helper to generate year options
const currentYear = getYear(new Date());
const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);

// Helper for month names
const monthNames = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

// Helper to detect mobile (screen width < 768px)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

export function FilterBar({ 
  setFilterRegion, 
  setFilterDistrict, 
  setFilterStatus, 
  filterStatus, 
  onRefresh, 
  isRefreshing,
  setFilterFaultType,
  setDateRange,
  setSelectedDay,
  setSelectedMonth,
  setSelectedMonthYear,
  setSelectedYear,
  setDateFilterType,
  filterFaultType,
  dateRange,
  selectedDay,
  selectedMonth,
  selectedMonthYear,
  selectedYear,
  dateFilterType
}: Omit<FilterBarProps, 'dateFilterType'> & { dateFilterType: "range" | "day" | "month" | "year" }) {
  const { regions, districts } = useData();
  const { user } = useAzureADAuth();
  
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedFaultType, setSelectedFaultType] = useState<string>("all");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  // Set initial values based on user role
  useEffect(() => {
    if (user) {
      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
          setFilterRegion(userRegion.id);
          
          const userDistrict = districts.find(d => d.name === user.district);
          if (userDistrict) {
            setSelectedDistrict(userDistrict.id);
            setFilterDistrict(userDistrict.id);
          }
        }
      } else if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
          setFilterRegion(userRegion.id);
        }
      } else if (user.role === "ashsubt") {
        // For ashsubt - set default to first allowed Ashanti region
        const ashsubtRegions = regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
        if (ashsubtRegions.length > 0) {
          const defaultRegion = ashsubtRegions[0];
          setSelectedRegion(defaultRegion.id);
          setFilterRegion(defaultRegion.id);
        }
      } else if (user.role === "accsubt") {
        // For accsubt - set default to first allowed Accra region
        const accsubtRegions = regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
        if (accsubtRegions.length > 0) {
          const defaultRegion = accsubtRegions[0];
          setSelectedRegion(defaultRegion.id);
          setFilterRegion(defaultRegion.id);
        }
      }
    }
  }, [user, regions, districts, setFilterRegion, setFilterDistrict]);
  
  // Update filters when selections change
  useEffect(() => {
    setFilterRegion(selectedRegion);
  }, [selectedRegion, setFilterRegion]);
  
  useEffect(() => {
    setFilterDistrict(selectedDistrict);
  }, [selectedDistrict, setFilterDistrict]);
  
  const handleRegionChange = (selectedRegionId: string) => {
    setSelectedRegion(selectedRegionId);
    setSelectedDistrict("");  // Reset district when region changes
  };

  const handleStatusChange = (value: string) => {
    // Cast the string value to the expected type
    setFilterStatus(value as "all" | "pending" | "resolved");
  };
  
  const handleClearFilters = () => {
    // Don't clear region/district for district/regional engineers and technicians
    if (user?.role === "global_engineer" || user?.role === "system_admin") {
      setSelectedRegion("");
      setFilterRegion("");
      setSelectedDistrict("");
      setFilterDistrict("");
    } else if (user?.role === "regional_engineer") {
      setSelectedDistrict("");
      setFilterDistrict("");
    }
    
    setSelectedFaultType("all");
    setFilterStatus("pending");
    setDateFilterType("range");
    setDateRange({ from: undefined, to: undefined });
    setSelectedDay(undefined);
    setSelectedMonth(undefined);
    setSelectedMonthYear(undefined);
    setSelectedYear(undefined);
  };
  
  // Filter regions based on user role
  const filteredRegions = (() => {
    if (!user) return regions;
    
    // Global engineers and system admins can see all regions
    if (user.role === "global_engineer" || user.role === "system_admin") {
      return regions;
    }
    
    // Regional engineers, project engineers, and regional general managers can only see their assigned region
    if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") {
      return regions.filter(r => r.name === user.region);
    }
    
    // Ashsubt users can see all Ashanti regions
    if (user.role === "ashsubt") {
      return regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
    }
    
    // Accsubt users can see all Accra regions
    if (user.role === "accsubt") {
      return regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
    }
    
    // District engineers, district managers and technicians can only see their assigned region
    if (user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") {
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        return regions.filter(r => r.id === userDistrict.regionId);
      }
      return [];
    }
    
    return regions;
  })();
  
  // Filter districts based on selected region and user role
  const filteredDistricts = (() => {
    if (!selectedRegion) {
      // If no region selected and user is ashsubt or accsubt, show districts in their allowed regions
      if (user?.role === "ashsubt") {
        return districts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
      }
      if (user?.role === "accsubt") {
        return districts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
      }
      return [];
    }
    
    return districts.filter(d => {
      // First check if district belongs to selected region
      if (d.regionId !== selectedRegion) return false;
      
      // For district engineers, district managers and technicians, only show their assigned district
      if (user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician") {
        return d.name === user.district;
      }
      
      // For regional engineers, project engineers, regional general managers, ashsubt, and accsubt, show all districts in selected region
      if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager" || user?.role === "ashsubt" || user?.role === "accsubt") {
        return true; // Already filtered by selectedRegion above
      }
      
      // For other roles, show all districts in the selected region
      return true;
    });
  })();
  
  // Handlers for specific date pickers
  const handleDaySelect = (day: Date | undefined) => {
    setSelectedDay(day);
    // Potentially close popover here if needed
  };

  const handleMonthSelect = (monthIndex: string) => {
    setSelectedMonth(parseInt(monthIndex, 10));
  };

  const handleMonthYearSelect = (year: string) => {
     setSelectedMonthYear(parseInt(year, 10));
  };
  
  const handleYearSelect = (year: string) => {
     setSelectedYear(parseInt(year, 10));
  };

  // Get available districts based on selected region
  const availableDistricts = districts.filter(d => d.regionId === selectedRegion);
  
  // Get available fault types
  const faultTypes = FAULT_TYPES;
  
  // Get available months and years
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(2000, i).toLocaleString('default', { month: 'long' })
  }));
  
  // Handle fault type change
  const handleFaultTypeChange = (value: string) => {
    setFilterFaultType(value);
  };
  
  // Handle date filter type change
  const handleDateFilterTypeChange = (value: "range" | "day" | "month" | "year") => {
    setDateFilterType(value);
    // Reset other date filters when changing type
    if (value === "range") {
      setSelectedDay(undefined);
      setSelectedMonth(undefined);
      setSelectedMonthYear(undefined);
      setSelectedYear(undefined);
    } else if (value === "day") {
      setDateRange({ from: undefined, to: undefined });
      setSelectedMonth(undefined);
      setSelectedMonthYear(undefined);
      setSelectedYear(undefined);
    } else if (value === "month") {
      setDateRange({ from: undefined, to: undefined });
      setSelectedDay(undefined);
      setSelectedYear(undefined);
    } else if (value === "year") {
      setDateRange({ from: undefined, to: undefined });
      setSelectedDay(undefined);
      setSelectedMonth(undefined);
      setSelectedMonthYear(undefined);
    }
  };
  
  // Handle month change
  const handleMonthChange = (value: string) => {
    const month = parseInt(value);
    setSelectedMonth(month);
  };
  
  // Handle month year change
  const handleMonthYearChange = (value: string) => {
    const year = parseInt(value);
    setSelectedMonthYear(year);
  };
  
  // Handle year change
  const handleYearChange = (value: string) => {
    const year = parseInt(value);
    setSelectedYear(year);
  };

  const isMobile = useIsMobile();

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium flex items-center">
            <FilterIcon className="mr-2 h-5 w-5" />
            Filter Faults
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearFilters}
            className="h-8 px-2 lg:px-3"
          >
            <XIcon className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        </div>
        
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger 
              value="basic"
              className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors duration-150"
            >
              Basic Filters
            </TabsTrigger>
            <TabsTrigger 
              value="advanced"
              className="data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors duration-150"
            >
              Advanced Filters
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="region-select-basic" className="text-xs text-muted-foreground">Region</Label>
                <Select 
                  value={selectedRegion} 
                  onValueChange={handleRegionChange}
                >
                  <SelectTrigger id="region-select-basic" className="mt-1">
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
              
              <div>
                <Label htmlFor="district-select-basic" className="text-xs text-muted-foreground">District/Section</Label>
                <Select 
                  value={selectedDistrict} 
                  onValueChange={setSelectedDistrict}
                  disabled={!selectedRegion}
                >
                  <SelectTrigger id="district-select-basic" className="mt-1">
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
              
              <div>
                <Label htmlFor="status-select-basic" className="text-xs text-muted-foreground">Status</Label>
                <Select 
                  value={filterStatus} 
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger id="status-select-basic" className="mt-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="fault-type-select" className="text-xs text-muted-foreground">Fault Type</Label>
                <Select value={selectedFaultType} onValueChange={setSelectedFaultType}>
                  <SelectTrigger id="fault-type-select" className="mt-1">
                    <SelectValue placeholder="Fault Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {faultTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="date-filter-type" className="text-xs text-muted-foreground">Filter Period By</Label>
                <Select 
                  value={dateFilterType}
                  onValueChange={(value) => setDateFilterType(value as "range" | "day" | "month" | "year")}
                >
                  <SelectTrigger id="date-filter-type" className="mt-1">
                    <SelectValue placeholder="Select period type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="range">Date Range</SelectItem>
                    <SelectItem value="day">Specific Day</SelectItem>
                    <SelectItem value="month">Specific Month</SelectItem>
                    <SelectItem value="year">Specific Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateFilterType === "range" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1">Date Range</label>
                  {isMobile ? (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="border rounded px-2 py-1 w-full"
                        value={dateRange.from ? dateRange.from.toISOString().slice(0, 10) : ""}
                        onChange={e => {
                          const from = e.target.value ? new Date(e.target.value) : undefined;
                          setDateRange({ from, to: dateRange.to });
                        }}
                      />
                      <input
                        type="date"
                        className="border rounded px-2 py-1 w-full"
                        value={dateRange.to ? dateRange.to.toISOString().slice(0, 10) : ""}
                        onChange={e => {
                          const to = e.target.value ? new Date(e.target.value) : undefined;
                          setDateRange({ from: dateRange.from, to });
                        }}
                      />
                    </div>
                  ) : (
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
                    />
                  )}
                </div>
              )}

              {dateFilterType === "day" && (
                <div>
                  <Label htmlFor="day-picker" className="text-xs text-muted-foreground">Select Day</Label>
                  <input
                    id="day-picker"
                    type="date"
                    className="border rounded px-2 py-1 w-full mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-700"
                    value={selectedDay ? selectedDay.toISOString().split('T')[0] : ''}
                    onChange={e => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      setSelectedDay(date);
                    }}
                  />
                </div>
              )}
              
              {dateFilterType === "month" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="month-select" className="text-xs text-muted-foreground">Month</Label>
                    <Select 
                      value={selectedMonth?.toString() ?? ""} 
                      onValueChange={handleMonthSelect}
                    >
                      <SelectTrigger id="month-select" className="mt-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="month-year-select" className="text-xs text-muted-foreground">Year</Label>
                    <Select 
                      value={selectedMonthYear?.toString() ?? ""} 
                      onValueChange={handleMonthYearSelect}
                    >
                      <SelectTrigger id="month-year-select" className="mt-1">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {dateFilterType === "year" && (
                <div>
                  <Label htmlFor="year-select" className="text-xs text-muted-foreground">Select Year</Label>
                  <Select 
                    value={selectedYear?.toString() ?? ""} 
                    onValueChange={handleYearSelect}
                  >
                    <SelectTrigger id="year-select" className="mt-1">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="md:col-span-3">
                <Button
                  variant="outline"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="w-full mt-4"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh Data"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
