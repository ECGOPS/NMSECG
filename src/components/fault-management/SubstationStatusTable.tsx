import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, FileEdit, Trash2, Eye, Download, FileDown } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PermissionService } from '@/services/PermissionService';
import { UserRole } from '@/lib/types';
import { PhotoService } from '@/services/PhotoService';
import { SubstationStatus } from '@/lib/types';

interface SubstationStatusTableProps {
  substationStatuses: SubstationStatus[];
  onEdit: (status: SubstationStatus) => void;
  onDelete: (id: string) => void;
  onView: (status: SubstationStatus) => void;
  onStatusUpdate?: (id: string, newStatus: string) => void;
  userRole: UserRole | undefined;
  regions?: { id: string; name: string }[];
  districts?: { id: string; name: string; regionId: string }[];
  // Pagination props
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function SubstationStatusTable({
  substationStatuses,
  onEdit,
  onDelete,
  onView,
  onStatusUpdate,
  userRole,
  regions = [],
  districts = [],
  // Pagination props
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  isLoading = false
}: SubstationStatusTableProps) {
  
  console.log('SubstationStatusTable - User role:', userRole);
  
  const permissionService = PermissionService.getInstance();
  
  // Helper functions to check permissions
  const canEditStatus = (userRole: UserRole | undefined) => {
    return permissionService.canUpdateFeature(userRole || null, 'substation_status');
  };

  const canDeleteStatus = (userRole: UserRole | undefined) => {
    return permissionService.canDeleteFeature(userRole || null, 'substation_status');
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 border-green-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Helper functions to get region and district names
  const getRegionName = (regionId: string) => {
    return regions.find(r => r.id === regionId)?.name || regionId;
  };

  const getDistrictName = (districtId: string) => {
    return districts.find(d => d.id === districtId)?.name || districtId;
  };

  // Comprehensive PDF export for individual substation status
  const exportToPDF = async (status: SubstationStatus) => {
    try {
      const photoCount = status.images ? status.images.length : 0;
      if (photoCount > 0) {
        toast.info(`Generating PDF with ${photoCount} photo${photoCount !== 1 ? 's' : ''}... This may take a moment.`);
      } else {
        toast.info('Generating PDF...');
      }
      
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Substation Status Report', 14, 20);
      
      // Add report ID and date
      doc.setFontSize(12);
      doc.text(`Report ID: ${status.id || 'N/A'}`, 14, 30);
      doc.text(`Date: ${status.date ? format(new Date(status.date), "dd/MM/yyyy") : 'N/A'}`, 14, 37);
      doc.text(`Time: ${status.time || 'N/A'}`, 14, 44);
      
      // Basic Information
      doc.text('Basic Information', 14, 54);
             const basicInfo = [
         ['Region:', getRegionName(status.region) || 'N/A'],
         ['District/Section:', getDistrictName(status.district) || 'N/A'],
        ['Substation Number:', status.substationNumber || 'N/A'],
        ['Substation Name:', status.substationName || 'N/A'],
        ['Rating:', status.rating || 'N/A'],
        ['Transformer Type:', status.transformerType || 'N/A'],
        ['Location:', status.location || `${status.latitude?.toFixed(6)}, ${status.longitude?.toFixed(6)}` || 'N/A'],
        ['Inspector:', status.inspector?.name || 'N/A'],
        ['Inspector Email:', status.inspector?.email || 'N/A'],
        ['Inspector Phone:', status.inspector?.phone || 'N/A'],
      ];
      
      autoTable(doc, {
        startY: 57,
        head: [['Field', 'Value']],
        body: basicInfo,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      // Transformer Conditions
      doc.text('Transformer Conditions', 14, doc.lastAutoTable.finalY + 15);
      const transformerInfo = [
        ['Name Plate:', status.transformerConditions?.namePlate ? 'Yes' : 'No'],
        ['Oil Leakage:', status.transformerConditions?.oilLeakage || 'N/A'],
        ['Bushing:', status.transformerConditions?.bushing || 'N/A'],
        ['Notes:', status.transformerConditions?.notes || 'None'],
      ];
      
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Field', 'Value']],
        body: transformerInfo,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      // Fuse Conditions
      doc.text('Fuse Conditions', 14, doc.lastAutoTable.finalY + 15);
      const fuseInfo = [
        ['Fuse Status:', status.fuseConditions?.fuseType || 'N/A'],
        ['Fuse Holder:', status.fuseConditions?.fuseHolder || 'N/A'],
        ['Notes:', status.fuseConditions?.notes || 'None'],
      ];
      
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Field', 'Value']],
        body: fuseInfo,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      // Earthing Conditions
      doc.text('Earthing Conditions', 14, doc.lastAutoTable.finalY + 15);
      const earthingInfo = [
        ['Earthing Status:', status.earthingConditions?.earthingStatus || 'N/A'],
        ['Notes:', status.earthingConditions?.notes || 'None'],
      ];
      
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Field', 'Value']],
        body: earthingInfo,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      // General Notes
      if (status.generalNotes) {
        doc.text('General Notes', 14, doc.lastAutoTable.finalY + 15);
        doc.setFontSize(10);
        doc.text(status.generalNotes, 14, doc.lastAutoTable.finalY + 25);
      }

      // Photos Section - Enhanced multiple photo handling
      if (status.images && status.images.length > 0) {
        const photoUrls = status.images.filter(url => url.trim());
        if (photoUrls.length > 0) {
          doc.text('Substation Photos:', 14, doc.lastAutoTable.finalY + 35);
          let y = doc.lastAutoTable.finalY + 45;
          let currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          
          // Process all photos with intelligent layout
          for (let i = 0; i < photoUrls.length; i++) {
            const imageUrl = photoUrls[i];
            
            try {
              // Use direct image loading for better quality
              const img = new window.Image();
              img.src = PhotoService.getInstance().convertToProxyUrl(imageUrl);
              
              // Wait for image to load with timeout
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Image loading timeout'));
                }, 8000); // Reduced timeout for better performance
                
                img.onload = () => {
                  clearTimeout(timeout);
                  resolve(true);
                };
                img.onerror = () => {
                  clearTimeout(timeout);
                  reject(new Error('Image failed to load'));
                };
              });
              
              // Calculate optimal dimensions while preserving aspect ratio
              const aspect = img.width / img.height;
              const pageWidth = doc.internal.pageSize.getWidth() - 28; // 14px margins on each side
              const maxWidth = Math.min(180, pageWidth);
              const maxHeight = 140;
              
              let width = maxWidth;
              let height = width / aspect;
              
              if (height > maxHeight) {
                height = maxHeight;
                width = height * aspect;
              }
              
              // Check if we need a new page
              if (y + height + 30 > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                y = 20;
                currentPage++;
                
                // Add photo section header on new page
                doc.setFontSize(12);
                doc.text(`Substation Photos (continued)`, 14, y);
                y += 20;
              }
              
              // Add photo number and description
              doc.setFontSize(10);
              doc.text(`Photo ${i + 1} of ${photoUrls.length}`, 14, y);
              y += 8;
              
              // Add image to PDF
              doc.addImage(img, 'JPEG', 14, y, width, height);
              
              y += height + 15;
              
              // Add photo metadata
              doc.setFontSize(8);
              doc.setTextColor(100, 100, 100);
              doc.text(`Dimensions: ${img.width} × ${img.height}px`, 14, y);
              y += 6;
              doc.text(`File: ${imageUrl.split('/').pop() || 'Unknown'}`, 14, y);
              y += 12;
              
              // Reset text color
              doc.setTextColor(0, 0, 0);
              
            } catch (error) {
              console.error(`Error processing photo ${i + 1}:`, error);
              
              // Check if we need a new page for error placeholder
              if (y + 50 > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                y = 20;
                currentPage++;
              }
              
              // Add error placeholder
              doc.setFillColor(250, 240, 240);
              doc.rect(14, y, 180, 50, 'F');
              doc.setDrawColor(200, 200, 200);
              doc.rect(14, y, 180, 50, 'S');
              
              doc.setTextColor(150, 50, 50);
              doc.setFontSize(8);
              doc.text(`Photo ${i + 1} - Failed to load`, 20, y + 15);
              doc.text(`Error: ${error.message}`, 20, y + 25);
              doc.text(`URL: ${imageUrl.substring(0, 40)}...`, 20, y + 35);
              
              y += 60;
              
              // Reset text color
              doc.setTextColor(0, 0, 0);
            }
          }
          
          // Add photo summary
          if (photoUrls.length > 0) {
            y += 10;
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Total Photos: ${photoUrls.length} | Successfully Processed: ${photoUrls.length - (photoUrls.length - photoUrls.filter((_, index) => {
              try {
                return true; // Count as successful if no error was thrown
              } catch {
                return false;
              }
            }).length)}`, 14, y);
            doc.setTextColor(0, 0, 0);
          }
        }
      }

      // Add footer with page numbers
      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
      }

      // Save the PDF
      const filename = `substation-status-${status.substationNumber}-${format(new Date(status.date), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  // Export all to PDF
  const exportAllToPDF = async () => {
    try {
      const totalPhotos = substationStatuses.reduce((sum, status) => sum + (status.images ? status.images.length : 0), 0);
      if (totalPhotos > 0) {
        toast.info(`Generating comprehensive PDF report with ${totalPhotos} total photos... This may take a moment.`);
      } else {
        toast.info('Generating comprehensive PDF report...');
      }
      
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Substation Status Report - All Records', 14, 20);
      
      // Add summary
      doc.setFontSize(12);
      doc.text(`Total Records: ${substationStatuses.length}`, 14, 35);
      doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 42);
      
      // Create table data with enhanced photo information
      const tableData = substationStatuses.map(status => {
        const photoCount = status.images ? status.images.length : 0;
        const photoInfo = photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}` : 'No photos';
        
        return [
          status.substationNumber || 'N/A',
          status.substationName || 'N/A',
          getRegionName(status.region) || 'N/A',
          getDistrictName(status.district) || 'N/A',
          status.status || 'N/A',
          status.date ? format(new Date(status.date), 'dd/MM/yyyy') : 'N/A',
          status.inspector?.name || 'N/A',
          photoInfo
        ];
      });
      
      autoTable(doc, {
        startY: 50,
        head: [['Substation #', 'Name', 'Region', 'District/Section', 'Status', 'Date', 'Inspector', 'Photos']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 35 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20 }, 5: { cellWidth: 20 }, 6: { cellWidth: 25 }, 7: { cellWidth: 20 } }
      });
      
             // Add photo summary statistics
       const recordsWithPhotos = substationStatuses.filter(status => status.images && status.images.length > 0).length;
      
      if (totalPhotos > 0) {
        const summaryY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(12);
        doc.text('Photo Summary:', 14, summaryY);
        doc.setFontSize(10);
        doc.text(`Total Photos: ${totalPhotos}`, 14, summaryY + 15);
        doc.text(`Records with Photos: ${recordsWithPhotos} of ${substationStatuses.length}`, 14, summaryY + 25);
        doc.text(`Average Photos per Record: ${(totalPhotos / substationStatuses.length).toFixed(1)}`, 14, summaryY + 35);
      }
      
      // Add footer with page numbers
      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
      }
      
      const filename = `substation-statuses-comprehensive-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      
      toast.success('Comprehensive PDF exported successfully');
    } catch (error) {
      console.error('Error exporting all to PDF:', error);
      toast.error('Failed to export comprehensive PDF');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Date',
      'Time',
      'Region',
      'District/Section',
      'Substation Number',
      'Substation Name',
      'Rating',
      'Transformer Type',
      'Status',
      'Inspector Name',
      'Inspector Email',
      'Inspector Phone',
      'Location',
      'Latitude',
      'Longitude',
      'Transformer Name Plate',
      'Transformer Oil Leakage',
      'Transformer Bushing',
      'Transformer Notes',
      'Fuse Status',
      'Fuse Holder',
      'Fuse Notes',
      'Earthing Status',
      'Earthing Notes',
      'General Notes',
      'Photo Count',
      'Created At',
      'Updated At'
    ];

    const csvContent = [
      headers.join(','),
      ...substationStatuses.map(status => [
        format(new Date(status.date), 'dd/MM/yyyy'),
        status.time || '',
        `"${getRegionName(status.region) || ''}"`,
        `"${getDistrictName(status.district) || ''}"`,
        `"${status.substationNumber || ''}"`,
        `"${status.substationName || ''}"`,
        `"${status.rating || ''}"`,
        `"${status.transformerType || ''}"`,
        `"${status.status || ''}"`,
        `"${status.inspector?.name || ''}"`,
        `"${status.inspector?.email || ''}"`,
        `"${status.inspector?.phone || ''}"`,
        `"${status.location || ''}"`,
        status.latitude || '',
        status.longitude || '',
        status.transformerConditions?.namePlate ? 'Yes' : 'No',
        `"${status.transformerConditions?.oilLeakage || ''}"`,
        `"${status.transformerConditions?.bushing || ''}"`,
        `"${status.transformerConditions?.notes || ''}"`,
        `"${status.fuseConditions?.fuseType || ''}"`,
        `"${status.fuseConditions?.fuseHolder || ''}"`,
        `"${status.fuseConditions?.notes || ''}"`,
        `"${status.earthingConditions?.earthingStatus || ''}"`,
        `"${status.earthingConditions?.notes || ''}"`,
        `"${status.generalNotes || ''}"`,
        status.images ? status.images.length.toString() : '0',
        status.createdAt ? format(new Date(status.createdAt), 'dd/MM/yyyy HH:mm') : '',
        status.updatedAt ? format(new Date(status.updatedAt), 'dd/MM/yyyy HH:mm') : ''
      ].join(','))
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `substation-statuses-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV exported successfully');
  };

  if (!substationStatuses || substationStatuses.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Substation Statuses</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportAllToPDF}
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export All to PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          No substation statuses found
               </div>

       {/* Pagination Controls */}
       {totalPages > 1 && (
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2 sm:px-4 py-3 border-t bg-white">
           <div className="flex-1 text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
             Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} results
           </div>
           <div className="flex items-center justify-center sm:justify-end space-x-2">
             <Button
               variant="outline"
               size="sm"
               onClick={() => onPageChange(Math.max(1, currentPage - 1))}
               disabled={currentPage === 1 || isLoading}
               className="text-xs px-2 sm:px-3"
             >
               <span className="hidden sm:inline">Previous</span>
               <span className="sm:hidden">Prev</span>
             </Button>
             <span className="text-xs sm:text-sm text-muted-foreground px-2">
               {currentPage} / {totalPages}
             </span>
             <Button
               variant="outline"
               size="sm"
               onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
               disabled={currentPage === totalPages || isLoading}
               className="text-xs px-2 sm:px-3"
             >
               Next
             </Button>
           </div>
         </div>
       )}
     </div>
   );
 }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h3 className="text-lg font-semibold">Substation Statuses</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportAllToPDF}
            className="flex items-center gap-2 flex-1 sm:flex-none"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Export All to PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="flex items-center gap-2 flex-1 sm:flex-none"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export to CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Substation</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Region</TableHead>
                                      <TableHead>District/Section</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inspector</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {substationStatuses.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="font-medium">
                  <div>
                    <div className="text-sm sm:text-base">
                      {status.date ? format(new Date(status.date), 'dd/MM/yyyy') : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">{status.time || '-'}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium text-sm sm:text-base">{status.substationName || '-'}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      #{status.substationNumber} • {status.rating} • {status.transformerType}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[120px] sm:max-w-[150px] truncate text-xs sm:text-sm" title={status.location || `${status.latitude?.toFixed(6)}, ${status.longitude?.toFixed(6)}`}>
                  {status.location || `${status.latitude?.toFixed(6)}, ${status.longitude?.toFixed(6)}` || '-'}
                </TableCell>
                <TableCell className="text-xs sm:text-sm">{getRegionName(status.region) || '-'}</TableCell>
                <TableCell className="text-xs sm:text-sm">{getDistrictName(status.district) || '-'}</TableCell>
                <TableCell>
                  {status.status ? (
                    onStatusUpdate ? (
                      <Select
                        value={status.status}
                        onValueChange={(value) => onStatusUpdate(status.id, value)}
                      >
                        <SelectTrigger className={`w-[140px] ${getStatusColor(status.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={getStatusColor(status.status)}>
                        {status.status.replace('-', ' ')}
                      </Badge>
                    )
                  ) : (
                    '-'
                  )}
                </TableCell>
                                 <TableCell>
                   <div className="font-medium text-xs sm:text-sm">{status.inspector?.name || '-'}</div>
                 </TableCell>
                <TableCell>
                  {status.images && status.images.length > 0 ? (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                      {status.images.length} photo{status.images.length !== 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">No photos</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onView(status)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {canEditStatus(userRole as UserRole) && (
                        <DropdownMenuItem onClick={() => onEdit(status)}>
                          <FileEdit className="mr-2 h-4 w-4" />
                          Edit Status
                        </DropdownMenuItem>
                      )}
                      {canDeleteStatus(userRole as UserRole) && (
                        <DropdownMenuItem 
                          onClick={() => onDelete(status.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Status
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => exportToPDF(status).catch(console.error)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export to PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
