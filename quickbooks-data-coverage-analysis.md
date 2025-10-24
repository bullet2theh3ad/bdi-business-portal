# QuickBooks Data Coverage Analysis

## Executive Summary
Analysis of current QuickBooks sync implementation vs. available QuickBooks Online API entities to identify potentially missing data.

## Currently Synced Entities ✅

### Transaction Entities
1. **Invoice** ✅ - Lines 307-438
   - Query: `SELECT * FROM Invoice`
   - Includes: Customer, amounts, payment status, line items

2. **Payment** ✅ - Lines 953-1065
   - Query: `SELECT * FROM Payment`
   - Includes: Customer payments, applied amounts, payment methods

3. **Bill** ✅ - Lines 1067-1181
   - Query: `SELECT * FROM Bill`
   - Includes: Vendor bills, due dates, payment status

4. **BillPayment** ✅ - Lines 1553-1652
   - Query: `SELECT * FROM BillPayment`
   - Includes: Payments made to vendors

5. **Purchase** ✅ - Lines 558-683
   - Query: `SELECT * FROM Purchase` (ALL payment types)
   - Note: Line 565 comment says "Get ALL Purchase transactions (not just Cash)"
   - **GOOD**: Already fetching all payment types without filtering

6. **Expense** ✅ - Lines 686-809
   - Query: `SELECT * FROM Expense`
   - Separate entity from Purchase

7. **SalesReceipt** ✅ - Lines 1184-1272
   - Query: `SELECT * FROM SalesReceipt`
   - Includes: Cash sales, payment methods

8. **CreditMemo** ✅ - Lines 1274-1363
   - Query: `SELECT * FROM CreditMemo`
   - Includes: Customer credits, remaining credit

9. **PurchaseOrder** ✅ - Lines 1365-1456
   - Query: `SELECT * FROM PurchaseOrder`
   - Includes: Vendor POs, ship dates, tracking

10. **Deposit** ✅ - Lines 1459-1550
    - Query: `SELECT * FROM Deposit`
    - Includes: Bank deposits, line items

### Master Data Entities
11. **Customer** ✅ - Lines 179-304
    - Query: `SELECT * FROM Customer`
    - Includes: Contact info, addresses, balance

12. **Vendor** ✅ - Lines 441-553
    - Query: `SELECT * FROM Vendor`
    - Includes: Contact info, addresses, balance

13. **Item** ✅ - Lines 812-950
    - Query: `SELECT * FROM Item WHERE Active IN (true, false)`
    - **GOOD**: Explicitly fetching both active AND inactive items
    - Includes: All item types (Inventory, Service, NonInventory, etc.)

---

## Potentially Missing Entities ⚠️

### High Priority - Financial Transactions

1. **Estimate** ❌ MISSING
   - Purpose: Customer quotes/proposals before invoicing
   - Use Case: Track sales pipeline, conversion from estimate to invoice
   - Query: `SELECT * FROM Estimate`
   - **Impact**: Missing sales pipeline data

2. **JournalEntry** ❌ MISSING
   - Purpose: Manual accounting adjustments, corrections
   - Use Case: Period-end adjustments, reclassifications
   - Query: `SELECT * FROM JournalEntry`
   - **Impact**: Missing manual accounting entries that affect GL

3. **Transfer** ❌ MISSING
   - Purpose: Transfers between bank/credit card accounts
   - Use Case: Track fund movements between accounts
   - Query: `SELECT * FROM Transfer`
   - **Impact**: Missing inter-account transfers

4. **RefundReceipt** ❌ MISSING
   - Purpose: Customer refunds (opposite of SalesReceipt)
   - Use Case: Track refunds issued to customers
   - Query: `SELECT * FROM RefundReceipt`
   - **Impact**: Missing refund transactions

5. **VendorCredit** ❌ MISSING
   - Purpose: Credits from vendors (opposite of Bill)
   - Use Case: Track vendor credits/returns
   - Query: `SELECT * FROM VendorCredit`
   - **Impact**: Missing vendor credit transactions

### Medium Priority - Supporting Data

6. **Account** ❌ MISSING
   - Purpose: Chart of Accounts
   - Use Case: Understand account structure, map transactions to GL accounts
   - Query: `SELECT * FROM Account WHERE Active IN (true, false)`
   - **Impact**: Missing GL account structure

7. **Class** ❌ MISSING
   - Purpose: Departmental/project tracking
   - Use Case: Track transactions by department, location, or project
   - Query: `SELECT * FROM Class WHERE Active IN (true, false)`
   - **Impact**: Missing class/department segmentation

8. **Department** ❌ MISSING
   - Purpose: Organizational structure
   - Use Case: Track transactions by department
   - Query: `SELECT * FROM Department`
   - **Impact**: Missing department segmentation

9. **TaxCode** ❌ MISSING
   - Purpose: Sales tax codes
   - Use Case: Understand tax rates applied to transactions
   - Query: `SELECT * FROM TaxCode WHERE Active IN (true, false)`
   - **Impact**: Missing tax code details

10. **TaxRate** ❌ MISSING
    - Purpose: Tax rate details
    - Use Case: Calculate and verify tax amounts
    - Query: `SELECT * FROM TaxRate WHERE Active IN (true, false)`
    - **Impact**: Missing tax rate details

11. **PaymentMethod** ❌ MISSING
    - Purpose: Payment method types
    - Use Case: Analyze payment methods used
    - Query: `SELECT * FROM PaymentMethod WHERE Active IN (true, false)`
    - **Impact**: Missing payment method reference data

12. **Term** ❌ MISSING
    - Purpose: Payment terms (Net 30, Due on Receipt, etc.)
    - Use Case: Understand payment term structure
    - Query: `SELECT * FROM Term WHERE Active IN (true, false)`
    - **Impact**: Missing payment terms reference data

### Lower Priority - Time Tracking & Budgets

13. **TimeActivity** ❌ MISSING
    - Purpose: Employee/contractor time tracking
    - Use Case: Billable hours, project time tracking
    - Query: `SELECT * FROM TimeActivity`
    - **Impact**: Missing time tracking data (if used)

14. **Budget** ❌ MISSING
    - Purpose: Financial budgets
    - Use Case: Budget vs. actual analysis
    - Query: `SELECT * FROM Budget`
    - **Impact**: Missing budget data (if used)

---

## Recommendations

### Immediate Action Items

1. **Add Estimate Entity** 🔴 HIGH PRIORITY
   - Estimates are critical for sales pipeline analysis
   - Many businesses use estimates before creating invoices
   - Implementation: Add Phase 14 to sync/route.ts

2. **Add JournalEntry Entity** 🔴 HIGH PRIORITY
   - Journal entries affect the General Ledger directly
   - Missing these means incomplete financial picture
   - Implementation: Add Phase 15 to sync/route.ts

3. **Add Account Entity** 🟡 MEDIUM PRIORITY
   - Chart of Accounts is fundamental reference data
   - Needed to understand where money is going
   - Implementation: Add Phase 16 to sync/route.ts

4. **Add VendorCredit & RefundReceipt** 🟡 MEDIUM PRIORITY
   - Complete the transaction picture (credits/refunds)
   - Important for accurate AP/AR tracking
   - Implementation: Add Phases 17-18 to sync/route.ts

5. **Add Transfer Entity** 🟡 MEDIUM PRIORITY
   - Track fund movements between accounts
   - Important for cash flow analysis
   - Implementation: Add Phase 19 to sync/route.ts

6. **Add Class & Department** 🟢 LOW PRIORITY (but useful)
   - Enables segmentation analysis
   - Only if business uses these features
   - Implementation: Add Phases 20-21 to sync/route.ts

### Query Pattern to Use

For all new entities, follow the existing pattern:

```typescript
// Example for Estimate
const estimatesQuery = `SELECT * FROM Estimate ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS 1000`;
```

**Key Points:**
- Use `${deltaQuery}` to support incremental sync
- Use pagination with `STARTPOSITION` and `MAXRESULTS 1000`
- For reference data (Account, Class, etc.), use: `WHERE Active IN (true, false)` to get both active and inactive records

### Items Already Done Right ✅

1. **Purchase Transactions**: Already fetching ALL payment types (line 565)
2. **Items**: Already fetching both active and inactive (line 821)
3. **Pagination**: Properly implemented for all entities
4. **Delta Sync**: Properly using `Metadata.LastUpdatedTime` filter

---

## Impact Assessment

### Missing Estimates
- **Business Impact**: Cannot track sales pipeline or quote-to-invoice conversion
- **Data Completeness**: ~20-30% of sales process may be missing
- **Recommendation**: **ADD IMMEDIATELY**

### Missing Journal Entries
- **Business Impact**: Incomplete General Ledger, missing manual adjustments
- **Data Completeness**: Could be 5-10% of GL transactions
- **Recommendation**: **ADD IMMEDIATELY**

### Missing Accounts (Chart of Accounts)
- **Business Impact**: Cannot properly categorize or analyze transactions
- **Data Completeness**: Fundamental reference data missing
- **Recommendation**: **ADD SOON**

### Missing VendorCredit & RefundReceipt
- **Business Impact**: Incomplete AP/AR picture, missing credit transactions
- **Data Completeness**: ~5-10% of vendor/customer transactions
- **Recommendation**: **ADD SOON**

### Missing Transfer
- **Business Impact**: Cannot track inter-account fund movements
- **Data Completeness**: Varies by business (could be significant for multi-account businesses)
- **Recommendation**: **ADD SOON**

---

## Implementation Priority

### Phase 1 (Immediate) 🔴
1. Estimate
2. JournalEntry
3. Account

### Phase 2 (Next Sprint) 🟡
4. VendorCredit
5. RefundReceipt
6. Transfer

### Phase 3 (Future) 🟢
7. Class
8. Department
9. TaxCode
10. TaxRate
11. PaymentMethod
12. Term
13. TimeActivity (if needed)
14. Budget (if needed)

---

## Database Schema Additions Needed

For each new entity, you'll need to create corresponding tables in Supabase:

- `quickbooks_estimates`
- `quickbooks_journal_entries`
- `quickbooks_accounts`
- `quickbooks_vendor_credits`
- `quickbooks_refund_receipts`
- `quickbooks_transfers`
- `quickbooks_classes`
- `quickbooks_departments`
- `quickbooks_tax_codes`
- `quickbooks_tax_rates`
- `quickbooks_payment_methods`
- `quickbooks_terms`

---

## Conclusion

**Current Coverage**: ~60-70% of common QuickBooks entities
**Missing Critical Data**: Estimates, Journal Entries, Chart of Accounts
**Recommendation**: Implement Phase 1 entities (Estimate, JournalEntry, Account) in next development cycle

The current implementation is solid for what it covers, but missing some key financial entities that would provide a more complete picture of the business's financial data.

