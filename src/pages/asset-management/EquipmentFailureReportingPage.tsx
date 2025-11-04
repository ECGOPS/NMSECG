import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Layout } from "@/components/layout/Layout";
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, RefreshCw, Search } from "lucide-react";
import { EquipmentFailureReportsTable } from '@/components/equipment-failure/EquipmentFailureReportsTable';
import { EquipmentFailureReportForm } from '@/components/equipment-failure/EquipmentFailureReportForm';
import { Input } from '@/components/ui/input';
import { PhotoService } from '@/services/PhotoService';
import { LoggingService } from '@/services/LoggingService';
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";

interface EquipmentFailureReport {
  id?: string;
  date: string;
  region: string;
  district: string;
  materialEquipmentName: string;
  typeOfMaterialEquipment: string;
  locationOfMaterialEquipment: string;
  ghanaPostGPS: string;
  nameOfManufacturer: string;
  serialNumber: string;
  manufacturingDate: string;
  countryOfOrigin: string;
  dateOfInstallation: string;
  dateOfCommission: string;
  descriptionOfMaterialEquipment: string;
  causeOfFailure: string;
  frequencyOfRepairs: string;
  historyOfRepairs: string;
  initialObservations: string;
  immediateActionsTaken: string;
  severityOfFault: string;
  preparedBy: string;
  contact: string;
  photo?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export default function EquipmentFailureReportingPage() {
  const { user, isAuthenticated } = useAzureADAuth();
  const { regions, districts, regionsLoading, districtsLoading } = useData();
  const navigate = useNavigate();
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();
  
  // State management
  const [activeTab, setActiveTab] = useState("reports");
  const [isReportFormOpen, setIsReportFormOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<EquipmentFailureReport | null>(null);
  const [editingReport, setEditingReport] = useState<EquipmentFailureReport | null>(null);
  
  // Data state
  const [reports, setReports] = useState<EquipmentFailureReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<EquipmentFailureReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Equipment types for filter
  const equipmentTypes = [
    'Transformer',
    'Switchgear',
    'Circuit Breaker',
    'Relay',
    'Cable',
    'Insulator',
    'Pole',
    'Meter',
    'Fuse',
    'Arrester',
    'Other'
  ];

  // Severity levels for filter
  const severityLevels = [
    'Low',
    'Medium',
    'High',
    'Critical'
  ];

  // Load reports from API with server-side pagination
  const loadReports = useCallback(async (page = currentPage, forceRefresh = false) => {
    if (!isAuthenticated) return;

    // Don't reload if we're already loading and it's not a force refresh
    if (isLoading && !forceRefresh) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add filters
      if (selectedDate) {
        params.append('date', selectedDate.toISOString().split('T')[0]);
      }
      if (selectedRegion && selectedRegion !== 'all') {
        params.append('region', selectedRegion);
      }
      if (selectedDistrict && selectedDistrict !== 'all') {
        params.append('district', selectedDistrict);
      }
      if (selectedType && selectedType !== 'all') {
        params.append('type', selectedType);
      }
      if (selectedSeverity && selectedSeverity !== 'all') {
        params.append('severity', selectedSeverity);
      }
      
      // Add pagination parameters
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());
      params.append('sortField', 'date');
      params.append('sortDirection', 'desc');
      
      console.log('Loading reports with params:', params.toString());
      try {
        const data = await apiRequest(`/api/equipment-failure-reports?${params.toString()}`);
        console.log('API response data:', data);
        
        // Update reports and pagination data
        setReports(data.records || []);
        setTotalRecords(data.total || 0);
        setTotalPages(data.totalPages || 0);
        
        // Update current page if it changed
        if (page !== currentPage) {
          setCurrentPage(page);
        }
        
        // Reset filtered reports to show current page data
        setFilteredReports(data.records || []);
        
        console.log(`Loaded ${data.records?.length || 0} reports out of ${data.total || 0} total`);
      } catch (error) {
        console.error('Error loading reports:', error);
        toast.error(error.message || 'Failed to load reports');
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, selectedDate, selectedRegion, selectedDistrict, selectedType, selectedSeverity, currentPage, pageSize, isLoading]);

  // Load reports on component mount
  useEffect(() => {
    loadReports(1, true);
  }, []);

  // Reload data when filters change (reset to page 1)
  useEffect(() => {
    if (currentPage === 1) {
      loadReports(1, true);
    } else {
      setCurrentPage(1);
    }
  }, [selectedDate, selectedRegion, selectedDistrict, selectedType, selectedSeverity]);

  // Debug: Log regions and districts
  useEffect(() => {
    console.log('Regions loaded:', regions);
    console.log('Districts loaded:', districts);
    console.log('Regions loading:', regionsLoading);
    console.log('Districts loading:', districtsLoading);
    console.log('Regions length:', regions?.length);
    console.log('Districts length:', districts?.length);
  }, [regions, districts, regionsLoading, districtsLoading]);

  // Debug: Log reports data
  useEffect(() => {
    console.log('Reports loaded:', reports);
    console.log('Filtered reports:', filteredReports);
    console.log('Reports length:', reports?.length);
    console.log('Filtered reports length:', filteredReports?.length);
  }, [reports, filteredReports]);

  // Apply search filter
  useEffect(() => {
    let filtered = reports;
    
    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.materialEquipmentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.typeOfMaterialEquipment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.locationOfMaterialEquipment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.preparedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.district?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredReports(filtered);
  }, [reports, searchTerm]);

  // Handle adding new report
  const handleAddReport = () => {
    setEditingReport(null);
    setIsReportFormOpen(true);
  };

  // Handle editing report
  const handleEditReport = (report: EquipmentFailureReport) => {
    setEditingReport(report);
    setIsReportFormOpen(true);
  };

  // Handle viewing report details
  const handleViewReport = (report: EquipmentFailureReport) => {
    setSelectedReport(report);
    setIsDetailsDialogOpen(true);
  };

  // Handle deleting report
  const handleDeleteReport = (report: EquipmentFailureReport) => {
    if (!report.id) return;
    
    // Open confirmation dialog
    const reportName = report.materialEquipmentName || report.id;
    openDeleteDialog(report.id, reportName, 'equipment failure report', report);
  };

  const performDeleteReport = async (id: string, data: any) => {
    const report = data as EquipmentFailureReport;
    
    try {
      // Log the delete action before deleting
      await LoggingService.getInstance().logDeleteAction(
        user?.id || 'unknown',
        user?.name || 'unknown',
        user?.role || 'unknown',
        'equipment_failure_report',
        report.id,
        report, // deleted data
        `Deleted equipment failure report: ${report.materialEquipmentName}`,
        report.region,
        report.district
      );

      await apiRequest(`/api/equipment-failure-reports/${report.id}`, {
        method: 'DELETE'
      });
      
      toast.success('Report deleted successfully');
      // Reload current page after deletion
      loadReports(currentPage, true);
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  // Handle saving report (create or update)
  const handleSaveReport = (report: EquipmentFailureReport) => {
    setIsReportFormOpen(false);
    // Reload current page after saving
    loadReports(currentPage, true);
  };

  // Handle resetting filters
  const handleResetFilters = () => {
    setSelectedDate(null);
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setSelectedType(null);
    setSelectedSeverity(null);
    setSearchTerm("");
    setCurrentPage(1);
    // Reload first page after resetting filters
    setTimeout(() => loadReports(1, true), 0);
  };

  // Check if any filters are active
  const hasActiveFilters = selectedDate || selectedRegion || selectedDistrict || selectedType || selectedSeverity || searchTerm;

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    loadReports(newPage);
  };

  // Add loading state for pagination
  const isPageChanging = isLoading && reports.length > 0;

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
            <AccessControlWrapper type="asset">
      <Layout>
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equipment Failure Reporting</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Report and manage equipment failures and material issues for proper documentation and analysis
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              {hasActiveFilters && (
                <p className="text-sm text-muted-foreground mt-2">
                  {filteredReports.length} of {totalRecords} reports
                </p>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {(user?.role === 'global_engineer' || user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager' || user?.role === 'technician' || user?.role === 'system_admin' || user?.role === 'ashsubt' || user?.role === 'accsubt') && (
                <Button 
                  onClick={handleAddReport}
                  className="w-full sm:w-auto min-h-[44px] touch-manipulation"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Report
                </Button>
              )}
              
                             <Button 
                 variant="outline" 
                 onClick={() => loadReports(currentPage, true)}
                 disabled={isLoading}
                 className="w-full sm:w-auto min-h-[44px] touch-manipulation"
               >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>



          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </div>
            
            {(user?.role === 'global_engineer' || user?.role === 'system_admin') && (
              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={selectedRegion || 'all'}
                  onValueChange={setSelectedRegion}
                  disabled={regionsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={regionsLoading ? "Loading regions..." : "All Regions"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions?.map((region) => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {(user?.role === 'global_engineer' || user?.role === 'system_admin') && (
              <div className="space-y-2">
                <Label>District/Section</Label>
                <Select
                  value={selectedDistrict || 'all'}
                  onValueChange={setSelectedDistrict}
                  disabled={districtsLoading || regionsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={districtsLoading || regionsLoading ? "Loading districts/sections..." : "All Districts/Sections"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts/Sections</SelectItem>
                    {districts?.filter(d => {
                      if (!selectedRegion || selectedRegion === 'all') return true;
                      const region = regions?.find(r => r.name === selectedRegion);
                      return region && d.regionId === region.id;
                    }).map((district) => (
                      <SelectItem key={district.id} value={district.name}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Equipment Type</Label>
              <Select
                value={selectedType || 'all'}
                onValueChange={setSelectedType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {equipmentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={selectedSeverity || 'all'}
                onValueChange={setSelectedSeverity}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  {severityLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                className="w-full sm:w-auto"
              >
                Reset Filters
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-1">
              <TabsTrigger value="reports">Failure Reports</TabsTrigger>
            </TabsList>

                         <TabsContent value="reports" className="space-y-4">
               {isLoading && reports.length === 0 ? (
                 <div className="flex items-center justify-center py-12">
                   <div className="text-center">
                     <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                     <p className="text-muted-foreground">Loading equipment failure reports...</p>
                   </div>
                 </div>
               ) : (
                 <EquipmentFailureReportsTable 
                   reports={filteredReports}
                   allReports={reports}
                   onEdit={handleEditReport}
                   onDelete={handleDeleteReport}
                   onView={handleViewReport}
                   userRole={user?.role}
                 />
               )}
              
                             {/* Pagination Controls */}
               {totalRecords > 0 && (
                 <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t gap-4">
                   <div className="flex items-center gap-4">
                     <div className="text-sm text-muted-foreground">
                       {isPageChanging ? (
                         <div className="flex items-center gap-2">
                           <RefreshCw className="h-4 w-4 animate-spin" />
                           Loading page {currentPage}...
                         </div>
                       ) : (
                         `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalRecords)} of ${totalRecords} results`
                       )}
                     </div>
                     
                     {/* Page Size Selector */}
                     <div className="flex items-center gap-2">
                       <Label htmlFor="pageSize" className="text-sm">Show:</Label>
                       <Select
                         value={pageSize.toString()}
                         onValueChange={(value) => {
                           const newPageSize = parseInt(value);
                           setPageSize(newPageSize);
                           setCurrentPage(1);
                           setTimeout(() => loadReports(1, true), 0);
                         }}
                         disabled={isPageChanging}
                       >
                         <SelectTrigger className="w-20">
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
                   </div>
                   
                   {/* Pagination Navigation */}
                   {totalPages > 1 && (
                     <div className="flex items-center space-x-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={handlePreviousPage}
                         disabled={currentPage === 1 || isPageChanging}
                       >
                         {isPageChanging ? (
                           <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                         ) : null}
                         Previous
                       </Button>
                       
                                                {/* Page Numbers */}
                         <div className="flex items-center space-x-1">
                           {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                             let pageNum;
                             if (totalPages <= 5) {
                               pageNum = i + 1;
                             } else if (currentPage <= 3) {
                               pageNum = i + 1;
                             } else if (currentPage >= totalPages - 2) {
                               pageNum = totalPages - 4 + i;
                             } else {
                               pageNum = currentPage - 2 + i;
                             }
                             
                             return (
                               <Button
                                 key={pageNum}
                                 variant={currentPage === pageNum ? "default" : "outline"}
                                 size="sm"
                                 onClick={() => handlePageChange(pageNum)}
                                 disabled={isPageChanging}
                                 className="w-8 h-8 p-0"
                               >
                                 {pageNum}
                               </Button>
                             );
                           })}
                         </div>
                         
                         {/* Go to Page Input */}
                         {totalPages > 5 && (
                           <div className="flex items-center gap-2 ml-2">
                             <span className="text-sm text-muted-foreground">Go to:</span>
                             <Input
                               type="number"
                               min={1}
                               max={totalPages}
                               value={currentPage}
                               onChange={(e) => {
                                 const page = parseInt(e.target.value);
                                 if (page >= 1 && page <= totalPages) {
                                   handlePageChange(page);
                                 }
                               }}
                               className="w-16 h-8 text-center"
                               disabled={isPageChanging}
                             />
                             <span className="text-sm text-muted-foreground">of {totalPages}</span>
                           </div>
                         )}
                       
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={handleNextPage}
                         disabled={currentPage === totalPages || isPageChanging}
                       >
                         Next
                         {isPageChanging ? (
                           <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                         ) : null}
                       </Button>
                     </div>
                   )}
                 </div>
               )}
            </TabsContent>
          </Tabs>

          {/* Report Form Sheet */}
          <Sheet open={isReportFormOpen} onOpenChange={setIsReportFormOpen}>
            <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingReport ? "Edit Equipment Failure Report" : "New Equipment Failure Report"}
                </SheetTitle>
                <SheetDescription>
                  {editingReport ? "Update the equipment failure report details below." : "Fill in the equipment failure report details below."}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <EquipmentFailureReportForm
                  report={editingReport}
                  regions={regions}
                  districts={districts}
                  user={user}
                  onSave={handleSaveReport}
                  onCancel={() => setIsReportFormOpen(false)}
                  isEditing={!!editingReport}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Report Details Dialog */}
          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Equipment Failure Report Details</DialogTitle>
                <DialogDescription>
                  View detailed information about the equipment failure report.
                </DialogDescription>
              </DialogHeader>
              {selectedReport && (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Date</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.date}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Region</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.region}</p>
                      </div>
                      <div>
                                        <Label className="text-sm font-medium">District/Section</Label>
                <p className="text-sm text-muted-foreground">{selectedReport.district}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Equipment Name</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.materialEquipmentName}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Equipment Type</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.typeOfMaterialEquipment}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Location</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.locationOfMaterialEquipment}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Technical Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Technical Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Manufacturer</Label>
                          <p className="text-sm text-muted-foreground">{selectedReport.nameOfManufacturer || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Serial Number</Label>
                          <p className="text-sm text-muted-foreground">{selectedReport.serialNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Country of Origin</Label>
                          <p className="text-sm text-muted-foreground">{selectedReport.countryOfOrigin || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">GPS Coordinates</Label>
                          <p className="text-sm text-muted-foreground">{selectedReport.ghanaPostGPS || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Description</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.descriptionOfMaterialEquipment || 'N/A'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dates */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Important Dates</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Manufacturing Date</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.manufacturingDate || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Date of Installation</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.dateOfInstallation || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Date of Commission</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.dateOfCommission || 'N/A'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Failure Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Failure Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Cause of Failure</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.causeOfFailure || 'N/A'}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Severity</Label>
                          <p className="text-sm text-muted-foreground">{selectedReport.severityOfFault || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Frequency of Repairs</Label>
                          <p className="text-sm text-muted-foreground">{selectedReport.frequencyOfRepairs || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">History of Repairs</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.historyOfRepairs || 'N/A'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions and Observations */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Actions and Observations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Initial Observations</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.initialObservations || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Immediate Actions Taken</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.immediateActionsTaken || 'N/A'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Prepared By</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.preparedBy}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Contact</Label>
                        <p className="text-sm text-muted-foreground">{selectedReport.contact}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Photos */}
                  {selectedReport.photo && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Equipment Photos</CardTitle>
                        <CardDescription>
                          Photos captured during the equipment failure inspection
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {selectedReport.photo.split(',').filter(url => url.trim()).map((photoUrl, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={PhotoService.getInstance().convertToProxyUrl(photoUrl)}
                                alt={`Equipment photo ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border border-gray-200"
                                onError={(e) => {
                                  // Handle broken images
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                  onClick={() => window.open(PhotoService.getInstance().convertToProxyUrl(photoUrl), '_blank')}
                                >
                                  View Full Size
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {selectedReport.photo.split(',').filter(url => url.trim()).length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No photos available for this report</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Metadata */}
                  {(selectedReport.createdAt || selectedReport.updatedAt) && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Report Metadata</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedReport.createdAt && (
                          <div>
                            <Label className="text-sm font-medium">Created</Label>
                            <p className="text-sm text-muted-foreground">
                              {new Date(selectedReport.createdAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {selectedReport.updatedAt && (
                          <div>
                            <Label className="text-sm font-medium">Last Updated</Label>
                            <p className="text-sm text-muted-foreground">
                              {new Date(selectedReport.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <DeleteConfirmationDialog
            isOpen={isOpen}
            onClose={closeDeleteDialog}
            onConfirm={() => confirmDelete(performDeleteReport)}
            title="Delete Equipment Failure Report"
            itemName={deleteItem?.name}
            itemType="equipment failure report"
            isLoading={isDeleting}
            warningMessage="This action cannot be undone. This will permanently delete the equipment failure report and remove all associated data from the system."
          />
        </div>
      </Layout>
    </AccessControlWrapper>
  );
}
