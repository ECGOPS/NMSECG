import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from '@/contexts/DataContext';
import { format } from 'date-fns';
import { ExternalLink, Trash2, Loader2, RefreshCw, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Report {
  id: string;
  title: string;
  description: string;
  report_type: 'Weekly' | 'Monthly';
  region_id: string | null;
  district_id: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  upload_date: string;
  month: string;
  week_number: number;
}

interface ReportTableProps {
  onRefresh?: () => void;
}

/**
 * ReportTable Component
 * 
 * Displays reports in a table with role-based filtering:
 * - Admin: See all reports
 * - Regional Admin: See region + all districts in region
 * - District User: See only their district reports
 */
export function ReportTable({ onRefresh }: ReportTableProps) {
  const { user } = useAzureADAuth();
  const { regions, districts } = useData();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalReports, setTotalReports] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterDistrict, setFilterDistrict] = useState<string>('all');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);

  // Get user's role
  const isAdmin = user?.role === 'system_admin' || user?.role === 'global_engineer';

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MMM yyyy');
      months.push({ value: monthStr, label: monthLabel });
    }
    return months;
  };

  const monthOptions = getMonthOptions();

  // Fetch reports
  const fetchReports = async (page: number = currentPage, size: number = pageSize) => {
    try {
      setIsLoading(true);
      
      const offset = (page - 1) * size;
      const params = new URLSearchParams();
      params.append('limit', size.toString());
      params.append('offset', offset.toString());

      if (filterType !== 'all') {
        params.append('type', filterType);
      }

      if (filterMonth) {
        params.append('month', filterMonth);
      }

      if (isAdmin && filterRegion !== 'all') {
        params.append('region_id', filterRegion);
      }

      if (isAdmin && filterDistrict !== 'all') {
        params.append('district_id', filterDistrict);
      }

      const data = await apiRequest(`/api/reports?${params.toString()}`);
      const reportsArray = Array.isArray(data) ? data : [];
      setReports(reportsArray);

      // Fetch total count
      if (totalReports === 0 || page === 1) {
        const countParams = new URLSearchParams(params.toString());
        countParams.append('countOnly', 'true');
        const countData = await apiRequest(`/api/reports?${countParams.toString()}`);
        setTotalReports(countData?.total || 0);
      }
    } catch (error: any) {
      console.error('[ReportTable] Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(currentPage, pageSize);
  }, [currentPage, pageSize, filterType, filterMonth, filterRegion, filterDistrict]);

  // Filter reports by search term (client-side)
  const filteredReports = reports.filter(report => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      report.title.toLowerCase().includes(searchLower) ||
      report.description.toLowerCase().includes(searchLower) ||
      report.uploaded_by_name.toLowerCase().includes(searchLower) ||
      report.file_name.toLowerCase().includes(searchLower)
    );
  });

  const handleDelete = async () => {
    if (!reportToDelete) return;

    try {
      await apiRequest(`/api/reports/${reportToDelete.id}`, {
        method: 'DELETE',
      });
      toast.success('Report deleted successfully');
      setDeleteDialogOpen(false);
      setReportToDelete(null);
      fetchReports(currentPage, pageSize);
      // Refresh count
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterMonth) params.append('month', filterMonth);
      if (isAdmin && filterRegion !== 'all') params.append('region_id', filterRegion);
      if (isAdmin && filterDistrict !== 'all') params.append('district_id', filterDistrict);
      params.append('countOnly', 'true');
      const countData = await apiRequest(`/api/reports?${params.toString()}`);
      setTotalReports(countData?.total || 0);
      onRefresh?.();
    } catch (error: any) {
      console.error('[ReportTable] Error deleting report:', error);
      toast.error(error.message || 'Failed to delete report');
    }
  };

  const getRegionName = (regionId: string | null) => {
    if (!regionId) return 'N/A';
    return regions.find(r => r.id === regionId)?.name || regionId;
  };

  const getDistrictName = (districtId: string | null) => {
    if (!districtId) return 'N/A';
    return districts.find(d => d.id === districtId)?.name || districtId;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                View and manage uploaded reports
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchReports(currentPage, pageSize)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-type">Report Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger id="filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-month">Month</Label>
              <Select value={filterMonth || '__all__'} onValueChange={(value) => setFilterMonth(value === '__all__' ? '' : value)}>
                <SelectTrigger id="filter-month">
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Months</SelectItem>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="filter-region">Region</Label>
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                  <SelectTrigger id="filter-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reports found
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      {isAdmin && <TableHead>Region</TableHead>}
                      {isAdmin && <TableHead>District</TableHead>}
                      <TableHead>Date & Time</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant={report.report_type === 'Weekly' ? 'default' : 'secondary'}
                          >
                            {report.report_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{report.uploaded_by_name || report.uploaded_by}</TableCell>
                        {isAdmin && (
                          <TableCell>{report.region_name || getRegionName(report.region_id)}</TableCell>
                        )}
                        {isAdmin && (
                          <TableCell>{report.district_name || getDistrictName(report.district_id)}</TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(report.upload_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              {report.file_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(report.file_size)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(report.file_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            {(isAdmin || report.uploaded_by === user?.id || report.uploaded_by === user?.uid) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setReportToDelete(report);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalReports > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalReports)} of {totalReports} reports
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="pageSize" className="text-sm whitespace-nowrap">Per page:</Label>
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger id="pageSize" className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || isLoading}
                        className="h-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1">Previous</span>
                      </Button>
                      
                      <div className="flex items-center gap-1 px-2">
                        <span className="text-sm">
                          Page {currentPage} of {Math.ceil(totalReports / pageSize) || 1}
                        </span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={currentPage >= Math.ceil(totalReports / pageSize) || isLoading}
                        className="h-8"
                      >
                        <span className="hidden sm:inline mr-1">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{reportToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setReportToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

