import React, { useState } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown, Download, BarChart as ChartBarIcon, 
  LineChart as ChartLineIcon, PieChart as ChartPieIcon
} from "lucide-react";
import { format } from 'date-fns';

interface ReliabilityIndices {
  saidi: number;
  saifi: number;
  caidi: number;
}

interface OutageMetrics {
  unservedEnergyMWh: number;
  customersAffected: number;
}

interface AnalyticsChartsProps {
  filteredFaults: (OP5Fault | ControlSystemOutage)[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ filteredFaults }) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [timeRange, setTimeRange] = useState<string>('all');

  const calculateReliabilityIndices = (faults: OP5Fault[]): ReliabilityIndices => {
    if (!faults || faults.length === 0) {
      return { saidi: 0, saifi: 0, caidi: 0 };
    }

    let totalSAIDI = 0;
    let totalSAIFI = 0;
    let totalCAIDI = 0;

    faults.forEach(fault => {
      totalSAIDI += fault.reliabilityIndices?.saidi || 0;
      totalSAIFI += fault.reliabilityIndices?.saifi || 0;
      totalCAIDI += fault.reliabilityIndices?.caidi || 0;
    });

    const avgSAIDI = totalSAIDI / faults.length;
    const avgSAIFI = totalSAIFI / faults.length;
    const avgCAIDI = totalCAIDI / faults.length;

    return {
      saidi: avgSAIDI,
      saifi: avgSAIFI,
      caidi: avgCAIDI,
    };
  };

  const calculateOutageMetrics = (outages: ControlSystemOutage[]): OutageMetrics => {
    if (!outages || outages.length === 0) {
      return { unservedEnergyMWh: 0, customersAffected: 0 };
    }

    let totalUnservedEnergy = 0;
    let totalCustomersAffected = 0;

    outages.forEach(outage => {
      totalUnservedEnergy += outage.unservedEnergyMWh || 0;
      totalCustomersAffected += (outage.customersAffected?.rural || 0) + (outage.customersAffected?.urban || 0) + (outage.customersAffected?.metro || 0);
    });

    return {
      unservedEnergyMWh: totalUnservedEnergy,
      customersAffected: totalCustomersAffected,
    };
  };

  // Filter faults by time range
  const getFilteredByTime = () => {
    if (timeRange === 'all') {
      return filteredFaults;
    }
    
    const now = new Date();
    let cutoff = new Date();
    
    if (timeRange === '7days') {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeRange === '30days') {
      cutoff.setDate(now.getDate() - 30);
    } else if (timeRange === '90days') {
      cutoff.setDate(now.getDate() - 90);
    }
    
    return filteredFaults.filter(fault => 
      new Date(fault.occurrenceDate) >= cutoff
    );
  };

  // Type guard to filter faults
  const op5FaultsData = getFilteredByTime().filter((fault): fault is OP5Fault =>
    'faultLocation' in fault && 'affectedPopulation' in fault
  );

  const controlOutagesData = getFilteredByTime().filter((fault): fault is ControlSystemOutage =>
    'customersAffected' in fault && 'reason' in fault
  );

  const reliabilityData = calculateReliabilityIndices(op5FaultsData);
  const outageMetricsData = calculateOutageMetrics(controlOutagesData);

  // Prepare chart data
  const performanceData = [
    { name: 'SAIDI', value: reliabilityData.saidi },
    { name: 'SAIFI', value: reliabilityData.saifi },
    { name: 'CAIDI', value: reliabilityData.caidi },
  ];
  
  const impactData = [
    { name: 'Unserved Energy (MWh)', value: outageMetricsData.unservedEnergyMWh },
    { name: 'Customers Affected', value: outageMetricsData.customersAffected },
  ];

  // Count faults by category
  const outageTypeCount = filteredFaults.reduce((acc, fault) => {
    acc[fault.faultType] = (acc[fault.faultType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const outageTypeData = Object.entries(outageTypeCount).map(([name, value]) => ({
    name,
    value
  }));

  // Export functions
  const exportToCSV = () => {
    // Create headers
            const headers = ['Type', 'Region', 'District/Section', 'Date', 'Status', 'Duration (min)'];
    
    // Create data rows
    const dataRows = filteredFaults.map(fault => {
      const type = 'faultLocation' in fault ? 'OP5 Fault' : 'Control Outage';
      const region = fault.regionId;
      const district = fault.districtId;
      const date = format(new Date(fault.occurrenceDate), 'yyyy-MM-dd');
      const status = fault.status;
      const duration = 'outrageDuration' in fault ? fault.outrageDuration || 0 : 0;
      
      return [type, region, district, date, status, duration].join(',');
    });
    
    // Combine headers and data
    const csvContent = [headers.join(','), ...dataRows].join('\n');
    
    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fault-analysis-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderChart = (data: any[], dataKey: string = 'value', nameKey: string = 'name') => {
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Select value={chartType} onValueChange={(value) => setChartType(value as 'bar' | 'line' | 'pie')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Chart Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar" className="flex items-center gap-2">
                <ChartBarIcon className="h-4 w-4" />
                <span>Bar Chart</span>
              </SelectItem>
              <SelectItem value="line" className="flex items-center gap-2">
                <ChartLineIcon className="h-4 w-4" />
                <span>Line Chart</span>
              </SelectItem>
              <SelectItem value="pie" className="flex items-center gap-2">
                <ChartPieIcon className="h-4 w-4" />
                <span>Pie Chart</span>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          variant="outline" 
          className="flex items-center gap-2" 
          onClick={exportToCSV}
        >
          <Download className="h-4 w-4" />
          Export to CSV
        </Button>
      </div>
      
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid grid-cols-3 mb-8 w-full max-w-md mx-auto">
          <TabsTrigger value="performance">Reliability</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
                          <TabsTrigger value="types">Outage Categories</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Reliability Indices</CardTitle>
              <CardDescription>
                System Average Interruption Duration & Frequency Indices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(performanceData)}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="impact">
          <Card>
            <CardHeader>
              <CardTitle>Impact Assessment</CardTitle>
              <CardDescription>
                Unserved Energy and Affected Customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(impactData)}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="types">
          <Card>
            <CardHeader>
                              <CardTitle>Outage Category Distribution</CardTitle>
                              <CardDescription>
                  Number of outages by category
                </CardDescription>
            </CardHeader>
            <CardContent>
              {renderChart(outageTypeData)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
          <CardDescription>
            Key performance metrics for the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-primary/10 p-4 rounded-lg flex flex-col">
              <span className="text-sm text-muted-foreground">Total Outages</span>
              <span className="text-3xl font-bold">{filteredFaults.length}</span>
            </div>
            <div className="bg-secondary/20 p-4 rounded-lg flex flex-col">
              <span className="text-sm text-muted-foreground">Avg. Outage Duration</span>
              <span className="text-3xl font-bold">
                {op5FaultsData.length > 0 
                  ? (op5FaultsData.reduce((sum, fault) => sum + (fault.outrageDuration || 0), 0) / op5FaultsData.length).toFixed(1)
                  : 0} min
              </span>
            </div>
            <div className="bg-accent/10 p-4 rounded-lg flex flex-col">
              <span className="text-sm text-muted-foreground">Unserved Energy</span>
              <span className="text-3xl font-bold">{outageMetricsData.unservedEnergyMWh.toFixed(1)} MWh</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsCharts;
