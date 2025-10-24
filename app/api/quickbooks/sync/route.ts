import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * QuickBooks Data Sync Endpoint (Phase 2 - Placeholder)
 * 
 * This endpoint will sync data from QuickBooks to the BDI Portal database.
 * 
 * SYNC FLOW:
 * 1. Check for active QuickBooks connection
 * 2. Refresh OAuth token if needed
 * 3. Fetch data from QuickBooks API (customers, invoices, vendors, expenses)
 * 4. Upsert data into local database
 * 5. Log sync results
 * 
 * SETUP REQUIRED:
 * - Install: pnpm add node-quickbooks
 * - Configure OAuth credentials
 * - Run database migration
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag access
    if (!canAccessQuickBooks(user.email)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get sync mode from request body (default to 'delta')
    const body = await request.json().catch(() => ({}));
    const { syncMode = 'delta' } = body; // 'delta' or 'full'
    
    console.log('🔄 Sync mode:', syncMode);

    // Get active QuickBooks connection
    const { data: connection, error: connError } = await supabase
      .from('quickbooks_connections')
      .select('*')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'No active QuickBooks connection found. Please connect first.' },
        { status: 404 }
      );
    }

    // Determine sync type: delta (incremental) or full
    let actualSyncType = syncMode;
    let deltaQuery = '';
    
    if (syncMode === 'delta' && connection.last_sync_at) {
      // Delta sync: only fetch records modified after last sync
      const lastSyncDate = new Date(connection.last_sync_at);
      const formattedDate = lastSyncDate.toISOString().split('.')[0] + '-08:00'; // QuickBooks format
      deltaQuery = `WHERE Metadata.LastUpdatedTime > '${formattedDate}'`;
      console.log('📊 Delta sync enabled. Fetching records modified after:', formattedDate);
    } else {
      // First sync or forced full sync
      actualSyncType = 'full';
      deltaQuery = '';
      console.log('📦 Full sync mode. Fetching all records.');
    }

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('quickbooks_sync_log')
      .insert({
        connection_id: connection.id,
        sync_type: actualSyncType,
        status: 'started',
        triggered_by: user.id,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
    }

    console.log(`🔄 Starting QuickBooks ${actualSyncType} sync...`);

    // Determine API base URL
    const apiBaseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    let customerCount = 0;
    let customersFetched = 0;
    let customersCreated = 0;
    let customersUpdated = 0;
    let invoiceCount = 0;
    let invoicesFetched = 0;
    let invoicesCreated = 0;
    let invoicesUpdated = 0;
    let vendorCount = 0;
    let vendorsFetched = 0;
    let vendorsCreated = 0;
    let vendorsUpdated = 0;
    let expenseCount = 0;
    let expensesFetched = 0;
    let expensesCreated = 0;
    let expensesUpdated = 0;
    let itemCount = 0;
    let itemsFetched = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let paymentCount = 0;
    let paymentsFetched = 0;
    let paymentsCreated = 0;
    let paymentsUpdated = 0;
    let billCount = 0;
    let billsFetched = 0;
    let billsCreated = 0;
    let billsUpdated = 0;

    let salesReceiptCount = 0;
    let salesReceiptsFetched = 0;
    let salesReceiptsCreated = 0;
    let salesReceiptsUpdated = 0;

    let creditMemoCount = 0;
    let creditMemosFetched = 0;
    let creditMemosCreated = 0;
    let creditMemosUpdated = 0;

    let poCount = 0;
    let posFetched = 0;
    let posCreated = 0;
    let posUpdated = 0;

    // Track intuit_tid from first API response (declare outside try-catch for error handling)
    let intuitTid: string | null = null;

    try {
      // Create service role client (used throughout sync for bypassing RLS)
      const supabaseService = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesArray) => {
              cookiesArray.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            },
          },
        }
      );

      // Fetch Customers from QuickBooks (with pagination)
      // Note: QB has a hard limit of 1000 records per query, so we need to paginate
      console.log('📥 Fetching customers from QuickBooks...');
      let allCustomers: any[] = [];
      let startPosition = 1;
      let hasMoreCustomers = true;
      
      while (hasMoreCustomers) {
        const customersQuery = `SELECT * FROM Customer ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS 1000`;
        console.log(`Customer Query (page ${Math.ceil(startPosition / 1000)}):`, customersQuery);
        
        const customersResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(customersQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!customersResponse.ok) {
          const errorBody = await customersResponse.text();
          console.error('QuickBooks API Error Response:', errorBody);
          throw new Error(`QuickBooks API error (${customersResponse.status}): ${customersResponse.statusText} - ${errorBody}`);
        }

        // Capture intuit_tid from first successful response
        if (!intuitTid) {
          intuitTid = customersResponse.headers.get('intuit_tid') || null;
          if (intuitTid) {
            console.log('📝 Captured intuit_tid:', intuitTid);
          }
        }

        const customersData = await customersResponse.json();
        const customers = customersData.QueryResponse?.Customer || [];
        
        if (customers.length > 0) {
          allCustomers = allCustomers.concat(customers);
          console.log(`✅ Fetched ${customers.length} customers (total so far: ${allCustomers.length})`);
          
          // If we got less than 1000, we're done
          if (customers.length < 1000) {
            hasMoreCustomers = false;
          } else {
            startPosition += 1000;
          }
        } else {
          hasMoreCustomers = false;
        }
      }
      
      const customers = allCustomers;
      customersFetched = customers.length;

      console.log(`✅ Fetched ${customersFetched} total customers from QuickBooks`);

      // Upsert customers to database
      for (const customer of customers) {
        let customerData: any;
        try {
          customerData = {
            connection_id: connection.id,
            qb_customer_id: customer.Id,
            qb_sync_token: customer.SyncToken,
            display_name: customer.DisplayName || customer.FullyQualifiedName,
            given_name: customer.GivenName,
            family_name: customer.FamilyName,
            company_name: customer.CompanyName,
            primary_email: customer.PrimaryEmailAddr?.Address,
            primary_phone: customer.PrimaryPhone?.FreeFormNumber,
            website: customer.WebAddr?.URI,
            billing_address: customer.BillAddr ? JSON.stringify(customer.BillAddr) : null,
            shipping_address: customer.ShipAddr ? JSON.stringify(customer.ShipAddr) : null,
            balance: customer.Balance || 0,
            currency_code: customer.CurrencyRef?.value || 'USD',
            is_active: customer.Active !== false,
            qb_created_at: customer.MetaData?.CreateTime,
            qb_updated_at: customer.MetaData?.LastUpdatedTime,
          };

          // Check if customer exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_customers')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_customer_id', customer.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is expected for new customers
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_customers')
              .update(customerData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Update error for customer ${customer.Id}:`, updateError);
              throw updateError;
            }
            customersUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_customers')
              .insert(customerData);
            
            if (insertError) {
              console.error(`❌ Insert error for customer ${customer.Id}:`, insertError);
              throw insertError;
            }
            customersCreated++;
          }

          customerCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting customer ${customer.Id}:`, err);
          console.error('Customer data:', JSON.stringify(customerData, null, 2));
        }
      }

      console.log(`✅ Synced ${customerCount} customers (${customersCreated} created, ${customersUpdated} updated)`);

      // ===============================================
      // PHASE 4: SYNC INVOICES (with pagination)
      // ===============================================
      console.log('📥 Fetching invoices from QuickBooks...');
      let allInvoices: any[] = [];
      let invoiceStartPosition = 1;
      let hasMoreInvoices = true;
      
      while (hasMoreInvoices) {
        const invoicesQuery = `SELECT * FROM Invoice ${deltaQuery} STARTPOSITION ${invoiceStartPosition} MAXRESULTS 1000`;
        console.log(`Invoice Query (page ${Math.ceil(invoiceStartPosition / 1000)}):`, invoicesQuery);
        
        const invoicesResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(invoicesQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!invoicesResponse.ok) {
          const errorBody = await invoicesResponse.text();
          console.error('QuickBooks Invoices API Error Response:', errorBody);
          throw new Error(`QuickBooks API error (invoices, ${invoicesResponse.status}): ${invoicesResponse.statusText} - ${errorBody}`);
        }

        const invoicesData = await invoicesResponse.json();
        const invoices = invoicesData.QueryResponse?.Invoice || [];
        
        if (invoices.length > 0) {
          allInvoices = allInvoices.concat(invoices);
          console.log(`✅ Fetched ${invoices.length} invoices (total so far: ${allInvoices.length})`);
          
          // If we got less than 1000, we're done
          if (invoices.length < 1000) {
            hasMoreInvoices = false;
          } else {
            invoiceStartPosition += 1000;
          }
        } else {
          hasMoreInvoices = false;
        }
      }
      
      const invoices = allInvoices;
      invoicesFetched = invoices.length;

      console.log(`✅ Fetched ${invoicesFetched} total invoices from QuickBooks`);

      // Upsert invoices to database
      for (const invoice of invoices) {
        let invoiceData: any;
        try {
          invoiceData = {
            connection_id: connection.id,
            qb_invoice_id: invoice.Id,
            qb_sync_token: invoice.SyncToken,
            qb_doc_number: invoice.DocNumber, // Fixed: was doc_number
            
            // Customer reference
            qb_customer_id: invoice.CustomerRef?.value,
            customer_name: invoice.CustomerRef?.name,
            
            // Dates
            invoice_date: invoice.TxnDate, // Fixed: was txn_date
            due_date: invoice.DueDate,
            
            // Amounts
            total_amount: invoice.TotalAmt || 0,
            balance: invoice.Balance || 0,
            currency_code: invoice.CurrencyRef?.value || 'USD',
            
            // Status (combining email and print status)
            status: invoice.EmailStatus || invoice.PrintStatus || 'NotSet',
            
            // Payment info
            payment_status: invoice.Balance === 0 ? 'Paid' : (invoice.Balance < invoice.TotalAmt ? 'Partial' : 'Unpaid'),
            paid_amount: invoice.TotalAmt - invoice.Balance,
            
            // Line Items (stored as JSON)
            line_items: invoice.Line ? JSON.stringify(invoice.Line) : null,
            
            // Metadata
            qb_created_at: invoice.MetaData?.CreateTime,
            qb_updated_at: invoice.MetaData?.LastUpdatedTime,
          };

          // Check if invoice exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_invoices')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_invoice_id', invoice.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is expected for new invoices
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_invoices')
              .update(invoiceData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Update error for invoice ${invoice.Id}:`, updateError);
              throw updateError;
            }
            invoicesUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_invoices')
              .insert(invoiceData);
            
            if (insertError) {
              console.error(`❌ Insert error for invoice ${invoice.Id}:`, insertError);
              throw insertError;
            }
            invoicesCreated++;
          }

          invoiceCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting invoice ${invoice.Id}:`, err);
          console.error('Invoice data:', JSON.stringify(invoiceData, null, 2));
        }
      }

      console.log(`✅ Synced ${invoiceCount} invoices (${invoicesCreated} created, ${invoicesUpdated} updated)`);

      // ===============================================
      // PHASE 5: SYNC VENDORS (with pagination)
      // ===============================================
      console.log('📥 Fetching vendors from QuickBooks...');
      let allVendors: any[] = [];
      let vendorStartPosition = 1;
      let hasMoreVendors = true;
      
      while (hasMoreVendors) {
        const vendorsQuery = `SELECT * FROM Vendor ${deltaQuery} STARTPOSITION ${vendorStartPosition} MAXRESULTS 1000`;
        console.log(`Vendor Query (page ${Math.ceil(vendorStartPosition / 1000)}):`, vendorsQuery);
        
        const vendorsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(vendorsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!vendorsResponse.ok) {
          const errorBody = await vendorsResponse.text();
          console.error('QuickBooks Vendors API Error Response:', errorBody);
          throw new Error(`QuickBooks API error (vendors, ${vendorsResponse.status}): ${vendorsResponse.statusText} - ${errorBody}`);
        }

        const vendorsData = await vendorsResponse.json();
        const vendors = vendorsData.QueryResponse?.Vendor || [];
        
        if (vendors.length > 0) {
          allVendors = allVendors.concat(vendors);
          console.log(`✅ Fetched ${vendors.length} vendors (total so far: ${allVendors.length})`);
          
          if (vendors.length < 1000) {
            hasMoreVendors = false;
          } else {
            vendorStartPosition += 1000;
          }
        } else {
          hasMoreVendors = false;
        }
      }
      
      const vendors = allVendors;
      vendorsFetched = vendors.length;

      console.log(`✅ Fetched ${vendorsFetched} total vendors from QuickBooks`);

      // Upsert vendors to database
      for (const vendor of vendors) {
        let vendorData: any;
        try {
          vendorData = {
            connection_id: connection.id,
            qb_vendor_id: vendor.Id,
            qb_sync_token: vendor.SyncToken,
            display_name: vendor.DisplayName || vendor.CompanyName,
            company_name: vendor.CompanyName,
            primary_email: vendor.PrimaryEmailAddr?.Address,
            primary_phone: vendor.PrimaryPhone?.FreeFormNumber,
            website: vendor.WebAddr?.URI,
            billing_address: vendor.BillAddr ? JSON.stringify(vendor.BillAddr) : null,
            balance: vendor.Balance || 0,
            currency_code: vendor.CurrencyRef?.value || 'USD',
            is_active: vendor.Active !== false,
            qb_created_at: vendor.MetaData?.CreateTime,
            qb_updated_at: vendor.MetaData?.LastUpdatedTime,
          };

          // Check if vendor exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_vendors')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_vendor_id', vendor.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_vendors')
              .update(vendorData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Update error for vendor ${vendor.Id}:`, updateError);
              throw updateError;
            }
            vendorsUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_vendors')
              .insert(vendorData);
            
            if (insertError) {
              console.error(`❌ Insert error for vendor ${vendor.Id}:`, insertError);
              throw insertError;
            }
            vendorsCreated++;
          }

          vendorCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting vendor ${vendor.Id}:`, err);
          console.error('Vendor data:', JSON.stringify(vendorData, null, 2));
        }
      }

      console.log(`✅ Synced ${vendorCount} vendors (${vendorsCreated} created, ${vendorsUpdated} updated)`);

      // ===============================================
      // PHASE 5: SYNC EXPENSES (with pagination)
      // ===============================================
      console.log('📥 Fetching ALL expenses from QuickBooks (all payment types)...');
      let allExpenses: any[] = [];
      let expenseStartPosition = 1;
      let hasMoreExpenses = true;
      
      while (hasMoreExpenses) {
        // Get ALL Purchase transactions (not just Cash)
        let expensesQuery = `SELECT * FROM Purchase ${deltaQuery} STARTPOSITION ${expenseStartPosition} MAXRESULTS 1000`;
        console.log(`Expense Query (page ${Math.ceil(expenseStartPosition / 1000)}):`, expensesQuery);
        
        const expensesResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(expensesQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!expensesResponse.ok) {
          const errorBody = await expensesResponse.text();
          console.error('QuickBooks Expenses API Error Response:', errorBody);
          throw new Error(`QuickBooks API error (expenses, ${expensesResponse.status}): ${expensesResponse.statusText} - ${errorBody}`);
        }

        const expensesData = await expensesResponse.json();
        const expenses = expensesData.QueryResponse?.Purchase || [];
        
        if (expenses.length > 0) {
          allExpenses = allExpenses.concat(expenses);
          console.log(`✅ Fetched ${expenses.length} expenses (total so far: ${allExpenses.length})`);
          
          if (expenses.length < 1000) {
            hasMoreExpenses = false;
          } else {
            expenseStartPosition += 1000;
          }
        } else {
          hasMoreExpenses = false;
        }
      }
      
      const expenses = allExpenses;
      expensesFetched = expenses.length;

      console.log(`✅ Fetched ${expensesFetched} total expenses from QuickBooks`);

      // Upsert expenses to database
      for (const expense of expenses) {
        let expenseData: any;
        try {
          expenseData = {
            connection_id: connection.id,
            qb_expense_id: expense.Id,
            qb_sync_token: expense.SyncToken,
            
            // Transaction details
            expense_date: expense.TxnDate,
            payment_type: expense.PaymentType,
            
            // Vendor/Entity reference
            qb_vendor_id: expense.EntityRef?.value,
            vendor_name: expense.EntityRef?.name,
            
            // Financial
            total_amount: expense.TotalAmt || 0,
            currency_code: expense.CurrencyRef?.value || 'USD',
            
            // Account reference
            account_ref: expense.AccountRef?.value,
            
            // Memo/Description
            memo: expense.PrivateNote,
            
            // Line Items (stored as JSON)
            line_items: expense.Line ? JSON.stringify(expense.Line) : null,
            
            // Metadata
            qb_created_at: expense.MetaData?.CreateTime,
            qb_updated_at: expense.MetaData?.LastUpdatedTime,
          };

          // Check if expense exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_expenses')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_expense_id', expense.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_expenses')
              .update(expenseData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Update error for expense ${expense.Id}:`, updateError);
              throw updateError;
            }
            expensesUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_expenses')
              .insert(expenseData);
            
            if (insertError) {
              console.error(`❌ Insert error for expense ${expense.Id}:`, insertError);
              throw insertError;
            }
            expensesCreated++;
          }

          expenseCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting expense ${expense.Id}:`, err);
          console.error('Expense data:', JSON.stringify(expenseData, null, 2));
        }
      }

      console.log(`✅ Synced ${expenseCount} Purchase expenses (${expensesCreated} created, ${expensesUpdated} updated)`);

      // ===============================================
      // PHASE 5b: SYNC EXPENSE ENTITY (different from Purchase)
      // ===============================================
      console.log('📥 Fetching Expense entities from QuickBooks...');
      let allExpenseEntities: any[] = [];
      let expenseEntityStartPosition = 1;
      let hasMoreExpenseEntities = true;
      let expenseEntitiesFetched = 0;
      let expenseEntityCount = 0;
      let expenseEntitiesCreated = 0;
      let expenseEntitiesUpdated = 0;
      
      while (hasMoreExpenseEntities) {
        // Get ALL Expense transactions
        let expenseEntityQuery = `SELECT * FROM Expense ${deltaQuery} STARTPOSITION ${expenseEntityStartPosition} MAXRESULTS 1000`;
        console.log(`Expense Entity Query (page ${Math.ceil(expenseEntityStartPosition / 1000)}):`, expenseEntityQuery);
        
        const expenseEntityResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(expenseEntityQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!expenseEntityResponse.ok) {
          const errorBody = await expenseEntityResponse.text();
          console.error('QuickBooks Expense Entity API Error Response:', errorBody);
          console.log('⚠️  Continuing without Expense entities...');
          break;
        }

        const expenseEntityData = await expenseEntityResponse.json();
        const expenseEntities = expenseEntityData.QueryResponse?.Expense || [];
        
        if (expenseEntities.length > 0) {
          allExpenseEntities = allExpenseEntities.concat(expenseEntities);
          console.log(`✅ Fetched ${expenseEntities.length} Expense entities (total so far: ${allExpenseEntities.length})`);
          
          if (expenseEntities.length < 1000) {
            hasMoreExpenseEntities = false;
          } else {
            expenseEntityStartPosition += 1000;
          }
        } else {
          hasMoreExpenseEntities = false;
        }
      }
      
      expenseEntitiesFetched = allExpenseEntities.length;
      console.log(`✅ Fetched ${expenseEntitiesFetched} total Expense entities from QuickBooks`);

      // Upsert Expense entities to database (reuse same table as Purchase)
      for (const expenseEntity of allExpenseEntities) {
        let expenseEntityData: any;
        try {
          expenseEntityData = {
            connection_id: connection.id,
            qb_expense_id: expenseEntity.Id,
            qb_sync_token: expenseEntity.SyncToken,
            
            // Transaction details
            expense_date: expenseEntity.TxnDate,
            payment_type: expenseEntity.PaymentType || 'Other',
            
            // Vendor/Entity reference
            qb_vendor_id: expenseEntity.EntityRef?.value,
            vendor_name: expenseEntity.EntityRef?.name,
            
            // Financial
            total_amount: expenseEntity.TotalAmt || 0,
            currency_code: expenseEntity.CurrencyRef?.value || 'USD',
            
            // Account reference
            account_ref: expenseEntity.AccountRef?.value,
            
            // Memo/Description
            memo: expenseEntity.PrivateNote,
            
            // Line Items (stored as JSON)
            line_items: expenseEntity.Line ? JSON.stringify(expenseEntity.Line) : null,
            
            // Metadata
            qb_created_at: expenseEntity.MetaData?.CreateTime,
            qb_updated_at: expenseEntity.MetaData?.LastUpdatedTime,
          };

          // Check if expense exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_expenses')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_expense_id', expenseEntity.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_expenses')
              .update(expenseEntityData)
              .eq('id', existing.id);

            if (updateError) throw updateError;
            expenseEntitiesUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_expenses')
              .insert(expenseEntityData);

            if (insertError) throw insertError;
            expenseEntitiesCreated++;
          }

          expenseEntityCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting Expense entity ${expenseEntity.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${expenseEntityCount} Expense entities (${expenseEntitiesCreated} created, ${expenseEntitiesUpdated} updated)`);

      // ===============================================
      // PHASE 6: SYNC ITEMS/PRODUCTS (with pagination)
      // ===============================================
      console.log('📥 Fetching items from QuickBooks...');
      let allItems: any[] = [];
      let itemStartPosition = 1;
      let hasMoreItems = true;
      
      while (hasMoreItems) {
        // Combine Active filter with delta query
        let itemsQuery = 'SELECT * FROM Item WHERE Active IN (true, false)';
        if (deltaQuery) {
          const deltaCondition = deltaQuery.replace('WHERE', 'AND');
          itemsQuery += ` ${deltaCondition}`;
        }
        itemsQuery += ` STARTPOSITION ${itemStartPosition} MAXRESULTS 1000`;
        console.log(`Item Query (page ${Math.ceil(itemStartPosition / 1000)}):`, itemsQuery);
        
        const itemsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(itemsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!itemsResponse.ok) {
          const errorBody = await itemsResponse.text();
          console.error('QuickBooks Items API Error Response:', errorBody);
          throw new Error(`QuickBooks API error (items, ${itemsResponse.status}): ${itemsResponse.statusText} - ${errorBody}`);
        }

        const itemsData = await itemsResponse.json();
        const items = itemsData.QueryResponse?.Item || [];
        
        if (items.length > 0) {
          allItems = allItems.concat(items);
          console.log(`✅ Fetched ${items.length} items (total so far: ${allItems.length})`);
          
          if (items.length < 1000) {
            hasMoreItems = false;
          } else {
            itemStartPosition += 1000;
          }
        } else {
          hasMoreItems = false;
        }
      }
      
      const items = allItems;
      itemsFetched = items.length;

      console.log(`✅ Fetched ${itemsFetched} total items from QuickBooks`);

      // Upsert items to database
      for (const item of items) {
        let itemData: any;
        try {
          itemData = {
            connection_id: connection.id,
            qb_item_id: item.Id,
            qb_sync_token: item.SyncToken,
            name: item.Name,
            sku: item.Sku || null,
            description: item.Description || null,
            type: item.Type, // Inventory, Service, NonInventory, etc.
            
            // Pricing
            unit_price: item.UnitPrice || 0,
            purchase_cost: item.PurchaseCost || 0,
            
            // Inventory (if applicable)
            qty_on_hand: item.QtyOnHand || 0,
            reorder_point: item.ReorderPoint || 0,
            
            // Accounting references
            income_account_ref: item.IncomeAccountRef?.value || null,
            expense_account_ref: item.ExpenseAccountRef?.value || null,
            asset_account_ref: item.AssetAccountRef?.value || null,
            
            // Status
            is_active: item.Active !== false,
            taxable: item.Taxable === true,
            
            // Parent reference (for sub-items)
            parent_ref: item.ParentRef?.value || null,
            
            // Full data for reference
            full_data: item,
            
            // Metadata
            qb_created_at: item.MetaData?.CreateTime,
            qb_updated_at: item.MetaData?.LastUpdatedTime,
          };

          // Check if item exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_items')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_item_id', item.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_items')
              .update(itemData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Update error for item ${item.Id}:`, updateError);
              throw updateError;
            }
            itemsUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_items')
              .insert(itemData);
            
            if (insertError) {
              console.error(`❌ Insert error for item ${item.Id}:`, insertError);
              throw insertError;
            }
            itemsCreated++;
          }

          itemCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting item ${item.Id}:`, err);
          console.error('Item data:', JSON.stringify(itemData, null, 2));
        }
      }

      console.log(`✅ Synced ${itemCount} items (${itemsCreated} created, ${itemsUpdated} updated)`);

      // ===============================================
      // PHASE 7: SYNC PAYMENTS (with pagination)
      // ===============================================
      console.log('📥 Fetching payments from QuickBooks...');
      let allPayments: any[] = [];
      let paymentStartPosition = 1;
      let hasMorePayments = true;
      
      while (hasMorePayments) {
        const paymentsQuery = `SELECT * FROM Payment ${deltaQuery} STARTPOSITION ${paymentStartPosition} MAXRESULTS 1000`;
        console.log(`Payment Query (page ${Math.ceil(paymentStartPosition / 1000)}):`, paymentsQuery);
        
        const paymentsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(paymentsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!paymentsResponse.ok) {
          const errorBody = await paymentsResponse.text();
          console.error('QuickBooks Payments API Error Response:', errorBody);
          throw new Error(`QuickBooks API error (payments, ${paymentsResponse.status}): ${paymentsResponse.statusText} - ${errorBody}`);
        }

        const paymentsData = await paymentsResponse.json();
        const payments = paymentsData.QueryResponse?.Payment || [];
        
        if (payments.length > 0) {
          allPayments = allPayments.concat(payments);
          console.log(`✅ Fetched ${payments.length} payments (total so far: ${allPayments.length})`);
          
          if (payments.length < 1000) {
            hasMorePayments = false;
          } else {
            paymentStartPosition += 1000;
          }
        } else {
          hasMorePayments = false;
        }
      }
      
      const payments = allPayments;
      paymentsFetched = payments.length;

      console.log(`✅ Fetched ${paymentsFetched} total payments from QuickBooks`);

      // Upsert payments to database
      for (const payment of payments) {
        let paymentData: any;
        try {
          paymentData = {
            connection_id: connection.id,
            qb_payment_id: payment.Id,
            qb_sync_token: payment.SyncToken,
            qb_customer_id: payment.CustomerRef?.value || null,
            customer_name: payment.CustomerRef?.name || null,
            payment_date: payment.TxnDate,
            total_amount: payment.TotalAmt || 0,
            unapplied_amount: payment.UnappliedAmt || 0,
            payment_method: payment.PaymentMethodRef?.name || null,
            reference_number: payment.PaymentRefNum || null,
            deposit_to_account: payment.DepositToAccountRef?.value || null,
            line_items: payment.Line || [],
            qb_created_at: payment.MetaData?.CreateTime,
            qb_updated_at: payment.MetaData?.LastUpdatedTime,
          };

          // Check if payment exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_payments')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_payment_id', payment.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_payments')
              .update(paymentData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Update error for payment ${payment.Id}:`, updateError);
              throw updateError;
            }
            paymentsUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_payments')
              .insert(paymentData);
            
            if (insertError) {
              console.error(`❌ Insert error for payment ${payment.Id}:`, insertError);
              throw insertError;
            }
            paymentsCreated++;
          }

          paymentCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting payment ${payment.Id}:`, err);
          console.error('Payment data:', JSON.stringify(paymentData, null, 2));
        }
      }

      console.log(`✅ Synced ${paymentCount} payments (${paymentsCreated} created, ${paymentsUpdated} updated)`);

      // ===============================================
      // PHASE 8: SYNC BILLS (with pagination)
      // ===============================================
      console.log('📥 Fetching bills from QuickBooks...');
      let allBills: any[] = [];
      let billStartPosition = 1;
      let hasMoreBills = true;
      
      while (hasMoreBills) {
        const billsQuery = `SELECT * FROM Bill ${deltaQuery} STARTPOSITION ${billStartPosition} MAXRESULTS 1000`;
        console.log(`Bill Query (page ${Math.ceil(billStartPosition / 1000)}):`, billsQuery);
        
        const billsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(billsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!billsResponse.ok) {
          const errorBody = await billsResponse.text();
          console.error('QuickBooks Bills API Error Response:', errorBody);
          throw new Error(`QuickBooks API error (bills, ${billsResponse.status}): ${billsResponse.statusText} - ${errorBody}`);
        }

        const billsData = await billsResponse.json();
        const bills = billsData.QueryResponse?.Bill || [];
        
        if (bills.length > 0) {
          allBills = allBills.concat(bills);
          console.log(`✅ Fetched ${bills.length} bills (total so far: ${allBills.length})`);
          
          if (bills.length < 1000) {
            hasMoreBills = false;
          } else {
            billStartPosition += 1000;
          }
        } else {
          hasMoreBills = false;
        }
      }
      
      const bills = allBills;
      billsFetched = bills.length;

      console.log(`✅ Fetched ${billsFetched} total bills from QuickBooks`);

      // Upsert bills to database
      for (const bill of bills) {
        let billData: any;
        try {
          billData = {
            connection_id: connection.id,
            qb_bill_id: bill.Id,
            qb_sync_token: bill.SyncToken,
            qb_vendor_id: bill.VendorRef?.value || null,
            vendor_name: bill.VendorRef?.name || null,
            bill_number: bill.DocNumber || null,
            bill_date: bill.TxnDate,
            due_date: bill.DueDate || null,
            total_amount: bill.TotalAmt || 0,
            balance: bill.Balance || 0,
            payment_status: bill.Balance === 0 ? 'Paid' : bill.Balance < bill.TotalAmt ? 'Partial' : 'Unpaid',
            line_items: bill.Line || [],
            ap_account_ref: bill.APAccountRef?.value || null,
            qb_created_at: bill.MetaData?.CreateTime,
            qb_updated_at: bill.MetaData?.LastUpdatedTime,
          };

          // Check if bill exists
          const { data: existing, error: existingError } = await supabaseService
            .from('quickbooks_bills')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_bill_id', bill.Id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            throw existingError;
          }

          if (existing) {
            const { error: updateError } = await supabaseService
              .from('quickbooks_bills')
              .update(billData)
              .eq('id', existing.id);
            
            if (updateError) {
              console.error(`❌ Update error for bill ${bill.Id}:`, updateError);
              throw updateError;
            }
            billsUpdated++;
          } else {
            const { error: insertError } = await supabaseService
              .from('quickbooks_bills')
              .insert(billData);
            
            if (insertError) {
              console.error(`❌ Insert error for bill ${bill.Id}:`, insertError);
              throw insertError;
            }
            billsCreated++;
          }

          billCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting bill ${bill.Id}:`, err);
          console.error('Bill data:', JSON.stringify(billData, null, 2));
        }
      }

      console.log(`✅ Synced ${billCount} bills (${billsCreated} created, ${billsUpdated} updated)`);

      // =============================================
      // Phase 9: Sales Receipts Sync
      // =============================================
      console.log('📥 Fetching sales receipts from QuickBooks...');
      let allSalesReceipts: any[] = [];
      startPosition = 1;
      const maxSalesReceiptsPerQuery = 1000;

      while (true) {
        const salesReceiptsQuery = `SELECT * FROM SalesReceipt ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxSalesReceiptsPerQuery}`;
        
        const salesReceiptsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(salesReceiptsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!salesReceiptsResponse.ok) {
          console.error('QuickBooks API Error fetching sales receipts');
          break;
        }

        const salesReceiptsData = await salesReceiptsResponse.json();
        const salesReceiptsBatch = salesReceiptsData?.QueryResponse?.SalesReceipt || [];
        
        if (salesReceiptsBatch.length === 0) break;
        
        allSalesReceipts = allSalesReceipts.concat(salesReceiptsBatch);
        salesReceiptsFetched += salesReceiptsBatch.length;
        
        if (salesReceiptsBatch.length < maxSalesReceiptsPerQuery) break;
        startPosition += maxSalesReceiptsPerQuery;
      }

      console.log(`📦 Fetched ${salesReceiptsFetched} sales receipts from QuickBooks`);

      for (const receipt of allSalesReceipts) {
        try {
          const receiptData = {
            connection_id: connection.id,
            qb_sales_receipt_id: receipt.Id,
            qb_sync_token: receipt.SyncToken,
            customer_ref: receipt.CustomerRef?.value || null,
            customer_name: receipt.CustomerRef?.name || null,
            doc_number: receipt.DocNumber || null,
            txn_date: receipt.TxnDate || null,
            total_amount: receipt.TotalAmt || 0,
            balance: receipt.Balance || 0,
            payment_method_ref: receipt.PaymentMethodRef?.value || null,
            payment_method_name: receipt.PaymentMethodRef?.name || null,
            deposit_to_account_ref: receipt.DepositToAccountRef?.value || null,
            email_status: receipt.EmailStatus || null,
            print_status: receipt.PrintStatus || null,
            memo: receipt.PrivateNote || null,
            full_data: receipt,
            qb_created_at: receipt.MetaData?.CreateTime || null,
            qb_updated_at: receipt.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_sales_receipts')
            .upsert(receiptData, {
              onConflict: 'connection_id,qb_sales_receipt_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting sales receipt ${receipt.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            salesReceiptsCreated++;
          } else {
            salesReceiptsUpdated++;
          }

          salesReceiptCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting sales receipt ${receipt.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${salesReceiptCount} sales receipts (${salesReceiptsCreated} created, ${salesReceiptsUpdated} updated)`);

      // =============================================
      // Phase 10: Credit Memos Sync
      // =============================================
      console.log('📥 Fetching credit memos from QuickBooks...');
      let allCreditMemos: any[] = [];
      startPosition = 1;
      const maxCreditMemosPerQuery = 1000;

      while (true) {
        const creditMemosQuery = `SELECT * FROM CreditMemo ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxCreditMemosPerQuery}`;
        
        const creditMemosResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(creditMemosQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!creditMemosResponse.ok) {
          console.error('QuickBooks API Error fetching credit memos');
          break;
        }

        const creditMemosData = await creditMemosResponse.json();
        const creditMemosBatch = creditMemosData?.QueryResponse?.CreditMemo || [];
        
        if (creditMemosBatch.length === 0) break;
        
        allCreditMemos = allCreditMemos.concat(creditMemosBatch);
        creditMemosFetched += creditMemosBatch.length;
        
        if (creditMemosBatch.length < maxCreditMemosPerQuery) break;
        startPosition += maxCreditMemosPerQuery;
      }

      console.log(`📦 Fetched ${creditMemosFetched} credit memos from QuickBooks`);

      for (const memo of allCreditMemos) {
        try {
          const memoData = {
            connection_id: connection.id,
            qb_credit_memo_id: memo.Id,
            qb_sync_token: memo.SyncToken,
            customer_ref: memo.CustomerRef?.value || null,
            customer_name: memo.CustomerRef?.name || null,
            doc_number: memo.DocNumber || null,
            txn_date: memo.TxnDate || null,
            total_amount: memo.TotalAmt || 0,
            balance: memo.Balance || 0,
            remaining_credit: memo.RemainingCredit || 0,
            email_status: memo.EmailStatus || null,
            print_status: memo.PrintStatus || null,
            apply_tax_after_discount: memo.ApplyTaxAfterDiscount || false,
            memo: memo.CustomerMemo?.value || null,
            private_note: memo.PrivateNote || null,
            full_data: memo,
            qb_created_at: memo.MetaData?.CreateTime || null,
            qb_updated_at: memo.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_credit_memos')
            .upsert(memoData, {
              onConflict: 'connection_id,qb_credit_memo_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting credit memo ${memo.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            creditMemosCreated++;
          } else {
            creditMemosUpdated++;
          }

          creditMemoCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting credit memo ${memo.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${creditMemoCount} credit memos (${creditMemosCreated} created, ${creditMemosUpdated} updated)`);

      // =============================================
      // Phase 11: Purchase Orders Sync
      // =============================================
      console.log('📥 Fetching purchase orders from QuickBooks...');
      let allPOs: any[] = [];
      startPosition = 1;
      const maxPOsPerQuery = 1000;

      while (true) {
        const posQuery = `SELECT * FROM PurchaseOrder ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxPOsPerQuery}`;
        
        const posResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(posQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!posResponse.ok) {
          console.error('QuickBooks API Error fetching purchase orders');
          break;
        }

        const posData = await posResponse.json();
        const posBatch = posData?.QueryResponse?.PurchaseOrder || [];
        
        if (posBatch.length === 0) break;
        
        allPOs = allPOs.concat(posBatch);
        posFetched += posBatch.length;
        
        if (posBatch.length < maxPOsPerQuery) break;
        startPosition += maxPOsPerQuery;
      }

      console.log(`📦 Fetched ${posFetched} purchase orders from QuickBooks`);

      for (const po of allPOs) {
        try {
          const poData = {
            connection_id: connection.id,
            qb_po_id: po.Id,
            qb_sync_token: po.SyncToken,
            vendor_ref: po.VendorRef?.value || null,
            vendor_name: po.VendorRef?.name || null,
            doc_number: po.DocNumber || null,
            txn_date: po.TxnDate || null,
            total_amount: po.TotalAmt || 0,
            ship_method_ref: po.ShipMethodRef?.value || null,
            ship_method_name: po.ShipMethodRef?.name || null,
            ship_date: po.ShipDate || null,
            tracking_num: po.TrackingNum || null,
            email_status: po.EmailStatus || null,
            print_status: po.PrintStatus || null,
            po_status: po.POStatus || null,
            memo: po.Memo || null,
            private_note: po.PrivateNote || null,
            full_data: po,
            qb_created_at: po.MetaData?.CreateTime || null,
            qb_updated_at: po.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_purchase_orders_qb')
            .upsert(poData, {
              onConflict: 'connection_id,qb_po_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting purchase order ${po.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            posCreated++;
          } else {
            posUpdated++;
          }

          poCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting purchase order ${po.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${poCount} purchase orders (${posCreated} created, ${posUpdated} updated)`);

      // =============================================
      // Phase 12: Deposits Sync
      // =============================================
      console.log('📥 Fetching deposits from QuickBooks...');
      let allDeposits: any[] = [];
      startPosition = 1;
      const maxDepositsPerQuery = 1000;
      let depositsFetched = 0;
      let depositCount = 0;
      let depositsCreated = 0;
      let depositsUpdated = 0;

      while (true) {
        const depositsQuery = `SELECT * FROM Deposit ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxDepositsPerQuery}`;
        
        const depositsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(depositsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!depositsResponse.ok) {
          console.error('QuickBooks API Error fetching deposits');
          break;
        }

        const depositsData = await depositsResponse.json();
        const depositsBatch = depositsData?.QueryResponse?.Deposit || [];
        
        if (depositsBatch.length === 0) break;
        
        allDeposits = allDeposits.concat(depositsBatch);
        depositsFetched += depositsBatch.length;
        
        if (depositsBatch.length < maxDepositsPerQuery) break;
        startPosition += maxDepositsPerQuery;
      }

      console.log(`📦 Fetched ${depositsFetched} deposits from QuickBooks`);

      for (const deposit of allDeposits) {
        try {
          const depositData = {
            connection_id: connection.id,
            qb_deposit_id: deposit.Id,
            qb_sync_token: deposit.SyncToken,
            txn_date: deposit.TxnDate || null,
            doc_number: deposit.DocNumber || null,
            total_amount: deposit.TotalAmt || 0,
            deposit_to_account_ref: deposit.DepositToAccountRef?.value || null,
            deposit_to_account_name: deposit.DepositToAccountRef?.name || null,
            deposit_to_account_value: deposit.DepositToAccountRef?.value || null,
            currency_code: deposit.CurrencyRef?.value || 'USD',
            exchange_rate: deposit.ExchangeRate || null,
            line_items: deposit.Line || [],
            line_count: deposit.Line?.length || 0,
            private_note: deposit.PrivateNote || null,
            customer_memo: deposit.CustomerMemo?.value || null,
            qb_created_at: deposit.MetaData?.CreateTime || null,
            qb_updated_at: deposit.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_deposits')
            .upsert(depositData, {
              onConflict: 'connection_id,qb_deposit_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting deposit ${deposit.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            depositsCreated++;
          } else {
            depositsUpdated++;
          }

          depositCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting deposit ${deposit.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${depositCount} deposits (${depositsCreated} created, ${depositsUpdated} updated)`);

      // =============================================
      // Phase 13: Bill Payments Sync
      // =============================================
      console.log('📥 Fetching bill payments from QuickBooks...');
      let allBillPayments: any[] = [];
      startPosition = 1;
      const maxBillPaymentsPerQuery = 1000;
      let billPaymentsFetched = 0;
      let billPaymentCount = 0;
      let billPaymentsCreated = 0;
      let billPaymentsUpdated = 0;

      while (true) {
        const billPaymentsQuery = `SELECT * FROM BillPayment ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxBillPaymentsPerQuery}`;
        
        const billPaymentsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(billPaymentsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!billPaymentsResponse.ok) {
          console.error('QuickBooks API Error fetching bill payments');
          break;
        }

        const billPaymentsData = await billPaymentsResponse.json();
        const billPaymentsBatch = billPaymentsData?.QueryResponse?.BillPayment || [];
        
        if (billPaymentsBatch.length === 0) break;
        
        allBillPayments = allBillPayments.concat(billPaymentsBatch);
        billPaymentsFetched += billPaymentsBatch.length;
        
        if (billPaymentsBatch.length < maxBillPaymentsPerQuery) break;
        startPosition += maxBillPaymentsPerQuery;
      }

      console.log(`📦 Fetched ${billPaymentsFetched} bill payments from QuickBooks`);

      for (const billPayment of allBillPayments) {
        try {
          const billPaymentData = {
            connection_id: connection.id,
            qb_payment_id: billPayment.Id,
            qb_sync_token: billPayment.SyncToken,
            txn_date: billPayment.TxnDate || null,
            doc_number: billPayment.DocNumber || null,
            total_amount: billPayment.TotalAmt || 0,
            vendor_ref: billPayment.VendorRef?.value || null,
            vendor_name: billPayment.VendorRef?.name || null,
            vendor_value: billPayment.VendorRef?.value || null,
            payment_type: billPayment.PayType || null,
            payment_method_ref: billPayment.PaymentMethodRef?.value || null,
            payment_method_name: billPayment.PaymentMethodRef?.name || null,
            payment_account_ref: billPayment.APAccountRef?.value || null,
            payment_account_name: billPayment.APAccountRef?.name || null,
            payment_account_value: billPayment.APAccountRef?.value || null,
            check_num: billPayment.CheckNum || null,
            print_status: billPayment.PrintStatus || null,
            currency_code: billPayment.CurrencyRef?.value || 'USD',
            exchange_rate: billPayment.ExchangeRate || null,
            line_items: billPayment.Line || [],
            line_count: billPayment.Line?.length || 0,
            private_note: billPayment.PrivateNote || null,
            credit_card_txn_info: billPayment.CreditCardPayment || null,
            qb_created_at: billPayment.MetaData?.CreateTime || null,
            qb_updated_at: billPayment.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_bill_payments')
            .upsert(billPaymentData, {
              onConflict: 'connection_id,qb_payment_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting bill payment ${billPayment.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            billPaymentsCreated++;
          } else {
            billPaymentsUpdated++;
          }

          billPaymentCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting bill payment ${billPayment.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${billPaymentCount} bill payments (${billPaymentsCreated} created, ${billPaymentsUpdated} updated)`);

      // =============================================
      // Phase 14: Estimates Sync
      // =============================================
      console.log('📥 Fetching estimates from QuickBooks...');
      let allEstimates: any[] = [];
      startPosition = 1;
      const maxEstimatesPerQuery = 1000;
      let estimatesFetched = 0;
      let estimateCount = 0;
      let estimatesCreated = 0;
      let estimatesUpdated = 0;

      while (true) {
        const estimatesQuery = `SELECT * FROM Estimate ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxEstimatesPerQuery}`;
        
        const estimatesResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(estimatesQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!estimatesResponse.ok) {
          console.error('QuickBooks API Error fetching estimates');
          break;
        }

        const estimatesData = await estimatesResponse.json();
        const estimatesBatch = estimatesData?.QueryResponse?.Estimate || [];
        
        if (estimatesBatch.length === 0) break;
        
        allEstimates = allEstimates.concat(estimatesBatch);
        estimatesFetched += estimatesBatch.length;
        
        if (estimatesBatch.length < maxEstimatesPerQuery) break;
        startPosition += maxEstimatesPerQuery;
      }

      console.log(`📦 Fetched ${estimatesFetched} estimates from QuickBooks`);

      for (const estimate of allEstimates) {
        try {
          const estimateData = {
            connection_id: connection.id,
            qb_estimate_id: estimate.Id,
            qb_sync_token: estimate.SyncToken,
            qb_doc_number: estimate.DocNumber || null,
            qb_customer_id: estimate.CustomerRef?.value || null,
            customer_name: estimate.CustomerRef?.name || null,
            txn_date: estimate.TxnDate || null,
            expiration_date: estimate.ExpirationDate || null,
            accepted_date: estimate.AcceptedDate || null,
            total_amount: estimate.TotalAmt || 0,
            currency_code: estimate.CurrencyRef?.value || 'USD',
            status: estimate.TxnStatus || null,
            email_status: estimate.EmailStatus || null,
            print_status: estimate.PrintStatus || null,
            bill_email: estimate.BillEmail?.Address || null,
            billing_address: estimate.BillAddr ? JSON.stringify(estimate.BillAddr) : null,
            shipping_address: estimate.ShipAddr ? JSON.stringify(estimate.ShipAddr) : null,
            customer_memo: estimate.CustomerMemo?.value || null,
            private_note: estimate.PrivateNote || null,
            line_items: estimate.Line ? JSON.stringify(estimate.Line) : null,
            full_data: estimate,
            qb_created_at: estimate.MetaData?.CreateTime || null,
            qb_updated_at: estimate.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_estimates')
            .upsert(estimateData, {
              onConflict: 'connection_id,qb_estimate_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting estimate ${estimate.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            estimatesCreated++;
          } else {
            estimatesUpdated++;
          }

          estimateCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting estimate ${estimate.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${estimateCount} estimates (${estimatesCreated} created, ${estimatesUpdated} updated)`);

      // =============================================
      // Phase 15: Journal Entries Sync
      // =============================================
      console.log('📥 Fetching journal entries from QuickBooks...');
      let allJournalEntries: any[] = [];
      startPosition = 1;
      const maxJournalEntriesPerQuery = 1000;
      let journalEntriesFetched = 0;
      let journalEntryCount = 0;
      let journalEntriesCreated = 0;
      let journalEntriesUpdated = 0;

      while (true) {
        const journalEntriesQuery = `SELECT * FROM JournalEntry ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxJournalEntriesPerQuery}`;
        
        const journalEntriesResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(journalEntriesQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!journalEntriesResponse.ok) {
          console.error('QuickBooks API Error fetching journal entries');
          break;
        }

        const journalEntriesData = await journalEntriesResponse.json();
        const journalEntriesBatch = journalEntriesData?.QueryResponse?.JournalEntry || [];
        
        if (journalEntriesBatch.length === 0) break;
        
        allJournalEntries = allJournalEntries.concat(journalEntriesBatch);
        journalEntriesFetched += journalEntriesBatch.length;
        
        if (journalEntriesBatch.length < maxJournalEntriesPerQuery) break;
        startPosition += maxJournalEntriesPerQuery;
      }

      console.log(`📦 Fetched ${journalEntriesFetched} journal entries from QuickBooks`);

      for (const journalEntry of allJournalEntries) {
        try {
          const journalEntryData = {
            connection_id: connection.id,
            qb_journal_entry_id: journalEntry.Id,
            qb_sync_token: journalEntry.SyncToken,
            qb_doc_number: journalEntry.DocNumber || null,
            txn_date: journalEntry.TxnDate || null,
            total_amount: journalEntry.TotalAmt || 0,
            currency_code: journalEntry.CurrencyRef?.value || 'USD',
            adjustment: journalEntry.Adjustment || false,
            private_note: journalEntry.PrivateNote || null,
            line_items: journalEntry.Line ? JSON.stringify(journalEntry.Line) : null,
            full_data: journalEntry,
            qb_created_at: journalEntry.MetaData?.CreateTime || null,
            qb_updated_at: journalEntry.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_journal_entries')
            .upsert(journalEntryData, {
              onConflict: 'connection_id,qb_journal_entry_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting journal entry ${journalEntry.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            journalEntriesCreated++;
          } else {
            journalEntriesUpdated++;
          }

          journalEntryCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting journal entry ${journalEntry.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${journalEntryCount} journal entries (${journalEntriesCreated} created, ${journalEntriesUpdated} updated)`);

      // =============================================
      // Phase 16: Accounts Sync (Chart of Accounts)
      // =============================================
      console.log('📥 Fetching accounts from QuickBooks...');
      let allAccounts: any[] = [];
      startPosition = 1;
      const maxAccountsPerQuery = 1000;
      let accountsFetched = 0;
      let accountCount = 0;
      let accountsCreated = 0;
      let accountsUpdated = 0;

      while (true) {
        // Get both active and inactive accounts
        let accountsQuery = 'SELECT * FROM Account WHERE Active IN (true, false)';
        if (deltaQuery) {
          const deltaCondition = deltaQuery.replace('WHERE', 'AND');
          accountsQuery += ` ${deltaCondition}`;
        }
        accountsQuery += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxAccountsPerQuery}`;
        
        const accountsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(accountsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!accountsResponse.ok) {
          console.error('QuickBooks API Error fetching accounts');
          break;
        }

        const accountsData = await accountsResponse.json();
        const accountsBatch = accountsData?.QueryResponse?.Account || [];
        
        if (accountsBatch.length === 0) break;
        
        allAccounts = allAccounts.concat(accountsBatch);
        accountsFetched += accountsBatch.length;
        
        if (accountsBatch.length < maxAccountsPerQuery) break;
        startPosition += maxAccountsPerQuery;
      }

      console.log(`📦 Fetched ${accountsFetched} accounts from QuickBooks`);

      for (const account of allAccounts) {
        try {
          const accountData = {
            connection_id: connection.id,
            qb_account_id: account.Id,
            qb_sync_token: account.SyncToken,
            name: account.Name,
            fully_qualified_name: account.FullyQualifiedName || null,
            account_number: account.AcctNum || null,
            account_type: account.AccountType || null,
            account_sub_type: account.AccountSubType || null,
            classification: account.Classification || null,
            parent_ref: account.ParentRef?.value || null,
            sub_account: account.SubAccount || false,
            account_level: account.Level || 0,
            current_balance: account.CurrentBalance || 0,
            current_balance_with_sub_accounts: account.CurrentBalanceWithSubAccounts || 0,
            currency_code: account.CurrencyRef?.value || 'USD',
            is_active: account.Active !== false,
            description: account.Description || null,
            tax_code_ref: account.TaxCodeRef?.value || null,
            full_data: account,
            qb_created_at: account.MetaData?.CreateTime || null,
            qb_updated_at: account.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_accounts')
            .upsert(accountData, {
              onConflict: 'connection_id,qb_account_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting account ${account.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            accountsCreated++;
          } else {
            accountsUpdated++;
          }

          accountCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting account ${account.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${accountCount} accounts (${accountsCreated} created, ${accountsUpdated} updated)`);

      // =============================================
      // Phase 17: Vendor Credits Sync
      // =============================================
      console.log('📥 Fetching vendor credits from QuickBooks...');
      let allVendorCredits: any[] = [];
      startPosition = 1;
      const maxVendorCreditsPerQuery = 1000;
      let vendorCreditsFetched = 0;
      let vendorCreditCount = 0;
      let vendorCreditsCreated = 0;
      let vendorCreditsUpdated = 0;

      while (true) {
        const vendorCreditsQuery = `SELECT * FROM VendorCredit ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxVendorCreditsPerQuery}`;
        
        const vendorCreditsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(vendorCreditsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!vendorCreditsResponse.ok) {
          console.error('QuickBooks API Error fetching vendor credits');
          break;
        }

        const vendorCreditsData = await vendorCreditsResponse.json();
        const vendorCreditsBatch = vendorCreditsData?.QueryResponse?.VendorCredit || [];
        
        if (vendorCreditsBatch.length === 0) break;
        
        allVendorCredits = allVendorCredits.concat(vendorCreditsBatch);
        vendorCreditsFetched += vendorCreditsBatch.length;
        
        if (vendorCreditsBatch.length < maxVendorCreditsPerQuery) break;
        startPosition += maxVendorCreditsPerQuery;
      }

      console.log(`📦 Fetched ${vendorCreditsFetched} vendor credits from QuickBooks`);

      for (const vendorCredit of allVendorCredits) {
        try {
          const vendorCreditData = {
            connection_id: connection.id,
            qb_vendor_credit_id: vendorCredit.Id,
            qb_sync_token: vendorCredit.SyncToken,
            qb_doc_number: vendorCredit.DocNumber || null,
            qb_vendor_id: vendorCredit.VendorRef?.value || null,
            vendor_name: vendorCredit.VendorRef?.name || null,
            txn_date: vendorCredit.TxnDate || null,
            total_amount: vendorCredit.TotalAmt || 0,
            remaining_credit: vendorCredit.Balance || 0,
            currency_code: vendorCredit.CurrencyRef?.value || 'USD',
            ap_account_ref: vendorCredit.APAccountRef?.value || null,
            memo: vendorCredit.Memo || null,
            private_note: vendorCredit.PrivateNote || null,
            line_items: vendorCredit.Line ? JSON.stringify(vendorCredit.Line) : null,
            full_data: vendorCredit,
            qb_created_at: vendorCredit.MetaData?.CreateTime || null,
            qb_updated_at: vendorCredit.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_vendor_credits')
            .upsert(vendorCreditData, {
              onConflict: 'connection_id,qb_vendor_credit_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting vendor credit ${vendorCredit.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            vendorCreditsCreated++;
          } else {
            vendorCreditsUpdated++;
          }

          vendorCreditCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting vendor credit ${vendorCredit.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${vendorCreditCount} vendor credits (${vendorCreditsCreated} created, ${vendorCreditsUpdated} updated)`);

      // =============================================
      // Phase 18: Refund Receipts Sync
      // =============================================
      console.log('📥 Fetching refund receipts from QuickBooks...');
      let allRefundReceipts: any[] = [];
      startPosition = 1;
      const maxRefundReceiptsPerQuery = 1000;
      let refundReceiptsFetched = 0;
      let refundReceiptCount = 0;
      let refundReceiptsCreated = 0;
      let refundReceiptsUpdated = 0;

      while (true) {
        const refundReceiptsQuery = `SELECT * FROM RefundReceipt ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxRefundReceiptsPerQuery}`;
        
        const refundReceiptsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(refundReceiptsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!refundReceiptsResponse.ok) {
          console.error('QuickBooks API Error fetching refund receipts');
          break;
        }

        const refundReceiptsData = await refundReceiptsResponse.json();
        const refundReceiptsBatch = refundReceiptsData?.QueryResponse?.RefundReceipt || [];
        
        if (refundReceiptsBatch.length === 0) break;
        
        allRefundReceipts = allRefundReceipts.concat(refundReceiptsBatch);
        refundReceiptsFetched += refundReceiptsBatch.length;
        
        if (refundReceiptsBatch.length < maxRefundReceiptsPerQuery) break;
        startPosition += maxRefundReceiptsPerQuery;
      }

      console.log(`📦 Fetched ${refundReceiptsFetched} refund receipts from QuickBooks`);

      for (const refundReceipt of allRefundReceipts) {
        try {
          const refundReceiptData = {
            connection_id: connection.id,
            qb_refund_receipt_id: refundReceipt.Id,
            qb_sync_token: refundReceipt.SyncToken,
            qb_doc_number: refundReceipt.DocNumber || null,
            qb_customer_id: refundReceipt.CustomerRef?.value || null,
            customer_name: refundReceipt.CustomerRef?.name || null,
            txn_date: refundReceipt.TxnDate || null,
            total_amount: refundReceipt.TotalAmt || 0,
            currency_code: refundReceipt.CurrencyRef?.value || 'USD',
            payment_method_ref: refundReceipt.PaymentMethodRef?.value || null,
            payment_ref_number: refundReceipt.PaymentRefNum || null,
            deposit_to_account_ref: refundReceipt.DepositToAccountRef?.value || null,
            bill_email: refundReceipt.BillEmail?.Address || null,
            billing_address: refundReceipt.BillAddr ? JSON.stringify(refundReceipt.BillAddr) : null,
            customer_memo: refundReceipt.CustomerMemo?.value || null,
            private_note: refundReceipt.PrivateNote || null,
            line_items: refundReceipt.Line ? JSON.stringify(refundReceipt.Line) : null,
            full_data: refundReceipt,
            qb_created_at: refundReceipt.MetaData?.CreateTime || null,
            qb_updated_at: refundReceipt.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_refund_receipts')
            .upsert(refundReceiptData, {
              onConflict: 'connection_id,qb_refund_receipt_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting refund receipt ${refundReceipt.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            refundReceiptsCreated++;
          } else {
            refundReceiptsUpdated++;
          }

          refundReceiptCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting refund receipt ${refundReceipt.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${refundReceiptCount} refund receipts (${refundReceiptsCreated} created, ${refundReceiptsUpdated} updated)`);

      // =============================================
      // Phase 19: Transfers Sync
      // =============================================
      console.log('📥 Fetching transfers from QuickBooks...');
      let allTransfers: any[] = [];
      startPosition = 1;
      const maxTransfersPerQuery = 1000;
      let transfersFetched = 0;
      let transferCount = 0;
      let transfersCreated = 0;
      let transfersUpdated = 0;

      while (true) {
        const transfersQuery = `SELECT * FROM Transfer ${deltaQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxTransfersPerQuery}`;
        
        const transfersResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(transfersQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!transfersResponse.ok) {
          console.error('QuickBooks API Error fetching transfers');
          break;
        }

        const transfersData = await transfersResponse.json();
        const transfersBatch = transfersData?.QueryResponse?.Transfer || [];
        
        if (transfersBatch.length === 0) break;
        
        allTransfers = allTransfers.concat(transfersBatch);
        transfersFetched += transfersBatch.length;
        
        if (transfersBatch.length < maxTransfersPerQuery) break;
        startPosition += maxTransfersPerQuery;
      }

      console.log(`📦 Fetched ${transfersFetched} transfers from QuickBooks`);

      for (const transfer of allTransfers) {
        try {
          const transferData = {
            connection_id: connection.id,
            qb_transfer_id: transfer.Id,
            qb_sync_token: transfer.SyncToken,
            txn_date: transfer.TxnDate || null,
            amount: transfer.Amount || 0,
            from_account_ref: transfer.FromAccountRef?.value || null,
            from_account_name: transfer.FromAccountRef?.name || null,
            to_account_ref: transfer.ToAccountRef?.value || null,
            to_account_name: transfer.ToAccountRef?.name || null,
            private_note: transfer.PrivateNote || null,
            full_data: transfer,
            qb_created_at: transfer.MetaData?.CreateTime || null,
            qb_updated_at: transfer.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_transfers')
            .upsert(transferData, {
              onConflict: 'connection_id,qb_transfer_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting transfer ${transfer.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            transfersCreated++;
          } else {
            transfersUpdated++;
          }

          transferCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting transfer ${transfer.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${transferCount} transfers (${transfersCreated} created, ${transfersUpdated} updated)`);

      // =============================================
      // Phase 20: Classes Sync
      // =============================================
      console.log('📥 Fetching classes from QuickBooks...');
      let allClasses: any[] = [];
      startPosition = 1;
      const maxClassesPerQuery = 1000;
      let classesFetched = 0;
      let classCount = 0;
      let classesCreated = 0;
      let classesUpdated = 0;

      while (true) {
        // Get both active and inactive classes
        let classesQuery = 'SELECT * FROM Class WHERE Active IN (true, false)';
        if (deltaQuery) {
          const deltaCondition = deltaQuery.replace('WHERE', 'AND');
          classesQuery += ` ${deltaCondition}`;
        }
        classesQuery += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxClassesPerQuery}`;
        
        const classesResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(classesQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!classesResponse.ok) {
          console.error('QuickBooks API Error fetching classes');
          break;
        }

        const classesData = await classesResponse.json();
        const classesBatch = classesData?.QueryResponse?.Class || [];
        
        if (classesBatch.length === 0) break;
        
        allClasses = allClasses.concat(classesBatch);
        classesFetched += classesBatch.length;
        
        if (classesBatch.length < maxClassesPerQuery) break;
        startPosition += maxClassesPerQuery;
      }

      console.log(`📦 Fetched ${classesFetched} classes from QuickBooks`);

      for (const qbClass of allClasses) {
        try {
          const classData = {
            connection_id: connection.id,
            qb_class_id: qbClass.Id,
            qb_sync_token: qbClass.SyncToken,
            name: qbClass.Name,
            fully_qualified_name: qbClass.FullyQualifiedName || null,
            parent_ref: qbClass.ParentRef?.value || null,
            sub_class: qbClass.SubClass || false,
            class_level: qbClass.Level || 0,
            is_active: qbClass.Active !== false,
            full_data: qbClass,
            qb_created_at: qbClass.MetaData?.CreateTime || null,
            qb_updated_at: qbClass.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_classes')
            .upsert(classData, {
              onConflict: 'connection_id,qb_class_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting class ${qbClass.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            classesCreated++;
          } else {
            classesUpdated++;
          }

          classCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting class ${qbClass.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${classCount} classes (${classesCreated} created, ${classesUpdated} updated)`);

      // =============================================
      // Phase 21: Terms Sync
      // =============================================
      console.log('📥 Fetching terms from QuickBooks...');
      let allTerms: any[] = [];
      startPosition = 1;
      const maxTermsPerQuery = 1000;
      let termsFetched = 0;
      let termCount = 0;
      let termsCreated = 0;
      let termsUpdated = 0;

      while (true) {
        // Get both active and inactive terms
        let termsQuery = 'SELECT * FROM Term WHERE Active IN (true, false)';
        if (deltaQuery) {
          const deltaCondition = deltaQuery.replace('WHERE', 'AND');
          termsQuery += ` ${deltaCondition}`;
        }
        termsQuery += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxTermsPerQuery}`;
        
        const termsResponse = await fetch(
          `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=${encodeURIComponent(termsQuery)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${connection.access_token}`,
            },
          }
        );

        if (!termsResponse.ok) {
          console.error('QuickBooks API Error fetching terms');
          break;
        }

        const termsData = await termsResponse.json();
        const termsBatch = termsData?.QueryResponse?.Term || [];
        
        if (termsBatch.length === 0) break;
        
        allTerms = allTerms.concat(termsBatch);
        termsFetched += termsBatch.length;
        
        if (termsBatch.length < maxTermsPerQuery) break;
        startPosition += maxTermsPerQuery;
      }

      console.log(`📦 Fetched ${termsFetched} terms from QuickBooks`);

      for (const term of allTerms) {
        try {
          const termData = {
            connection_id: connection.id,
            qb_term_id: term.Id,
            qb_sync_token: term.SyncToken,
            name: term.Name,
            type: term.Type || null,
            due_days: term.DueDays || null,
            discount_days: term.DiscountDays || null,
            discount_percent: term.DiscountPercent || null,
            day_of_month_due: term.DayOfMonthDue || null,
            due_next_month_days: term.DueNextMonthDays || null,
            discount_day_of_month: term.DiscountDayOfMonth || null,
            is_active: term.Active !== false,
            full_data: term,
            qb_created_at: term.MetaData?.CreateTime || null,
            qb_updated_at: term.MetaData?.LastUpdatedTime || null,
          };

          const { error: upsertError, data: upsertData } = await supabaseService
            .from('quickbooks_terms')
            .upsert(termData, {
              onConflict: 'connection_id,qb_term_id',
              ignoreDuplicates: false,
            })
            .select('id');

          if (upsertError) {
            console.error(`❌ Error upserting term ${term.Id}:`, upsertError);
            continue;
          }

          const wasCreated = upsertData && upsertData.length > 0;
          if (wasCreated) {
            termsCreated++;
          } else {
            termsUpdated++;
          }

          termCount++;
        } catch (err: any) {
          console.error(`❌ Error upserting term ${term.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${termCount} terms (${termsCreated} created, ${termsUpdated} updated)`);

      // Update sync log as completed
      const totalRecords = customerCount + invoiceCount + vendorCount + expenseCount + expenseEntityCount + itemCount + paymentCount + billCount + salesReceiptCount + creditMemoCount + poCount + depositCount + billPaymentCount + estimateCount + journalEntryCount + accountCount + vendorCreditCount + refundReceiptCount + transferCount + classCount + termCount;
      if (syncLog) {
        await supabase
          .from('quickbooks_sync_log')
          .update({
            status: 'completed',
            records_fetched: customersFetched + invoicesFetched + vendorsFetched + expensesFetched + itemsFetched + paymentsFetched + billsFetched + salesReceiptsFetched + creditMemosFetched + posFetched + depositsFetched + billPaymentsFetched + estimatesFetched + journalEntriesFetched + accountsFetched + vendorCreditsFetched + refundReceiptsFetched + transfersFetched + classesFetched + termsFetched,
            records_created: customersCreated + invoicesCreated + vendorsCreated + expensesCreated + itemsCreated + paymentsCreated + billsCreated + salesReceiptsCreated + creditMemosCreated + posCreated + depositsCreated + billPaymentsCreated + estimatesCreated + journalEntriesCreated + accountsCreated + vendorCreditsCreated + refundReceiptsCreated + transfersCreated + classesCreated + termsCreated,
            records_updated: customersUpdated + invoicesUpdated + vendorsUpdated + expensesUpdated + itemsUpdated + paymentsUpdated + billsUpdated + salesReceiptsUpdated + creditMemosUpdated + posUpdated + depositsUpdated + billPaymentsUpdated + estimatesUpdated + journalEntriesUpdated + accountsUpdated + vendorCreditsUpdated + refundReceiptsUpdated + transfersUpdated + classesUpdated + termsUpdated,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      // Update connection last sync time
      await supabase
        .from('quickbooks_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'success',
        })
        .eq('id', connection.id);

      // Update connection with successful sync timestamp
      const syncTimestamp = new Date().toISOString();
      
      await supabaseService
        .from('quickbooks_connections')
        .update({
          last_sync_at: syncTimestamp,
          last_sync_status: 'success',
          last_sync_error: null,
        })
        .eq('id', connection.id);

      // Update sync log
      if (syncLog) {
        await supabaseService
          .from('quickbooks_sync_log')
          .update({
            status: 'success',
            records_synced: totalRecords,
            completed_at: syncTimestamp,
            intuit_tid: intuitTid,
          })
          .eq('id', syncLog.id);
      }

      console.log(`✅ Sync completed successfully! Records synced: ${totalRecords}`);
      if (intuitTid) {
        console.log(`📝 QuickBooks Transaction ID (intuit_tid): ${intuitTid}`);
      }
      console.log(`📅 Next delta sync will fetch records modified after: ${syncTimestamp}`);

      return NextResponse.json({
        message: 'QuickBooks sync completed successfully',
        syncType: actualSyncType,
        nextSyncWillBeDelta: true,
        totalRecords: totalRecords,
        details: {
          customers: {
            fetched: customersFetched,
            created: customersCreated,
            updated: customersUpdated,
          },
          invoices: {
            fetched: invoicesFetched,
            created: invoicesCreated,
            updated: invoicesUpdated,
          },
          vendors: {
            fetched: vendorsFetched,
            created: vendorsCreated,
            updated: vendorsUpdated,
          },
          expenses: {
            fetched: expensesFetched,
            created: expensesCreated,
            updated: expensesUpdated,
          },
          items: {
            fetched: itemsFetched,
            created: itemsCreated,
            updated: itemsUpdated,
          },
          payments: {
            fetched: paymentsFetched,
            created: paymentsCreated,
            updated: paymentsUpdated,
          },
          bills: {
            fetched: billsFetched,
            created: billsCreated,
            updated: billsUpdated,
          },
          salesReceipts: {
            fetched: salesReceiptsFetched,
            created: salesReceiptsCreated,
            updated: salesReceiptsUpdated,
          },
          creditMemos: {
            fetched: creditMemosFetched,
            created: creditMemosCreated,
            updated: creditMemosUpdated,
          },
          purchaseOrders: {
            fetched: posFetched,
            created: posCreated,
            updated: posUpdated,
          },
          deposits: {
            fetched: depositsFetched,
            created: depositsCreated,
            updated: depositsUpdated,
          },
          billPayments: {
            fetched: billPaymentsFetched,
            created: billPaymentsCreated,
            updated: billPaymentsUpdated,
          },
          estimates: {
            fetched: estimatesFetched,
            created: estimatesCreated,
            updated: estimatesUpdated,
          },
          journalEntries: {
            fetched: journalEntriesFetched,
            created: journalEntriesCreated,
            updated: journalEntriesUpdated,
          },
          accounts: {
            fetched: accountsFetched,
            created: accountsCreated,
            updated: accountsUpdated,
          },
          vendorCredits: {
            fetched: vendorCreditsFetched,
            created: vendorCreditsCreated,
            updated: vendorCreditsUpdated,
          },
          refundReceipts: {
            fetched: refundReceiptsFetched,
            created: refundReceiptsCreated,
            updated: refundReceiptsUpdated,
          },
          transfers: {
            fetched: transfersFetched,
            created: transfersCreated,
            updated: transfersUpdated,
          },
          classes: {
            fetched: classesFetched,
            created: classesCreated,
            updated: classesUpdated,
          },
          terms: {
            fetched: termsFetched,
            created: termsCreated,
            updated: termsUpdated,
          },
        },
      });

    } catch (syncError: any) {
      console.error('Sync error:', syncError);

      // Update sync log as failed
      if (syncLog) {
        await supabase
          .from('quickbooks_sync_log')
          .update({
            status: 'failed',
            error_message: syncError.message,
            completed_at: new Date().toISOString(),
            intuit_tid: intuitTid,
          })
          .eq('id', syncLog.id);
      }

      // Update connection with error
      await supabase
        .from('quickbooks_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'failed',
          last_sync_error: syncError.message,
        })
        .eq('id', connection.id);

      throw syncError;
    }

  } catch (error) {
    console.error('Error in POST /api/quickbooks/sync:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

