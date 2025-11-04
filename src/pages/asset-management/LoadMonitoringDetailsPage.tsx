import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator"; // Import Separator
import { toast } from "sonner";
import { LoadMonitoringData } from "@/lib/asset-types";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useParams } from "react-router-dom";
import { formatDate } from "@/utils/calculations"; // Import formatDate
import { ArrowLeft } from "lucide-react"; // For back button
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { offlineStorageCompat } from "@/utils/offlineStorage";

// Helper function to format time
const formatTime = (timeStr?: string) => {
  if (!timeStr || typeof timeStr !== 'string' || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
    return 'N/A';
  }
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 'N/A';
    const baseDate = new Date();
    baseDate.setHours(hours, minutes, 0, 0);
    return format(baseDate, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error, timeStr);
    return 'N/A';
  }
};

// Helper component to display a detail item
const DetailItem = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div className="flex flex-col space-y-1.5">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    <p className="text-base">{value ?? 'N/A'}</p>
  </div>
);

// Helper function to calculate warning levels
const calculateWarningLevels = (record: LoadMonitoringData) => {
  // Calculate neutral warning level
  let neutralWarningLevel: "normal" | "warning" | "critical" = "normal";
  let neutralWarningMessage = "";
  
  if (record.calculatedNeutral > record.tenPercentFullLoadNeutral * 2) {
    neutralWarningLevel = "critical";
    neutralWarningMessage = "Critical: Neutral current exceeds 200% of rated neutral";
  } else if (record.calculatedNeutral > record.tenPercentFullLoadNeutral) {
    neutralWarningLevel = "warning";
    neutralWarningMessage = "Warning: Neutral current exceeds rated neutral";
  }
  
  // Calculate phase imbalance and phase currents
  const redPhaseBulkLoad = record.redPhaseBulkLoad || 0;
  const yellowPhaseBulkLoad = record.yellowPhaseBulkLoad || 0;
  const bluePhaseBulkLoad = record.bluePhaseBulkLoad || 0;
  
  const maxPhaseCurrent = Math.max(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad);
  const minPhaseCurrent = Math.max(0, Math.min(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad));
  const avgPhaseCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
  const imbalancePercentage = avgPhaseCurrent > 0 ? ((maxPhaseCurrent - avgPhaseCurrent) / avgPhaseCurrent) * 100 : 0;
  
  // Calculate phase imbalance warning level
  let imbalanceWarningLevel: "normal" | "warning" | "critical" = "normal";
  let imbalanceWarningMessage = "";
  
  if (imbalancePercentage > 20) {
    imbalanceWarningLevel = "critical";
    imbalanceWarningMessage = "Critical: Severe phase imbalance detected";
  } else if (imbalancePercentage > 10) {
    imbalanceWarningLevel = "warning";
    imbalanceWarningMessage = "Warning: Significant phase imbalance detected";
  }
  
  return {
    neutralWarningLevel,
    neutralWarningMessage,
    imbalanceWarningLevel,
    imbalanceWarningMessage,
    imbalancePercentage,
    maxPhaseCurrent,
    minPhaseCurrent,
    avgPhaseCurrent
  };
};

export default function LoadMonitoringDetailsPage() {
  const { getLoadMonitoringRecord } = useData();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [record, setRecord] = useState<(LoadMonitoringData & { isOffline?: boolean; offlineId?: string; syncStatus?: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formattedPercentageLoad, setFormattedPercentageLoad] = useState<string>("0.00");
  const [warningLevels, setWarningLevels] = useState<{
    neutralWarningLevel: "normal" | "warning" | "critical";
    neutralWarningMessage: string;
    imbalanceWarningLevel: "normal" | "warning" | "critical";
    imbalanceWarningMessage: string;
    imbalancePercentage: number;
    maxPhaseCurrent: number;
    minPhaseCurrent: number;
    avgPhaseCurrent: number;
  }>({
    neutralWarningLevel: "normal",
    neutralWarningMessage: "",
    imbalanceWarningLevel: "normal",
    imbalanceWarningMessage: "",
    imbalancePercentage: 0,
    maxPhaseCurrent: 0,
    minPhaseCurrent: 0,
    avgPhaseCurrent: 0
  });

  // Derive problem analysis and recommendations
  const analysis = (() => {
    if (!record) {
      return { issues: [] as string[], recommendation: '', movePlan: [] as any[], worstLeg: null as null | { index: number; phase: 'Red' | 'Yellow' | 'Blue'; overAvgA: number }, legPlans: [] as Array<{ leg: number; moves: Array<{ from: 'Red'|'Yellow'|'Blue'; to: 'Red'|'Yellow'|'Blue'; amountA: number }> }> };
    }

    const issues: string[] = [];

    // Overall overload check
    if (typeof record.percentageLoad === 'number' && record.percentageLoad >= 100) {
      issues.push(`Transformer is overloaded (${record.percentageLoad.toFixed(2)}%).`);
    } else if (typeof record.percentageLoad === 'number' && record.percentageLoad >= 70) {
      issues.push(`High loading level detected (${record.percentageLoad.toFixed(2)}%). Action required.`);
    }

    // Neutral current warnings
    if (warningLevels.neutralWarningLevel === 'critical') {
      issues.push('Critical neutral current: exceeds 200% of rated neutral.');
    } else if (warningLevels.neutralWarningLevel === 'warning') {
      issues.push('Neutral current exceeds rated neutral.');
    }

    // Phase imbalance
    if (warningLevels.imbalanceWarningLevel === 'critical') {
      issues.push(`Severe phase imbalance (${warningLevels.imbalancePercentage.toFixed(1)}%).`);
    } else if (warningLevels.imbalanceWarningLevel === 'warning') {
      issues.push(`Significant phase imbalance (${warningLevels.imbalancePercentage.toFixed(1)}%).`);
    }

    // Identify worst leg and phase
    let worstLegIndex = -1;
    let worstPhase: 'Red' | 'Yellow' | 'Blue' | null = null;
    let worstValue = -Infinity;
    let worstLegOverAvg = 0;
    (record.feederLegs || []).forEach((leg, index) => {
      const entries: Array<{ label: 'Red' | 'Yellow' | 'Blue'; value: number }> = [
        { label: 'Red', value: typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent : 0 },
        { label: 'Yellow', value: typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent : 0 },
        { label: 'Blue', value: typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent : 0 },
      ];
      const maxEntry = entries.reduce((a, b) => (a.value >= b.value ? a : b));
      const legAvg = (entries[0].value + entries[1].value + entries[2].value) / 3;
      if (maxEntry.value > worstValue) {
        worstValue = maxEntry.value;
        worstPhase = maxEntry.label;
        worstLegIndex = index;
        worstLegOverAvg = Math.max(0, maxEntry.value - legAvg);
      }
    });

    if (worstLegIndex >= 0 && worstPhase) {
      // Compare against average phase current if available
      const avg = warningLevels.avgPhaseCurrent || 0;
      if (avg > 0 && worstValue > avg * 1.2) {
        issues.push(`Highest current on Leg ${worstLegIndex + 1} (${worstPhase} phase: ${worstValue.toFixed(2)} A), noticeably above average (${avg.toFixed(2)} A).`);
      } else {
        issues.push(`Highest current observed on Leg ${worstLegIndex + 1} (${worstPhase} phase: ${worstValue.toFixed(2)} A).`);
      }
    }

    // Phase-level load balancing plan (how many amps to shift)
    const phaseTotals = (record.feederLegs || []).reduce(
      (acc, leg) => {
        acc.red += typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent : 0;
        acc.yellow += typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent : 0;
        acc.blue += typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent : 0;
        return acc;
      },
      { red: 0, yellow: 0, blue: 0 }
    );
    const targetPerPhase = (phaseTotals.red + phaseTotals.yellow + phaseTotals.blue) / 3;
    const deficits = {
      yellow: Math.max(0, targetPerPhase - phaseTotals.yellow),
      blue: Math.max(0, targetPerPhase - phaseTotals.blue),
      red: Math.max(0, targetPerPhase - phaseTotals.red)
    };
    const movePlan: Array<{ from: 'Red' | 'Yellow' | 'Blue'; to: Array<{ phase: 'Red' | 'Yellow' | 'Blue'; amountA: number }>; excessA: number }> = [];

    const planFrom = (fromKey: 'red' | 'yellow' | 'blue', toKeys: Array<'red' | 'yellow' | 'blue'>) => {
      const fromTotal = phaseTotals[fromKey];
      const excess = Math.max(0, fromTotal - targetPerPhase);
      if (excess <= 0) return;
      let remaining = excess;
      const to: Array<{ phase: 'Red' | 'Yellow' | 'Blue'; amountA: number }> = [];
      toKeys.forEach(k => {
        if (k === fromKey) return;
        if (remaining <= 0) return;
        const cap = deficits[k];
        const move = Math.min(remaining, cap);
        if (move > 0.01) {
          to.push({ phase: (k.charAt(0).toUpperCase() + k.slice(1)) as 'Red' | 'Yellow' | 'Blue', amountA: Number(move.toFixed(2)) });
          remaining -= move;
        }
      });
      movePlan.push({ from: (fromKey.charAt(0).toUpperCase() + fromKey.slice(1)) as 'Red' | 'Yellow' | 'Blue', to, excessA: Number(excess.toFixed(2)) });
    };

    // Determine which phases are above target and create move suggestions to the ones below target
    planFrom('red', ['yellow', 'blue']);
    planFrom('yellow', ['red', 'blue']);
    planFrom('blue', ['red', 'yellow']);

    // Per-leg move plans: balance within each leg
    const legPlans: Array<{ leg: number; moves: Array<{ from: 'Red'|'Yellow'|'Blue'; to: 'Red'|'Yellow'|'Blue'; amountA: number }> }> = [];
    (record.feederLegs || []).forEach((leg, index) => {
      const red = typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent : 0;
      const yellow = typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent : 0;
      const blue = typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent : 0;
      const avg = (red + yellow + blue) / 3;
      const excessMap: Record<'Red'|'Yellow'|'Blue', number> = {
        Red: Math.max(0, red - avg),
        Yellow: Math.max(0, yellow - avg),
        Blue: Math.max(0, blue - avg)
      };
      const deficitMap: Record<'Red'|'Yellow'|'Blue', number> = {
        Red: Math.max(0, avg - red),
        Yellow: Math.max(0, avg - yellow),
        Blue: Math.max(0, avg - blue)
      };
      const fromPhases = (Object.keys(excessMap) as Array<'Red'|'Yellow'|'Blue'>).filter(p => excessMap[p] > 0.01).sort((a,b) => excessMap[b] - excessMap[a]);
      const toPhases = (Object.keys(deficitMap) as Array<'Red'|'Yellow'|'Blue'>).filter(p => deficitMap[p] > 0.01).sort((a,b) => deficitMap[b] - deficitMap[a]);
      const moves: Array<{ from: 'Red'|'Yellow'|'Blue'; to: 'Red'|'Yellow'|'Blue'; amountA: number }> = [];
      fromPhases.forEach(from => {
        let remaining = excessMap[from];
        toPhases.forEach(to => {
          if (to === from || remaining <= 0) return;
          const take = Math.min(remaining, deficitMap[to]);
          if (take > 0.01) {
            moves.push({ from, to, amountA: Number(take.toFixed(2)) });
            remaining -= take;
            deficitMap[to] = Math.max(0, deficitMap[to] - take);
          }
        });
      });
      if (moves.length > 0) {
        legPlans.push({ leg: index + 1, moves });
      }
    });

    // Build recommendation based on issues
    let recommendation = '';
    const overload = issues.find(i => i.includes('overloaded'));
    const severeImbalance = issues.find(i => i.includes('Severe phase imbalance'));
    const significantImbalance = issues.find(i => i.includes('Significant phase imbalance'));
    const neutralCrit = issues.find(i => i.includes('Critical neutral'));

    if (overload) {
      recommendation = 'Reduce load immediately or consider uprating transformer capacity. Investigate large single-phase loads and redistribute where possible.';
    } else if (neutralCrit || severeImbalance) {
      recommendation = 'Rebalance phases: shift single-phase loads from the heaviest phase to lighter phases. Inspect neutral connections for loose/parallel neutrals.';
    } else if (significantImbalance) {
      recommendation = 'Optimize phase balancing by redistributing feeders/loads across phases; verify service connections on the indicated leg.';
    } else if (worstLegIndex >= 0 && worstPhase) {
      recommendation = `Investigate Leg ${worstLegIndex + 1} (${worstPhase} phase). Check for abnormal single-phase loading, loose joints, or faults; redistribute loads if needed.`;
    } else {
      recommendation = 'No critical issues detected. Continue periodic monitoring and maintain balanced loading across phases.';
    }

    return { issues, recommendation, movePlan, worstLeg: worstLegIndex >= 0 && worstPhase ? { index: worstLegIndex, phase: worstPhase, overAvgA: Number(worstLegOverAvg.toFixed(2)) } : null, legPlans };
  })();

  useEffect(() => {
    let isMounted = true;

    const fetchRecordData = async () => {
      if (!id || !getLoadMonitoringRecord) {
        toast.error("Invalid record ID or data context unavailable.");
        navigate("/asset-management/load-monitoring");
        return;
      }
      
      try {
        const fetchedRecord = await getLoadMonitoringRecord(id);
        
        if (!isMounted) return;
        
        if (fetchedRecord) {
          setRecord(fetchedRecord);
          setFormattedPercentageLoad(fetchedRecord.percentageLoad?.toFixed(2) ?? "0.00");
          setWarningLevels(calculateWarningLevels(fetchedRecord));
        } else {
          // If not found in main store, check offline storage
          try {
            const storedData = await offlineStorageCompat.getStoredLoadMonitoringForViewing();
            const offlineRecord = storedData.find(offline => offline.id === id);
            
            if (offlineRecord) {
              const formattedRecord = {
                ...offlineRecord,
                isOffline: true,
                offlineId: offlineRecord.id,
                syncStatus: 'pending'
              } as LoadMonitoringData & { isOffline: boolean; offlineId: string; syncStatus: string };
              
              setRecord(formattedRecord);
              setFormattedPercentageLoad(formattedRecord.percentageLoad?.toFixed(2) ?? "0.00");
              setWarningLevels(calculateWarningLevels(formattedRecord));
            } else {
              toast.error("Load monitoring record not found.");
              navigate("/asset-management/load-monitoring");
            }
          } catch (offlineError) {
            console.error("Error checking offline storage:", offlineError);
            toast.error("Load monitoring record not found.");
            navigate("/asset-management/load-monitoring");
          }
        }
      } catch (error) {
        console.error("Error fetching load monitoring record:", error);
        if (isMounted) {
          toast.error("Failed to load record details.");
          navigate("/asset-management/load-monitoring");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRecordData();

    return () => {
      isMounted = false;
    };
  }, [id, getLoadMonitoringRecord, navigate]);

  // Listen for offline sync completion to handle ID mapping
  useEffect(() => {
    const handleOfflineSyncCompleted = (event: CustomEvent) => {
      console.log('[LoadMonitoringDetailsPage] Offline sync completed:', event.detail);
      // Refresh the page to show updated data
      window.location.reload();
    };

    window.addEventListener('offlineSyncCompleted', handleOfflineSyncCompleted as EventListener);
    
    return () => {
      window.removeEventListener('offlineSyncCompleted', handleOfflineSyncCompleted as EventListener);
    };
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="icon" onClick={() => navigate("/asset-management/load-monitoring")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-8 w-64 bg-muted animate-pulse rounded"></div>
            <div className="w-10"></div>
          </div>

          <div className="grid gap-6">
            {/* Loading skeleton for Basic Information Card */}
            <Card>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                    <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Loading skeleton for Feeder Legs Card */}
            <Card>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="border p-4 rounded-md">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded mb-3"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="space-y-2">
                          <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                          <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Loading skeleton for Calculated Load Information Card */}
            <Card>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                    <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (!record) {
    return <Layout><div>Record not found.</div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
           <Button variant="outline" size="icon" onClick={() => navigate("/asset-management/load-monitoring")}>
             <ArrowLeft className="h-4 w-4" />
           </Button>
           <h1 className="text-2xl font-bold tracking-tight">Load Monitoring Record Details</h1>
           {record.isOffline ? (
             <span className="inline-flex items-center px-4 py-2 bg-warning text-white rounded-md text-sm">
               Offline Record
             </span>
           ) : (
             <Button onClick={() => navigate(`/asset-management/load-monitoring/edit/${record.id}`)}>
               Edit
             </Button>
           )}
        </div>

        <div className="grid gap-4 sm:gap-6">
            {/* Basic Information Card */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                 <DetailItem label="Date" value={formatDate(record.date)} />
                 <DetailItem label="Time" value={formatTime(record.time)} />
                 <DetailItem label="Region" value={record.region} />
                 <DetailItem label="District/Section" value={record.district} />
                 <DetailItem label="Substation Name" value={record.substationName} />
                 <DetailItem label="Substation Number" value={record.substationNumber} />
                 <DetailItem label="Location" value={record.location} />
                 <DetailItem label="GPS Location" value={record.gpsLocation || 'N/A'} />
                 <DetailItem label="Ownership" value={(record as any).ownership || 'N/A'} />
                 <DetailItem label="Voltage Level" value={record.voltageLevel || 'N/A'} />
                 <DetailItem label="Rating (kVA)" value={record.rating} />
                 <DetailItem label="Peak Load Status" value={record.peakLoadStatus} />
                 <div className="flex flex-col space-y-1">
                   <Label className="text-sm font-medium text-muted-foreground">Load Status</Label>
                   <Badge className={`w-fit ${
                     record.percentageLoad >= 70 ? "bg-red-500" :
                     record.percentageLoad >= 45 ? "bg-yellow-500" :
                     "bg-green-500"
                   }`}>
                     {record.percentageLoad >= 70 ? "OVERLOAD" :
                      record.percentageLoad >= 45 ? "AVERAGE" :
                      "OKAY"}
                   </Badge>
                 </div>
                 <DetailItem label="Created By" value={record.createdBy?.name || 'Unknown'} />
                 <DetailItem label="Updated By" value={`${record.updatedBy?.name || record.createdBy?.name || 'Unknown'} (${isValidDate(record.updatedAt) ? format(new Date(record.updatedAt), 'MMM d, yyyy h:mm a') : 'N/A'})`} />
              </CardContent>
            </Card>

            {/* Feeder Legs Card */}
             <Card>
              <CardHeader>
                <CardTitle>Feeder Legs Current (Amps)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  {record.feederLegs?.map((leg, index) => (
                    <div key={leg.id} className="border p-4 rounded-md">
                       <Label className="block font-medium mb-3">Feeder Leg {index + 1}</Label>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           <DetailItem label="Red Phase" value={typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent.toFixed(2) : 'N/A'} />
                           <DetailItem label="Yellow Phase" value={typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent.toFixed(2) : 'N/A'} />
                           <DetailItem label="Blue Phase" value={typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent.toFixed(2) : 'N/A'} />
                           <DetailItem label="Neutral" value={typeof leg.neutralCurrent === 'number' ? leg.neutralCurrent.toFixed(2) : 'N/A'} />
                       </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Calculated Load Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Calculated Load Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <DetailItem label="Rated Load (A)" value={record.ratedLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Avg. Current (A)" value={record.averageCurrent?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="% Load" value={`${formattedPercentageLoad} %`} />
                <div className="flex flex-col space-y-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">Calculated Neutral (A)</Label>
                  <p className={`text-base ${
                    warningLevels.neutralWarningLevel === "critical" ? "text-red-500" : 
                    warningLevels.neutralWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {record.calculatedNeutral?.toFixed(2) ?? 'N/A'}
                  </p>
                  {warningLevels.neutralWarningMessage && (
                    <p className={`text-sm ${
                      warningLevels.neutralWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {warningLevels.neutralWarningMessage}
                    </p>
                  )}
                </div>
                <DetailItem label="10% Rated Neutral (A)" value={record.tenPercentFullLoadNeutral?.toFixed(2) ?? 'N/A'} />
                <div className="flex flex-col space-y-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">Phase Imbalance (%)</Label>
                  <p className={`text-base ${
                    warningLevels.imbalanceWarningLevel === "critical" ? "text-red-500" : 
                    warningLevels.imbalanceWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {warningLevels.imbalancePercentage.toFixed(2)}%
                  </p>
                  {warningLevels.imbalanceWarningMessage && (
                    <p className={`text-sm ${
                      warningLevels.imbalanceWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {warningLevels.imbalanceWarningMessage}
                    </p>
                  )}
                </div>
                <DetailItem label="Red Phase Bulk (A)" value={record.redPhaseBulkLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Yellow Phase Bulk (A)" value={record.yellowPhaseBulkLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Blue Phase Bulk (A)" value={record.bluePhaseBulkLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Max Phase Current (A)" value={warningLevels.maxPhaseCurrent.toFixed(2)} />
                <DetailItem label="Min Phase Current (A)" value={warningLevels.minPhaseCurrent.toFixed(2)} />
                <DetailItem label="Avg Phase Current (A)" value={warningLevels.avgPhaseCurrent.toFixed(2)} />
              </CardContent>
            </Card>

            {/* Problem Analysis & Recommendations */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800 dark:to-blue-900/30">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-800 dark:to-blue-900/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">Problem Analysis & Recommendations</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400 font-medium">Clear indication of where the issue is and what to do next</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Issues Section */}
                {analysis.issues.length > 0 ? (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full">
                        <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <Label className="text-sm font-semibold text-red-800 dark:text-red-300">Detected Issues</Label>
                    </div>
                    <ul className="space-y-2">
                      {analysis.issues.map((issue, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 bg-red-500 dark:bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-red-700 dark:text-red-300 font-medium">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 bg-green-100 dark:bg-green-900/50 rounded-full">
                        <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-green-800 dark:text-green-300">No issues detected based on current measurements.</span>
                    </div>
                  </div>
                )}

                {/* Worst Leg Section */}
                {analysis.worstLeg && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="p-1 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                        <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <Label className="text-sm font-semibold text-amber-800 dark:text-amber-300">Leg Needing Balancing</Label>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-md p-3 border border-amber-100 dark:border-amber-800/50">
                      <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                        <span className="font-bold">Leg {analysis.worstLeg.index + 1}</span> shows the highest phase loading on the{' '}
                        <span className="font-bold text-amber-800 dark:text-amber-200">{analysis.worstLeg.phase}</span> phase{' '}
                        <span className="font-bold">(≈ {analysis.worstLeg.overAvgA} A above that leg's average)</span>. 
                        Prioritize moving single-phase customers off this phase on this leg.
                      </p>
                    </div>
                  </div>
                )}

                {/* Load Balancing Plan Section */}
                {analysis.movePlan && analysis.movePlan.filter(p => p.excessA > 0 && p.to.length > 0).length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                        <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <Label className="text-sm font-semibold text-blue-800 dark:text-blue-300">Load Balancing Plan (Phase Level)</Label>
                    </div>
                    <div className="space-y-3">
                      {analysis.movePlan.filter(p => p.excessA > 0 && p.to.length > 0).map((p, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-md p-3 border border-blue-100 dark:border-blue-800/50">
                          <div className="flex items-start space-x-2">
                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                Move <span className="font-bold text-blue-800 dark:text-blue-200">~{p.to.map(t => `${t.amountA} A to ${t.phase}`).join(' and ')}</span> from{' '}
                                <span className="font-bold text-blue-800 dark:text-blue-200">{p.from} phase</span> (excess ≈{' '}
                                <span className="font-bold text-blue-800 dark:text-blue-200">{p.excessA} A</span>) to approach balanced phases.
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/50 rounded-md">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        <span className="font-semibold">Note:</span> Amps shown are estimated to reach the average phase loading. 
                        Adjust in the field based on practical feeder topology and customer grouping.
                      </p>
                    </div>
                  </div>
                )}

                {/* Per-Leg Balancing Suggestions */}
                {analysis.legPlans && analysis.legPlans.length > 0 && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="p-1 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                        <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <Label className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Per-Leg Balancing Suggestions</Label>
                    </div>
                    <div className="space-y-3">
                      {analysis.legPlans.map((lp, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-md p-3 border border-indigo-100 dark:border-indigo-800/50">
                          <div className="flex items-start space-x-2">
                            <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                                <span className="font-bold text-indigo-800 dark:text-indigo-200">Leg {lp.leg}:</span> move{' '}
                                <span className="font-bold text-indigo-800 dark:text-indigo-200">
                                  {lp.moves.map(m => `${m.amountA} A from ${m.from} to ${m.to}`).join(' and ')}
                                </span>.
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-md">
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                        <span className="font-semibold">Priority:</span> Shift single-phase customers within each leg as indicated above for precise balancing.
                      </p>
                    </div>
                  </div>
                )}

                {/* Final Recommendation */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded-full">
                      <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Final Recommendation</Label>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-md p-4 border border-slate-100 dark:border-slate-700">
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{analysis.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

             <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={() => navigate("/asset-management/load-monitoring")}>
                    Back to List
                </Button>
            </div>
        </div>
      </div>
    </Layout>
  );
}

// Helper to check if a date string is valid
function isValidDate(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}
