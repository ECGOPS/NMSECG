import { useState, useEffect } from "react";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isValid, parseISO } from "date-fns";
import LoggingService, { LogEntry } from "@/services/LoggingService";

// Extended interface to match actual backend response
interface UserLog extends LogEntry {
  // No additional properties needed - LogEntry already has everything we need
}

import { Loader2, ArrowLeft, Download, Filter, RefreshCw, ChevronLeft, ChevronRight, Trash2, X, Activity, Users, Shield, Database, Eye, Calendar, MapPin, User, FileText, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PermissionService } from "@/services/PermissionService";

export default function UserLogsPage() {
  const { user } = useAzureADAuth();
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const [selectedLog, setSelectedLog] = useState<UserLog | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const loggingService = LoggingService.getInstance();

  const actions = ["Create", "Update", "Delete", "View"];
  const entityTypes = [
    "Outage", 
    "User", 
    "Broadcast", 
    "Feeder", 
    "VITAsset", 
    "VITInspection", 
    "SubstationInspection", 
    "OverheadLineInspection",
    "LoadMonitoring",
    "DistrictPopulation"
  ];

  // Check permissions
  const canViewLogs = user?.role ? permissionService.canAccessFeature(user.role, 'user_logs') : false;
  const canDeleteLogs = user?.role ? permissionService.canDeleteFeature(user.role, 'user_logs') : false;
  const canDeleteAllLogs = user?.role ? permissionService.canAccessFeature(user.role, 'user_logs_delete_all') : false;

  useEffect(() => {
    if (!canViewLogs) {
      toast.error("You don't have permission to view user logs");
      navigate("/dashboard");
      return;
    }
    fetchLogs();
  }, [startDate, endDate, selectedAction, selectedEntityType, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, selectedAction, selectedEntityType]);

  const fetchLogs = async () => {
    if (isPageChanging) {
      setIsPageChanging(true);
    } else {
    setIsLoading(true);
    }
    
    try {
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        action: selectedAction === "all" ? undefined : selectedAction,
        resourceType: selectedEntityType === "all" ? undefined : selectedEntityType
      };
      
      const pagination = {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage
      };
      
      // Fetch logs with pagination
      const logs = await loggingService.getLogs(filters, pagination);
      setLogs(logs as UserLog[]);
      
      // Fetch total count for pagination
      const total = await loggingService.getLogsCount(filters);
      setTotalLogs(total);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to fetch logs");
    } finally {
      setIsLoading(false);
      setIsPageChanging(false);
    }
  };

  const handlePageChange = (page: number) => {
    setIsPageChanging(true);
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleLogClick = (log: UserLog) => {
    setSelectedLog(log);
    setIsDialogOpen(true);
  };

  const exportToCSV = async () => {
    try {
      toast.info("Preparing export...");
      
      // Fetch all logs for export (without pagination)
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        action: selectedAction === "all" ? undefined : selectedAction,
        resourceType: selectedEntityType === "all" ? undefined : selectedEntityType
      };
      
      // Get all logs for export (limit to 10000 to prevent memory issues)
      const allLogs = await loggingService.getLogs(filters, { limit: 10000, offset: 0 });
      
      const headers = ["Region", "District/Section", "Timestamp", "User", "Role", "Action", "Resource Type", "Description", "Changes", "Actions"];
    const csvContent = [
      headers.join(","),
        ...allLogs.map(log => [
        log.region || "",
        log.district || "",
        log.timestamp,
        log.userName,
        log.userRole,
        log.action,
          log.resourceType || "",
          log.description || "",
          log.changes ? JSON.stringify(log.changes) : (log.oldValues && log.newValues ? `Before: ${JSON.stringify(log.oldValues)}, After: ${JSON.stringify(log.newValues)}` : ""),
          "View Details Available"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
      toast.success(`Exported ${allLogs.length} logs to CSV`);
    } catch (error) {
      console.error("Error exporting logs:", error);
      toast.error("Failed to export logs");
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-300 shadow-sm";
      case "update":
      case "edit":
        return "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border-blue-300 shadow-sm";
      case "delete":
        return "bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border-red-300 shadow-sm";
      case "view":
        return "bg-gradient-to-r from-slate-50 to-gray-50 text-slate-800 border-slate-300 shadow-sm";
      default:
        return "bg-gradient-to-r from-slate-50 to-gray-50 text-slate-800 border-slate-300 shadow-sm";
    }
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedAction("all");
    setSelectedEntityType("all");
    setCurrentPage(1); // Reset to first page when clearing filters
  };

  const deleteAllLogs = async () => {
    try {
      await loggingService.clearLogs();
      toast.success("All logs cleared successfully");
      fetchLogs();
    } catch (error) {
      console.error("Error clearing logs:", error);
      toast.error("Failed to clear logs");
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalLogs / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalLogs);
  const currentLogs = logs; // No need to slice since we're getting paginated data from server

  if (!canViewLogs) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-slate-200">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view user logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
        <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-xl">
                <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Audit Logs</h1>
                <p className="text-slate-600 mt-1 text-sm sm:text-base">Comprehensive tracking of all system activities and changes</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
                className="flex items-center justify-center space-x-2 border-slate-300 hover:bg-slate-50 w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Dashboard</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
                className="flex items-center justify-center space-x-2 border-slate-300 hover:bg-slate-50 w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm">Refresh</span>
          </Button>
          <Button
            onClick={exportToCSV}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm">Export CSV</span>
          </Button>
          {canDeleteAllLogs && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="flex items-center justify-center space-x-2 w-full sm:w-auto">
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">Clear All</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Logs</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all user logs.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAllLogs} className="bg-red-600 hover:bg-red-700">
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-blue-100">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Database className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-blue-600">Total Logs</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-900">{totalLogs.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-green-100">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-green-600">Current Page</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-900">{currentPage} of {totalPages || 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-r from-purple-50 to-purple-100 sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-purple-600">Items Per Page</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-900">{itemsPerPage}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center space-x-2 mb-4 sm:mb-6">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Filter className="h-4 w-4 text-slate-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Search & Filters</h2>
      </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="space-y-3">
              <Label htmlFor="startDate" className="text-sm font-medium text-slate-700">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="endDate" className="text-sm font-medium text-slate-700">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="action" className="text-sm font-medium text-slate-700">Action Type</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="entityType" className="text-sm font-medium text-slate-700">Resource Type</Label>
              <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {entityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-center sm:justify-end mt-4 sm:mt-6 pt-4 border-t border-slate-200">
            <Button 
              variant="outline" 
              onClick={clearFilters} 
              className="flex items-center space-x-2 border-slate-300 hover:bg-slate-50 text-slate-700 w-full sm:w-auto"
            >
              <X className="h-4 w-4" />
              <span className="text-sm">Clear All Filters</span>
            </Button>
          </div>
        </div>

        {/* Logs Table Section */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center space-x-3 text-slate-900">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div>
                  <span className="text-lg sm:text-xl font-bold">Audit Logs</span>
                  <p className="text-xs sm:text-sm text-slate-600 font-normal mt-1">System activity and change tracking</p>
                </div>
              </CardTitle>
              <div className="text-left sm:text-right">
                <div className="text-xs sm:text-sm font-medium text-slate-700">
                  Showing {startIndex + 1}-{endIndex} of {totalLogs.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {totalPages} page{totalPages !== 1 ? 's' : ''} total
                </div>
              </div>
            </div>
        </CardHeader>
          <CardContent className="p-0">
            {isPageChanging && (
              <div className="flex items-center justify-center py-6 sm:py-8 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-blue-600" />
                  <div className="text-center">
                    <span className="text-xs sm:text-sm font-semibold text-blue-700">Loading page {currentPage}...</span>
                    <p className="text-xs text-blue-600 mt-1">Please wait while we fetch the data</p>
                  </div>
                </div>
              </div>
            )}
            
          <div className="overflow-x-auto">
            <ScrollArea className="h-[500px] sm:h-[650px]">
              <Table className="relative min-w-[1200px]">
              <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 hover:bg-slate-100 border-b-2 border-slate-200">
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[100px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span className="hidden sm:inline">Region</span>
                        <span className="sm:hidden">Reg</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[120px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span className="hidden sm:inline">District/Section</span>
                        <span className="sm:hidden">District</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[120px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span className="hidden sm:inline">Timestamp</span>
                        <span className="sm:hidden">Time</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[120px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <User className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span>User</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[100px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span>Role</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[100px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span>Action</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[120px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Database className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span className="hidden sm:inline">Resource Type</span>
                        <span className="sm:hidden">Type</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[150px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span className="hidden sm:inline">Description</span>
                        <span className="sm:hidden">Desc</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 min-w-[150px]">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span className="hidden sm:inline">Changes</span>
                        <span className="sm:hidden">Chg</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-800 text-xs sm:text-sm uppercase tracking-wide py-3 px-3 sm:py-4 sm:px-6 text-center min-w-[100px]">
                      <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4 text-slate-600" />
                        <span className="hidden sm:inline">Actions</span>
                        <span className="sm:hidden">Act</span>
                      </div>
                    </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={10} className="text-center py-16">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="relative">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-200 rounded-full animate-pulse"></div>
                          </div>
                          <div className="text-center">
                            <p className="text-slate-700 font-semibold text-lg">Loading audit logs...</p>
                            <p className="text-slate-500 text-sm mt-1">Please wait while we fetch the latest data</p>
                          </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : currentLogs.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={10} className="text-center py-16">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                            <Database className="h-10 w-10 text-slate-400" />
                          </div>
                          <div className="text-center">
                            <p className="text-slate-700 font-semibold text-lg">No logs found</p>
                            <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or check back later</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={clearFilters}
                              className="mt-4 border-slate-300 hover:bg-slate-50"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Clear Filters
                            </Button>
                          </div>
                        </div>
                    </TableCell>
                  </TableRow>
                ) : (
                    currentLogs.map((log, index) => (
                      <TableRow 
                        key={log.id} 
                        className={`group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 cursor-pointer transition-all duration-200 border-b border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}
                        onClick={() => handleLogClick(log)}
                      >
                        <TableCell className="py-3 px-3 sm:py-4 sm:px-6">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            <span className="font-medium text-slate-900 text-xs sm:text-sm truncate">
                          {log.region || <span className="text-slate-400 italic">-</span>}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-3 sm:py-4 sm:px-6">
                          <span className="text-slate-700 font-medium text-xs sm:text-sm truncate block">
                          {log.district || <span className="text-slate-400 italic">-</span>}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-3 sm:py-4 sm:px-6 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-slate-700 font-medium text-xs">
                        {(() => {
                          try {
                            const date = new Date(log.timestamp);
                            if (isValid(date)) {
                                      return format(date, "MMM dd");
                            } else {
                                      return <span className="text-red-500 text-xs">Invalid</span>;
                            }
                          } catch (error) {
                                    return <span className="text-red-500 text-xs">Invalid</span>;
                          }
                        })()}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {(() => {
                                try {
                                  const date = new Date(log.timestamp);
                                  if (isValid(date)) {
                                      return format(date, "HH:mm");
                                  } else {
                                      return "";
                                  }
                                } catch (error) {
                                    return "";
                                }
                              })()}
                            </span>
                          </div>
                      </TableCell>
                        <TableCell className="py-3 px-3 sm:py-4 sm:px-6">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {log.userName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <span className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{log.userName}</span>
                          </div>
                        </TableCell>
                      <TableCell className="py-3 px-3 sm:py-4 sm:px-6">
                          <Badge variant="outline" className="font-medium text-xs px-2 py-1 bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors">
                          <span className="hidden sm:inline">{log.userRole.replace(/_/g, ' ')}</span>
                          <span className="sm:hidden">{log.userRole.split('_')[0]}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-3 sm:py-4 sm:px-6">
                          <Badge className={`${getActionColor(log.action)} font-semibold text-xs px-2 py-1 border shadow-sm`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 px-3 sm:py-4 sm:px-6">
                          <Badge variant="secondary" className="font-medium text-xs px-2 py-1 bg-slate-100 text-slate-700 border-slate-200">
                            <span className="hidden sm:inline">{log.resourceType || "-"}</span>
                            <span className="sm:hidden">{log.resourceType?.substring(0, 8) || "-"}</span>
                        </Badge>
                      </TableCell>
                        <TableCell className="py-3 px-3 sm:py-4 sm:px-6 max-w-xs">
                          <div className="truncate group-hover:whitespace-normal group-hover:break-words" title={log.description || ""}>
                            <span className="text-slate-700 text-xs sm:text-sm">
                              {log.description ? (log.description.length > 20 ? `${log.description.substring(0, 20)}...` : log.description) : <span className="text-slate-400 italic">-</span>}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-3 sm:py-4 sm:px-6 max-w-xs">
                          {log.changes && Object.keys(log.changes).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(log.changes).slice(0, 1).map(([field, change]) => (
                                <div key={field} className="text-xs bg-blue-50 p-1.5 sm:p-2 rounded-md border border-blue-200 shadow-sm">
                                  <span className="font-semibold text-blue-800 text-xs">{field}:</span>
                                  <div className="mt-1 space-y-1">
                                    <div className="text-blue-600 text-xs">
                                      <span className="font-medium">Old:</span> {JSON.stringify(change.old).substring(0, 15)}...
                                    </div>
                                    <div className="text-blue-700 text-xs">
                                      <span className="font-medium">New:</span> {JSON.stringify(change.new).substring(0, 15)}...
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {Object.keys(log.changes).length > 1 && (
                                <div className="text-xs text-blue-600 font-medium bg-blue-100 px-1.5 py-0.5 rounded">
                                  +{Object.keys(log.changes).length - 1}
                                </div>
                              )}
                            </div>
                          ) : log.oldValues && log.newValues ? (
                            <div className="text-xs bg-green-50 p-1.5 sm:p-2 rounded-md border border-green-200 shadow-sm">
                              <div className="text-green-800 font-semibold mb-1 text-xs">B/A</div>
                              <div className="space-y-1">
                                <div className="text-green-600 text-xs">
                                  <span className="font-medium">B:</span> {JSON.stringify(log.oldValues).substring(0, 10)}...
                                </div>
                                <div className="text-green-700 text-xs">
                                  <span className="font-medium">A:</span> {JSON.stringify(log.newValues).substring(0, 10)}...
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-3 sm:py-4 sm:px-6 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLogClick(log);
                            }}
                            className="flex items-center justify-center space-x-1 sm:space-x-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto"
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline text-xs">View</span>
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          </div>

            {/* Pagination Controls */}
            <div className="border-t border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="itemsPerPage" className="text-xs sm:text-sm font-semibold text-slate-700">Items per page:</Label>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={handleItemsPerPageChange}
              >
                        <SelectTrigger id="itemsPerPage" className="w-20 sm:w-24 border-slate-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
                  </div>
                  <div className="hidden sm:block w-px h-6 bg-slate-300"></div>
                  <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
                    <span className="font-semibold text-slate-700">{startIndex + 1}-{endIndex}</span> of <span className="font-semibold text-slate-700">{totalLogs.toLocaleString()}</span> logs
                  </div>
            </div>
                
            <div className="flex items-center justify-center gap-2 sm:gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1 || isPageChanging}
                      className="w-8 h-8 sm:w-10 sm:h-10 p-0 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                >
                  <span className="text-xs font-semibold">«</span>
                </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isPageChanging}
                      className="w-8 h-8 sm:w-10 sm:h-10 p-0 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
              >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              </div>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage <= 2) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 1) {
                        pageNum = totalPages - 2 + i;
                      } else {
                        pageNum = currentPage - 1 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          disabled={isPageChanging}
                          className={`w-8 h-8 sm:w-10 sm:h-10 p-0 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                            currentPage === pageNum 
                              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" 
                              : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                          }`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
              <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || isPageChanging}
                      className="w-8 h-8 sm:w-10 sm:h-10 p-0 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages || isPageChanging}
                      className="w-8 h-8 sm:w-10 sm:h-10 p-0 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                >
                  <span className="text-xs font-semibold">»</span>
              </Button>
              </div>
            </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log Details Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[98vw] h-[98vh] sm:w-[90vw] sm:h-[90vh] md:w-[80vw] md:h-[85vh] lg:max-w-4xl lg:max-h-[90vh] overflow-hidden flex flex-col p-0 m-2 sm:m-4">
            <DialogHeader className="pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6 flex-shrink-0 border-b border-slate-200">
              <DialogTitle className="flex items-center space-x-2 text-base sm:text-lg">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span>Audit Log Details</span>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-600 mt-1">
                Comprehensive view of all changes and metadata for this audit log entry
              </DialogDescription>
            </DialogHeader>
            
            {selectedLog && (
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
                <div className="space-y-3 sm:space-y-4">
                {/* Basic Information */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-slate-600" />
                      <span>Basic Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">Action Type</Label>
                        <Badge className={`${getActionColor(selectedLog.action)} text-xs sm:text-sm px-2 sm:px-3 py-1`}>
                          {selectedLog.action}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">Resource Type</Label>
                        <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                          {selectedLog.resourceType || "N/A"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">Resource ID</Label>
                        <p className="text-xs sm:text-sm text-slate-900 font-mono bg-slate-100 px-2 py-1 rounded break-all">
                          {selectedLog.resourceId || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">Description</Label>
                        <p className="text-xs sm:text-sm text-slate-900 break-words">
                          {selectedLog.description || "No description provided"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* User Information */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                      <User className="h-4 w-4 text-slate-600" />
                      <span>User Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">User Name</Label>
                        <p className="text-xs sm:text-sm text-slate-900 font-medium break-words">{selectedLog.userName}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">User Role</Label>
                        <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                          {selectedLog.userRole.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">User ID</Label>
                        <p className="text-xs sm:text-sm text-slate-900 font-mono bg-slate-100 px-2 py-1 rounded break-all">
                          {selectedLog.userId}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Location Information */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-slate-600" />
                      <span>Location Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">Region</Label>
                        <p className="text-xs sm:text-sm text-slate-900 break-words">
                          {selectedLog.region || <span className="text-slate-400 italic">Not specified</span>}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">District/Section</Label>
                        <p className="text-xs sm:text-sm text-slate-900 break-words">
                          {selectedLog.district || <span className="text-slate-400 italic">Not specified</span>}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timestamp Information */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                      <span>Timestamp Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">Timestamp</Label>
                        <p className="text-xs sm:text-sm text-slate-900 font-mono break-words">
                          {(() => {
                            try {
                              const date = new Date(selectedLog.timestamp);
                              if (isValid(date)) {
                                return format(date, "MMM dd, yyyy 'at' HH:mm:ss");
                              } else {
                                return "Invalid Date";
                              }
                            } catch (error) {
                              return "Invalid Date";
                            }
                          })()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-medium text-slate-600">Relative Time</Label>
                        <p className="text-xs sm:text-sm text-slate-900">
                          {(() => {
                            try {
                              const date = new Date(selectedLog.timestamp);
                              const now = new Date();
                              const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
                              
                              if (diffInMinutes < 1) return "Just now";
                              if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
                              if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
                              return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''} ago`;
                            } catch (error) {
                              return "Unknown";
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Changes Information */}
                {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2 p-3 sm:p-4">
                      <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span>Detailed Changes</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
                      <div className="space-y-3 sm:space-y-4">
                        {Object.entries(selectedLog.changes).map(([field, change]) => (
                          <div key={field} className="border border-blue-200 rounded-lg p-3 sm:p-4 bg-blue-50/50">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                              <h4 className="font-semibold text-blue-900 capitalize text-sm sm:text-base break-words">{field}</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs sm:text-sm font-medium text-blue-700">Previous Value</Label>
                                <div className="bg-white p-2 sm:p-3 rounded border border-blue-200 overflow-x-auto">
                                  <pre className="text-xs sm:text-sm text-blue-800 whitespace-pre-wrap break-words">
                                    {JSON.stringify(change.old, null, 2)}
                                  </pre>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs sm:text-sm font-medium text-blue-700">New Value</Label>
                                <div className="bg-white p-2 sm:p-3 rounded border border-blue-200 overflow-x-auto">
                                  <pre className="text-xs sm:text-sm text-blue-800 whitespace-pre-wrap break-words">
                                    {JSON.stringify(change.new, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Before/After Values */}
                {selectedLog.oldValues && selectedLog.newValues && Object.keys(selectedLog.oldValues).length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2 p-3 sm:p-4">
                      <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-green-600" />
                        <span>Before & After Values</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-3 sm:p-4 pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm font-medium text-green-700">Before (Old Values)</Label>
                          <div className="bg-white p-2 sm:p-3 rounded border border-green-200 max-h-48 sm:max-h-60 overflow-y-auto">
                            <pre className="text-xs sm:text-sm text-green-800 whitespace-pre-wrap break-words">
                              {JSON.stringify(selectedLog.oldValues, null, 2)}
                            </pre>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs sm:text-sm font-medium text-green-700">After (New Values)</Label>
                          <div className="bg-white p-2 sm:p-3 rounded border border-green-200 max-h-48 sm:max-h-60 overflow-y-auto">
                            <pre className="text-xs sm:text-sm text-green-800 whitespace-pre-wrap break-words">
                              {JSON.stringify(selectedLog.newValues, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Metadata */}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2 p-3 sm:p-4">
                      <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                        <Database className="h-4 w-4 text-purple-600" />
                        <span>Additional Metadata</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0">
                      <div className="bg-white p-2 sm:p-3 rounded border border-purple-200 max-h-48 sm:max-h-60 overflow-y-auto">
                        <pre className="text-xs sm:text-sm text-purple-800 whitespace-pre-wrap break-words">
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Raw Data */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 p-3 sm:p-4">
                    <CardTitle className="text-sm sm:text-base flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-slate-600" />
                      <span>Raw Log Data</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="bg-slate-100 p-2 sm:p-3 rounded border border-slate-200 max-h-48 sm:max-h-60 overflow-y-auto">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words">
                        {JSON.stringify(selectedLog, null, 2)}
                      </pre>
          </div>
        </CardContent>
      </Card>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 