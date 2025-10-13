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

    // Get date range from request body (default to last 60 days)
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body;
    
    console.log('📅 Sync date range:', { startDate, endDate });

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

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('quickbooks_sync_log')
      .insert({
        connection_id: connection.id,
        sync_type: 'full',
        status: 'started',
        triggered_by: user.id,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
    }

    console.log('🔄 Starting QuickBooks full sync...');

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

    try {
      // Fetch Customers from QuickBooks (with pagination)
      // Note: QB has a hard limit of 1000 records per query, so we need to paginate
      console.log('📥 Fetching customers from QuickBooks...');
      let allCustomers: any[] = [];
      let startPosition = 1;
      let hasMoreCustomers = true;
      
      while (hasMoreCustomers) {
        const customersQuery = `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS 1000`;
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

      // Use service role for inserting (bypass RLS)
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
        let invoicesQuery = 'SELECT * FROM Invoice';
        if (startDate && endDate) {
          invoicesQuery += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
        }
        invoicesQuery += ` STARTPOSITION ${invoiceStartPosition} MAXRESULTS 1000`;
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
        const vendorsQuery = `SELECT * FROM Vendor STARTPOSITION ${vendorStartPosition} MAXRESULTS 1000`;
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
      console.log('📥 Fetching expenses from QuickBooks...');
      let allExpenses: any[] = [];
      let expenseStartPosition = 1;
      let hasMoreExpenses = true;
      
      while (hasMoreExpenses) {
        let expensesQuery = 'SELECT * FROM Purchase WHERE PaymentType = \'Cash\'';
        if (startDate && endDate) {
          expensesQuery += ` AND TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
        }
        expensesQuery += ` STARTPOSITION ${expenseStartPosition} MAXRESULTS 1000`;
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

      console.log(`✅ Synced ${expenseCount} expenses (${expensesCreated} created, ${expensesUpdated} updated)`);

      // ===============================================
      // PHASE 6: SYNC ITEMS/PRODUCTS (with pagination)
      // ===============================================
      console.log('📥 Fetching items from QuickBooks...');
      let allItems: any[] = [];
      let itemStartPosition = 1;
      let hasMoreItems = true;
      
      while (hasMoreItems) {
        const itemsQuery = `SELECT * FROM Item WHERE Active IN (true, false) STARTPOSITION ${itemStartPosition} MAXRESULTS 1000`;
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

      // Update sync log as completed
      const totalRecords = customerCount + invoiceCount + vendorCount + expenseCount + itemCount;
      if (syncLog) {
        await supabase
          .from('quickbooks_sync_log')
          .update({
            status: 'completed',
            records_fetched: customersFetched + invoicesFetched + vendorsFetched + expensesFetched + itemsFetched,
            records_created: customersCreated + invoicesCreated + vendorsCreated + expensesCreated + itemsCreated,
            records_updated: customersUpdated + invoicesUpdated + vendorsUpdated + expensesUpdated + itemsUpdated,
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

      return NextResponse.json({
        message: 'QuickBooks sync completed successfully',
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

