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
import { MoreHorizontal, FileEdit, Trash2, Eye, Download, FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PermissionService } from '@/services/PermissionService';
import { UserRole } from '@/lib/types';
import { PhotoService } from '@/services/PhotoService';

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

interface EquipmentFailureReportsTableProps {
  reports: EquipmentFailureReport[];
  allReports?: EquipmentFailureReport[];
  onEdit: (report: EquipmentFailureReport) => void;
  onDelete: (report: EquipmentFailureReport) => void;
  onView: (report: EquipmentFailureReport) => void;
  userRole?: string;
}

export function EquipmentFailureReportsTable({
  reports,
  allReports,
  onEdit,
  onDelete,
  onView,
  userRole
}: EquipmentFailureReportsTableProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'csv' | null>(null);
  
  // Debug logging
  console.log('EquipmentFailureReportsTable - Reports received:', reports);
  console.log('EquipmentFailureReportsTable - Reports length:', reports?.length);
  console.log('EquipmentFailureReportsTable - User role:', userRole);
  
  const permissionService = PermissionService.getInstance();
  
  // Helper functions to check permissions
  const canEditReport = (userRole: UserRole | undefined) => {
    return permissionService.canUpdateFeature(userRole || null, 'equipment_failure_reporting');
  };

  const canDeleteReport = (userRole: UserRole | undefined) => {
    return permissionService.canDeleteFeature(userRole || null, 'equipment_failure_reporting');
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

     // Comprehensive PDF export for individual report
   const exportToPDF = async (report: EquipmentFailureReport) => {
     try {
       toast.info('Generating PDF... This may take a moment for reports with photos.');
       
       const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Equipment Failure Report', 14, 20);
    
    // Add report ID and date
    doc.setFontSize(12);
    doc.text(`Report ID: ${report.id || 'N/A'}`, 14, 30);
    doc.text(`Date: ${report.date ? format(new Date(report.date), "dd/MM/yyyy") : 'N/A'}`, 14, 37);
    
    // Basic Information
    doc.text('Basic Information', 14, 47);
    const basicInfo = [
      ['Region:', report.region || 'N/A'],
      ['District/Section:', report.district || 'N/A'],
      ['Equipment Name:', report.materialEquipmentName || 'N/A'],
      ['Equipment Type:', report.typeOfMaterialEquipment || 'N/A'],
      ['Location:', report.locationOfMaterialEquipment || 'N/A'],
      ['GPS Coordinates:', report.ghanaPostGPS || 'N/A'],
      ['Prepared By:', report.preparedBy || 'N/A'],
      ['Contact:', report.contact || 'N/A'],
    ];
    
    autoTable(doc, {
      startY: 50,
      head: [['Field', 'Value']],
      body: basicInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Manufacturer Information
    doc.text('Manufacturer Information', 14, doc.lastAutoTable.finalY + 15);
    const manufacturerInfo = [
      ['Manufacturer:', report.nameOfManufacturer || 'N/A'],
      ['Serial Number:', report.serialNumber || 'N/A'],
      ['Country of Origin:', report.countryOfOrigin || 'N/A'],
      ['Manufacturing Date:', report.manufacturingDate ? format(new Date(report.manufacturingDate), "dd/MM/yyyy") : 'N/A'],
      ['Installation Date:', report.dateOfInstallation ? format(new Date(report.dateOfInstallation), "dd/MM/yyyy") : 'N/A'],
      ['Commission Date:', report.dateOfCommission ? format(new Date(report.dateOfCommission), "dd/MM/yyyy") : 'N/A'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: manufacturerInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Equipment Description
    doc.text('Equipment Description', 14, doc.lastAutoTable.finalY + 15);
    doc.setFontSize(10);
    doc.text(report.descriptionOfMaterialEquipment || 'No description provided', 14, doc.lastAutoTable.finalY + 25);
    
    // Failure Information
    doc.text('Failure Information', 14, doc.lastAutoTable.finalY + 35);
    const failureInfo = [
      ['Cause of Failure:', report.causeOfFailure || 'N/A'],
      ['Severity:', report.severityOfFault || 'N/A'],
      ['Frequency of Repairs:', report.frequencyOfRepairs || 'N/A'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 45,
      head: [['Field', 'Value']],
      body: failureInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Repair History
    doc.text('Repair History', 14, doc.lastAutoTable.finalY + 15);
    doc.setFontSize(10);
    doc.text(report.historyOfRepairs || 'No repair history provided', 14, doc.lastAutoTable.finalY + 25);
    
    // Observations and Actions
    doc.text('Observations and Actions', 14, doc.lastAutoTable.finalY + 35);
    const observationsInfo = [
      ['Initial Observations:', report.initialObservations || 'N/A'],
      ['Immediate Actions Taken:', report.immediateActionsTaken || 'N/A'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 45,
      head: [['Field', 'Value']],
      body: observationsInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

         // Photos Section - Embed actual images like overheadline does
     if (report.photo) {
       const photoUrls = report.photo.split(',').filter(url => url.trim());
       if (photoUrls.length > 0) {
         doc.text('Equipment Photos:', 14, doc.lastAutoTable.finalY + 15);
         let y = doc.lastAutoTable.finalY + 25;
         
         // Limit to first 3 photos to avoid PDF issues
         const photosToProcess = photoUrls.slice(0, 3);
         
         for (let i = 0; i < photosToProcess.length; i++) {
           const imageUrl = photosToProcess[i];
           try {
             // Use direct image loading like overheadline inspection for better quality
             const img = new window.Image();
             img.src = PhotoService.getInstance().convertToProxyUrl(imageUrl);
             
             // Wait for image to load
             await new Promise((resolve, reject) => {
               const timeout = setTimeout(() => {
                 reject(new Error('Image loading timeout'));
               }, 10000); // 10 second timeout
               
               img.onload = () => {
                 clearTimeout(timeout);
                 resolve(true);
               };
               img.onerror = () => {
                 clearTimeout(timeout);
                 reject(new Error('Image failed to load'));
               };
             });
             
             // Calculate dimensions while preserving aspect ratio
             const aspect = img.width / img.height;
             const maxWidth = 180; // Increased from 160 for better quality
             const maxHeight = 120; // Increased from 120 for better quality
             
             let width = maxWidth;
             let height = width / aspect;
             
             if (height > maxHeight) {
               height = maxHeight;
               width = height * aspect;
             }
             
             // Check if we need a new page
             if (y + height > 280) {
               doc.addPage();
               y = 20;
             }
             
             // Add image directly to PDF without canvas processing (like overheadline)
             doc.addImage(img, 'JPEG', 14, y, width, height);
             
             y += height + 15;
             
             // Add photo caption
             doc.setFontSize(8);
             doc.text(`Photo ${i + 1}`, 14, y);
             y += 8;
             
           } catch (error) {
             console.error(`Error processing photo ${i + 1}:`, error);
             
             // Add a placeholder for failed photos
             if (y + 40 > 280) {
               doc.addPage();
               y = 20;
             }
             
             doc.setFillColor(240, 240, 240);
             doc.rect(14, y, 180, 40, 'F');
             doc.setDrawColor(200, 200, 200);
             doc.rect(14, y, 180, 40, 'S');
             
             doc.setTextColor(100, 100, 100);
             doc.setFontSize(8);
             doc.text(`Photo ${i + 1} - Failed to load`, 20, y + 20);
             doc.text(`Error: ${error.message}`, 20, y + 30);
             
             y += 50;
             
             // Continue with next photo instead of failing completely
             continue;
           }
         }
         
         // If there are more photos, add a note
         if (photoUrls.length > 3) {
           doc.setFontSize(10);
           doc.text(`Note: ${photoUrls.length - 3} additional photos available in the system`, 14, y + 10);
         }
       }
     }

    // Add footer
    doc.setFontSize(8);
    doc.text(`Report generated on: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, doc.internal.pageSize.height - 20);
    
           // Save the PDF
       doc.save(`equipment-failure-report-${report.id || 'unknown'}.pdf`);
       toast.success('PDF exported successfully');
     } catch (error) {
       console.error('Error generating PDF:', error);
       toast.error('Failed to generate PDF. Please try again.');
     }
   };

  // Bulk PDF export for all reports
  const exportAllToPDF = async () => {
    if (!reports || reports.length === 0) {
      toast.error('No reports to export');
      return;
    }

    setIsExporting(true);
    setExportType('pdf');
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Equipment Failure Reports Summary', 14, 22);
    
    // Add export date
    doc.setFontSize(10);
    doc.text(`Exported on: ${format(new Date(), 'PPP')}`, 14, 32);
    
    // Prepare table data
    const tableData = reports.map(report => [
      format(new Date(report.date), 'dd/MM/yyyy'),
      report.region || '-',
      report.district || '-',
      report.materialEquipmentName || '-',
      report.typeOfMaterialEquipment || '-',
      report.severityOfFault || '-',
      report.preparedBy || '-',
      report.photo ? report.photo.split(',').filter(url => url.trim()).length.toString() : '0'
    ]);

    // Add table
    autoTable(doc, {
      head: [['Date', 'Region', 'District/Section', 'Equipment Name', 'Type', 'Severity', 'Prepared By', 'Photos']],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
    });

    // Save the PDF
    doc.save(`equipment-failure-reports-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exported successfully');
    setIsExporting(false);
    setExportType(null);
  };

  const exportToExcel = async () => {
    if (!reports || reports.length === 0) {
      toast.error('No reports to export');
      return;
    }
    setIsExporting(true);
    setExportType('csv');
    // Create CSV content
    const headers = [
      'Date',
      'Region',
      'District/Section',
      'Material/Equipment Name',
      'Type of Material/Equipment',
      'Location',
      'GPS Coordinates',
      'Manufacturer',
      'Serial Number',
      'Manufacturing Date',
      'Country of Origin',
      'Installation Date',
      'Commission Date',
      'Description',
      'Cause of Failure',
      'Frequency of Repairs',
      'History of Repairs',
      'Initial Observations',
      'Immediate Actions',
      'Severity',
      'Prepared By',
      'Contact',
      'Photo Count'
    ];

    const csvContent = [
      headers.join(','),
      ...reports.map(report => [
        format(new Date(report.date), 'dd/MM/yyyy'),
        `"${report.region || ''}"`,
        `"${report.district || ''}"`,
        `"${report.materialEquipmentName || ''}"`,
        `"${report.typeOfMaterialEquipment || ''}"`,
        `"${report.locationOfMaterialEquipment || ''}"`,
        `"${report.ghanaPostGPS || ''}"`,
        `"${report.nameOfManufacturer || ''}"`,
        `"${report.serialNumber || ''}"`,
        `"${report.manufacturingDate || ''}"`,
        `"${report.countryOfOrigin || ''}"`,
        `"${report.dateOfInstallation || ''}"`,
        `"${report.dateOfCommission || ''}"`,
        `"${report.descriptionOfMaterialEquipment || ''}"`,
        `"${report.causeOfFailure || ''}"`,
        `"${report.frequencyOfRepairs || ''}"`,
        `"${report.historyOfRepairs || ''}"`,
        `"${report.initialObservations || ''}"`,
        `"${report.immediateActionsTaken || ''}"`,
        `"${report.severityOfFault || ''}"`,
        `"${report.preparedBy || ''}"`,
        `"${report.contact || ''}"`,
        report.photo ? report.photo.split(',').filter(url => url.trim()).length.toString() : '0'
      ].join(','))
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `equipment-failure-reports-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV exported successfully');
    setIsExporting(false);
    setExportType(null);
  };

  if (!reports || reports.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Equipment Failure Reports</h3>
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
              onClick={exportToExcel}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          No equipment failure reports found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <h3 className="text-lg font-semibold">Equipment Failure Reports</h3>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={exportAllToPDF}
            className="flex items-center gap-2 w-full sm:w-auto"
            disabled={isExporting}
          >
            {isExporting && exportType === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {isExporting && exportType === 'pdf' ? 'Exporting PDF...' : 'Export All to PDF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="flex items-center gap-2 w-full sm:w-auto"
            disabled={isExporting}
          >
            {isExporting && exportType === 'csv' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting && exportType === 'csv' ? 'Exporting CSV...' : 'Export to CSV'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>District/Section</TableHead>
              <TableHead>Equipment Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Prepared By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">
                  {report.date ? format(new Date(report.date), 'dd/MM/yyyy') : '-'}
                </TableCell>
                <TableCell>{report.region || '-'}</TableCell>
                <TableCell>{report.district || '-'}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={report.materialEquipmentName}>
                  {report.materialEquipmentName || '-'}
                </TableCell>
                <TableCell>{report.typeOfMaterialEquipment || '-'}</TableCell>
                <TableCell className="max-w-[150px] truncate" title={report.locationOfMaterialEquipment}>
                  {report.locationOfMaterialEquipment || '-'}
                </TableCell>
                <TableCell>
                  {report.severityOfFault ? (
                    <Badge variant="outline" className={getSeverityColor(report.severityOfFault)}>
                      {report.severityOfFault}
                    </Badge>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {report.photo ? (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                      {report.photo.split(',').filter(url => url.trim()).length} photo{report.photo.split(',').filter(url => url.trim()).length !== 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">No photos</span>
                  )}
                </TableCell>
                <TableCell>{report.preparedBy || '-'}</TableCell>
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
                      <DropdownMenuItem onClick={() => onView(report)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {canEditReport(userRole as UserRole) && (
                        <DropdownMenuItem onClick={() => onEdit(report)}>
                          <FileEdit className="mr-2 h-4 w-4" />
                          Edit Report
                        </DropdownMenuItem>
                      )}
                      {canDeleteReport(userRole as UserRole) && (
                        <DropdownMenuItem 
                          onClick={() => onDelete(report)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Report
                        </DropdownMenuItem>
                      )}
                                             <DropdownMenuItem onClick={() => exportToPDF(report).catch(console.error)}>
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
