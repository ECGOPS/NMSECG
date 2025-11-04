import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Loader2, Target, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * District Performance Card Component
 * 
 * Displays real-time performance metrics for district users:
 * - Target vs Actual comparison
 * - Achievement percentage with progress bar
 * - Color-coded status indicators
 * - Multiple target types support
 */
interface PerformanceData {
  districtId: string;
  district: string;
  regionId: string;
  region: string;
  month: string;
  targetType: string;
  target: number;
  actual: number;
  variance: number;
  percentage: number;
  targetId: string | null;
}

export function DistrictPerformanceCard() {
  const { user } = useAzureADAuth();
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('all');

  // Initialize month to current month
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setSelectedMonth(currentMonth);
  }, []);

  // Fetch performance data for district
  const fetchPerformance = async () => {
    if (!user?.district || !selectedMonth) return;

    try {
      setIsLoading(true);
      
      // Get district ID from district name
      // The backend performance route accepts districtId, so we need to look it up
      const districtsResponse = await apiRequest('/api/areas');
      const districts = Array.isArray(districtsResponse) ? districtsResponse : [];
      const userDistrict = districts.find((d: any) => 
        d.name === user.district || d.district === user.district
      );

      if (!userDistrict) {
        console.warn('[DistrictPerformanceCard] District not found:', user.district);
        toast.error('District not found. Please contact your administrator.');
        setPerformanceData([]);
        return;
      }

      const districtId = userDistrict.id;

      const params = new URLSearchParams();
      if (selectedTargetType !== 'all') {
        params.append('targetType', selectedTargetType);
      }

      const url = `/api/performance/district/${districtId}/month/${selectedMonth}?${params.toString()}`;
      const data = await apiRequest(url);
      setPerformanceData(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('[DistrictPerformanceCard] Error fetching performance:', error);
      toast.error(error.message || 'Failed to load performance data');
      setPerformanceData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.district && selectedMonth) {
      fetchPerformance();
    }
  }, [user?.district, selectedMonth, selectedTargetType]);

  // Get performance status
  const getPerformanceStatus = (percentage: number) => {
    if (percentage < 80) return { label: 'Below Target', color: 'text-red-600', icon: XCircle, variant: 'destructive' as const };
    if (percentage >= 80 && percentage <= 100) return { label: 'On Track', color: 'text-yellow-600', icon: AlertCircle, variant: 'default' as const };
    return { label: 'Exceeding Target', color: 'text-green-600', icon: CheckCircle2, variant: 'default' as const };
  };

  // Get target type label
  const getTargetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      loadMonitoring: 'Load Monitoring',
      substationInspection: 'Substation Inspection',
      overheadLine: 'Overhead Line (km)',
    };
    return labels[type] || type;
  };

  // Get unit
  const getUnit = (type: string) => {
    return type === 'overheadLine' ? 'km' : '';
  };

  // Filter data by target type if selected
  const filteredData = selectedTargetType === 'all'
    ? performanceData
    : performanceData.filter(d => d.targetType === selectedTargetType);

  // Export to PDF
  const exportToPDF = () => {
    if (filteredData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const districtName = user?.district || 'Unknown District';
    const regionName = performanceData[0]?.region || user?.region || 'Unknown Region';
    const targetTypeLabel = selectedTargetType === 'all' 
      ? 'All Types' 
      : getTargetTypeLabel(selectedTargetType);

    const doc = new jsPDF('portrait');
    
    // Header with color
    doc.setTextColor(0, 51, 102); // Dark blue
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('District Performance Report', 14, 15);
    
    // Metadata with colors
    doc.setTextColor(64, 64, 64); // Dark gray
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`District: ${districtName}`, 14, 25);
    doc.text(`Region: ${regionName}`, 14, 30);
    doc.text(`Month: ${selectedMonth}`, 14, 35);
    doc.text(`Target Type: ${targetTypeLabel}`, 14, 40);
    doc.setTextColor(128, 128, 128); // Medium gray
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 45);

    // Prepare table data with color information
    const tableData: any[][] = [];
    const cellStyles: any[] = [];
    
    filteredData.forEach((item) => {
      const varianceStr = item.variance >= 0 ? `+${item.variance.toFixed(2)}` : item.variance.toFixed(2);
      const unit = item.targetType === 'overheadLine' ? ' km' : '';
      
      tableData.push([
        getTargetTypeLabel(item.targetType),
        item.targetType === 'overheadLine' ? `${item.target} km` : item.target.toString(),
        item.targetType === 'overheadLine' ? `${item.actual.toFixed(2)} km` : item.actual.toString(),
        varianceStr + unit,
        `${item.percentage.toFixed(1)}%`,
        item.percentage >= 100 ? 'Exceeding' : item.percentage >= 80 ? 'On Track' : 'Below Target'
      ]);

      // Color for variance column (green if positive, red if negative)
      const varianceColor = item.variance >= 0 ? [34, 139, 34] : [220, 20, 60]; // Green or red
      
      // Color for percentage column based on performance
      let percentageColor: number[] = [0, 0, 0];
      if (item.percentage >= 100) {
        percentageColor = [34, 139, 34]; // Green for exceeding target
      } else if (item.percentage >= 80) {
        percentageColor = [255, 165, 0]; // Orange for on track
      } else {
        percentageColor = [220, 20, 60]; // Red for below target
      }

      // Color for status column
      let statusColor: number[] = [0, 0, 0];
      if (item.percentage >= 100) {
        statusColor = [34, 139, 34]; // Green
      } else if (item.percentage >= 80) {
        statusColor = [255, 165, 0]; // Orange
      } else {
        statusColor = [220, 20, 60]; // Red
      }

      cellStyles.push({
        3: { textColor: varianceColor }, // Variance column
        4: { textColor: percentageColor }, // Percentage column
        5: { textColor: statusColor } // Status column
      });
    });

    // Add table with colors
    autoTable(doc, {
      startY: 50,
      head: [['Target Type', 'Target', 'Actual', 'Variance', '% Achieved', 'Status']],
      body: tableData,
      styles: { 
        fontSize: 9,
        textColor: [0, 0, 0] // Black text by default
      },
      headStyles: { 
        fillColor: [0, 51, 102], // Dark blue header
        textColor: [255, 255, 255], // White text
        fontStyle: 'bold'
      },
      alternateRowStyles: { 
        fillColor: [248, 248, 248] // Light gray for alternating rows
      },
      didParseCell: (data: any) => {
        // Apply custom colors based on row index
        if (data.section === 'body') {
          const rowIndex = data.row.index;
          if (cellStyles[rowIndex]) {
            // Apply variance, percentage, and status colors
            if (cellStyles[rowIndex][data.column.index]) {
              data.cell.styles.textColor = cellStyles[rowIndex][data.column.index].textColor;
              if (data.column.index === 5) { // Status column
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        }
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35 },
        5: { cellWidth: 40 },
      },
      margin: { left: 14, right: 14 }
    });

    // Save PDF
    const fileName = `district-performance-${districtName}-${selectedMonth}-${selectedTargetType}.pdf`;
    doc.save(fileName);
    
    toast.success('PDF exported successfully');
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <Card>
        <CardHeader className="pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl sm:text-2xl">My Performance Dashboard</CardTitle>
                  <CardDescription className="text-sm sm:text-base mt-1">
                    Track your performance against set targets
                  </CardDescription>
                </div>
                {filteredData.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportToPDF}
                    disabled={isLoading}
                    className="flex-shrink-0"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Export PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="space-y-1 flex-1 sm:flex-initial sm:min-w-[140px]">
                <label className="text-xs text-muted-foreground">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="flex h-9 sm:h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-1 flex-1 sm:flex-initial sm:min-w-[160px]">
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  value={selectedTargetType}
                  onChange={(e) => setSelectedTargetType(e.target.value)}
                  className="flex h-9 sm:h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="all">All</option>
                  <option value="loadMonitoring">Load Monitoring</option>
                  <option value="substationInspection">Substation Inspection</option>
                  <option value="overheadLine">Overhead Line</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <Target className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base">No performance data available for the selected month.</p>
              <p className="text-xs sm:text-sm mt-2">Targets may not be set for this period.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredData.map((item) => {
                const status = getPerformanceStatus(item.percentage);
                const StatusIcon = status.icon;
                
                return (
                  <Card key={`${item.targetType}-${item.month}`} className="relative hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm sm:text-base font-semibold truncate pr-2">{getTargetTypeLabel(item.targetType)}</CardTitle>
                        <StatusIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${status.color}`} />
                      </div>
                      <CardDescription className="text-xs mt-1">{item.month}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
                      {/* Target and Actual */}
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Target</p>
                          <p className="text-xl sm:text-2xl font-bold break-words">
                            {item.targetType === 'overheadLine'
                              ? `${item.target} km`
                              : item.target.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Actual</p>
                          <p className="text-xl sm:text-2xl font-bold break-words">
                            {item.targetType === 'overheadLine'
                              ? `${item.actual.toFixed(2)} km`
                              : item.actual.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Achievement</span>
                          <Badge variant={status.variant} className="text-xs px-2 py-0.5">
                            {item.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                        <Progress 
                          value={Math.min(item.percentage, 100)} 
                          className="h-2 sm:h-2.5"
                        />
                      </div>

                      {/* Variance */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Variance</span>
                          <span className={`text-xs sm:text-sm font-medium ${item.variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {item.variance >= 0 ? '+' : ''}
                            {item.targetType === 'overheadLine'
                              ? `${item.variance.toFixed(2)} km`
                              : `${item.variance.toLocaleString()} ${getUnit(item.targetType)}`}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="pt-2">
                        <Badge variant={status.variant} className="w-full justify-center text-xs py-1.5">
                          {status.label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

