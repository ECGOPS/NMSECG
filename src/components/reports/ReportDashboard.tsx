import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportUploadForm } from './ReportUploadForm';
import { ReportTable } from './ReportTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Calendar, TrendingUp } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { format } from 'date-fns';

interface ReportStats {
  total: number;
  weekly: number;
  monthly: number;
  byMonth: Array<{ month: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
}

/**
 * ReportDashboard Component
 * 
 * Combines upload form, table, and statistics dashboard
 */
export function ReportDashboard() {
  const { user } = useAzureADAuth();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch statistics
  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      
      // Get all reports for stats (admin sees all, others see filtered)
      const allReports = await apiRequest('/api/reports?limit=1000');
      const reportsArray = Array.isArray(allReports) ? allReports : [];

      // Calculate statistics
      const weekly = reportsArray.filter(r => r.report_type === 'Weekly').length;
      const monthly = reportsArray.filter(r => r.report_type === 'Monthly').length;

      // Group by month
      const monthMap = new Map<string, number>();
      reportsArray.forEach(report => {
        if (report.month) {
          monthMap.set(report.month, (monthMap.get(report.month) || 0) + 1);
        }
      });

      const byMonth = Array.from(monthMap.entries())
        .map(([month, count]) => ({
          month: format(new Date(month + '-01'), 'MMM yyyy'),
          count
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6); // Last 6 months

      const byType = [
        { type: 'Weekly', count: weekly },
        { type: 'Monthly', count: monthly }
      ];

      setStats({
        total: reportsArray.length,
        weekly,
        monthly,
        byMonth,
        byType
      });
    } catch (error) {
      console.error('[ReportDashboard] Error fetching stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshKey]);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : stats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              All uploaded reports
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Reports</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : stats?.weekly || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Weekly submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Reports</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : stats?.monthly || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly submissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {stats && stats.byMonth.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports by Month</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports by Type</CardTitle>
              <CardDescription>Weekly vs Monthly</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.byType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats.byType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Form */}
      <ReportUploadForm onUploadSuccess={handleUploadSuccess} />

      {/* Reports Table */}
      <ReportTable onRefresh={() => setRefreshKey(prev => prev + 1)} />
    </div>
  );
}

