# QuickBooks Additional Entities Setup

## ⚠️ IMPORTANT: Run this SQL in Supabase First!

Before testing the app, you **MUST** run the following SQL file in your Supabase SQL Editor:

```
create-quickbooks-additional-entities.sql
```

This will create 3 new tables:
- `quickbooks_sales_receipts`
- `quickbooks_credit_memos`
- `quickbooks_purchase_orders_qb`

## What Was Added:

### Database:
- 3 new tables with RLS policies
- Proper indexes for performance
- Compatible with existing QB integration

### API Routes:
- `/api/quickbooks/sales-receipts` - Fetch sales receipts
- `/api/quickbooks/credit-memos` - Fetch credit memos
- `/api/quickbooks/purchase-orders` - Fetch purchase orders
- Updated `/api/quickbooks/sync` to sync all 3 entities
- Updated `/api/quickbooks/stats` to include counts

### Menu Items:
- Sales Receipts (under QuickBooks)
- Credit Memos (under QuickBooks)
- Purchase Orders (under QuickBooks)

### UI Pages:
- `/admin/quickbooks/sales-receipts` - With charts
- `/admin/quickbooks/credit-memos` - With charts
- `/admin/quickbooks/purchase-orders` - With charts

## Next Steps:
1. **Run the SQL** in `create-quickbooks-additional-entities.sql`
2. Build the app: `pnpm build`
3. Test locally or deploy
4. Run QuickBooks Sync to populate data
5. View the new pages!

## Data Synced Per Entity:
- **Sales Receipts**: Cash sales, payment methods, customer info
- **Credit Memos**: Customer credits/refunds, remaining credits
- **Purchase Orders**: Vendor POs, shipping info, PO status

