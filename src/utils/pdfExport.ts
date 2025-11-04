import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { VITAsset, VITInspectionChecklist, Region, District } from "@/lib/types";
import { formatDate } from "@/utils/calculations";
import { format } from 'date-fns';
import { SubstationInspection } from "@/lib/asset-types";
import { PhotoService } from "@/services/PhotoService";
import { FeederService } from "@/services/FeederService";

// Add type declaration for jsPDF with autotable extensions
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY?: number;
    };
    autoTable: (options: any) => jsPDF;
    internal: {
      events: PubSub;
      scaleFactor: number;
      pageSize: {
        width: number;
        getWidth: () => number;
        height: number;
        getHeight: () => number;
      };
      pages: number[];
      getEncryptor: (objectId: number) => (data: string) => string;
    };
    setPage: (pageNumber: number) => jsPDF;
  }
}

/**
 * Export VIT inspection data to CSV format
 */
export const exportInspectionToCsv = (inspection: VITInspectionChecklist, asset: VITAsset | null, getRegionName: (id: string) => string, getDistrictName: (id: string) => string) => {
  if (!asset) return;

  // Create headers and data as single rows
  const headers = [
    "Asset Serial Number",
    "Asset Type",
    "Region",
    "District",
    "Inspection Date",
    "Inspector",
    "Rodent/Termite Encroachment",
    "Clean & Dust Free",
    "Protection Button Enabled",
    "Recloser Button Enabled",
    "Ground/Earth Button Enabled",
    "AC Power On",
    "Battery Power Low",
    "Handle Lock On",
    "Remote Button Enabled",
    "Gas Level Low",
    "Earthing Arrangement Adequate",
    "No Fuses Blown",
    "No Damage to Bushings",
    "No Damage to HV Connections",
    "Insulators Clean",
    "Paintwork Adequate",
    "PT Fuse Link Intact",
    "No Corrosion",
    "Silica Gel Condition",
    "Correct Labelling",
    "Remarks"
  ];

  const data = [
    asset?.serialNumber || "",
    asset?.typeOfUnit || "",
    asset?.region || "Unknown",
    asset?.district || "Unknown",
    formatDate(inspection.inspectionDate),
    inspection.inspectedBy,
    inspection.rodentTermiteEncroachment,
    inspection.cleanDustFree,
    inspection.protectionButtonEnabled,
    inspection.recloserButtonEnabled,
    inspection.groundEarthButtonEnabled,
    inspection.acPowerOn,
    inspection.batteryPowerLow,
    inspection.handleLockOn,
    inspection.remoteButtonEnabled,
    inspection.gasLevelLow,
    inspection.earthingArrangementAdequate,
    inspection.noFusesBlown,
    inspection.noDamageToBushings,
    inspection.noDamageToHVConnections,
    inspection.insulatorsClean,
    inspection.paintworkAdequate,
    inspection.ptFuseLinkIntact,
    inspection.noCorrosion,
    inspection.silicaGelCondition,
    inspection.correctLabelling,
    inspection.remarks
  ];

  // Combine headers and data
  const csvContent = [
    headers.join(","),
    data.map(v => `"${v}"`).join(",")
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `vit-inspection-${asset?.serialNumber}-${inspection.inspectionDate.split('T')[0]}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generate comprehensive PDF report for VIT inspection
 */
export const exportInspectionToPDF = async (inspection: VITInspectionChecklist, asset: VITAsset | null, getRegionName: (id: string) => string, getDistrictName: (id: string) => string) => {
  try {
    if (!asset) {
      throw new Error("Asset information is required to generate the report");
    }

    const region = asset.region || "Unknown";
    const district = asset.district || "Unknown";
    
    // Fetch feeder alias - try from inspection first, then from feeder service
    let feederAlias: string | undefined = inspection?.feederAlias;
    if (!feederAlias) {
      const feederName = inspection?.feederName || asset.feederName;
      if (feederName) {
        try {
          const feederService = FeederService.getInstance();
          const allFeeders = await feederService.getAllFeeders();
          const feeder = allFeeders.find(f => f.name === feederName);
          if (feeder) {
            feederAlias = feeder.alias;
          }
        } catch (error) {
          console.warn('[exportInspectionToPDF] Error fetching feeder alias:', error);
          // Continue without alias if lookup fails
        }
      }
    }
    
    // Create PDF document with A4 size
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    const { width, height } = page.getSize();

    // Add header with company logo and title
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Draw header background
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width: width,
      height: 100,
      color: rgb(0.1, 0.4, 0.6),
    });

    // Add title
    page.drawText('VIT INSPECTION REPORT', {
      x: 50,
      y: height - 60,
      size: 24,
      color: rgb(1, 1, 1),
      font: boldFont,
    });

    // Add report metadata in header
    let formattedDate = 'Not specified';
    try {
      if (inspection.inspectionDate) {
        const dateObj = new Date(inspection.inspectionDate);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = format(dateObj, 'dd/MM/yyyy');
        }
      }
    } catch (error) {
      console.warn('Error formatting inspection date:', error);
    }

    page.drawText(`Report Date: ${formattedDate}`, {
      x: width - 200,
      y: height - 60,
      size: 12,
      color: rgb(1, 1, 1),
      font: regularFont,
    });

    page.drawText(`Inspector: ${inspection.inspectedBy || 'Not specified'}`, {
      x: width - 200,
      y: height - 80,
      size: 12,
      color: rgb(1, 1, 1),
      font: regularFont,
    });

    // Add asset information section with background
    const sectionY = height - 150;
    page.drawRectangle({
      x: 40,
      y: sectionY - 140,
      width: width - 80,
      height: 140,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });

    page.drawText('Asset Information', {
      x: 50,
      y: sectionY - 25,
      size: 16,
      color: rgb(0.1, 0.4, 0.6),
      font: boldFont,
    });

    // Add asset details in two columns
    const assetInfo = [
      ['Serial Number:', asset.serialNumber],
      ['Type of Unit:', asset.typeOfUnit],
      ['Voltage Level:', asset.voltageLevel],
      ['Region:', region],
      ['District:', district],
      ['Location:', asset.location],
      ['Feeder Name:', inspection?.feederName || asset.feederName],
      ['Feeder Alias:', feederAlias || 'N/A'],
      ['GPS Coordinates:', asset.gpsCoordinates],
    ];

    let yPosition = sectionY - 50;
    const columnWidth = (width - 100) / 2;
    const rowHeight = 16;
    
    assetInfo.forEach(([label, value], index) => {
      const column = index % 2;
      const x = 50 + (column * columnWidth);
      
      page.drawText(label, {
        x,
        y: yPosition,
        size: 10,
        color: rgb(0.4, 0.4, 0.4),
        font: regularFont,
      });
      
      // Truncate long values if needed
      const maxValueLength = 25;
      const displayValue = value || 'Not specified';
      const truncatedValue = displayValue.length > maxValueLength 
        ? displayValue.substring(0, maxValueLength) + '...' 
        : displayValue;
      
      page.drawText(truncatedValue, {
        x: x + 100,
        y: yPosition,
        size: 10,
        color: rgb(0.2, 0.2, 0.2),
        font: boldFont,
      });

      if (column === 1) {
        yPosition -= rowHeight;
      }
    });

    // Add inspection checklist section
    yPosition -= 40;
    page.drawText('Inspection Checklist', {
      x: 50,
      y: yPosition,
      size: 16,
      color: rgb(0.1, 0.4, 0.6),
      font: boldFont,
    });

    // Add inspection items in a table format
    const inspectionItems = [
      { name: 'Rodent/Termite Encroachment', status: inspection.rodentTermiteEncroachment || 'Not specified' },
      { name: 'Clean and Dust Free', status: inspection.cleanDustFree || 'Not specified' },
      { name: 'Protection Button Enabled', status: inspection.protectionButtonEnabled || 'Not specified' },
      { name: 'Recloser Button Enabled', status: inspection.recloserButtonEnabled || 'Not specified' },
      { name: 'Ground/Earth Button Enabled', status: inspection.groundEarthButtonEnabled || 'Not specified' },
      { name: 'AC Power On', status: inspection.acPowerOn || 'Not specified' },
      { name: 'Battery Power Low', status: inspection.batteryPowerLow || 'Not specified' },
      { name: 'Handle Lock On', status: inspection.handleLockOn || 'Not specified' },
      { name: 'Remote Button Enabled', status: inspection.remoteButtonEnabled || 'Not specified' },
      { name: 'Gas Level Low', status: inspection.gasLevelLow || 'Not specified' },
      { name: 'Earthing Arrangement Adequate', status: inspection.earthingArrangementAdequate || 'Not specified' },
      { name: 'No Fuses Blown', status: inspection.noFusesBlown || 'Not specified' },
      { name: 'No Damage to Bushings', status: inspection.noDamageToBushings || 'Not specified' },
      { name: 'No Damage to HV Connections', status: inspection.noDamageToHVConnections || 'Not specified' },
      { name: 'Insulators Clean', status: inspection.insulatorsClean || 'Not specified' },
      { name: 'Paintwork Adequate', status: inspection.paintworkAdequate || 'Not specified' },
      { name: 'PT Fuse Link Intact', status: inspection.ptFuseLinkIntact || 'Not specified' },
      { name: 'No Corrosion', status: inspection.noCorrosion || 'Not specified' },
      { name: 'Silica Gel Condition', status: inspection.silicaGelCondition || 'Not specified' },
      { name: 'Correct Labelling', status: inspection.correctLabelling || 'Not specified' },
    ];

    yPosition -= 20;
    let currentPage = page;
    inspectionItems.forEach(({ name, status }, index) => {
      // Check if we need a new page
      if (yPosition < 100) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        yPosition = height - 50;
      }

      // Draw row background
      currentPage.drawRectangle({
        x: 40,
        y: yPosition - 15,
        width: width - 80,
        height: 20,
        color: index % 2 === 0 ? rgb(0.98, 0.98, 0.98) : rgb(1, 1, 1),
      });

      // Draw item name
      currentPage.drawText(name, {
        x: 50,
        y: yPosition,
        size: 10,
        color: rgb(0.2, 0.2, 0.2),
        font: regularFont,
      });

      // Draw status with color coding
      const statusColor = status === 'Yes' || status === 'Good' ? rgb(0, 0.6, 0) : rgb(0.8, 0, 0);
      currentPage.drawText(status, {
        x: width - 150,
        y: yPosition,
        size: 10,
        color: statusColor,
        font: boldFont,
      });

      yPosition -= 20;
    });

    // Add remarks section if any
    if (inspection.remarks) {
      // Check if we need a new page
      if (yPosition < 150) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        yPosition = height - 50;
      }

      yPosition -= 40;
      currentPage.drawText('Remarks', {
        x: 50,
        y: yPosition,
        size: 16,
        color: rgb(0.1, 0.4, 0.6),
        font: boldFont,
      });

      // Draw remarks box
      currentPage.drawRectangle({
        x: 40,
        y: yPosition - 100,
        width: width - 80,
        height: 80,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });

      currentPage.drawText(inspection.remarks, {
        x: 50,
        y: yPosition - 30,
        size: 10,
        color: rgb(0.2, 0.2, 0.2),
        font: regularFont,
        maxWidth: width - 100,
      });
    }

    // Add photos section if there are any photos
    console.log('[VITInspectionPDF] Inspection photoUrls:', {
      photoUrls: inspection.photoUrls,
      length: inspection.photoUrls?.length,
      type: typeof inspection.photoUrls,
      isArray: Array.isArray(inspection.photoUrls)
    });
    
    if (inspection.photoUrls && inspection.photoUrls.length > 0) {
      // Check if we need a new page
      if (yPosition < 150) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        yPosition = height - 50;
      }

      // Add photos header
      currentPage.drawRectangle({
        x: 0,
        y: height - 60,
        width: width,
        height: 60,
        color: rgb(0.1, 0.4, 0.6),
      });

      currentPage.drawText('Inspection Photos', {
        x: 50,
        y: height - 35,
        size: 20,
        color: rgb(1, 1, 1),
        font: boldFont,
      });

      let photoY = height - 100;
      const photoWidth = 250;
      const photoHeight = 180;
      const margin = 30;

      for (const photoUrl of inspection.photoUrls) {
        console.log('[VITInspectionPDF] Processing photo:', photoUrl);
        try {
          // Check if we need a new page for the next photo
          if (photoY < 150) {
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            photoY = height - 50;
          }

          // Handle both base64 and Azure Blob Storage URLs
          let imageBytes: ArrayBuffer;
          
          if (photoUrl.startsWith('data:')) {
            // Handle base64 images
            const base64Data = photoUrl.split(',')[1];
            const uint8Array = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            imageBytes = uint8Array.buffer;
          } else {
            // Handle Azure Blob Storage URLs using PhotoService
            const proxyUrl = PhotoService.getInstance().convertToProxyUrl(photoUrl);
            console.log('[VITInspectionPDF] Loading photo:', { original: photoUrl, proxy: proxyUrl });
            imageBytes = await fetch(proxyUrl).then(res => res.arrayBuffer());
          }
          
          // Embed the image
          const image = await pdfDoc.embedJpg(imageBytes).catch(() => pdfDoc.embedPng(imageBytes));
          
          // Calculate dimensions to maintain aspect ratio
          const aspectRatio = image.width / image.height;
          let finalWidth = photoWidth;
          let finalHeight = photoWidth / aspectRatio;
          
          if (finalHeight > photoHeight) {
            finalHeight = photoHeight;
            finalWidth = photoHeight * aspectRatio;
          }

          // Draw photo frame
          currentPage.drawRectangle({
            x: 40,
            y: photoY - finalHeight - 10,
            width: finalWidth + 20,
            height: finalHeight + 20,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
          });

          // Draw the image
          currentPage.drawImage(image, {
            x: 50,
            y: photoY - finalHeight,
            width: finalWidth,
            height: finalHeight,
          });

          // Add photo caption
          currentPage.drawText(`Photo ${inspection.photoUrls.indexOf(photoUrl) + 1}`, {
            x: 50,
            y: photoY - finalHeight - 20,
            size: 10,
            color: rgb(0.4, 0.4, 0.4),
            font: regularFont,
          });

          // Update Y position for next photo
          photoY -= finalHeight + margin + 30;
        } catch (error) {
          console.error('[VITInspectionPDF] Error embedding photo:', error);
          // Add error message for failed photo
          currentPage.drawText(`Photo ${inspection.photoUrls.indexOf(photoUrl) + 1}: Failed to load`, {
            x: 50,
            y: photoY - 20,
            size: 10,
            color: rgb(0.8, 0.2, 0.2),
            font: regularFont,
          });
          photoY -= 30;
        }
      }
    }

    // Add footer with page numbers
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: width - 100,
        y: 30,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
        font: regularFont,
      });
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Generate filename with safe date handling
    let filenameDate = 'unknown-date';
    try {
      if (inspection.inspectionDate) {
        const dateObj = new Date(inspection.inspectionDate);
        if (!isNaN(dateObj.getTime())) {
          filenameDate = format(dateObj, 'yyyy-MM-dd');
        }
      }
    } catch (error) {
      console.warn('Error formatting filename date:', error);
    }
    
    link.href = url;
    link.download = `vit-inspection-${asset.serialNumber}-${filenameDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

/**
 * Generate comprehensive PDF report for Substation inspection
 */
export const exportSubstationInspectionToPDF = async (inspection: SubstationInspection) => {
  try {
    console.log('Starting PDF generation for inspection:', inspection.id);
    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    // Load fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Define layout constants
    const { width, height } = page.getSize();
    const margin = 50;
    const lineHeight = 20;
    const sectionSpacing = 30;
    
    let currentY = height - margin;
    let currentPage = page;
    
    // Add header
    currentPage.drawText('SUBSTATION INSPECTION REPORT', {
      x: margin,
      y: currentY,
      size: 24,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });
    currentY -= lineHeight * 2;

    // Add report metadata with safe date handling
    let formattedDate = 'Not specified';
    try {
      if (inspection.date) {
        const dateObj = new Date(inspection.date);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = format(dateObj, 'dd/MM/yyyy');
        }
      }
    } catch (error) {
      console.warn('Error formatting inspection date:', error);
    }

    currentPage.drawText(`Report Date: ${formattedDate}`, {
      x: margin,
      y: currentY,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
      font: regularFont,
    });
    currentY -= lineHeight;

    currentPage.drawText(`Created By: ${inspection.createdBy || 'Not specified'}`, {
      x: margin,
      y: currentY,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
      font: regularFont,
    });
    currentY -= lineHeight;

    // Add substation information
    currentPage.drawText('Substation Information:', {
      x: margin,
      y: currentY,
      size: 14,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });
    currentY -= lineHeight;

    const substationInfo = [
      { label: "Region", value: inspection.region },
      { label: "District", value: inspection.district },
      { label: "Date", value: inspection.date },
      { label: "Substation Number", value: inspection.substationNo },
      { label: "Substation Name", value: inspection.substationName || "Not specified" },
      { label: "Type", value: inspection.type },
      { label: "Location", value: inspection.location || "Not specified" },
      { label: "GPS Location", value: inspection.gpsLocation || "Not specified" },
      { label: "Voltage Level", value: inspection.voltageLevel || "Not specified" }
    ];

    substationInfo.forEach(({ label, value }) => {
      currentPage.drawText(`${label}: ${value}`, {
        x: margin,
        y: currentY,
        size: 12,
        color: rgb(0.2, 0.2, 0.2),
        font: regularFont,
      });
      currentY -= lineHeight;
    });

    // Add inspection details
    currentY -= sectionSpacing;
    currentPage.drawText('Inspection Details:', {
      x: margin,
      y: currentY,
      size: 14,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });
    currentY -= lineHeight;

    // Define categories based on inspection type
    const categories = inspection.substationType === 'primary' ? [
      { 
        title: 'Site Condition', 
        key: 'siteCondition',
        description: 'This section covers the inspection of the substation site and surrounding area.'
      },
      { 
        title: 'General Building', 
        key: 'generalBuilding',
        description: 'This section covers the general condition and maintenance of the substation building.'
      },
      { 
        title: 'Control Equipment', 
        key: 'controlEquipment',
        description: 'This section covers the inspection of control panels, relays, and other control equipment.'
      },
      { 
        title: 'Basement', 
        key: 'basement',
        description: 'This section covers the inspection of the substation basement and related equipment.'
      },
      { 
        title: 'Power Transformer', 
        key: 'powerTransformer',
        description: 'This section covers the inspection of transformers, cooling systems, and related equipment.'
      },
      { 
        title: 'Outdoor Equipment', 
        key: 'outdoorEquipment',
        description: 'This section covers the inspection of outdoor equipment, switchgear, and related components.'
      }
    ] : [
      {
        title: 'Site Condition',
        key: 'siteCondition',
        description: 'This section covers the inspection of the substation site and surrounding area.'
      },
      {
        title: 'Transformer',
        key: 'transformer',
        description: 'This section covers the inspection of transformers and related equipment.'
      },
      {
        title: 'Area Fuse',
        key: 'areaFuse',
        description: 'This section covers the inspection of area fuses and related components.'
      },
      {
        title: 'Arrestors',
        key: 'arrestors',
        description: 'This section covers the inspection of arrestors and related equipment.'
      },
      {
        title: 'Switchgear',
        key: 'switchgear',
        description: 'This section covers the inspection of switchgear and related components.'
      },
      {
        title: 'Distribution Equipment',
        key: 'distributionEquipment',
        description: 'This section covers the inspection of distribution equipment, including distribution pillars, panels, and fuses.'
      },
      {
        title: 'Paint Work',
        key: 'paintWork',
        description: 'This section covers the inspection of paint work and general appearance.'
      }
    ];

    // Add each category
    for (const category of categories) {
      if (currentY < margin + lineHeight * 3) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
      }

      currentPage.drawText(category.title, {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      // Get items for this category
      const items = (inspection as any)[category.key] || [];
      console.log(`Processing category ${category.key}:`, items); // Debug log

      if (items.length === 0) {
        currentPage.drawText('No items in this category', {
          x: margin + 20,
          y: currentY,
          size: 12,
          color: rgb(0.4, 0.4, 0.4),
          font: regularFont,
        });
        currentY -= lineHeight;
      } else {
        for (const item of items) {
          if (currentY < margin + lineHeight * 3) {
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            currentY = height - margin;
          }

          currentPage.drawText(`• ${item.name}: ${item.status || 'Not specified'}`, {
            x: margin + 20,
            y: currentY,
            size: 12,
            color: rgb(0.2, 0.2, 0.2),
            font: regularFont,
          });
          currentY -= lineHeight;

          if (item.remarks) {
            if (currentY < margin + lineHeight * 3) {
              currentPage = pdfDoc.addPage([595.28, 841.89]);
              currentY = height - margin;
            }

            currentPage.drawText(`  Remarks: ${item.remarks}`, {
              x: margin + 40,
              y: currentY,
              size: 12,
              color: rgb(0.4, 0.4, 0.4),
              font: regularFont,
            });
            currentY -= lineHeight;
          }
        }
      }
      currentY -= sectionSpacing;
    }

    // Add remarks if available
    if (inspection.remarks) {
      if (currentY < margin + lineHeight * 3) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
      }

      currentPage.drawText('Additional Notes:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      const remarksLines = inspection.remarks.split('\n');
      remarksLines.forEach(line => {
        if (currentY < margin + lineHeight * 3) {
          currentPage = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - margin;
        }

        currentPage.drawText(line, {
          x: margin,
          y: currentY,
          size: 12,
          color: rgb(0.2, 0.2, 0.2),
          font: regularFont,
        });
        currentY -= lineHeight;
      });
    }

    // Add photos if available
    if (inspection.images && inspection.images.length > 0) {
      if (currentY < margin + lineHeight * 3) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
      }

      currentPage.drawText('Before Inspection Photos:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight * 2;

      // Process each before image
      for (const imageUrl of inspection.images) {
        try {
          // Convert blob URL to proxy URL to avoid CORS issues
          const proxyUrl = PhotoService.getInstance().convertToProxyUrl(imageUrl);
          console.log(`[PDF Export] Fetching image: ${proxyUrl}`);
          
          // Fetch the image
          const response = await fetch(proxyUrl);
          const imageBytes = await response.arrayBuffer();
          
          // Embed the image in the PDF
          const image = await pdfDoc.embedJpg(imageBytes);
          
          // Calculate image dimensions to fit the page width while maintaining aspect ratio
          const maxWidth = width - (margin * 2);
          const maxHeight = 300; // Maximum height for each image
          const imageWidth = image.width;
          const imageHeight = image.height;
          
          let scaledWidth = imageWidth;
          let scaledHeight = imageHeight;
          
          if (scaledWidth > maxWidth) {
            const ratio = maxWidth / scaledWidth;
            scaledWidth = maxWidth;
            scaledHeight = scaledHeight * ratio;
          }
          
          if (scaledHeight > maxHeight) {
            const ratio = maxHeight / scaledHeight;
            scaledHeight = maxHeight;
            scaledWidth = scaledWidth * ratio;
          }

          // Check if we need a new page
          if (currentY - scaledHeight < margin + lineHeight * 3) {
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            currentY = height - margin;
          }

          // Draw the image
          currentPage.drawImage(image, {
            x: margin,
            y: currentY - scaledHeight,
            width: scaledWidth,
            height: scaledHeight,
          });

          currentY -= scaledHeight + lineHeight;
        } catch (error) {
          console.error('Error processing before image:', error);
          // Continue with the next image if one fails
          continue;
        }
      }
    }

    // Add after inspection photos if available (for secondary substation inspections)
    if ((inspection as any).afterImages && (inspection as any).afterImages.length > 0) {
      if (currentY < margin + lineHeight * 3) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
      }

      currentPage.drawText('After Inspection Photos:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight * 2;

      // Process each after image
      for (const imageUrl of (inspection as any).afterImages) {
        try {
          // Convert blob URL to proxy URL to avoid CORS issues
          const proxyUrl = PhotoService.getInstance().convertToProxyUrl(imageUrl);
          console.log(`[PDF Export] Fetching after image: ${proxyUrl}`);
          
          // Fetch the image
          const response = await fetch(proxyUrl);
          const imageBytes = await response.arrayBuffer();
          
          // Embed the image in the PDF
          const image = await pdfDoc.embedJpg(imageBytes);
          
          // Calculate image dimensions to fit the page width while maintaining aspect ratio
          const maxWidth = width - (margin * 2);
          const maxHeight = 300; // Maximum height for each image
          const imageWidth = image.width;
          const imageHeight = image.height;
          
          let scaledWidth = imageWidth;
          let scaledHeight = imageHeight;
          
          if (scaledWidth > maxWidth) {
            const ratio = maxWidth / scaledWidth;
            scaledWidth = maxWidth;
            scaledHeight = scaledHeight * ratio;
          }
          
          if (scaledHeight > maxHeight) {
            const ratio = maxHeight / scaledHeight;
            scaledHeight = maxHeight;
            scaledWidth = scaledWidth * ratio;
          }

          // Check if we need a new page
          if (currentY - scaledHeight < margin + lineHeight * 3) {
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            currentY = height - margin;
          }

          // Draw the image
          currentPage.drawImage(image, {
            x: margin,
            y: currentY - scaledHeight,
            width: scaledWidth,
            height: scaledHeight,
          });

          currentY -= scaledHeight + lineHeight;
        } catch (error) {
          console.error('Error processing after image:', error);
          // Continue with the next image if one fails
          continue;
        }
      }
    }

    // Add footer with page numbers
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: width - margin - 50,
        y: margin - 20,
        size: 10,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Generate filename with safe date handling
    let filenameDate = 'unknown-date';
    try {
      if (inspection.date) {
        const dateObj = new Date(inspection.date);
        if (!isNaN(dateObj.getTime())) {
          filenameDate = format(dateObj, 'yyyy-MM-dd');
        }
      }
    } catch (error) {
      console.warn('Error formatting filename date:', error);
    }
    
    link.href = url;
    link.download = `substation-inspection-${inspection.substationNo}-${filenameDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

/**
 * Generate comprehensive PDF report for Analytics & Reporting
 */
export const exportAnalyticsToPDF = async (
  filteredFaults: any[],
  reliabilityIndices: any,
  dateRange: string,
  startDate: Date | null,
  endDate: Date | null,
  selectedRegion: string,
  selectedDistrict: string,
  regions: Region[],
  districts: District[]
) => {
  try {
    // Create PDF document with A4 size
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    const { width, height } = page.getSize();
    const margin = 50;
    const contentWidth = width - margin * 2;
    let currentY = height - margin;

    // Load fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // --- Header --- 
    page.drawText('ANALYTICS & REPORTING', {
      x: margin,
      y: currentY,
      size: 18,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 25;

    // --- Metadata --- 
    const metaData = [
        [`Report Generated:`, format(new Date(), 'dd/MM/yyyy HH:mm')],
        [`Date Range:`, dateRange === 'all' ? 'All Time' : `${format(startDate!, 'dd/MM/yyyy')} to ${format(endDate!, 'dd/MM/yyyy')}`],
        [`Region:`, selectedRegion === 'all' ? 'All Regions' : regions.find(r => r.id === selectedRegion)?.name || 'Unknown'],
        [`District:`, selectedDistrict === 'all' ? 'All Districts' : districts.find(d => d.id === selectedDistrict)?.name || 'Unknown']
    ];
    metaData.forEach(([label, value]) => {
        page.drawText(label, { x: margin, y: currentY, font: regularFont, size: 10, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(value, { x: margin + 100, y: currentY, font: regularFont, size: 10, color: rgb(0, 0, 0) });
        currentY -= 15;
    });
    currentY -= 15; // Extra space after metadata
    
    // --- Summary Statistics Table --- 
    page.drawText('Summary Statistics', {
      x: margin,
      y: currentY,
      size: 14,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 20;

    const totalFaults = filteredFaults.length;
    const op5Faults = filteredFaults.filter(f => f.type === 'OP5 Fault').length;
    const controlOutages = filteredFaults.filter(f => f.type === 'Control Outage').length;
    const activeFaults = filteredFaults.filter(f => f.status === 'active').length;
    const resolvedFaults = totalFaults - activeFaults;

    const summaryHeaders = ['Metric', 'Value'];
    const summaryData = [
      ['Total Faults / Outages', totalFaults],
      ['OP5 Faults', op5Faults],
      ['Control System Outages', controlOutages],
      ['Active', activeFaults],
      ['Resolved', resolvedFaults],
    ];

    currentY = await drawTable({ 
      page, startX: margin, startY: currentY, tableWidth: contentWidth / 2, // Use half width
      headers: summaryHeaders, data: summaryData, 
      headerFont: boldFont, bodyFont: regularFont, 
      columnWidths: [150, 100]
    });
    currentY -= 20; // Space after table

    // --- Reliability Indices Table --- 
     page.drawText('Reliability Indices', {
      x: margin,
      y: currentY,
      size: 14,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 20;

    const reliabilityHeaders = ['Population', 'SAIDI', 'SAIFI', 'CAIDI'];
    const reliabilityData = [
      ['Rural', 
        reliabilityIndices?.rural?.saidi?.toFixed(3) || '0.000', 
        reliabilityIndices?.rural?.saifi?.toFixed(3) || '0.000', 
        reliabilityIndices?.rural?.caidi?.toFixed(3) || '0.000'
      ],
       ['Urban', 
        reliabilityIndices?.urban?.saidi?.toFixed(3) || '0.000', 
        reliabilityIndices?.urban?.saifi?.toFixed(3) || '0.000', 
        reliabilityIndices?.urban?.caidi?.toFixed(3) || '0.000'
      ],
       ['Metro', 
        reliabilityIndices?.metro?.saidi?.toFixed(3) || '0.000', 
        reliabilityIndices?.metro?.saifi?.toFixed(3) || '0.000', 
        reliabilityIndices?.metro?.caidi?.toFixed(3) || '0.000'
      ],
      ['Total', // Add a total row if available in reliabilityIndices object
        reliabilityIndices?.total?.saidi?.toFixed(3) || 'N/A', 
        reliabilityIndices?.total?.saifi?.toFixed(3) || 'N/A', 
        reliabilityIndices?.total?.caidi?.toFixed(3) || 'N/A'
      ],
    ];

     currentY = await drawTable({ 
      page, startX: margin, startY: currentY, tableWidth: contentWidth, // Use full width
      headers: reliabilityHeaders, data: reliabilityData, 
      headerFont: boldFont, bodyFont: regularFont, 
      columnWidths: [100, 100, 100, 100] // Adjust widths as needed
    });
    currentY -= 20;

    // --- MTTR Report Section ---
    page.drawText('Mean Time To Repair (MTTR) Analysis', {
      x: margin,
      y: currentY,
      size: 14,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 20;

    // Calculate MTTR statistics
    console.log('MTTR Debug - All faults:', filteredFaults.map(f => ({
      id: f.id,
      type: f.type,
      repairDate: f.repairDate,
      repairEndDate: f.repairEndDate
    })));

    const op5FaultsWithMTTR = filteredFaults.filter(f => {
      const isOP5 = f.type === 'OP5 Fault';
      const hasValidDates = f.repairDate && f.repairEndDate;
      
      if (isOP5 && hasValidDates) {
        const repairDate = new Date(f.repairDate);
        const repairEndDate = new Date(f.repairEndDate);
        const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60); // Convert to hours
        f.mttr = mttr; // Add calculated MTTR to the fault object
      }

      console.log('MTTR Debug - Fault:', {
        id: f.id,
        type: f.type,
        repairDate: f.repairDate,
        repairEndDate: f.repairEndDate,
        calculatedMTTR: f.mttr,
        isOP5,
        hasValidDates
      });

      return isOP5 && hasValidDates;
    });

    console.log('MTTR Debug - Filtered faults:', op5FaultsWithMTTR.map(f => ({
      id: f.id,
      type: f.type,
      mttr: f.mttr
    })));

    const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => sum + (fault.mttr || 0), 0);
    const averageMTTR = op5FaultsWithMTTR.length > 0 ? totalMTTR / op5FaultsWithMTTR.length : 0;

    console.log('MTTR Debug - Summary:', {
      totalFaults: filteredFaults.length,
      op5Faults: filteredFaults.filter(f => f.type === 'OP5 Fault').length,
      faultsWithMTTR: op5FaultsWithMTTR.length,
      totalMTTR,
      averageMTTR
    });

    // MTTR Summary Table
    const mttrSummaryHeaders = ['Metric', 'Value'];
    const mttrSummaryData = [
      ['Total Faults with MTTR', op5FaultsWithMTTR.length],
      ['Average MTTR', `${averageMTTR.toFixed(2)} hours`],
      ['Total Repair Time', `${totalMTTR.toFixed(2)} hours`],
    ];

    currentY = await drawTable({ 
      page, startX: margin, startY: currentY, tableWidth: contentWidth / 2,
      headers: mttrSummaryHeaders, data: mttrSummaryData, 
      headerFont: boldFont, bodyFont: regularFont, 
      columnWidths: [150, 100]
    });
    currentY -= 20;

    // MTTR by Region Table
    page.drawText('MTTR by Region', {
      x: margin,
      y: currentY,
      size: 12,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 15;

    const mttrRegionHeaders = ['Region', 'Avg. MTTR (hours)', 'Fault Count'];
    const mttrRegionData = regions
      .map(region => {
        const regionFaults = op5FaultsWithMTTR.filter(f => f.regionId === region.id);
        if (regionFaults.length === 0) return null;
        const regionMTTRSum = regionFaults.reduce((sum, fault) => sum + (fault.mttr || 0), 0);
        const avgMTTR = regionMTTRSum / regionFaults.length;
        return [region.name, avgMTTR.toFixed(2), regionFaults.length];
      })
      .filter(row => row !== null);

    if (mttrRegionData.length > 0) {
      currentY = await drawTable({ 
        page, startX: margin, startY: currentY, tableWidth: contentWidth * 0.75,
        headers: mttrRegionHeaders, data: mttrRegionData as (string | number)[][], 
        headerFont: boldFont, bodyFont: regularFont, 
        columnWidths: [150, 100, 100]
      });
    }
    currentY -= 20;

    // TODO: Add Fault List Table (Optional, might need pagination)
    // Consider adding a table listing the top N faults or faults exceeding a certain duration/MTTR
    // This would require pagination logic if the list is long.

    // Add footer with page numbers (ensure this runs after all pages potentially added)
    const totalPages = pdfDoc.getPages().length;
    pdfDoc.getPages().forEach((p, index) => {
      p.drawText(`Page ${index + 1} of ${totalPages}`, {
        x: width - margin - 50,
        y: margin / 2, // Position at bottom margin
        size: 9,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    // --- Save the PDF --- 
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    let filenameDate = 'all-time';
    if (dateRange !== 'all' && startDate && endDate) {
      filenameDate = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
    }
    link.href = url;
    link.download = `Analytics-Report-${filenameDate}.pdf`; // Improved filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Analytics PDF report generated successfully.');

  } catch (error) {
    console.error('Error generating analytics PDF report:', error);
    // Consider using toast notification for user feedback
    // toast.error("Failed to generate PDF report.");
  }
};

// Helper function to draw text and handle potential null/undefined values
const drawTextSafe = (page: PDFPage, text: string | number | null | undefined, options: any, fallback = 'N/A') => {
  const displayText = (text === null || text === undefined || text === '') ? fallback : String(text);
  page.drawText(displayText, options);
};

// --- NEW TABLE DRAWING HELPER --- 
interface DrawTableOptions {
  page: PDFPage;
  startX: number;
  startY: number;
  tableWidth: number;
  headers: string[];
  data: (string | number | null | undefined)[][]; // Array of rows, each row is an array of cell values
  columnWidths?: number[]; // Optional: specify widths, otherwise distribute equally
  headerFont: PDFFont;
  bodyFont: PDFFont;
  headerFontSize?: number;
  bodyFontSize?: number;
  lineHeight?: number;
  borderColor?: any; // e.g., rgb(0.8, 0.8, 0.8)
  headerBgColor?: any; // e.g., rgb(0.9, 0.9, 0.9)
  headerTextColor?: any;
  bodyTextColor?: any;
}

async function drawTable({
  page,
  startX,
  startY,
  tableWidth,
  headers,
  data,
  columnWidths,
  headerFont,
  bodyFont,
  headerFontSize = 10,
  bodyFontSize = 9,
  lineHeight = 15,
  borderColor = rgb(0.7, 0.7, 0.7),
  headerBgColor = rgb(0.9, 0.9, 0.9),
  headerTextColor = rgb(0, 0, 0),
  bodyTextColor = rgb(0, 0, 0),
}: DrawTableOptions): Promise<number> { // Returns the Y position after the table
  let currentY = startY;
  const columnCount = headers.length;
  const defaultColWidth = tableWidth / columnCount;
  const widths = columnWidths || Array(columnCount).fill(defaultColWidth);

  // Ensure widths array matches header count
  if (widths.length !== columnCount) {
    console.warn("drawTable: Column widths count doesn't match headers count. Using default widths.");
    widths.length = columnCount; // Adjust array size
    widths.fill(defaultColWidth);
  }

  const rowHeight = lineHeight;
  const cellPadding = 3;

  // Draw Header
  page.drawRectangle({
    x: startX,
    y: currentY - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: headerBgColor,
  });

  let currentX = startX;
  headers.forEach((header, i) => {
    drawTextSafe(page, header, {
      x: currentX + cellPadding,
      y: currentY - rowHeight + cellPadding + 2, // Adjust text position within cell
      font: headerFont,
      size: headerFontSize,
      color: headerTextColor,
    });
    currentX += widths[i];
  });
  currentY -= rowHeight;

  // Draw Data Rows
  data.forEach((row) => {
    currentX = startX;
    row.forEach((cell, i) => {
      drawTextSafe(page, cell, {
        x: currentX + cellPadding,
        y: currentY - rowHeight + cellPadding + 1,
        font: bodyFont,
        size: bodyFontSize,
        color: bodyTextColor,
      });
      currentX += widths[i];
    });

    // Draw row bottom border
    page.drawLine({
      start: { x: startX, y: currentY - rowHeight },
      end: { x: startX + tableWidth, y: currentY - rowHeight },
      thickness: 0.5,
      color: borderColor,
    });

    currentY -= rowHeight;
  });

  // Draw Table Borders (Outer and Vertical Column Lines)
  page.drawRectangle({
      x: startX,
      y: currentY,
      width: tableWidth,
      height: startY - currentY,
      borderColor: borderColor,
      borderWidth: 0.5,
  });

  currentX = startX;
  for (let i = 0; i < columnCount -1 ; i++) { // Draw vertical lines between columns
      currentX += widths[i];
      page.drawLine({
          start: { x: currentX, y: startY },
          end: { x: currentX, y: currentY },
          thickness: 0.5,
          color: borderColor,
      });
  }

  return currentY; // Return the Y position below the drawn table
}
// --- END TABLE HELPER --- 

/**
 * Generate comprehensive PDF report for a single VIT asset
 */
export const exportVITAssetToPDF = async (asset: VITAsset) => {
  try {
    if (!asset) throw new Error("Asset is required");
    
    // Fetch feeder alias if feeder name exists
    let feederAlias: string | undefined = undefined;
    if (asset.feederName) {
      try {
        const feederService = FeederService.getInstance();
        const allFeeders = await feederService.getAllFeeders();
        const feeder = allFeeders.find(f => f.name === asset.feederName);
        if (feeder) {
          feederAlias = feeder.alias;
        }
      } catch (error) {
        console.warn('[exportVITAssetToPDF] Error fetching feeder alias:', error);
        // Continue without alias if lookup fails
      }
    }
    
    // Create PDF document with A4 size
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    const { width, height } = page.getSize();
    const margin = 50;
    let currentY = height - margin;
    // Load fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    // --- Header ---
    page.drawText('VIT ASSET REPORT', {
      x: margin,
      y: currentY,
      size: 22,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 30;
    // --- Metadata ---
    const metaData = [
      [`Report Generated:`, format(new Date(), 'dd/MM/yyyy HH:mm')],
      [`Serial Number:`, asset.serialNumber],
      [`Type:`, asset.typeOfUnit],
      [`Voltage Level:`, asset.voltageLevel],
      [`Region:`, asset.region],
      [`District:`, asset.district],
      [`Feeder Name:`, asset.feederName],
      [`Feeder Alias:`, feederAlias || 'N/A'],
      [`Location:`, asset.location],
      [`GPS Coordinates:`, asset.gpsCoordinates],
      [`Status:`, asset.status],
      [`Protection:`, asset.protection],
      [`Created At:`, formatDate(asset.createdAt, true)],
      [`Updated At:`, formatDate(asset.updatedAt, true)],
      [`Created By:`, asset.createdBy],
    ];
    metaData.forEach(([label, value]) => {
      page.drawText(label, { x: margin, y: currentY, font: regularFont, size: 11, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(String(value ?? 'N/A'), { x: margin + 140, y: currentY, font: boldFont, size: 11, color: rgb(0, 0, 0) });
      currentY -= 18;
    });
    // --- Asset Photo ---
    if (asset.photoUrl) {
      try {
        // Use PhotoService to convert Azure Blob URLs to proxy URLs
        const proxyUrl = PhotoService.getInstance().convertToProxyUrl(asset.photoUrl);
        console.log('[VITAssetPDF] Loading asset photo:', { original: asset.photoUrl, proxy: proxyUrl });
        
        const imageBytes = await fetch(proxyUrl).then(res => res.arrayBuffer());
        const image = await pdfDoc.embedJpg(imageBytes).catch(() => pdfDoc.embedPng(imageBytes));
        const imgDims = image.scale(0.3); // scale to fit
        currentY -= 10;
        page.drawText('Asset Photo:', { x: margin, y: currentY, font: boldFont, size: 13, color: rgb(0.1, 0.4, 0.6) });
        currentY -= imgDims.height + 10;
        page.drawImage(image, {
          x: margin,
          y: currentY,
          width: imgDims.width,
          height: imgDims.height,
        });
        currentY -= 20;
      } catch (err) {
        console.error('[VITAssetPDF] Error loading asset photo:', err);
        // If image fails, skip
        currentY -= 10;
        page.drawText('Asset Photo: (Failed to load image)', { x: margin, y: currentY, font: boldFont, size: 13, color: rgb(0.8, 0.2, 0.2) });
        currentY -= 20;
      }
    }
    // --- Map View ---
    if (asset.gpsCoordinates && asset.gpsCoordinates.includes(',')) {
      try {
        const [lat, lng] = asset.gpsCoordinates.split(',').map(Number);
        // Use Google Static Maps API
        // IMPORTANT: Set VITE_GOOGLE_MAPS_API_KEY in your .env file
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) throw new Error('Google Maps API key is not set. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.');
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x250&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
        const mapBytes = await fetch(mapUrl).then(res => res.arrayBuffer());
        const mapImage = await pdfDoc.embedPng(mapBytes);
        const mapDims = mapImage.scale(0.7);
        page.drawText('Map View:', { x: margin, y: currentY, font: boldFont, size: 13, color: rgb(0.1, 0.4, 0.6) });
        currentY -= mapDims.height + 10;
        page.drawImage(mapImage, {
          x: margin,
          y: currentY,
          width: mapDims.width,
          height: mapDims.height,
        });
        currentY -= 20;
        // Attribution for Google Maps
        page.drawText('Map data © Google', {
          x: margin,
          y: currentY,
          font: regularFont,
          size: 8,
          color: rgb(0.4, 0.4, 0.4),
        });
        currentY -= 10;
      } catch (err) {
        currentY -= 10;
        page.drawText('Map View: (Failed to load map image)', { x: margin, y: currentY, font: boldFont, size: 13, color: rgb(0.8, 0.2, 0.2) });
        currentY -= 20;
      }
    }
    // --- Download PDF ---
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    // Generate filename with safe date handling
    let filenameDate = 'unknown-date';
    try {
      const dateObj = asset.createdAt?.seconds ? new Date(asset.createdAt.seconds * 1000) : new Date(asset.createdAt);
      if (!isNaN(dateObj.getTime())) {
        filenameDate = format(dateObj, 'yyyy-MM-dd');
      }
    } catch (error) {
      // fallback
    }
    link.href = url;
    link.download = `vit-asset-${asset.serialNumber}-${filenameDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating VIT asset PDF:", error);
    throw error;
  }
};
