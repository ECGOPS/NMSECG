import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { FeederLeg, LoadMonitoringData } from "@/lib/asset-types";
import { Region, District } from "@/lib/types"; // Import Region and District types
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useParams } from "react-router-dom";
import { useLoadMonitoringOfflineCRUD } from "@/hooks/useLoadMonitoringOfflineCRUD";

export default function EditLoadMonitoringPage() {
  const { user } = useAzureADAuth();
  const { getLoadMonitoringRecord, updateLoadMonitoringRecord, regions, districts } = useData(); // Get regions & districts
  const { updateRecord, isOnline } = useLoadMonitoringOfflineCRUD(); // Use offline CRUD
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // State for filtered districts based on selected region
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);

  const [formData, setFormData] = useState<Partial<LoadMonitoringData>>({
    feederLegs: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const [loadInfo, setLoadInfo] = useState<{
    ratedLoad: number;
    redPhaseBulkLoad: number;
    yellowPhaseBulkLoad: number;
    bluePhaseBulkLoad: number;
    averageCurrent: number;
    percentageLoad: number;
    tenPercentFullLoadNeutral: number;
    calculatedNeutral: number;
    neutralWarningLevel: "normal" | "warning" | "critical";
    neutralWarningMessage: string;
    imbalancePercentage: number;
    imbalanceWarningLevel: "normal" | "warning" | "critical";
    imbalanceWarningMessage: string;
    maxPhaseCurrent: number;
    minPhaseCurrent: number;
    avgPhaseCurrent: number;
  }>({
    ratedLoad: 0,
    redPhaseBulkLoad: 0,
    yellowPhaseBulkLoad: 0,
    bluePhaseBulkLoad: 0,
    averageCurrent: 0,
    percentageLoad: 0,
    tenPercentFullLoadNeutral: 0,
    calculatedNeutral: 0,
    neutralWarningLevel: "normal",
    neutralWarningMessage: "",
    imbalancePercentage: 0,
    imbalanceWarningLevel: "normal",
    imbalanceWarningMessage: "",
    maxPhaseCurrent: 0,
    minPhaseCurrent: 0,
    avgPhaseCurrent: 0
  });

  // Fetch existing record data and set initial dropdown state
  useEffect(() => {
    const initializeRecord = async () => {
      if (id && getLoadMonitoringRecord && regions && districts) {
        try {
          const record = await getLoadMonitoringRecord(id);
          if (record) {
            // Find the region and district IDs based on their names
            const existingRegion = regions.find(r => r.name === record.region);
            const existingDistrict = districts.find(d => d.name === record.district && d.regionId === existingRegion?.id);
            
            if (existingRegion) {
              // Set region and filter districts
              setFormData(prev => ({
                ...record,
                regionId: existingRegion.id,
                region: record.region
              }));
              
              // Filter districts for the selected region
              const regionDistricts = districts.filter(d => d.regionId === existingRegion.id);
              setFilteredDistricts(regionDistricts);
              
              // Set district if found
              if (existingDistrict) {
                setFormData(prev => ({
                  ...prev,
                  districtId: existingDistrict.id,
                  district: record.district
                }));
              }
            } else {
              // Region from record not found? Reset both.
              setFormData(prev => ({ ...prev, regionId: "", region: "", districtId: "", district: "" }));
              setFilteredDistricts([]);
            }
          } else {
            toast.error("Load monitoring record not found.");
            navigate("/asset-management/load-monitoring");
          }
        } catch (error) {
          console.error("Error loading record:", error);
          toast.error("Failed to load record. Please try again.");
          navigate("/asset-management/load-monitoring");
        }
        setIsLoading(false);
      } else if (!isLoading && (!regions || !districts)) {
          toast.error("Region/District data not loaded. Cannot edit.");
          navigate("/asset-management/load-monitoring");
          setIsLoading(false);
      } else if (!isLoading && !id) { // Added check for missing ID after loading
          toast.error("Invalid record ID.");
          navigate("/asset-management/load-monitoring");
          setIsLoading(false);
      }
    };

    initializeRecord();
  }, [id, getLoadMonitoringRecord, regions, districts, navigate, isLoading]);

  // --- Form Handling Functions ---
  const addFeederLeg = () => {
    if ((formData.feederLegs?.length || 0) >= 8) {
      toast.warning("Maximum of 8 feeder legs allowed");
      return;
    }
    setFormData(prev => ({
      ...prev,
      feederLegs: [
        ...(prev.feederLegs || []),
        {
          id: uuidv4(),
          redPhaseCurrent: 0,
          yellowPhaseCurrent: 0,
          bluePhaseCurrent: 0,
          neutralCurrent: 0
        }
      ]
    }));
  };

  const removeFeederLeg = (legId: string) => {
    if ((formData.feederLegs?.length || 0) <= 1) {
      toast.warning("At least one feeder leg is required");
      return;
    }
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.filter(leg => leg.id !== legId) || []
    }));
  };

 const updateFeederLeg = (legId: string, field: keyof FeederLeg, value: string) => {
    // Validate input: maximum 3 digits before decimal point, preserve decimal places
    const validateNumericInput = (input: string): string => {
      if (input === '') return '';
      
      // Allow only numbers, decimal point, and minus sign
      const cleanInput = input.replace(/[^0-9.-]/g, '');
      
      // Split by decimal point
      const parts = cleanInput.split('.');
      
      // If there's a decimal point, limit integer part to 3 digits
      if (parts.length === 2) {
        const integerPart = parts[0];
        const decimalPart = parts[1];
        
        // Limit integer part to 3 digits
        if (integerPart.length > 3) {
          return parts[0].substring(0, 3) + '.' + parts[1];
        }
        
        return cleanInput;
      } else if (parts.length === 1) {
        // No decimal point, limit to 3 digits
        if (cleanInput.length > 3) {
          return cleanInput.substring(0, 3);
        }
        return cleanInput;
      }
      
      return cleanInput;
    };

    const validatedValue = validateNumericInput(value);
    const numericValue = validatedValue === '' ? 0 : parseFloat(validatedValue);
    
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.map(leg =>
        leg.id === legId ? { ...leg, [field]: isNaN(numericValue) ? validatedValue : numericValue } : leg
      ) || []
    }));
  };

  const handleInputChange = (field: keyof LoadMonitoringData, value: any) => {
    if (field === 'region' || field === 'district') return;
     if (field === 'rating') {
       setFormData(prev => ({
        ...prev,
        [field]: value === '' ? undefined : Number(value)
      }));
    } else {
       setFormData(prev => ({
         ...prev,
         [field]: value
       }));
    }
  };

  // Handle Region Change
  const handleRegionChange = (regionId: string) => {
    const selectedRegion = regions?.find(r => r.id === regionId);
    if (selectedRegion && districts) {
      const regionDistricts = districts.filter(d => d.regionId === regionId);
      setFilteredDistricts(regionDistricts);
      setFormData(prev => ({
        ...prev,
        regionId: regionId,
        region: selectedRegion.name,
        districtId: "",
        district: ""
      }));
    } else {
      setFilteredDistricts([]);
      setFormData(prev => ({ 
        ...prev, 
        regionId: "", 
        region: "", 
        districtId: "", 
        district: "" 
      }));
    }
  };

  // Handle District Change
  const handleDistrictChange = (districtId: string) => {
    const selectedDistrict = districts?.find(d => d.id === districtId);
    if (selectedDistrict) {
      setFormData(prev => ({ 
        ...prev, 
        districtId: districtId,
        district: selectedDistrict.name
      }));
    }
  };

  // --- Load Calculation Logic ---
   useEffect(() => {
    if (isLoading) return;

    const rating = Number(formData.rating);
    const feederLegs = formData.feederLegs || [];

    const areFeederCurrentsValid = feederLegs.every(leg =>
        typeof leg.redPhaseCurrent === 'number' && !isNaN(leg.redPhaseCurrent) &&
        typeof leg.yellowPhaseCurrent === 'number' && !isNaN(leg.yellowPhaseCurrent) &&
        typeof leg.bluePhaseCurrent === 'number' && !isNaN(leg.bluePhaseCurrent) &&
        typeof leg.neutralCurrent === 'number' && !isNaN(leg.neutralCurrent)
    );

    if (isNaN(rating) || rating <= 0 || feederLegs.length === 0 || !areFeederCurrentsValid) {
      setLoadInfo({
        ratedLoad: 0, redPhaseBulkLoad: 0, yellowPhaseBulkLoad: 0, bluePhaseBulkLoad: 0,
        averageCurrent: 0, percentageLoad: 0, tenPercentFullLoadNeutral: 0, calculatedNeutral: 0,
        neutralWarningLevel: "normal",
        neutralWarningMessage: "",
        imbalancePercentage: 0,
        imbalanceWarningLevel: "normal",
        imbalanceWarningMessage: "",
        maxPhaseCurrent: 0,
        minPhaseCurrent: 0,
        avgPhaseCurrent: 0
      });
      return;
    }

    const redPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.redPhaseCurrent), 0);
    const yellowPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.yellowPhaseCurrent), 0);
    const bluePhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.bluePhaseCurrent), 0);

    const averageCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
    const ratedLoad = rating * 1.334;
    const percentageLoad = ratedLoad > 0 ? (averageCurrent * 100) / ratedLoad : 0;
    const tenPercentFullLoadNeutral = 0.1 * ratedLoad;

    // Standard neutral current calculation for three-phase systems
    console.log("Calculating neutral with standard formula:", {
      redPhaseBulkLoad,
      yellowPhaseBulkLoad,
      bluePhaseBulkLoad
    });
    
    // Standard formula: In = √(IR² + IY² + IB² - IR·IY - IR·IB - IY·IB)
    const calculatedNeutral = Math.sqrt(
      Math.max(0,
        Math.pow(redPhaseBulkLoad, 2) + 
        Math.pow(yellowPhaseBulkLoad, 2) + 
        Math.pow(bluePhaseBulkLoad, 2) - 
        (redPhaseBulkLoad * yellowPhaseBulkLoad) - 
        (redPhaseBulkLoad * bluePhaseBulkLoad) - 
        (yellowPhaseBulkLoad * bluePhaseBulkLoad)
      )
    );
    
    console.log("Calculated neutral result:", calculatedNeutral);

    // Calculate phase imbalance analysis
    const maxPhaseCurrent = Math.max(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad);
    const minPhaseCurrent = Math.max(0, Math.min(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad));
    const avgPhaseCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
    const imbalancePercentage = avgPhaseCurrent > 0 ? ((maxPhaseCurrent - avgPhaseCurrent) / avgPhaseCurrent) * 100 : 0;
    
    // Determine neutral current warning level
    let neutralWarningLevel: "normal" | "warning" | "critical" = "normal";
    let neutralWarningMessage = "";
    
    if (calculatedNeutral > tenPercentFullLoadNeutral * 2) {
      neutralWarningLevel = "critical";
      neutralWarningMessage = "Critical: Neutral current exceeds 200% of rated neutral";
    } else if (calculatedNeutral > tenPercentFullLoadNeutral) {
      neutralWarningLevel = "warning";
      neutralWarningMessage = "Warning: Neutral current exceeds rated neutral";
    }
    
    // Determine phase imbalance warning level
    let imbalanceWarningLevel: "normal" | "warning" | "critical" = "normal";
    let imbalanceWarningMessage = "";
    
    if (imbalancePercentage > 20) {
      imbalanceWarningLevel = "critical";
      imbalanceWarningMessage = "Critical: Severe phase imbalance detected";
    } else if (imbalancePercentage > 10) {
      imbalanceWarningLevel = "warning";
      imbalanceWarningMessage = "Warning: Significant phase imbalance detected";
    }

    setLoadInfo({
      ratedLoad,
      redPhaseBulkLoad,
      yellowPhaseBulkLoad,
      bluePhaseBulkLoad,
      averageCurrent,
      percentageLoad,
      tenPercentFullLoadNeutral,
      calculatedNeutral: isNaN(calculatedNeutral) ? 0 : calculatedNeutral,
      neutralWarningLevel,
      neutralWarningMessage,
      imbalancePercentage,
      imbalanceWarningLevel,
      imbalanceWarningMessage,
      maxPhaseCurrent,
      minPhaseCurrent,
      avgPhaseCurrent
    });
  }, [formData.rating, formData.feederLegs, isLoading]);

  // Problem analysis & recommendations for edit page
  const analysis = useMemo(() => {
    const feederLegs = formData.feederLegs || [];
    const safeNum = (v: any) => (v === '' || isNaN(Number(v))) ? 0 : Number(v);
    const issues: string[] = [];
    if (loadInfo.percentageLoad >= 100) issues.push(`Transformer is overloaded (${loadInfo.percentageLoad.toFixed(2)}%).`);
    else if (loadInfo.percentageLoad >= 70) issues.push(`High loading level detected (${loadInfo.percentageLoad.toFixed(2)}%). Action required.`);
    if (loadInfo.neutralWarningLevel === 'critical') issues.push('Critical neutral current: exceeds 200% of rated neutral.');
    else if (loadInfo.neutralWarningLevel === 'warning') issues.push('Neutral current exceeds rated neutral.');
    if (loadInfo.imbalanceWarningLevel === 'critical') issues.push(`Severe phase imbalance (${loadInfo.imbalancePercentage.toFixed(1)}%).`);
    else if (loadInfo.imbalanceWarningLevel === 'warning') issues.push(`Significant phase imbalance (${loadInfo.imbalancePercentage.toFixed(1)}%).`);
    let worstLegIndex = -1; let worstPhase: 'Red'|'Yellow'|'Blue' | null = null; let worstValue = -Infinity; let worstOverAvg = 0;
    feederLegs.forEach((leg, idx) => {
      const red = safeNum(leg.redPhaseCurrent); const yellow = safeNum(leg.yellowPhaseCurrent); const blue = safeNum(leg.bluePhaseCurrent);
      const entries = [ {label:'Red' as const, value:red}, {label:'Yellow' as const, value:yellow}, {label:'Blue' as const, value:blue} ];
      const maxEntry = entries.reduce((a,b)=> a.value>=b.value?a:b);
      const avg = (red+yellow+blue)/3;
      if (maxEntry.value > worstValue) { worstValue = maxEntry.value; worstPhase = maxEntry.label; worstLegIndex = idx; worstOverAvg = Math.max(0, maxEntry.value - avg); }
    });
    if (worstLegIndex >= 0 && worstPhase) issues.push(`Highest current on Leg ${worstLegIndex+1} (${worstPhase} phase: ${worstValue.toFixed(2)} A).`);
    const phaseTotals = feederLegs.reduce((acc, leg) => { acc.red += safeNum(leg.redPhaseCurrent); acc.yellow += safeNum(leg.yellowPhaseCurrent); acc.blue += safeNum(leg.bluePhaseCurrent); return acc; }, {red:0, yellow:0, blue:0});
    const targetPerPhase = (phaseTotals.red + phaseTotals.yellow + phaseTotals.blue)/3;
    const deficits = { red: Math.max(0, targetPerPhase - phaseTotals.red), yellow: Math.max(0, targetPerPhase - phaseTotals.yellow), blue: Math.max(0, targetPerPhase - phaseTotals.blue) };
    const movePlan: Array<{ from:'Red'|'Yellow'|'Blue'; to:Array<{phase:'Red'|'Yellow'|'Blue'; amountA:number}>; excessA:number }> = [];
    const addPlan = (fromKey: 'red'|'yellow'|'blue', toKeys: Array<'red'|'yellow'|'blue'>) => {
      const excess = Math.max(0, phaseTotals[fromKey] - targetPerPhase);
      if (excess <= 0.01) return; let remaining = excess; const to: Array<{phase:'Red'|'Yellow'|'Blue'; amountA:number}> = [];
      toKeys.forEach(k=>{ if (k===fromKey||remaining<=0) return; const cap = deficits[k]; const mv = Math.min(remaining, cap); if (mv>0.01){ to.push({phase:(k.charAt(0).toUpperCase()+k.slice(1)) as any, amountA:Number(mv.toFixed(2))}); remaining -= mv; }});
      movePlan.push({ from: (fromKey.charAt(0).toUpperCase()+fromKey.slice(1)) as any, to, excessA: Number(excess.toFixed(2)) });
    };
    addPlan('red',['yellow','blue']); addPlan('yellow',['red','blue']); addPlan('blue',['red','yellow']);
    const legPlans: Array<{ leg:number; moves: Array<{from:'Red'|'Yellow'|'Blue'; to:'Red'|'Yellow'|'Blue'; amountA:number}> }> = [];
    feederLegs.forEach((leg, idx) => {
      const red = safeNum(leg.redPhaseCurrent); const yellow = safeNum(leg.yellowPhaseCurrent); const blue = safeNum(leg.bluePhaseCurrent);
      const avg = (red+yellow+blue)/3;
      const excess = { Red: Math.max(0, red-avg), Yellow: Math.max(0, yellow-avg), Blue: Math.max(0, blue-avg) };
      const deficit = { Red: Math.max(0, avg-red), Yellow: Math.max(0, avg-yellow), Blue: Math.max(0, avg-blue) };
      const fromPh = (Object.keys(excess) as Array<'Red'|'Yellow'|'Blue'>).filter(p=>excess[p]>0.01).sort((a,b)=>excess[b]-excess[a]);
      const toPh = (Object.keys(deficit) as Array<'Red'|'Yellow'|'Blue'>).filter(p=>deficit[p]>0.01).sort((a,b)=>deficit[b]-deficit[a]);
      const moves: Array<{from:'Red'|'Yellow'|'Blue'; to:'Red'|'Yellow'|'Blue'; amountA:number}> = [];
      fromPh.forEach(f=>{ let rem = excess[f]; toPh.forEach(t=>{ if (t===f||rem<=0) return; const mv = Math.min(rem, deficit[t]); if (mv>0.01){ moves.push({from:f,to:t,amountA:Number(mv.toFixed(2))}); rem-=mv; deficit[t]=Math.max(0,deficit[t]-mv);} }); });
      if (moves.length>0) legPlans.push({ leg: idx+1, moves });
    });
    return {
      issues,
      worstLeg: worstLegIndex>=0 && worstPhase ? { index: worstLegIndex, phase: worstPhase, overAvgA: Number(worstOverAvg.toFixed(2)) } : null,
      movePlan,
      legPlans,
      recommendation: issues.find(i=>i.includes('overloaded')) ? 'Reduce load immediately or consider uprating transformer capacity. Investigate large single-phase loads and redistribute where possible.' : (issues.find(i=>i.includes('Severe phase imbalance')) || issues.find(i=>i.includes('Neutral'))) ? 'Rebalance phases and inspect neutral connections; shift single-phase loads off the heaviest phase.' : 'No critical issues detected. Maintain balanced loading and continue monitoring.'
    };
  }, [loadInfo, formData.feederLegs]);


  // --- Form Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
        toast.error("Record ID is missing. Cannot update.");
        return;
    }

    const invalidFeeder = formData.feederLegs?.find(leg =>
        isNaN(Number(leg.redPhaseCurrent)) || isNaN(Number(leg.yellowPhaseCurrent)) ||
        isNaN(Number(leg.bluePhaseCurrent)) || isNaN(Number(leg.neutralCurrent))
    );

    if (invalidFeeder) {
        toast.error("Please ensure all feeder leg currents are valid numbers.");
        return;
    }

    if (!formData.date || !formData.time || !formData.regionId || !formData.districtId || !formData.substationName || !formData.substationNumber || formData.rating === undefined || formData.rating <= 0 || !formData.feederLegs) {
      toast.error("Please fill all required fields, including a valid rating (KVA > 0).");
      return;
    }

    // Get region and district names from IDs
    const region = regions?.find(r => r.id === formData.regionId);
    const district = districts?.find(d => d.id === formData.districtId);

    if (!region || !district) {
      toast.error("Invalid region or district selected.");
      return;
    }

    const processedFeederLegs = formData.feederLegs.map(leg => ({
        ...leg,
        redPhaseCurrent: Number(leg.redPhaseCurrent),
        yellowPhaseCurrent: Number(leg.yellowPhaseCurrent),
        bluePhaseCurrent: Number(leg.bluePhaseCurrent),
        neutralCurrent: Number(leg.neutralCurrent),
    }));

    const completeData: LoadMonitoringData = {
      id: id,
      date: formData.date,
      time: formData.time,
      regionId: formData.regionId,
      districtId: formData.districtId,
      region: region.name,
      district: district.name,
      substationName: formData.substationName,
      substationNumber: formData.substationNumber,
      location: formData.location || "",
      gpsLocation: formData.gpsLocation || "", // Add gpsLocation to completeData
      rating: formData.rating,
      peakLoadStatus: formData.peakLoadStatus || "day",
      ownership: (formData.ownership as 'public' | 'private') || 'public', // Add ownership to completeData
      voltageLevel: formData.voltageLevel,
      feederLegs: processedFeederLegs,
      ratedLoad: loadInfo.ratedLoad,
      redPhaseBulkLoad: loadInfo.redPhaseBulkLoad,
      yellowPhaseBulkLoad: loadInfo.yellowPhaseBulkLoad,
      bluePhaseBulkLoad: loadInfo.bluePhaseBulkLoad,
      averageCurrent: loadInfo.averageCurrent,
      percentageLoad: loadInfo.percentageLoad,
      tenPercentFullLoadNeutral: loadInfo.tenPercentFullLoadNeutral,
      calculatedNeutral: loadInfo.calculatedNeutral,
      neutralWarningLevel: loadInfo.neutralWarningLevel,
      neutralWarningMessage: loadInfo.neutralWarningMessage,
      imbalancePercentage: loadInfo.imbalancePercentage,
      imbalanceWarningLevel: loadInfo.imbalanceWarningLevel,
      imbalanceWarningMessage: loadInfo.imbalanceWarningMessage,
      maxPhaseCurrent: loadInfo.maxPhaseCurrent,
      minPhaseCurrent: loadInfo.minPhaseCurrent,
      avgPhaseCurrent: loadInfo.avgPhaseCurrent,
      createdBy: formData.createdBy || {
        id: user?.id || '',
        name: user?.name || 'Unknown'
      },
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: {
        id: user?.id || '',
        name: user?.name || 'Unknown'
      },
    };

    // Use offline CRUD for updates
    try {
      await updateRecord(id, completeData);
      toast.success("Record updated successfully!");
      navigate("/asset-management/load-monitoring");
    } catch (error) {
      console.error('Failed to update record:', error);
      toast.error("Failed to update record. Please try again.");
    }
  };

  if (isLoading) {
      return <Layout><div>Loading record...</div></Layout>;
  }

 return ( // Ensure component returns JSX
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Edit Load Record</h1>
          <p className="text-muted-foreground mt-2">
            Update the details for this transformer load record.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:gap-6">
            {/* Basic Information Card */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Record when and where the load monitoring is taking place
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                   <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date || ''}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time || ''}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={formData.regionId || ""}
                      onValueChange={handleRegionChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "regional_engineer" || user?.role === "regional_general_manager" || user?.role === "technician"}
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Select Region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions?.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District/Section</Label>
                    <Select
                      value={formData.districtId || ""}
                      onValueChange={handleDistrictChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician" || !formData.regionId || filteredDistricts.length === 0}
                    >
                      <SelectTrigger id="district" className={user?.role === "district_engineer" || user?.role === "district_manager" ? "bg-muted" : ""}>
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredDistricts.map((district) => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="substationName">Substation Name</Label>
                    <Input
                      id="substationName"
                      type="text"
                      value={formData.substationName || ''}
                      onChange={(e) => handleInputChange('substationName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="substationNumber">Substation Number</Label>
                    <Input
                      id="substationNumber"
                      type="text"
                      value={formData.substationNumber || ''}
                      onChange={(e) => handleInputChange('substationNumber', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gpsLocation">GPS Location (Latitude, Longitude)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="gpsLocation"
                        type="text"
                        placeholder="e.g., 7.123456, -1.234567"
                        value={formData.gpsLocation || ''}
                        onChange={(e) => handleInputChange('gpsLocation', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const latitude = position.coords.latitude.toFixed(6);
                                const longitude = position.coords.longitude.toFixed(6);
                                handleInputChange('gpsLocation', `${latitude}, ${longitude}`);
                              },
                              (error) => {
                                toast.error('Unable to retrieve your location.');
                              },
                              { enableHighAccuracy: true }
                            );
                          } else {
                            toast.error('Geolocation is not supported by your browser.');
                          }
                        }}
                      >
                        Get Location
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (kVA)</Label>
                    <Input
                      id="rating"
                      type="number"
                      value={formData.rating ?? ''}
                      onChange={(e) => handleInputChange('rating', e.target.value)}
                      min="0"
                      placeholder="Enter KVA rating"
                      required
                    />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="peakLoadStatus">Peak Load Status</Label>
                    <Select
                      value={formData.peakLoadStatus || 'day'}
                      onValueChange={(value) => handleInputChange('peakLoadStatus', value as 'day' | 'night')}
                    >
                      <SelectTrigger id="peakLoadStatus">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day Peak</SelectItem>
                        <SelectItem value="night">Night Peak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Ownership Select */}
                  <div className="space-y-2">
                    <Label htmlFor="ownership">Ownership</Label>
                    <Select
                      value={(formData.ownership as 'public' | 'private') || 'public'}
                      onValueChange={(value) => handleInputChange('ownership' as any, value as 'public' | 'private')}
                    >
                      <SelectTrigger id="ownership">
                        <SelectValue placeholder="Select ownership" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Voltage Level Select */}
                  <div className="space-y-2">
                    <Label htmlFor="voltageLevel">Voltage Level</Label>
                    <Select
                      value={formData.voltageLevel || ''}
                      onValueChange={(value) => handleInputChange('voltageLevel' as any, value as '11kV' | '33kV' | '69kV')}
                    >
                      <SelectTrigger id="voltageLevel">
                        <SelectValue placeholder="Select voltage level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="11kV">11kV</SelectItem>
                        <SelectItem value="33kV">33kV</SelectItem>
                        <SelectItem value="69kV">69kV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feeder Legs Card */}
             <Card>
              <CardHeader>
                <CardTitle>Feeder Legs Current (Amps)</CardTitle>
                <CardDescription>Enter current readings for each feeder leg. Maximum 8 legs.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formData.feederLegs?.map((leg, index) => (
                    <div key={leg.id} className="grid grid-cols-5 gap-4 items-center border p-4 rounded-md">
                      <Label className="col-span-5 font-medium">Feeder Leg {index + 1}</Label>
                      <div className="space-y-1">
                        <Label htmlFor={`red-${leg.id}`}>Red Phase</Label>
                        <Input
                          id={`red-${leg.id}`}
                          type="number"
                          value={leg.redPhaseCurrent ?? ''} // Handle potential non-number value during typing
                          onChange={(e) => updateFeederLeg(leg.id, 'redPhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`yellow-${leg.id}`}>Yellow Phase</Label>
                        <Input
                          id={`yellow-${leg.id}`}
                          type="number"
                           value={leg.yellowPhaseCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'yellowPhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`blue-${leg.id}`}>Blue Phase</Label>
                        <Input
                          id={`blue-${leg.id}`}
                          type="number"
                           value={leg.bluePhaseCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'bluePhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`neutral-${leg.id}`}>Neutral</Label>
                        <Input
                          id={`neutral-${leg.id}`}
                          type="number"
                          value={leg.neutralCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'neutralCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeederLeg(leg.id)}
                        disabled={(formData.feederLegs?.length || 0) <= 1}
                        className="justify-self-end"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFeederLeg}
                  className="mt-4"
                  disabled={(formData.feederLegs?.length || 0) >= 8}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Feeder Leg
                </Button>
              </CardContent>
            </Card>

            {/* Calculated Load Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Calculated Load Information</CardTitle>
                <CardDescription>Automatically calculated based on your inputs.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Rated Load (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.ratedLoad.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Avg. Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.averageCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">% Load</Label>
                  <p className="text-lg font-semibold">{loadInfo.percentageLoad.toFixed(2)} %</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Calculated Neutral (A)</Label>
                  <p className={`text-lg font-semibold ${
                    loadInfo.neutralWarningLevel === "critical" ? "text-red-500" : 
                    loadInfo.neutralWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {loadInfo.calculatedNeutral.toFixed(2)}
                  </p>
                  {loadInfo.neutralWarningMessage && (
                    <p className={`text-sm ${
                      loadInfo.neutralWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {loadInfo.neutralWarningMessage}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">10% Rated Neutral (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.tenPercentFullLoadNeutral.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Phase Imbalance (%)</Label>
                  <p className={`text-lg font-semibold ${
                    loadInfo.imbalanceWarningLevel === "critical" ? "text-red-500" : 
                    loadInfo.imbalanceWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {loadInfo.imbalancePercentage.toFixed(2)}%
                  </p>
                  {loadInfo.imbalanceWarningMessage && (
                    <p className={`text-sm ${
                      loadInfo.imbalanceWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {loadInfo.imbalanceWarningMessage}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Max Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.maxPhaseCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Min Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.minPhaseCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Avg Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.avgPhaseCurrent.toFixed(2)}</p>
                </div>
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

            {/* Submit/Cancel Buttons */}
            <div className="flex justify-end gap-4 mt-2">
                <Button type="button" variant="outline" onClick={() => navigate("/asset-management/load-monitoring")}>
                    Cancel
                </Button>
                <Button type="submit">
                    Update Record
                </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
} // Added closing brace
