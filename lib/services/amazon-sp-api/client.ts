/**
 * Amazon SP-API Client
 * Main client for interacting with Amazon Selling Partner API
 * Based on working Python implementation from BDI_2/aws_client.py
 */

import { AmazonSPAPIAuth } from './auth';
import { AmazonRateLimiter, RequestQueue } from './rate-limiter';
import {
  AmazonCredentials,
  AmazonReportType,
  CreateReportRequest,
  CreateReportResponse,
  GetReportResponse,
  GetReportDocumentResponse,
  ReportProcessingStatus,
  AmazonSPAPIError,
  AmazonMarketplace,
} from './types';
import { gunzipSync } from 'zlib';

// ============================================================================
// SP-API CLIENT
// ============================================================================

export class AmazonSPAPIClient {
  private auth: AmazonSPAPIAuth;
  private rateLimiter: AmazonRateLimiter;
  private requestQueue: RequestQueue;
  
  private readonly SP_API_URL = 'https://sellingpartnerapi-na.amazon.com';
  private readonly REPORTS_VERSION = '2021-06-30';
  
  // Polling configuration
  private readonly POLL_INTERVAL_MS = 10000; // 10 seconds
  private readonly MAX_POLL_TIME_MS = 600000; // 10 minutes

  constructor(credentials: AmazonCredentials) {
    this.auth = new AmazonSPAPIAuth(credentials);
    this.rateLimiter = new AmazonRateLimiter();
    this.requestQueue = new RequestQueue(5); // Max 5 concurrent requests
  }

  // ==========================================================================
  // REPORTS API (3-Step Process)
  // ==========================================================================

  /**
   * Request a report (Step 1)
   * Based on: BDI_2/aws_client.py -> request_report()
   * 
   * @param reportType Type of report to request
   * @param startDate Start date (ISO 8601)
   * @param endDate End date (ISO 8601)
   * @param marketplaceIds Marketplace IDs
   * @returns Report ID
   */
  async requestReport(
    reportType: AmazonReportType | string,
    startDate?: string,
    endDate?: string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    console.log(`[SP-API] Requesting report: ${reportType}`);
    
    const payload: CreateReportRequest = {
      reportType,
      marketplaceIds,
    };

    if (startDate) {
      payload.dataStartTime = startDate;
    }
    if (endDate) {
      payload.dataEndTime = endDate;
    }

    return await this.rateLimiter.executeWithRetry(async () => {
      const path = `/reports/${this.REPORTS_VERSION}/reports`;
      const headers = await this.auth.getSignedHeaders(
        'POST',
        path,
        this.SP_API_URL.replace('https://', ''),
        {},
        JSON.stringify(payload)
      );

      const response = await fetch(`${this.SP_API_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'REPORT_REQUEST_FAILED',
          `Failed to request report: ${response.status}`,
          response.status,
          errorText
        );
      }

      const data: CreateReportResponse = await response.json();
      console.log(`[SP-API] Report requested successfully. Report ID: ${data.reportId}`);
      return data.reportId;
    }, 'Request Report');
  }

  /**
   * Wait for report to complete (Step 2)
   * Based on: BDI_2/aws_client.py -> wait_for_report()
   * 
   * @param reportId Report ID from requestReport()
   * @returns Report document ID
   */
  async waitForReport(reportId: string): Promise<string> {
    console.log(`[SP-API] Waiting for report ${reportId} to complete...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.MAX_POLL_TIME_MS) {
      const report = await this.getReportStatus(reportId);
      
      console.log(`[SP-API] Report ${reportId} status: ${report.processingStatus}`);
      
      if (report.processingStatus === ReportProcessingStatus.DONE) {
        if (!report.reportDocumentId) {
          throw new AmazonSPAPIError(
            'REPORT_NO_DOCUMENT_ID',
            'Report completed but no document ID returned',
            undefined,
            report
          );
        }
        console.log(`[SP-API] Report ${reportId} completed. Document ID: ${report.reportDocumentId}`);
        return report.reportDocumentId;
      }
      
      if (report.processingStatus === ReportProcessingStatus.CANCELLED ||
          report.processingStatus === ReportProcessingStatus.FATAL) {
        throw new AmazonSPAPIError(
          'REPORT_PROCESSING_FAILED',
          `Report processing failed with status: ${report.processingStatus}`,
          undefined,
          report
        );
      }
      
      // Wait before polling again
      await this.sleep(this.POLL_INTERVAL_MS);
    }
    
    throw new AmazonSPAPIError(
      'REPORT_TIMEOUT',
      `Report ${reportId} did not complete within ${this.MAX_POLL_TIME_MS / 1000} seconds`,
      undefined,
      { reportId }
    );
  }

  /**
   * Get report status
   * Based on: BDI_2/amazon_flat_file_v2.py -> wait_for_report()
   */
  async getReportStatus(reportId: string): Promise<GetReportResponse> {
    return await this.rateLimiter.executeWithRetry(async () => {
      const path = `/reports/${this.REPORTS_VERSION}/reports/${reportId}`;
      const headers = await this.auth.getSignedHeaders(
        'GET',
        path,
        this.SP_API_URL.replace('https://', '')
      );

      const response = await fetch(`${this.SP_API_URL}${path}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'GET_REPORT_FAILED',
          `Failed to get report status: ${response.status}`,
          response.status,
          errorText
        );
      }

      return await response.json();
    }, 'Get Report Status');
  }

  /**
   * Download report (Step 3)
   * Based on: BDI_2/aws_client.py -> download_report()
   * 
   * @param reportDocumentId Report document ID from waitForReport()
   * @returns Report data as string
   */
  async downloadReport(reportDocumentId: string): Promise<string> {
    console.log(`[SP-API] Downloading report document ${reportDocumentId}...`);
    
    return await this.rateLimiter.executeWithRetry(async () => {
      // Step 1: Get report document info (includes download URL)
      const path = `/reports/${this.REPORTS_VERSION}/documents/${reportDocumentId}`;
      const headers = await this.auth.getSignedHeaders(
        'GET',
        path,
        this.SP_API_URL.replace('https://', '')
      );

      const response = await fetch(`${this.SP_API_URL}${path}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'GET_REPORT_DOCUMENT_FAILED',
          `Failed to get report document info: ${response.status}`,
          response.status,
          errorText
        );
      }

      const documentInfo: GetReportDocumentResponse = await response.json();
      
      // Step 2: Download from the URL
      console.log(`[SP-API] Downloading from URL: ${documentInfo.url.substring(0, 50)}...`);
      const downloadResponse = await fetch(documentInfo.url);
      
      if (!downloadResponse.ok) {
        throw new AmazonSPAPIError(
          'DOWNLOAD_REPORT_FAILED',
          `Failed to download report: ${downloadResponse.status}`,
          downloadResponse.status
        );
      }

      // Step 3: Handle compression if needed
      let content: Buffer | string;
      
      if (documentInfo.compressionAlgorithm === 'GZIP') {
        console.log(`[SP-API] Decompressing GZIP content...`);
        const buffer = Buffer.from(await downloadResponse.arrayBuffer());
        content = gunzipSync(buffer).toString('utf-8');
      } else {
        content = await downloadResponse.text();
      }

      console.log(`[SP-API] Report downloaded successfully (${content.length} bytes)`);
      return content;
    }, 'Download Report');
  }

  /**
   * Complete report workflow: Request → Wait → Download
   * Based on: BDI_2/fetch_settlement_reports.py -> get_amazon_settlement_report()
   * 
   * @param reportType Type of report
   * @param startDate Start date (ISO 8601)
   * @param endDate End date (ISO 8601)
   * @param marketplaceIds Marketplace IDs
   * @returns Report data as string
   */
  async getReport(
    reportType: AmazonReportType | string,
    startDate?: string,
    endDate?: string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    console.log(`[SP-API] Starting complete report workflow for ${reportType}`);
    const startTime = Date.now();

    try {
      // Step 1: Request the report
      const reportId = await this.requestReport(reportType, startDate, endDate, marketplaceIds);
      
      // Step 2: Wait for completion
      const documentId = await this.waitForReport(reportId);
      
      // Step 3: Download the report
      const reportData = await this.downloadReport(documentId);
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`[SP-API] Report workflow completed in ${duration.toFixed(2)} seconds`);
      
      return reportData;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      console.error(`[SP-API] Report workflow failed after ${duration.toFixed(2)} seconds:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // FBA INVENTORY API
  // ==========================================================================

  /**
   * Get FBA Inventory Summaries (real-time inventory data)
   * https://developer-docs.amazon.com/sp-api/docs/fba-inventory-api-v1-reference#get-inventorysummaries
   * 
   * @param marketplaceIds Marketplace IDs
   * @param details Include details (default: false)
   * @param granularityType MARKETPLACE or ASIN
   * @param startDateTime Filter for inventory updated after this date
   * @returns Inventory summaries
   */
  async getInventorySummaries(
    marketplaceIds: string[] = [AmazonMarketplace.US],
    details: boolean = true,
    granularityType: 'Marketplace' | 'ASIN' = 'Marketplace',
    startDateTime?: string
  ): Promise<any> {
    console.log(`[SP-API] Fetching FBA inventory summaries...`);
    
    return await this.rateLimiter.executeWithRetry(async () => {
      const queryParams = new URLSearchParams({
        granularityType,
        granularityId: marketplaceIds[0],
        marketplaceIds: marketplaceIds.join(','),
        details: details.toString(),
      });

      if (startDateTime) {
        queryParams.append('startDateTime', startDateTime);
      }

      const path = `/fba/inventory/v1/summaries?${queryParams.toString()}`;
      const headers = await this.auth.getSignedHeaders(
        'GET',
        path,
        this.SP_API_URL.replace('https://', '')
      );

      const response = await fetch(`${this.SP_API_URL}${path}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'GET_INVENTORY_SUMMARIES_FAILED',
          `Failed to get inventory summaries: ${response.status}`,
          response.status,
          errorText
        );
      }

      const data = await response.json();
      console.log(`[SP-API] Inventory summaries fetched successfully`);
      return data;
    }, 'Get Inventory Summaries');
  }

  /**
   * Get Inbound Shipments (inventory in transit to Amazon)
   * https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#get-shipments
   * 
   * @param shipmentStatusList Filter by status (WORKING, SHIPPED, IN_TRANSIT, DELIVERED, etc.)
   * @param lastUpdatedAfter Filter for shipments updated after this date
   * @param lastUpdatedBefore Filter for shipments updated before this date
   * @returns Inbound shipments
   */
  async getInboundShipments(
    shipmentStatusList?: string[],
    lastUpdatedAfter?: string,
    lastUpdatedBefore?: string
  ): Promise<any> {
    console.log(`[SP-API] Fetching inbound shipments...`);
    
    return await this.rateLimiter.executeWithRetry(async () => {
      const queryParams = new URLSearchParams();

      if (shipmentStatusList && shipmentStatusList.length > 0) {
        queryParams.append('ShipmentStatusList', shipmentStatusList.join(','));
      }
      if (lastUpdatedAfter) {
        queryParams.append('LastUpdatedAfter', lastUpdatedAfter);
      }
      if (lastUpdatedBefore) {
        queryParams.append('LastUpdatedBefore', lastUpdatedBefore);
      }

      const path = `/fba/inbound/v0/shipments?${queryParams.toString()}`;
      const headers = await this.auth.getSignedHeaders(
        'GET',
        path,
        this.SP_API_URL.replace('https://', '')
      );

      const response = await fetch(`${this.SP_API_URL}${path}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'GET_INBOUND_SHIPMENTS_FAILED',
          `Failed to get inbound shipments: ${response.status}`,
          response.status,
          errorText
        );
      }

      const data = await response.json();
      console.log(`[SP-API] Inbound shipments fetched successfully`);
      return data;
    }, 'Get Inbound Shipments');
  }

  /**
   * Get Inbound Shipment Items (detailed items for a specific shipment)
   * https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#get-shipmentitems
   * 
   * @param shipmentId Shipment ID (optional if using date range)
   * @param lastUpdatedAfter Filter for items updated after this date
   * @param lastUpdatedBefore Filter for items updated before this date
   * @returns Shipment items
   */
  async getInboundShipmentItems(
    shipmentId?: string,
    lastUpdatedAfter?: string,
    lastUpdatedBefore?: string
  ): Promise<any> {
    console.log(`[SP-API] Fetching inbound shipment items${shipmentId ? ` for ${shipmentId}` : ''}...`);
    
    return await this.rateLimiter.executeWithRetry(async () => {
      const queryParams = new URLSearchParams();
      
      // Amazon FBA Inbound API v0 requires QueryType parameter
      if (shipmentId) {
        queryParams.append('QueryType', 'SHIPMENT');
        queryParams.append('ShipmentId', shipmentId);
      } else if (lastUpdatedAfter && lastUpdatedBefore) {
        queryParams.append('QueryType', 'DATE_RANGE');
        queryParams.append('LastUpdatedAfter', lastUpdatedAfter);
        queryParams.append('LastUpdatedBefore', lastUpdatedBefore);
      } else {
        // If no shipmentId, use a 30-day date range
        queryParams.append('QueryType', 'DATE_RANGE');
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        queryParams.append('LastUpdatedAfter', thirtyDaysAgo.toISOString());
        queryParams.append('LastUpdatedBefore', now.toISOString());
      }

      const path = `/fba/inbound/v0/shipmentItems?${queryParams.toString()}`;
      console.log(`[SP-API] Inbound shipment items URL:`, path);
      console.log(`[SP-API] Query params:`, Object.fromEntries(queryParams.entries()));
      
      const headers = await this.auth.getSignedHeaders(
        'GET',
        path,
        this.SP_API_URL.replace('https://', '')
      );

      const response = await fetch(`${this.SP_API_URL}${path}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'GET_INBOUND_SHIPMENT_ITEMS_FAILED',
          `Failed to get inbound shipment items: ${response.status}`,
          response.status,
          errorText
        );
      }

      const data = await response.json();
      console.log(`[SP-API] Inbound shipment items fetched successfully`);
      return data;
    }, 'Get Inbound Shipment Items');
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format date to ISO 8601 with time
   */
  static formatDate(date: Date, endOfDay: boolean = false): string {
    if (endOfDay) {
      return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
    const isoString = date.toISOString();
    return isoString.substring(0, 10) + 'T00:00:00Z';
  }

  /**
   * Clear auth cache (useful for testing)
   */
  clearAuthCache(): void {
    this.auth.clearCache();
  }

  /**
   * Get request queue status
   */
  getQueueStatus() {
    return this.requestQueue.getStatus();
  }
}
