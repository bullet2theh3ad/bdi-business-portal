/**
 * Types for Warehouse WIP (Work In Progress) Flow System
 */

// Stage types
export type WIPStage = 'Intake' | 'WIP' | 'RMA' | 'Outflow' | 'Other Intake' | 'Unknown';

// Aging bucket types
export type AgingBucket = '0-7' | '8-14' | '15-30' | '>30';

// Import status
export type ImportStatus = 'processing' | 'completed' | 'failed';

/**
 * WIP Unit Record (from warehouse_wip_units table)
 */
export interface WIPUnit {
  id: string;
  serialNumber: string;
  modelNumber: string; // SKU
  source?: string;
  
  // Dates
  receivedDate?: string; // ISO date string
  isoYearWeekReceived?: string; // e.g., "2025-41"
  emgShipDate?: string;
  emgInvoiceDate?: string;
  jiraIsoYearWeek?: string;
  jiraInvoiceDate?: string;
  jiraTransferIsoWeek?: string;
  jiraTransferDate?: string;
  
  // Flags
  isWip: boolean;
  isRma: boolean;
  isCatvIntake: boolean;
  
  // NEW: Processing status and destination
  wipStatus?: string | null;  // RECEIVED, PASSED, FAILED, RTS-NEW, RTS-KITTED, RECYCLED, SHIPPED, RMA_SHIPPED, MISSING
  outflow?: string | null;     // Destination: EMG, ISSOY, SVT, etc.
  
  // Derived
  stage: WIPStage;
  outflowDate?: string;
  agingDays?: number;
  agingBucket?: AgingBucket;
  
  // Metadata
  importBatchId?: string;
  importedAt?: string;
  updatedAt?: string;
  rawData?: Record<string, any>;
}

/**
 * WIP Import Batch (from warehouse_wip_imports table)
 */
export interface WIPImportBatch {
  id: string;
  fileName: string;
  fileSize?: number;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  status: ImportStatus;
  errorMessage?: string;
  importedBy?: string;
  startedAt: string;
  completedAt?: string;
  summaryStats?: {
    intake: number;
    wip: number;
    rma: number;
    outflow: number;
  };
}

/**
 * Weekly Summary Record (from warehouse_wip_weekly_summary table)
 */
export interface WIPWeeklySummary {
  id: string;
  isoYear: number;
  weekNumber: number;
  isoYearWeek: string; // e.g., "2025-41"
  receivedIn: number;
  jiraShippedOut: number;
  emgShippedOut: number;
  wipInHouse: number;
  wipCumulative: number;
  importBatchId?: string;
  importedAt: string;
}

/**
 * Excel Row Types (from Raw Data sheet)
 */
export interface RawDataExcelRow {
  'Serial Number': string;
  'Model Number': string;
  'WIP (1/0)': number | string; // Could be 1, 0, "1", "0"
  'Source': string;
  'ISO YearWeek (Received)': string;
  'Date Stamp': string | Date;
  'EMG Ship Date': string | Date;
  'EMG Invoice Date': string | Date;
  'Jira ISO YearWeek': string;
  'Jira Invoice Date': string | Date;
  'Jira Transfer ISO Week': string;
  'Jira Transfer Date': string | Date;
  [key: string]: any; // Allow other columns
}

/**
 * Weekly Summary Excel Row Types
 */
export interface WeeklySummaryExcelRow {
  metricName: string;
  [weekNumber: string]: number | string; // "15": 123, "16": 456, etc.
}

/**
 * Parsed Weekly Matrix (for API responses)
 */
export interface WeeklyMatrix {
  isoYear: number;
  weeks: string[]; // e.g., ["15", "16", "17", ...]
  metrics: {
    receivedIn: Record<string, number>;
    jiraShippedOut: Record<string, number>;
    emgShippedOut: Record<string, number>;
    wipInHouse: Record<string, number>;
    wipCumulative: Record<string, number>;
  };
  grandTotal?: {
    receivedIn: number;
    jiraShippedOut: number;
    emgShippedOut: number;
    wipInHouse: number;
    wipCumulative: number;
  };
}

/**
 * Sankey Flow Data (for visualizations)
 */
export interface SankeyNode {
  id: string;
  label: string;
  count: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/**
 * Cumulative Flow Data (for charts)
 */
export interface CumulativeFlowDataPoint {
  week: string; // ISO year-week
  intake: number;
  wip: number;
  rma: number;
  outflow: number;
}

/**
 * WIP Aging Data (for charts)
 */
export interface AgingBucketData {
  bucket: AgingBucket;
  count: number;
  stage?: WIPStage;
}

/**
 * Filter Options
 */
export interface WIPFilters {
  dateFrom?: string; // ISO date
  dateTo?: string;
  skus?: string[]; // Model numbers
  sources?: string[]; // Source values
  stages?: WIPStage[];
  isoYearWeek?: string; // For weekly view
}

/**
 * Dashboard Metrics
 */
export interface WIPMetrics {
  totalIntake: number;
  activeWip: number;
  rmaInProcess: number;
  totalOutflow: number;
  avgAgingDays: number;
  periodReceived: number; // For selected date range
  periodOutflow: number;
}

/**
 * SKU Leaders (for weekly summary)
 */
export interface SKULeader {
  sku: string;
  skuName?: string;
  count: number;
  percentage?: number;
}

/**
 * Weekly Delta
 */
export interface WeeklyDelta {
  week: string;
  metric: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercentage?: number;
}

/**
 * Exception Record (for identifying bottlenecks)
 */
export interface WIPException {
  week: string;
  type: 'wip_increase_outflow_decrease' | 'aging_threshold' | 'missing_data';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedUnits?: number;
}

