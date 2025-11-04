import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { Zap, Users, Clock, MonitorSmartphone } from "lucide-react";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { calculateOutageDuration } from "@/lib/calculations";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export interface StatsOverviewProps {
  op5Faults: OP5Fault[];
  controlOutages: ControlSystemOutage[];
  filterRegion?: string;
  filterDistrict?: string;
}

export function StatsOverview({ op5Faults, controlOutages, filterRegion, filterDistrict }: StatsOverviewProps) {
  const { regions, districts } = useData();
  const [totalFaults, setTotalFaults] = useState(0);
  const [totalOutages, setTotalOutages] = useState(0);
  const [affectedPopulation, setAffectedPopulation] = useState(0);
  const [averageOutageTime, setAverageOutageTime] = useState(0);

  // Get region and district names
  const regionName = filterRegion ? regions.find(r => r.id === filterRegion)?.name : undefined;
  const districtName = filterDistrict ? districts.find(d => d.id === filterDistrict)?.name : undefined;

  useEffect(() => {
    // Filter for pending faults only
    const pendingOp5Faults = op5Faults.filter(fault => fault.status === 'pending');
    const pendingControlOutages = controlOutages.filter(outage => outage.status === 'pending');
    
    // Calculate total pending faults and outages
    setTotalFaults(pendingOp5Faults.length);
    setTotalOutages(pendingControlOutages.length);

    // Calculate total affected population from pending faults only
    let totalAffected = 0;
    pendingOp5Faults.forEach(fault => {
      if (fault.affectedPopulation) {
        totalAffected += fault.affectedPopulation.rural + fault.affectedPopulation.urban + fault.affectedPopulation.metro;
      }
    });
    setAffectedPopulation(totalAffected);

    // Calculate average outage time from pending faults only (in hours)
    let totalDuration = 0;
    const pendingFaultsWithDuration = pendingOp5Faults.filter(fault => 
      fault.occurrenceDate && fault.restorationDate && 
      new Date(fault.restorationDate) > new Date(fault.occurrenceDate)
    );
    
    pendingFaultsWithDuration.forEach(fault => {
      const duration = calculateOutageDuration(fault.occurrenceDate, fault.restorationDate);
      totalDuration += duration;
    });
    
    const avgDuration = pendingFaultsWithDuration.length > 0 ? totalDuration / pendingFaultsWithDuration.length : 0;
    setAverageOutageTime(avgDuration);

  }, [op5Faults, controlOutages]);

  const locationText = districtName 
    ? `in ${districtName}` 
    : regionName 
      ? `in ${regionName}` 
      : "ECG Global";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <Card className="group relative overflow-hidden bg-gradient-to-br from-red-50 via-red-50/50 to-white dark:from-[#2a2325] dark:via-[#2a2325]/80 dark:to-[#1a1a1a] border border-red-200/60 dark:border-red-900/40 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-red-300 dark:hover:border-red-800">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
                Pending Faults
              </CardTitle>
              <p className={cn(
                "text-xs sm:text-sm mt-0.5 transition-colors duration-300 truncate",
                "text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/40 dark:to-red-800/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            Critical OP5 faults awaiting resolution
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={totalFaults} />
          </div>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden bg-gradient-to-br from-orange-50 via-orange-50/50 to-white dark:from-[#2a2820] dark:via-[#2a2820]/80 dark:to-[#1a1a1a] border border-orange-200/60 dark:border-orange-900/40 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-orange-300 dark:hover:border-orange-800">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
                Pending Outages
              </CardTitle>
              <p className={cn(
                "text-xs sm:text-sm mt-0.5 transition-colors duration-300 truncate",
                "text-gray-600 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
              <MonitorSmartphone className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <CardDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            Critical control system outages awaiting resolution
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={totalOutages} />
          </div>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden bg-gradient-to-br from-blue-50 via-blue-50/50 to-white dark:from-[#20232a] dark:via-[#20232a]/80 dark:to-[#1a1a1a] border border-blue-200/60 dark:border-blue-900/40 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-800">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
                Pending Impact
              </CardTitle>
              <p className={cn(
                "text-xs sm:text-sm mt-0.5 transition-colors duration-300 truncate",
                "text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            Population currently affected by pending faults
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={affectedPopulation} formatValue={(val) => val.toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden bg-gradient-to-br from-green-50 via-green-50/50 to-white dark:from-[#202a23] dark:via-[#202a23]/80 dark:to-[#1a1a1a] border border-green-200/60 dark:border-green-900/40 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-green-300 dark:hover:border-green-800">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
                Avg. Resolution Time
              </CardTitle>
              <p className={cn(
                "text-xs sm:text-sm mt-0.5 transition-colors duration-300 truncate",
                "text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
              <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
            Average time to resolve pending faults (hours)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={averageOutageTime} formatValue={(val) => val.toFixed(1)} />
            <span className="text-lg sm:text-xl ml-1 text-muted-foreground">hrs</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
