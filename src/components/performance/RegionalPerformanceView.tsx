import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from '@/contexts/DataContext';
import { Loader2, TrendingUp, TrendingDown, Minus, Award, Medal, Download, FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * Regional Performance View Component
 * 
 * Displays performance metrics for all districts under a region:
 * - Target vs Actual comparison
 * - Variance and percentage achieved
 * - Color-coded performance indicators
 * - Bar charts for visualization
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

export function RegionalPerformanceView() {
  const { user } = useAzureADAuth();
  const { regions, districts } = useData();
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('all');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');

  // Initialize month to current month
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setSelectedMonth(currentMonth);
    
    // Set region based on user's region
    if (user?.region && regions.length > 0) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setSelectedRegionId(userRegion.id);
      }
    }
  }, [user, regions]);

  // Fetch performance data
  const fetchPerformance = async () => {
    if (!selectedRegionId || !selectedMonth) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedTargetType !== 'all') {
        params.append('targetType', selectedTargetType);
      }

      const url = `/api/performance/region/${selectedRegionId}/month/${selectedMonth}?${params.toString()}`;
      const data = await apiRequest(url);
      setPerformanceData(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('[RegionalPerformanceView] Error fetching performance:', error);
      toast.error('Failed to load performance data');
      setPerformanceData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRegionId && selectedMonth) {
      fetchPerformance();
    }
  }, [selectedRegionId, selectedMonth, selectedTargetType]);

  // Get performance color based on percentage
  const getPerformanceColor = (percentage: number) => {
    if (percentage < 80) return 'bg-red-500';
    if (percentage >= 80 && percentage <= 100) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Get performance badge variant
  const getPerformanceBadge = (percentage: number) => {
    if (percentage < 80) return 'destructive';
    if (percentage >= 80 && percentage <= 100) return 'default';
    return 'default';
  };

  // Get performance icon
  const getPerformanceIcon = (percentage: number) => {
    if (percentage >= 100) return <TrendingUp className="h-4 w-4" />;
    if (percentage < 80) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
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

  // Get unit for target type
  const getUnit = (type: string) => {
    return type === 'overheadLine' ? 'km' : 'count';
  };

  // Prepare chart data
  const chartData = performanceData.map(item => ({
    district: item.district,
    target: item.target,
    actual: item.actual,
    percentage: item.percentage,
  }));

  // Filter data by target type if selected
  const filteredData = selectedTargetType === 'all'
    ? performanceData
    : performanceData.filter(d => d.targetType === selectedTargetType);

  // Group data by district if showing all types
  const groupedByDistrict = selectedTargetType === 'all' 
    ? filteredData.reduce((acc, item) => {
        if (!acc[item.districtId]) {
          acc[item.districtId] = [];
        }
        acc[item.districtId].push(item);
        return acc;
      }, {} as Record<string, PerformanceData[]>)
    : {};

  // Calculate rankings
  // If showing all types, rank by average percentage per district
  // If showing single type, rank by percentage for that type
  const calculateRankings = () => {
    if (selectedTargetType === 'all') {
      // For "all types", calculate average percentage per district
      const districtAverages = Object.entries(groupedByDistrict).map(([districtId, items]) => {
        // Only include items with targets > 0 in average calculation
        const validItems = items.filter(item => item.target > 0);
        const avgPercentage = validItems.length > 0
          ? validItems.reduce((sum, item) => sum + item.percentage, 0) / validItems.length
          : 0;
        return {
          districtId,
          district: items[0].district,
          averagePercentage: avgPercentage,
          items,
          hasTarget: validItems.length > 0
        };
      });
      
      // Sort by: 1) has target, 2) average percentage (descending - highest first)
      districtAverages.sort((a, b) => {
        // Districts with targets come first
        if (a.hasTarget && !b.hasTarget) return -1;
        if (!a.hasTarget && b.hasTarget) return 1;
        // If both have targets or both don't, sort by percentage
        return b.averagePercentage - a.averagePercentage;
      });
      
      // Add rank to each district
      return districtAverages.map((dist, index) => ({
        ...dist,
        rank: index + 1
      }));
    } else {
      // For single type, separate districts with targets from those without
      const withTargets = filteredData.filter(item => item.target > 0);
      const withoutTargets = filteredData.filter(item => item.target === 0);
      
      // Sort districts with targets by percentage (descending)
      withTargets.sort((a, b) => {
        // First compare percentage
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }
        // If same percentage, compare actual (higher actual = better)
        return b.actual - a.actual;
      });
      
      // Districts without targets go to the end, sorted by actual (if any)
      withoutTargets.sort((a, b) => b.actual - a.actual);
      
      // Combine: districts with targets first, then districts without targets
      const sorted = [...withTargets, ...withoutTargets];
      
      // Add rank to each item
      return sorted.map((item, index) => ({
        ...item,
        rank: index + 1,
        hasTarget: item.target > 0
      }));
    }
  };

  const rankedData = calculateRankings();

  // Export to CSV
  const exportToCSV = () => {
    if (rankedData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const regionName = regions.find(r => r.id === selectedRegionId)?.name || 'Unknown Region';
    const targetTypeLabel = selectedTargetType === 'all' 
      ? 'All Types' 
      : getTargetTypeLabel(selectedTargetType);

    // Prepare CSV headers
    const headers = ['Rank', 'District', 'Target Type', 'Target', 'Actual', 'Variance', '% Achieved'];

    // Prepare CSV rows
    const rows: string[][] = [];
    
    if (selectedTargetType === 'all') {
      rankedData.forEach((rankedDistrict: any) => {
        rankedDistrict.items.forEach((item: PerformanceData) => {
          const varianceStr = item.variance >= 0 ? `+${item.variance.toFixed(2)}` : item.variance.toFixed(2);
          const unit = item.targetType === 'overheadLine' ? ' km' : '';
          
          rows.push([
            rankedDistrict.rank.toString(),
            item.district,
            getTargetTypeLabel(item.targetType),
            item.targetType === 'overheadLine' ? `${item.target} km` : item.target.toString(),
            item.targetType === 'overheadLine' ? `${item.actual.toFixed(2)} km` : item.actual.toString(),
            varianceStr + unit,
            `${item.percentage.toFixed(1)}%`
          ]);
        });
      });
    } else {
      rankedData.forEach((item: any) => {
        const varianceStr = item.variance >= 0 ? `+${item.variance.toFixed(2)}` : item.variance.toFixed(2);
        const unit = item.targetType === 'overheadLine' ? ' km' : '';
        
        rows.push([
          item.hasTarget ? item.rank.toString() : '-',
          item.district,
          getTargetTypeLabel(item.targetType),
          item.targetType === 'overheadLine' ? `${item.target} km` : item.target.toString(),
          item.targetType === 'overheadLine' ? `${item.actual.toFixed(2)} km` : item.actual.toString(),
          varianceStr + unit,
          item.hasTarget ? `${item.percentage.toFixed(1)}%` : 'N/A'
        ]);
      });
    }

    // Create CSV content
    const csvContent = [
      [`Regional Performance Report - ${regionName}`],
      [`Month: ${selectedMonth}`],
      [`Target Type: ${targetTypeLabel}`],
      [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `regional-performance-${regionName}-${selectedMonth}-${selectedTargetType}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('CSV exported successfully');
  };

  // Export to PDF
  const exportToPDF = () => {
    if (rankedData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const regionName = regions.find(r => r.id === selectedRegionId)?.name || 'Unknown Region';
    const targetTypeLabel = selectedTargetType === 'all' 
      ? 'All Types' 
      : getTargetTypeLabel(selectedTargetType);

    const doc = new jsPDF('landscape');
    
    // Header with color
    doc.setTextColor(0, 51, 102); // Dark blue
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Regional Performance Report', 14, 15);
    
    // Metadata with colors
    doc.setTextColor(64, 64, 64); // Dark gray
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Region: ${regionName}`, 14, 25);
    doc.text(`Month: ${selectedMonth}`, 14, 30);
    doc.text(`Target Type: ${targetTypeLabel}`, 14, 35);
    doc.setTextColor(128, 128, 128); // Medium gray
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 40);

    // Prepare table data with color information
    const tableData: any[][] = [];
    const cellStyles: any[] = [];
    
    if (selectedTargetType === 'all') {
      rankedData.forEach((rankedDistrict: any) => {
        rankedDistrict.items.forEach((item: PerformanceData, idx: number) => {
          const varianceStr = item.variance >= 0 ? `+${item.variance.toFixed(2)}` : item.variance.toFixed(2);
          const unit = item.targetType === 'overheadLine' ? ' km' : '';
          
          tableData.push([
            idx === 0 ? rankedDistrict.rank.toString() : '',
            idx === 0 ? item.district : '',
            getTargetTypeLabel(item.targetType),
            item.targetType === 'overheadLine' ? `${item.target} km` : item.target.toString(),
            item.targetType === 'overheadLine' ? `${item.actual.toFixed(2)} km` : item.actual.toString(),
            varianceStr + unit,
            `${item.percentage.toFixed(1)}%`
          ]);

          // Determine row color based on performance
          let rowFillColor: number[] = [255, 255, 255]; // Default white
          if (idx === 0) {
            // First row of each district group
            if (rankedDistrict.rank === 1) {
              rowFillColor = [255, 255, 200]; // Light yellow/gold for 1st
            } else if (rankedDistrict.rank === 2) {
              rowFillColor = [245, 245, 245]; // Light gray for 2nd
            } else if (rankedDistrict.rank === 3) {
              rowFillColor = [255, 235, 205]; // Light orange for 3rd
            } else {
              rowFillColor = [250, 250, 250]; // Very light gray for others
            }
          } else {
            rowFillColor = [255, 255, 255]; // White for subsequent rows
          }

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

          cellStyles.push({
            5: { textColor: varianceColor }, // Variance column
            6: { textColor: percentageColor } // Percentage column
          });
        });
      });
    } else {
      rankedData.forEach((item: any) => {
        const varianceStr = item.variance >= 0 ? `+${item.variance.toFixed(2)}` : item.variance.toFixed(2);
        const unit = item.targetType === 'overheadLine' ? ' km' : '';
        
        tableData.push([
          item.hasTarget ? item.rank.toString() : '-',
          item.district,
          getTargetTypeLabel(item.targetType),
          item.targetType === 'overheadLine' ? `${item.target} km` : item.target.toString(),
          item.targetType === 'overheadLine' ? `${item.actual.toFixed(2)} km` : item.actual.toString(),
          varianceStr + unit,
          item.hasTarget ? `${item.percentage.toFixed(1)}%` : 'N/A'
        ]);

        // Determine row color based on rank
        let rowFillColor: number[] = [255, 255, 255];
        if (item.hasTarget) {
          if (item.rank === 1) {
            rowFillColor = [255, 255, 200]; // Light yellow/gold
          } else if (item.rank === 2) {
            rowFillColor = [245, 245, 245]; // Light gray
          } else if (item.rank === 3) {
            rowFillColor = [255, 235, 205]; // Light orange
          } else {
            rowFillColor = [250, 250, 250]; // Very light gray
          }
        }

        // Color for variance and percentage columns
        const varianceColor = item.variance >= 0 ? [34, 139, 34] : [220, 20, 60];
        let percentageColor: number[] = [128, 128, 128]; // Gray for N/A
        if (item.hasTarget) {
          if (item.percentage >= 100) {
            percentageColor = [34, 139, 34]; // Green
          } else if (item.percentage >= 80) {
            percentageColor = [255, 165, 0]; // Orange
          } else {
            percentageColor = [220, 20, 60]; // Red
          }
        }

        cellStyles.push({
          5: { textColor: varianceColor },
          6: { textColor: percentageColor }
        });
      });
    }

    // Add table with colors
    autoTable(doc, {
      startY: 45,
      head: [['Rank', 'District', 'Target Type', 'Target', 'Actual', 'Variance', '% Achieved']],
      body: tableData,
      styles: { 
        fontSize: 8,
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
            // Apply variance and percentage colors
            if (cellStyles[rowIndex][data.column.index]) {
              data.cell.styles.textColor = cellStyles[rowIndex][data.column.index].textColor;
            }
          }
          
          // Color rank column for top 3
          if (data.column.index === 0 && tableData[rowIndex][0] !== '' && tableData[rowIndex][0] !== '-') {
            const rank = parseInt(tableData[rowIndex][0]);
            if (rank === 1) {
              data.cell.styles.fillColor = [255, 215, 0]; // Gold
              data.cell.styles.textColor = [0, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            } else if (rank === 2) {
              data.cell.styles.fillColor = [192, 192, 192]; // Silver
              data.cell.styles.textColor = [0, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            } else if (rank === 3) {
              data.cell.styles.fillColor = [205, 127, 50]; // Bronze
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 40 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30 },
      },
      margin: { left: 14, right: 14 }
    });

    // Save PDF
    const fileName = `regional-performance-${regionName}-${selectedMonth}-${selectedTargetType}.pdf`;
    doc.save(fileName);
    
    toast.success('PDF exported successfully');
  };

  // Get rank badge styling
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 flex items-center gap-1 w-8 justify-center">
          <Award className="h-3 w-3" />
          {rank}
        </Badge>
      );
    } else if (rank === 2) {
      return (
        <Badge className="bg-gray-400 text-white hover:bg-gray-500 flex items-center gap-1 w-8 justify-center">
          <Medal className="h-3 w-3" />
          {rank}
        </Badge>
      );
    } else if (rank === 3) {
      return (
        <Badge className="bg-orange-600 text-white hover:bg-orange-700 flex items-center gap-1 w-8 justify-center">
          <Medal className="h-3 w-3" />
          {rank}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="w-8 justify-center">
          {rank}
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Regional Performance Dashboard</CardTitle>
              <CardDescription>
                View performance metrics for all districts under your region
              </CardDescription>
            </div>
            {filteredData.length > 0 && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={exportToCSV}
                  disabled={isLoading}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={exportToPDF}
                  disabled={isLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select
                value={selectedRegionId}
                onValueChange={setSelectedRegionId}
                disabled={user?.role !== 'system_admin' && user?.role !== 'global_engineer'}
              >
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetType">Target Type</Label>
              <Select value={selectedTargetType} onValueChange={setSelectedTargetType}>
                <SelectTrigger id="targetType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="loadMonitoring">Load Monitoring</SelectItem>
                  <SelectItem value="substationInspection">Substation Inspection</SelectItem>
                  <SelectItem value="overheadLine">Overhead Line</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No performance data available for the selected filters.
            </div>
          ) : (
            <>
              {/* Chart */}
              {chartData.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Performance Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="district" 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="target" fill="#8884d8" name="Target" />
                        <Bar dataKey="actual" fill="#82ca9d" name="Actual" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>Target Type</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>% Achieved</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTargetType === 'all' ? (
                      // Show all types grouped by district with ranking
                      rankedData.map((rankedDistrict) => {
                        const items = rankedDistrict.items;
                        return (
                          <React.Fragment key={rankedDistrict.districtId}>
                            {items.map((item, idx) => (
                              <TableRow key={`${rankedDistrict.districtId}-${item.targetType}`}>
                                {idx === 0 && (
                                  <>
                                    <TableCell rowSpan={items.length} className="text-center">
                                      {getRankBadge(rankedDistrict.rank)}
                                    </TableCell>
                                    <TableCell rowSpan={items.length} className="font-medium">
                                      {item.district}
                                      {rankedDistrict.averagePercentage > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          Avg: {rankedDistrict.averagePercentage.toFixed(1)}%
                                        </div>
                                      )}
                                    </TableCell>
                                  </>
                                )}
                                <TableCell>
                                  <Badge variant="secondary">{getTargetTypeLabel(item.targetType)}</Badge>
                                </TableCell>
                                <TableCell>
                                  {item.targetType === 'overheadLine' 
                                    ? `${item.target} km`
                                    : item.target.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  {item.targetType === 'overheadLine'
                                    ? `${item.actual.toFixed(2)} km`
                                    : item.actual.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <span className={item.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {item.variance >= 0 ? '+' : ''}
                                    {item.targetType === 'overheadLine'
                                      ? item.variance.toFixed(2)
                                      : item.variance.toLocaleString()}
                                    {item.targetType === 'overheadLine' ? ' km' : ''}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getPerformanceBadge(item.percentage)}>
                                    {item.percentage.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getPerformanceIcon(item.percentage)}
                                    <div
                                      className={`w-3 h-3 rounded-full ${getPerformanceColor(item.percentage)}`}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      // Show single type with ranking
                      rankedData.map((item: any) => {
                        const hasTarget = item.target > 0;
                        const showRank = hasTarget; // Only show rank for districts with targets
                        
                        return (
                          <TableRow key={`${item.districtId}-${item.targetType}`}>
                            <TableCell className="text-center">
                              {showRank ? (
                                getRankBadge(item.rank)
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.district}
                              {!hasTarget && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  No target set
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{getTargetTypeLabel(item.targetType)}</Badge>
                            </TableCell>
                            <TableCell>
                              {item.targetType === 'overheadLine'
                                ? `${item.target} km`
                                : item.target.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {item.targetType === 'overheadLine'
                                ? `${item.actual.toFixed(2)} km`
                                : item.actual.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span className={item.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {item.variance >= 0 ? '+' : ''}
                                {item.targetType === 'overheadLine'
                                  ? item.variance.toFixed(2)
                                  : item.variance.toLocaleString()}
                                {item.targetType === 'overheadLine' ? ' km' : ''}
                              </span>
                            </TableCell>
                            <TableCell>
                              {hasTarget ? (
                                <Badge variant={getPerformanceBadge(item.percentage)}>
                                  {item.percentage.toFixed(1)}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasTarget ? (
                                <div className="flex items-center gap-2">
                                  {getPerformanceIcon(item.percentage)}
                                  <div
                                    className={`w-3 h-3 rounded-full ${getPerformanceColor(item.percentage)}`}
                                  />
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

