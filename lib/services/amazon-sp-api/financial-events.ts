/**
 * Amazon SP-API Financial Events Client
 * Handles Financial Events API v2024-06-19 for transaction-level data
 * Based on working Python implementation from BDI_2/amazon_finances_API.py
 * 
 * This is the BEST source for detailed transaction data including:
 * - Orders, refunds, adjustments
 * - All fees (FBA, referral, storage, etc.)
 * - Reimbursements
 * - Advertising costs
 * - And much more
 */

import { AmazonSPAPIAuth } from './auth';
import { AmazonRateLimiter } from './rate-limiter';
import {
  AmazonCredentials,
  FinancialEventsRequest,
  FinancialEventsResponse,
  FinancialEventGroup,
  AmazonSPAPIError,
  AmazonMarketplace,
} from './types';

// ============================================================================
// FINANCIAL EVENTS CLIENT
// ============================================================================

export class AmazonFinancialEventsClient {
  private auth: AmazonSPAPIAuth;
  private rateLimiter: AmazonRateLimiter;
  
  private readonly SP_API_URL = 'https://sellingpartnerapi-na.amazon.com';
  private readonly FINANCES_VERSION = 'v0';
  
  // API requires at least 2 minutes before current time
  private readonly TIME_BUFFER_MINUTES = 2;

  constructor(credentials: AmazonCredentials) {
    this.auth = new AmazonSPAPIAuth(credentials);
    this.rateLimiter = new AmazonRateLimiter();
  }

  /**
   * Get all financial transactions within a date range
   * Based on: BDI_2/amazon_finances_API.py -> get_financial_transactions()
   * 
   * This method handles:
   * - Pagination with nextToken
   * - 2-minute buffer requirement
   * - Rate limiting
   * - All transaction event types
   * 
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @param marketplaceId Marketplace ID (default: US)
   * @returns All financial events in the date range
   */
  async getFinancialTransactions(
    startDate: string,
    endDate: string,
    marketplaceId: string = AmazonMarketplace.US
  ): Promise<FinancialEventGroup[]> {
    console.log(`[Financial Events] Retrieving transactions from ${startDate} to ${endDate}`);
    
    // Ensure end date is at least 2 minutes before current time
    const endDateTime = this.ensureTimeBuffer(endDate);
    
    const allEvents: FinancialEventGroup[] = [];
    let nextToken: string | undefined = undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`[Financial Events] Fetching page ${pageCount}...`);
      
      const request: FinancialEventsRequest = {
        postedAfter: `${startDate}T00:00:00Z`,
        postedBefore: endDateTime,
        marketplaceId,
        maxResultsPerPage: 500, // Maximum allowed
      };

      if (nextToken) {
        request.nextToken = nextToken;
      }

      const response = await this.fetchFinancialEventsPage(request);
      
      if (response.payload?.FinancialEvents) {
        allEvents.push(response.payload.FinancialEvents);
        console.log(`[Financial Events] Page ${pageCount} retrieved successfully`);
      }

      nextToken = response.payload?.NextToken;
      
      if (nextToken) {
        console.log(`[Financial Events] More pages available, continuing...`);
      }

    } while (nextToken);

    console.log(`[Financial Events] Retrieved ${pageCount} pages of transactions`);
    return allEvents;
  }

  /**
   * Fetch a single page of financial events
   * Handles rate limiting and retries
   */
  private async fetchFinancialEventsPage(
    request: FinancialEventsRequest
  ): Promise<FinancialEventsResponse> {
    return await this.rateLimiter.executeWithRetry(async () => {
      const path = `/finances/${this.FINANCES_VERSION}/financialEvents`;
      
      // Build query parameters
      const queryParams: Record<string, string> = {
        PostedAfter: request.postedAfter,
        PostedBefore: request.postedBefore,
      };

      if (request.nextToken) {
        queryParams.NextToken = request.nextToken;
      }

      const headers = await this.auth.getSignedHeaders(
        'GET',
        path,
        this.SP_API_URL.replace('https://', ''),
        queryParams
      );

      // Build full URL with query params
      const queryString = new URLSearchParams(queryParams).toString();
      const url = `${this.SP_API_URL}${path}?${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'FINANCIAL_EVENTS_FAILED',
          `Failed to fetch financial events: ${response.status}`,
          response.status,
          errorText
        );
      }

      return await response.json();
    }, 'Fetch Financial Events');
  }

  /**
   * Ensure end date has at least 2-minute buffer from current time
   * Based on: BDI_2/amazon_finances_API.py time buffer logic
   */
  private ensureTimeBuffer(endDate: string): string {
    const endDateTime = new Date(`${endDate}T23:59:59Z`);
    const now = new Date();
    const bufferMs = this.TIME_BUFFER_MINUTES * 60 * 1000;
    
    if ((now.getTime() - endDateTime.getTime()) < bufferMs) {
      // End date is too recent, adjust to 2 minutes before now
      const adjustedEnd = new Date(now.getTime() - bufferMs);
      const adjusted = adjustedEnd.toISOString().replace(/\.\d{3}Z$/, 'Z');
      console.log(`[Financial Events] Adjusted end time to ${adjusted} (2-minute buffer)`);
      return adjusted;
    }
    
    return endDateTime.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /**
   * Get financial transactions for a specific month
   * Convenience method for monthly reporting
   */
  async getMonthlyTransactions(
    year: number,
    month: number,
    marketplaceId: string = AmazonMarketplace.US
  ): Promise<FinancialEventGroup[]> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
    
    return await this.getFinancialTransactions(startDate, endDate, marketplaceId);
  }

  /**
   * Get financial transactions for current month to date
   */
  async getCurrentMonthTransactions(
    marketplaceId: string = AmazonMarketplace.US
  ): Promise<FinancialEventGroup[]> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];
    
    return await this.getFinancialTransactions(startDate, endDate, marketplaceId);
  }

  /**
   * Get financial transactions for a date range with automatic chunking
   * Useful for large date ranges to avoid timeouts
   * 
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @param chunkDays Number of days per chunk (default: 30)
   * @param marketplaceId Marketplace ID
   * @returns All financial events in the date range
   */
  async getFinancialTransactionsChunked(
    startDate: string,
    endDate: string,
    chunkDays: number = 30,
    marketplaceId: string = AmazonMarketplace.US
  ): Promise<FinancialEventGroup[]> {
    console.log(`[Financial Events] Fetching transactions in ${chunkDays}-day chunks`);
    
    const allEvents: FinancialEventGroup[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let currentStart = start;
    let chunkNumber = 0;
    
    while (currentStart < end) {
      chunkNumber++;
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + chunkDays);
      
      if (currentEnd > end) {
        currentEnd.setTime(end.getTime());
      }
      
      const chunkStartStr = currentStart.toISOString().split('T')[0];
      const chunkEndStr = currentEnd.toISOString().split('T')[0];
      
      console.log(`[Financial Events] Chunk ${chunkNumber}: ${chunkStartStr} to ${chunkEndStr}`);
      
      const chunkEvents = await this.getFinancialTransactions(
        chunkStartStr,
        chunkEndStr,
        marketplaceId
      );
      
      allEvents.push(...chunkEvents);
      
      // Move to next chunk
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }
    
    console.log(`[Financial Events] Retrieved ${allEvents.length} event groups across ${chunkNumber} chunks`);
    return allEvents;
  }
}

// ============================================================================
// FINANCIAL EVENTS PARSER
// ============================================================================

/**
 * Helper class to parse and aggregate financial events
 * Based on: BDI_2/amazon_settlement_analyzer.py patterns
 */
export class FinancialEventsParser {
  /**
   * Extract all order IDs from financial events
   */
  static extractOrderIds(events: FinancialEventGroup[]): string[] {
    const orderIds = new Set<string>();
    
    events.forEach(group => {
      // Shipment events
      group.ShipmentEventList?.forEach(event => {
        if (event.AmazonOrderId) orderIds.add(event.AmazonOrderId);
      });
      
      // Refund events
      group.RefundEventList?.forEach(event => {
        if (event.AmazonOrderId) orderIds.add(event.AmazonOrderId);
      });
      
      // Service fee events
      group.ServiceFeeEventList?.forEach(event => {
        if (event.AmazonOrderId) orderIds.add(event.AmazonOrderId);
      });
    });
    
    return Array.from(orderIds);
  }

  /**
   * Calculate total revenue from financial events (EXCLUDING tax)
   */
  static calculateTotalRevenue(events: FinancialEventGroup[]): number {
    let total = 0;
    
    events.forEach(group => {
      group.ShipmentEventList?.forEach(event => {
        event.ShipmentItemList?.forEach(item => {
          item.ItemChargeList?.forEach(charge => {
            // Exclude tax from revenue calculation
            if (charge.ChargeAmount?.CurrencyAmount && charge.ChargeType !== 'Tax') {
              total += charge.ChargeAmount.CurrencyAmount;
            }
          });
        });
      });
    });
    
    return total;
  }

  /**
   * Calculate total tax collected from financial events
   */
  static calculateTotalTax(events: FinancialEventGroup[]): number {
    let total = 0;
    
    events.forEach(group => {
      group.ShipmentEventList?.forEach(event => {
        event.ShipmentItemList?.forEach(item => {
          item.ItemChargeList?.forEach(charge => {
            // Only include tax charges
            if (charge.ChargeAmount?.CurrencyAmount && charge.ChargeType === 'Tax') {
              total += charge.ChargeAmount.CurrencyAmount;
            }
          });
        });
      });
    });
    
    return total;
  }

  /**
   * Calculate total fees from financial events
   */
  static calculateTotalFees(events: FinancialEventGroup[]): number {
    let total = 0;
    
    events.forEach(group => {
      group.ShipmentEventList?.forEach(event => {
        // Shipment fees
        event.ShipmentFeeList?.forEach(fee => {
          if (fee.FeeAmount?.CurrencyAmount) {
            total += Math.abs(fee.FeeAmount.CurrencyAmount);
          }
        });
        
        // Order fees
        event.OrderFeeList?.forEach(fee => {
          if (fee.FeeAmount?.CurrencyAmount) {
            total += Math.abs(fee.FeeAmount.CurrencyAmount);
          }
        });
        
        // Item fees
        event.ShipmentItemList?.forEach(item => {
          item.ItemFeeList?.forEach(fee => {
            if (fee.FeeAmount?.CurrencyAmount) {
              total += Math.abs(fee.FeeAmount.CurrencyAmount);
            }
          });
        });
      });
    });
    
    return total;
  }

  /**
   * Calculate total refunds from financial events
   */
  static calculateTotalRefunds(events: FinancialEventGroup[]): number {
    let total = 0;
    
    events.forEach(group => {
      group.RefundEventList?.forEach(event => {
        event.ShipmentItemAdjustmentList?.forEach(item => {
          // Refund amounts are negative in the API, so we take absolute value
          item.ItemChargeAdjustmentList?.forEach(charge => {
            if (charge.ChargeAmount?.CurrencyAmount) {
              total += Math.abs(charge.ChargeAmount.CurrencyAmount);
            }
          });
        });
      });
    });
    
    return total;
  }

  /**
   * Get refund summary by SKU
   */
  static getRefundSummary(events: FinancialEventGroup[]): Map<string, {
    units: number;
    refundAmount: number;
  }> {
    const refundMap = new Map<string, { units: number; refundAmount: number }>();
    
    events.forEach(group => {
      group.RefundEventList?.forEach(event => {
        event.ShipmentItemAdjustmentList?.forEach(item => {
          if (!item.SellerSKU) return;
          
          const sku = item.SellerSKU;
          const existing = refundMap.get(sku) || { units: 0, refundAmount: 0 };
          
          // Add refunded quantity
          existing.units += Math.abs(item.QuantityShipped || 0);
          
          // Add refund amount
          item.ItemChargeAdjustmentList?.forEach(charge => {
            if (charge.ChargeAmount?.CurrencyAmount) {
              existing.refundAmount += Math.abs(charge.ChargeAmount.CurrencyAmount);
            }
          });
          
          refundMap.set(sku, existing);
        });
      });
    });
    
    return refundMap;
  }

  /**
   * Get fee breakdown by type
   */
  static getFeeBreakdown(events: FinancialEventGroup[]): {
    [feeType: string]: number;
  } {
    const feeBreakdown: { [feeType: string]: number } = {};
    
    events.forEach(group => {
      group.ShipmentEventList?.forEach(event => {
        // Shipment fees
        event.ShipmentFeeList?.forEach(fee => {
          if (fee.FeeType && fee.FeeAmount?.CurrencyAmount) {
            const feeType = fee.FeeType;
            feeBreakdown[feeType] = (feeBreakdown[feeType] || 0) + Math.abs(fee.FeeAmount.CurrencyAmount);
          }
        });
        
        // Order fees
        event.OrderFeeList?.forEach(fee => {
          if (fee.FeeType && fee.FeeAmount?.CurrencyAmount) {
            const feeType = fee.FeeType;
            feeBreakdown[feeType] = (feeBreakdown[feeType] || 0) + Math.abs(fee.FeeAmount.CurrencyAmount);
          }
        });
        
        // Item fees
        event.ShipmentItemList?.forEach(item => {
          item.ItemFeeList?.forEach(fee => {
            if (fee.FeeType && fee.FeeAmount?.CurrencyAmount) {
              const feeType = fee.FeeType;
              feeBreakdown[feeType] = (feeBreakdown[feeType] || 0) + Math.abs(fee.FeeAmount.CurrencyAmount);
            }
          });
        });
      });
    });
    
    return feeBreakdown;
  }

  /**
   * Calculate total advertising spend from Product Ads events
   */
  static calculateTotalAdSpend(events: FinancialEventGroup[]): number {
    let total = 0;
    
    events.forEach(group => {
      group.ProductAdsPaymentEventList?.forEach(event => {
        if (event.transactionValue?.CurrencyAmount) {
          total += Math.abs(event.transactionValue.CurrencyAmount);
        }
      });
    });
    
    return total;
  }

  /**
   * Calculate total chargebacks
   */
  static calculateTotalChargebacks(events: FinancialEventGroup[]): number {
    let total = 0;
    
    events.forEach(group => {
      group.ChargebackEventList?.forEach(event => {
        event.ShipmentItemList?.forEach(item => {
          item.ItemChargeList?.forEach(charge => {
            if (charge.ChargeAmount?.CurrencyAmount) {
              total += Math.abs(charge.ChargeAmount.CurrencyAmount);
            }
          });
        });
      });
    });
    
    return total;
  }

  /**
   * Calculate total adjustments (credits/debits from Amazon)
   */
  static calculateTotalAdjustments(events: FinancialEventGroup[]): {
    credits: number;
    debits: number;
    net: number;
  } {
    let credits = 0;
    let debits = 0;
    
    events.forEach(group => {
      group.AdjustmentEventList?.forEach(event => {
        // Check adjustment amount at event level
        if (event.AdjustmentAmount?.CurrencyAmount) {
          const value = event.AdjustmentAmount.CurrencyAmount;
          if (value > 0) {
            credits += value;
          } else {
            debits += Math.abs(value);
          }
        }
        
        // Also check item-level amounts
        event.AdjustmentItemList?.forEach(item => {
          if (item.TotalAmount?.CurrencyAmount) {
            const value = item.TotalAmount.CurrencyAmount;
            if (value > 0) {
              credits += value;
            } else {
              debits += Math.abs(value);
            }
          }
        });
      });
    });
    
    return {
      credits,
      debits,
      net: credits - debits
    };
  }

  /**
   * Calculate total coupon costs
   */
  static calculateTotalCoupons(events: FinancialEventGroup[]): number {
    let total = 0;
    
    events.forEach(group => {
      group.CouponPaymentEventList?.forEach(event => {
        if (event.TotalAmount?.CurrencyAmount) {
          total += Math.abs(event.TotalAmount.CurrencyAmount);
        }
      });
    });
    
    return total;
  }

  /**
   * Get SKU-level summary from financial events
   */
  static getSKUSummary(events: FinancialEventGroup[]): Map<string, {
    units: number;
    revenue: number;
    fees: number;
  }> {
    const skuMap = new Map<string, { units: number; revenue: number; fees: number }>();
    
    events.forEach(group => {
      group.ShipmentEventList?.forEach(event => {
        event.ShipmentItemList?.forEach(item => {
          if (!item.SellerSKU) return;
          
          const sku = item.SellerSKU;
          const existing = skuMap.get(sku) || { units: 0, revenue: 0, fees: 0 };
          
          // Add units
          existing.units += item.QuantityShipped || 0;
          
          // Add revenue
          item.ItemChargeList?.forEach(charge => {
            if (charge.ChargeAmount?.CurrencyAmount) {
              existing.revenue += charge.ChargeAmount.CurrencyAmount;
            }
          });
          
          // Add fees
          item.ItemFeeList?.forEach(fee => {
            if (fee.FeeAmount?.CurrencyAmount) {
              existing.fees += Math.abs(fee.FeeAmount.CurrencyAmount);
            }
          });
          
          skuMap.set(sku, existing);
        });
      });
    });
    
    return skuMap;
  }
}
