/**
 * WIP Excel Parser
 * Parses the Weekly Report Excel file for Raw Data and Weekly Summary sheets
 */

import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import type {
  RawDataExcelRow,
  WIPUnit,
  WeeklyMatrix,
  WIPWeeklySummary
} from '@/lib/types/wip';

/**
 * Parse a date from various formats in Excel
 */
function parseExcelDate(value: any): string | undefined {
  if (!value) return undefined;
  
  try {
    // If it's already a Date object
    if (value instanceof Date) {
      return format(value, 'yyyy-MM-dd');
    }
    
    // If it's an Excel serial number
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      return format(new Date(date.y, date.m - 1, date.d), 'yyyy-MM-dd');
    }
    
    // If it's a string date
    if (typeof value === 'string' && value.trim()) {
      // Try parsing as ISO date
      const parsed = parseISO(value);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, 'yyyy-MM-dd');
      }
      
      // Try other formats
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return format(date, 'yyyy-MM-dd');
      }
    }
  } catch (error) {
    console.warn(`Failed to parse date: ${value}`, error);
  }
  
  return undefined;
}

/**
 * Parse Raw Data sheet into WIP units
 */
export function parseRawDataSheet(workbook: XLSX.WorkBook): Partial<WIPUnit>[] {
  try {
    const sheetName = 'Raw Data';
    
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    console.log(`📊 Found ${rawData.length} rows in Raw Data sheet`);
    
    const units: (Partial<WIPUnit> | null)[] = rawData.map((row: any, index: number) => {
      try {
        // Skip empty rows (all values are null/undefined)
        const hasAnyData = Object.values(row).some(val => val !== null && val !== undefined && val !== '');
        if (!hasAnyData) {
          return null;
        }

        // Extract and normalize data (handle missing/messy values)
        const serialNumber = row['Serial Number']?.toString().trim() || '';
        const modelNumber = row['Model Number']?.toString().trim() || '';
        const source = row['Source']?.toString().trim() || '';
        
        // Handle messy WIP field
        const wipValue = row['WIP (1/0)'] ?? row['WIP'] ?? row['WIP (1/0) '] ?? row['WIP(1/0)'];
        const isWip = wipValue === 1 || wipValue === '1' || wipValue === true || wipValue === 'Yes' || wipValue === 'yes';
        
        // Handle RMA field (new column in Excel)
        const rmaValue = row['RMA/Seed Stock'] ?? row['RMA'] ?? row['RMA (1/0)'] ?? row['RMA(1/0)'];
        const isRmaFromColumn = rmaValue === 1 || rmaValue === '1' || rmaValue === true || rmaValue === 'Yes' || rmaValue === 'yes';
        
        // Detect flags from source (handle null/undefined) - fallback if RMA column not present
        const sourceLower = (source || '').toLowerCase();
        const isRmaFromSource = sourceLower.includes('rma');
        
        // Use RMA column if available, otherwise fall back to source detection
        const isRma = isRmaFromColumn || isRmaFromSource;
        
        // Debug RMA detection for first few rows
        if (index < 5 || isRma) {
          console.log(`🔍 Row ${index + 2}: Serial=${serialNumber}, Model=${modelNumber}, RMA/Seed Stock=${rmaValue}, isRma=${isRma}`);
        }
        const isCatvIntake = sourceLower.includes('catv');
        
        // NEW: Parse WIP Status column
        const wipStatus = row['WIP Status']?.toString().trim() || null;
        
        // NEW: Parse Outflow column
        const outflow = row['Outflow']?.toString().trim() || null;
        
        // Parse dates
        const receivedDate = parseExcelDate(row['Date Stamp']);
        const isoYearWeekReceived = row['ISO YearWeek (Received)']?.toString().trim();
        const emgShipDate = parseExcelDate(row['EMG Ship Date']);
        const emgInvoiceDate = parseExcelDate(row['EMG Invoice Date']);
        const jiraIsoYearWeek = row['Jira ISO YearWeek']?.toString().trim();
        const jiraInvoiceDate = parseExcelDate(row['Jira Invoice Date']);
        const jiraTransferIsoWeek = row['Jira Transfer ISO Week']?.toString().trim();
        const jiraTransferDate = parseExcelDate(row['Jira Transfer Date']);
        
        // Only skip if BOTH serial and model are missing (truly empty row)
        if (!serialNumber && !modelNumber) {
          return null;
        }
        
        // Warn about partial data but keep the row
        if (!serialNumber) {
          console.warn(`Row ${index + 2}: Missing serial number`);
        }
        if (!modelNumber) {
          console.warn(`Row ${index + 2}: Missing model number`);
        }
        
        const unit: Partial<WIPUnit> = {
          serialNumber,
          modelNumber,
          source,
          receivedDate,
          isoYearWeekReceived,
          emgShipDate,
          emgInvoiceDate,
          jiraIsoYearWeek,
          jiraInvoiceDate,
          jiraTransferIsoWeek,
          jiraTransferDate,
          isWip,
          isRma,
          isCatvIntake,
          wipStatus,        // NEW
          outflow,          // NEW
          rawData: row // Store entire row for debugging
        };
        
        return unit;
      } catch (error) {
        console.error(`Error parsing row ${index + 2}:`, error);
        return null;
      }
    });
    
    // Filter out null entries
    const validUnits = units.filter(u => u !== null) as Partial<WIPUnit>[];
    
    // Count RMA units for debugging
    const rmaUnits = validUnits.filter(u => u.isRma);
    const rmaByModel = rmaUnits.reduce((acc, unit) => {
      const model = unit.modelNumber || 'Unknown';
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`✅ Successfully parsed ${validUnits.length} units from Raw Data`);
    console.log(`🔴 RMA Units Found: ${rmaUnits.length} total`);
    console.log(`📊 RMA Units by Model:`, rmaByModel);
    return validUnits;
    
  } catch (error) {
    console.error('Error parsing Raw Data sheet:', error);
    throw error;
  }
}

/**
 * Parse Weekly Summary sheet into structured data
 */
export function parseWeeklySummarySheet(workbook: XLSX.WorkBook): WeeklyMatrix | null {
  try {
    const sheetName = 'Weekly Summary';
    
    if (!workbook.SheetNames.includes(sheetName)) {
      console.warn(`Sheet "${sheetName}" not found, skipping weekly summary`);
      return null;
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to 2D array for easier row-based parsing
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const data: any[][] = [];
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row: any[] = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        row.push(cell ? cell.v : null);
      }
      data.push(row);
    }
    
    // First row should be headers: "ISO Weeks --->" followed by week numbers
    const headerRow = data[0];
    const weeks: string[] = [];
    const weekColumns: number[] = []; // Track column indices
    
    for (let i = 1; i < headerRow.length; i++) {
      const value = headerRow[i];
      if (value && !isNaN(Number(value)) && value !== 'Grand Total') {
        weeks.push(value.toString());
        weekColumns.push(i);
      }
    }
    
    console.log(`📅 Found ${weeks.length} weeks in Weekly Summary:`, weeks);
    
    // Extract metrics from specific rows
    const metrics = {
      receivedIn: {} as Record<string, number>,
      jiraShippedOut: {} as Record<string, number>,
      emgShippedOut: {} as Record<string, number>,
      wipInHouse: {} as Record<string, number>,
      wipCumulative: {} as Record<string, number>
    };
    
    // Find metric rows by matching column A (row labels)
    for (let R = 1; R < data.length; R++) {
      const rowLabel = data[R][0]?.toString().toLowerCase() || '';
      
      let targetMetric: keyof typeof metrics | null = null;
      
      if (/received.*\(in\)/i.test(rowLabel)) {
        targetMetric = 'receivedIn';
      } else if (/shipped via jira.*\(out\)/i.test(rowLabel)) {
        targetMetric = 'jiraShippedOut';
      } else if (/count of emg shipped.*\(out\)/i.test(rowLabel)) {
        targetMetric = 'emgShippedOut';
      } else if (/^wip.*\(in house\)$/i.test(rowLabel) && !/cumulative/i.test(rowLabel)) {
        targetMetric = 'wipInHouse';
      } else if (/total wip.*cumulative/i.test(rowLabel)) {
        targetMetric = 'wipCumulative';
      }
      
      if (targetMetric) {
        // Extract values for each week
        weekColumns.forEach((colIndex, weekIndex) => {
          const value = data[R][colIndex];
          const numValue = typeof value === 'number' ? value : (isNaN(Number(value)) ? 0 : Number(value));
          metrics[targetMetric!][weeks[weekIndex]] = numValue;
        });
      }
    }
    
    // Infer ISO year (default to current year, could be improved)
    const currentYear = new Date().getFullYear();
    
    const result: WeeklyMatrix = {
      isoYear: currentYear,
      weeks,
      metrics,
    };
    
    console.log(`✅ Successfully parsed Weekly Summary with ${Object.keys(metrics).length} metrics`);
    return result;
    
  } catch (error) {
    console.error('Error parsing Weekly Summary sheet:', error);
    return null;
  }
}

/**
 * Parse entire Excel file (both sheets)
 */
export interface ParsedExcelData {
  units: Partial<WIPUnit>[];
  weeklySummary: WeeklyMatrix | null;
  stats: {
    totalUnits: number;
    hasWeeklySummary: boolean;
  };
}

export function parseWIPExcelFile(buffer: ArrayBuffer): ParsedExcelData {
  console.log(`📂 Parsing WIP Excel file from buffer (${buffer.byteLength} bytes)`);
  
  // Read workbook from buffer
  const workbook = XLSX.read(buffer, { type: 'array' });
  console.log(`📋 Workbook sheets:`, workbook.SheetNames);
  
  const units = parseRawDataSheet(workbook);
  const weeklySummary = parseWeeklySummarySheet(workbook);
  
  return {
    units,
    weeklySummary,
    stats: {
      totalUnits: units.length,
      hasWeeklySummary: weeklySummary !== null
    }
  };
}

/**
 * Validate parsed unit data (lenient - only reject truly invalid rows)
 */
export function validateWIPUnit(unit: Partial<WIPUnit>): string[] {
  const errors: string[] = [];
  
  // Only require serial number as truly critical
  if (!unit.serialNumber) {
    errors.push('Missing serial number');
  }
  
  // Warn about other missing fields but don't fail validation
  // This allows processing of messy/incomplete data
  
  return errors;
}

