/**
 * Amazon SP-API TypeScript Type Definitions
 * Based on working Python implementation from BDI_2
 */

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface AmazonCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessKey: string;
  secretKey: string;
  region?: string;
  sellerId?: string;
}

export interface LWATokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export enum AmazonReportType {
  // Settlement Reports
  SETTLEMENT_V2 = 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2',
  SETTLEMENT = 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE',
  
  // Order Reports
  FLAT_FILE_ORDERS = 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
  FLAT_FILE_ORDERS_V2 = 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE_GENERAL',
  
  // Inventory Reports
  INVENTORY_LEDGER = 'GET_LEDGER_DETAIL_VIEW_DATA',
  FBA_INVENTORY = 'GET_FBA_INVENTORY_AGED_DATA',
  STRANDED_INVENTORY = 'GET_STRANDED_INVENTORY_UI_DATA',
  
  // Returns Reports
  FBA_RETURNS = 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA',
  FLAT_FILE_RETURNS = 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE',
  
  // Fee Reports
  FBA_ESTIMATED_FEES = 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA',
  FBA_REIMBURSEMENTS = 'GET_FBA_REIMBURSEMENTS_DATA',
  
  // Listing Reports
  ACTIVE_LISTINGS = 'GET_MERCHANT_LISTINGS_ALL_DATA',
  OPEN_LISTINGS = 'GET_FLAT_FILE_OPEN_LISTINGS_DATA',
}

export enum ReportProcessingStatus {
  CANCELLED = 'CANCELLED',
  DONE = 'DONE',
  FATAL = 'FATAL',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_QUEUE = 'IN_QUEUE',
}

export interface CreateReportRequest {
  reportType: AmazonReportType | string;
  marketplaceIds: string[];
  dataStartTime?: string; // ISO 8601
  dataEndTime?: string; // ISO 8601
  reportOptions?: Record<string, string>;
}

export interface CreateReportResponse {
  reportId: string;
}

export interface GetReportResponse {
  reportId: string;
  reportType: string;
  dataStartTime?: string;
  dataEndTime?: string;
  createdTime: string;
  processingStatus: ReportProcessingStatus;
  processingStartTime?: string;
  processingEndTime?: string;
  reportDocumentId?: string;
}

export interface GetReportDocumentResponse {
  reportDocumentId: string;
  url: string;
  compressionAlgorithm?: 'GZIP';
}

// ============================================================================
// FINANCIAL EVENTS TYPES (Finances API v2024-06-19)
// ============================================================================

export interface FinancialEventsRequest {
  postedAfter: string; // ISO 8601
  postedBefore: string; // ISO 8601
  marketplaceId: string;
  maxResultsPerPage?: number;
  nextToken?: string;
}

export interface FinancialEventsResponse {
  payload: {
    FinancialEvents: FinancialEventGroup;
    NextToken?: string;
  };
}

export interface FinancialEventGroup {
  ShipmentEventList?: ShipmentEvent[];
  RefundEventList?: ShipmentEvent[];
  GuaranteeClaimEventList?: ShipmentEvent[];
  ChargebackEventList?: ShipmentEvent[];
  PayWithAmazonEventList?: PayWithAmazonEvent[];
  ServiceProviderCreditEventList?: SolutionProviderCreditEvent[];
  RetrochargeEventList?: RetrochargeEvent[];
  RentalTransactionEventList?: RentalTransactionEvent[];
  ProductAdsPaymentEventList?: ProductAdsPaymentEvent[];
  ServiceFeeEventList?: ServiceFeeEvent[];
  SellerDealPaymentEventList?: SellerDealPaymentEvent[];
  DebtRecoveryEventList?: DebtRecoveryEvent[];
  LoanServicingEventList?: LoanServicingEvent[];
  AdjustmentEventList?: AdjustmentEvent[];
  SAFETReimbursementEventList?: SAFETReimbursementEvent[];
  SellerReviewEnrollmentPaymentEventList?: SellerReviewEnrollmentPaymentEvent[];
  FBALiquidationEventList?: FBALiquidationEvent[];
  CouponPaymentEventList?: CouponPaymentEvent[];
  ImagingServicesFeeEventList?: ImagingServicesFeeEvent[];
  NetworkComminglingTransactionEventList?: NetworkComminglingTransactionEvent[];
  AffordabilityExpenseEventList?: AffordabilityExpenseEvent[];
  AffordabilityExpenseReversalEventList?: AffordabilityExpenseEvent[];
  RemovalShipmentEventList?: RemovalShipmentEvent[];
  RemovalShipmentAdjustmentEventList?: RemovalShipmentAdjustmentEvent[];
  TrialShipmentEventList?: TrialShipmentEvent[];
  TDSReimbursementEventList?: TDSReimbursementEvent[];
  AdhocDisbursementEventList?: AdhocDisbursementEvent[];
  TaxWithholdingEventList?: TaxWithholdingEvent[];
  ChargeRefundEventList?: ChargeRefundEvent[];
  FailedAdhocDisbursementEventList?: FailedAdhocDisbursementEventList[];
  ValueAddedServiceChargeEventList?: ValueAddedServiceChargeEvent[];
  CapacityReservationBillingEventList?: CapacityReservationBillingEvent[];
}

export interface ShipmentEvent {
  AmazonOrderId?: string;
  SellerOrderId?: string;
  MarketplaceName?: string;
  OrderChargeList?: ChargeComponent[];
  OrderChargeAdjustmentList?: ChargeComponent[];
  ShipmentFeeList?: FeeComponent[];
  ShipmentFeeAdjustmentList?: FeeComponent[];
  OrderFeeList?: FeeComponent[];
  OrderFeeAdjustmentList?: FeeComponent[];
  DirectPaymentList?: DirectPayment[];
  PostedDate?: string;
  ShipmentItemList?: ShipmentItem[];
  ShipmentItemAdjustmentList?: ShipmentItem[];
}

export interface ChargeComponent {
  ChargeType?: string;
  ChargeAmount?: Currency;
}

export interface FeeComponent {
  FeeType?: string;
  FeeAmount?: Currency;
}

export interface Currency {
  CurrencyCode?: string;
  CurrencyAmount?: number;
}

export interface DirectPayment {
  DirectPaymentType?: string;
  DirectPaymentAmount?: Currency;
}

export interface ShipmentItem {
  SellerSKU?: string;
  OrderItemId?: string;
  OrderAdjustmentItemId?: string;
  QuantityShipped?: number;
  ItemChargeList?: ChargeComponent[];
  ItemChargeAdjustmentList?: ChargeComponent[];
  ItemFeeList?: FeeComponent[];
  ItemFeeAdjustmentList?: FeeComponent[];
  ItemTaxWithheldList?: TaxWithheldComponent[];
  PromotionList?: Promotion[];
  PromotionAdjustmentList?: Promotion[];
  CostOfPointsGranted?: Currency;
  CostOfPointsReturned?: Currency;
}

export interface TaxWithheldComponent {
  TaxCollectionModel?: string;
  TaxesWithheld?: ChargeComponent[];
}

export interface Promotion {
  PromotionType?: string;
  PromotionId?: string;
  PromotionAmount?: Currency;
}

export interface PayWithAmazonEvent {
  SellerOrderId?: string;
  TransactionPostedDate?: string;
  BusinessObjectType?: string;
  SalesChannel?: string;
  Charge?: ChargeComponent;
  FeeList?: FeeComponent[];
  PaymentAmountType?: string;
  AmountDescription?: string;
  FulfillmentChannel?: string;
  StoreName?: string;
}

export interface SolutionProviderCreditEvent {
  ProviderTransactionType?: string;
  SellerOrderId?: string;
  MarketplaceId?: string;
  MarketplaceCountryCode?: string;
  SellerId?: string;
  SellerStoreName?: string;
  ProviderId?: string;
  ProviderStoreName?: string;
  TransactionAmount?: Currency;
  TransactionCreationDate?: string;
}

export interface RetrochargeEvent {
  RetrochargeEventType?: string;
  AmazonOrderId?: string;
  PostedDate?: string;
  BaseTax?: Currency;
  ShippingTax?: Currency;
  MarketplaceName?: string;
  RetrochargeTaxWithheldList?: TaxWithheldComponent[];
}

export interface RentalTransactionEvent {
  AmazonOrderId?: string;
  RentalEventType?: string;
  ExtensionLength?: number;
  PostedDate?: string;
  RentalChargeList?: ChargeComponent[];
  RentalFeeList?: FeeComponent[];
  MarketplaceName?: string;
  RentalInitialValue?: Currency;
  RentalReimbursement?: Currency;
  RentalTaxWithheldList?: TaxWithheldComponent[];
}

export interface ProductAdsPaymentEvent {
  postedDate?: string;
  transactionType?: string;
  invoiceId?: string;
  baseValue?: Currency;
  taxValue?: Currency;
  transactionValue?: Currency;
}

export interface ServiceFeeEvent {
  AmazonOrderId?: string;
  FeeReason?: string;
  FeeList?: FeeComponent[];
  SellerSKU?: string;
  FnSKU?: string;
  FeeDescription?: string;
  ASIN?: string;
}

export interface SellerDealPaymentEvent {
  postedDate?: string;
  dealId?: string;
  dealDescription?: string;
  eventType?: string;
  feeType?: string;
  feeAmount?: Currency;
  taxAmount?: Currency;
  totalAmount?: Currency;
}

export interface DebtRecoveryEvent {
  DebtRecoveryType?: string;
  RecoveryAmount?: Currency;
  OverPaymentCredit?: Currency;
  DebtRecoveryItemList?: DebtRecoveryItem[];
  ChargeInstrumentList?: ChargeInstrument[];
}

export interface DebtRecoveryItem {
  RecoveryAmount?: Currency;
  OriginalAmount?: Currency;
  GroupBeginDate?: string;
  GroupEndDate?: string;
}

export interface ChargeInstrument {
  Description?: string;
  Tail?: string;
  Amount?: Currency;
}

export interface LoanServicingEvent {
  LoanAmount?: Currency;
  SourceBusinessEventType?: string;
}

export interface AdjustmentEvent {
  AdjustmentType?: string;
  PostedDate?: string;
  AdjustmentAmount?: Currency;
  AdjustmentItemList?: AdjustmentItem[];
}

export interface AdjustmentItem {
  Quantity?: string;
  PerUnitAmount?: Currency;
  TotalAmount?: Currency;
  SellerSKU?: string;
  FnSKU?: string;
  ProductDescription?: string;
  ASIN?: string;
}

export interface SAFETReimbursementEvent {
  PostedDate?: string;
  SAFETClaimId?: string;
  ReimbursedAmount?: Currency;
  ReasonCode?: string;
  SAFETReimbursementItemList?: SAFETReimbursementItem[];
}

export interface SAFETReimbursementItem {
  itemChargeList?: ChargeComponent[];
  productDescription?: string;
  quantity?: string;
}

export interface SellerReviewEnrollmentPaymentEvent {
  PostedDate?: string;
  EnrollmentId?: string;
  ParentASIN?: string;
  FeeComponent?: FeeComponent;
  ChargeComponent?: ChargeComponent;
  TotalAmount?: Currency;
}

export interface FBALiquidationEvent {
  PostedDate?: string;
  OriginalRemovalOrderId?: string;
  LiquidationProceedsAmount?: Currency;
  LiquidationFeeAmount?: Currency;
}

export interface CouponPaymentEvent {
  PostedDate?: string;
  CouponId?: string;
  SellerCouponDescription?: string;
  ClipOrRedemptionCount?: number;
  PaymentEventId?: string;
  FeeComponent?: FeeComponent;
  ChargeComponent?: ChargeComponent;
  TotalAmount?: Currency;
}

export interface ImagingServicesFeeEvent {
  ImagingRequestBillingItemID?: string;
  ASIN?: string;
  PostedDate?: string;
  FeeList?: FeeComponent[];
}

export interface NetworkComminglingTransactionEvent {
  TransactionType?: string;
  PostedDate?: string;
  NetCoTransactionID?: string;
  SwapReason?: string;
  ASIN?: string;
  MarketplaceId?: string;
  TaxExclusiveAmount?: Currency;
  TaxAmount?: Currency;
}

export interface AffordabilityExpenseEvent {
  AmazonOrderId?: string;
  PostedDate?: string;
  MarketplaceId?: string;
  TransactionType?: string;
  BaseExpense?: Currency;
  TaxTypeCGST?: Currency;
  TaxTypeSGST?: Currency;
  TaxTypeIGST?: Currency;
  TotalExpense?: Currency;
}

export interface RemovalShipmentEvent {
  PostedDate?: string;
  OrderId?: string;
  TransactionType?: string;
  RemovalShipmentItemList?: RemovalShipmentItem[];
}

export interface RemovalShipmentItem {
  RemovalShipmentItemId?: string;
  TaxCollectionModel?: string;
  FulfillmentNetworkSKU?: string;
  Quantity?: number;
  Revenue?: Currency;
  FeeAmount?: Currency;
  TaxAmount?: Currency;
  TaxWithheld?: Currency;
}

export interface RemovalShipmentAdjustmentEvent {
  PostedDate?: string;
  AdjustmentEventId?: string;
  MerchantOrderId?: string;
  OrderId?: string;
  TransactionType?: string;
  RemovalShipmentItemAdjustmentList?: RemovalShipmentItemAdjustment[];
}

export interface RemovalShipmentItemAdjustment {
  RemovalShipmentItemId?: string;
  TaxCollectionModel?: string;
  FulfillmentNetworkSKU?: string;
  AdjustedQuantity?: number;
  RevenueAdjustment?: Currency;
  TaxAmountAdjustment?: Currency;
  TaxWithheldAdjustment?: Currency;
}

export interface TrialShipmentEvent {
  AmazonOrderId?: string;
  FinancialEventGroupId?: string;
  PostedDate?: string;
  SKU?: string;
  FeeList?: FeeComponent[];
}

export interface TDSReimbursementEvent {
  PostedDate?: string;
  TdsOrderId?: string;
  ReimbursedAmount?: Currency;
}

export interface AdhocDisbursementEvent {
  TransactionType?: string;
  PostedDate?: string;
  TransactionAmount?: Currency;
  TransactionItemId?: string;
}

export interface TaxWithholdingEvent {
  PostedDate?: string;
  TaxWithholdingPeriod?: string;
  TaxesWithheld?: ChargeComponent[];
}

export interface ChargeRefundEvent {
  PostedDate?: string;
  ReasonCode?: string;
  ReferenceId?: string;
  MarketplaceName?: string;
  ChargeRefundTransactions?: ChargeRefundTransaction[];
}

export interface ChargeRefundTransaction {
  ChargeAmount?: Currency;
  ChargeType?: string;
  FeeList?: FeeComponent[];
  MarketplaceFacilitatorTaxWithheldList?: TaxWithheldComponent[];
  TaxWithheldList?: TaxWithheldComponent[];
}

export interface FailedAdhocDisbursementEventList {
  FundsTransfersType?: string;
  TransferDate?: string;
  TransferId?: string;
  DisbursementAmount?: Currency;
}

export interface ValueAddedServiceChargeEvent {
  TransactionType?: string;
  PostedDate?: string;
  Description?: string;
  TransactionAmount?: Currency;
}

export interface CapacityReservationBillingEvent {
  TransactionType?: string;
  PostedDate?: string;
  Description?: string;
  TransactionAmount?: Currency;
}

// ============================================================================
// MARKETPLACE IDS
// ============================================================================

export enum AmazonMarketplace {
  US = 'ATVPDKIKX0DER',
  CA = 'A2EUQ1WTGCTBG2',
  MX = 'A1AM78C64UM0Y8',
  BR = 'A2Q3Y263D00KWC',
  UK = 'A1F83G8C2ARO7P',
  DE = 'A1PA6795UKMFR9',
  FR = 'A13V1IB3VIYZZH',
  IT = 'APJ6JRA9NG5V4',
  ES = 'A1RKKUPIHCS9HS',
  NL = 'A1805IZSGTT6HS',
  SE = 'A2NODRKZP88ZB9',
  PL = 'A1C3SOZRARQ6R3',
  JP = 'A1VC38T7YXB528',
  AU = 'A39IBJ37TRP1C6',
  SG = 'A19VAU5U5O7RUS',
  AE = 'A2VIGQ35RCS4UG',
  IN = 'A21TJRUUN4KGV',
}

// ============================================================================
// API ERROR TYPES
// ============================================================================

export interface SPAPIError {
  code: string;
  message: string;
  details?: string;
}

export class AmazonSPAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'AmazonSPAPIError';
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};
