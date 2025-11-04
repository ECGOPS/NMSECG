import { jsPDF } from "jspdf";

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY?: number;
    };
    autoTable: (options: {
      startY?: number;
      head?: string[][];
      body?: string[][];
      theme?: string;
      headStyles?: {
        fillColor?: number[];
        textColor?: number[];
      };
      styles?: {
        cellPadding?: number;
        fontSize?: number;
        overflow?: string;
      };
      columnStyles?: {
        [key: number]: {
          cellWidth?: number;
        };
      };
      margin?: {
        left?: number;
      };
    }) => jsPDF;
  }
}

declare module "jspdf-autotable" {} 