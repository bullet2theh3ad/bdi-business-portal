/**
 * Amazon SP-API Service
 * Main entry point for Amazon Selling Partner API integration
 * 
 * Usage:
 * ```typescript
 * import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
 * 
 * const amazon = new AmazonSPAPIService(credentials);
 * 
 * // Get settlement report
 * const settlement = await amazon.getSettlementReport('2025-01-01', '2025-01-31');
 * 
 * // Get financial transactions
 * const transactions = await amazon.getFinancialTransactions('2025-01-01', '2025-01-31');
 * ```
 */

export * from './types';
export * from './auth';
export * from './rate-limiter';
export * from './client';
export * from './financial-events';

import { AmazonSPAPIClient } from './client';
import { AmazonFinancialEventsClient } from './financial-events';
import { AmazonCredentials, AmazonReportType, AmazonMarketplace } from './types';

// ============================================================================
// UNIFIED SERVICE
// ============================================================================

/**
 * Unified Amazon SP-API Service
 * Combines Reports API and Financial Events API
 */
export class AmazonSPAPIService {
  private reportsClient: AmazonSPAPIClient;
  private financialEventsClient: AmazonFinancialEventsClient;

  constructor(credentials: AmazonCredentials) {
    this.reportsClient = new AmazonSPAPIClient(credentials);
    this.financialEventsClient = new AmazonFinancialEventsClient(credentials);
  }

  // ==========================================================================
  // REPORTS API
  // ==========================================================================

  /**
   * Get settlement report (best for bank reconciliation)
   * Based on: BDI_2/fetch_settlement_reports.py
   */
  async getSettlementReport(
    startDate: string,
    endDate: string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    return await this.reportsClient.getReport(
      AmazonReportType.SETTLEMENT_V2,
      startDate,
      endDate,
      marketplaceIds
    );
  }

  /**
   * Get order report (best for unit economics)
   */
  async getOrderReport(
    startDate: string,
    endDate: string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    return await this.reportsClient.getReport(
      AmazonReportType.FLAT_FILE_ORDERS,
      startDate,
      endDate,
      marketplaceIds
    );
  }

  /**
   * Get FBA inventory report
   */
  async getInventoryReport(
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    return await this.reportsClient.getReport(
      AmazonReportType.FBA_INVENTORY,
      undefined,
      undefined,
      marketplaceIds
    );
  }

  /**
   * Get returns report
   */
  async getReturnsReport(
    startDate: string,
    endDate: string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    return await this.reportsClient.getReport(
      AmazonReportType.FBA_RETURNS,
      startDate,
      endDate,
      marketplaceIds
    );
  }

  /**
   * Get custom report by type
   */
  async getCustomReport(
    reportType: AmazonReportType | string,
    startDate?: string,
    endDate?: string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    return await this.reportsClient.getReport(
      reportType,
      startDate,
      endDate,
      marketplaceIds
    );
  }

  /**
   * Request a report (Step 1 of 3-step process)
   * Returns reportId to poll for status
   */
  async requestReport(
    reportType: AmazonReportType | string,
    startDate?: string,
    endDate?: string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ): Promise<string> {
    return await this.reportsClient.requestReport(
      reportType,
      startDate,
      endDate,
      marketplaceIds
    );
  }

  /**
   * Get report status (Step 2 of 3-step process)
   * Poll this until processingStatus is 'DONE'
   */
  async getReportStatus(reportId: string) {
    return await this.reportsClient.getReportStatus(reportId);
  }

  /**
   * Download report (Step 3 of 3-step process)
   * Use reportDocumentId from getReportStatus
   */
  async downloadReport(reportDocumentId: string): Promise<string> {
    return await this.reportsClient.downloadReport(reportDocumentId);
  }

  /**
   * List existing reports of a specific type
   */
  async listReports(
    reportType: AmazonReportType | string,
    marketplaceIds: string[] = [AmazonMarketplace.US]
  ) {
    // This would need to be implemented in the client
    // For now, return empty array
    return [];
  }

  // ==========================================================================
  // FINANCIAL EVENTS API
  // ==========================================================================

  /**
   * Get financial transactions (best for transaction detail)
   * Based on: BDI_2/amazon_finances_API.py
   */
  async getFinancialTransactions(
    startDate: string,
    endDate: string,
    marketplaceId: string = AmazonMarketplace.US
  ) {
    return await this.financialEventsClient.getFinancialTransactions(
      startDate,
      endDate,
      marketplaceId
    );
  }

  /**
   * Get financial transactions for a specific month
   */
  async getMonthlyFinancialTransactions(
    year: number,
    month: number,
    marketplaceId: string = AmazonMarketplace.US
  ) {
    return await this.financialEventsClient.getMonthlyTransactions(
      year,
      month,
      marketplaceId
    );
  }

  /**
   * Get financial transactions for current month
   */
  async getCurrentMonthFinancialTransactions(
    marketplaceId: string = AmazonMarketplace.US
  ) {
    return await this.financialEventsClient.getCurrentMonthTransactions(marketplaceId);
  }

  /**
   * Get financial transactions with automatic chunking for large date ranges
   */
  async getFinancialTransactionsChunked(
    startDate: string,
    endDate: string,
    chunkDays: number = 30,
    marketplaceId: string = AmazonMarketplace.US
  ) {
    return await this.financialEventsClient.getFinancialTransactionsChunked(
      startDate,
      endDate,
      chunkDays,
      marketplaceId
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Clear authentication cache
   */
  clearAuthCache(): void {
    this.reportsClient.clearAuthCache();
  }

  /**
   * Get request queue status
   */
  getQueueStatus() {
    return this.reportsClient.getQueueStatus();
  }
}
