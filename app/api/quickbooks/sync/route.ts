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

    try {
      // Fetch Customers from QuickBooks
      console.log('📥 Fetching customers from QuickBooks...');
      const customersResponse = await fetch(
        `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=SELECT * FROM Customer MAXRESULTS 1000`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${connection.access_token}`,
          },
        }
      );

      if (!customersResponse.ok) {
        throw new Error(`QuickBooks API error: ${customersResponse.statusText}`);
      }

      const customersData = await customersResponse.json();
      const customers = customersData.QueryResponse?.Customer || [];
      customersFetched = customers.length;

      console.log(`✅ Fetched ${customersFetched} customers from QuickBooks`);

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
        try {
          const customerData = {
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
          const { data: existing } = await supabaseService
            .from('quickbooks_customers')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_customer_id', customer.Id)
            .single();

          if (existing) {
            await supabaseService
              .from('quickbooks_customers')
              .update(customerData)
              .eq('id', existing.id);
            customersUpdated++;
          } else {
            await supabaseService
              .from('quickbooks_customers')
              .insert(customerData);
            customersCreated++;
          }

          customerCount++;
        } catch (err) {
          console.error(`Error upserting customer ${customer.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${customerCount} customers (${customersCreated} created, ${customersUpdated} updated)`);

      // ===============================================
      // PHASE 4: SYNC INVOICES
      // ===============================================
      console.log('📥 Fetching invoices from QuickBooks...');
      const invoicesResponse = await fetch(
        `${apiBaseUrl}/v3/company/${connection.realm_id}/query?query=SELECT * FROM Invoice MAXRESULTS 1000`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${connection.access_token}`,
          },
        }
      );

      if (!invoicesResponse.ok) {
        throw new Error(`QuickBooks API error (invoices): ${invoicesResponse.statusText}`);
      }

      const invoicesData = await invoicesResponse.json();
      const invoices = invoicesData.QueryResponse?.Invoice || [];
      invoicesFetched = invoices.length;

      console.log(`✅ Fetched ${invoicesFetched} invoices from QuickBooks`);

      // Upsert invoices to database
      for (const invoice of invoices) {
        try {
          const invoiceData = {
            connection_id: connection.id,
            qb_invoice_id: invoice.Id,
            qb_sync_token: invoice.SyncToken,
            doc_number: invoice.DocNumber,
            
            // Customer reference
            qb_customer_id: invoice.CustomerRef?.value,
            customer_name: invoice.CustomerRef?.name,
            
            // Dates
            txn_date: invoice.TxnDate,
            due_date: invoice.DueDate,
            ship_date: invoice.ShipDate,
            
            // Amounts
            total_amount: invoice.TotalAmt || 0,
            balance: invoice.Balance || 0,
            currency_code: invoice.CurrencyRef?.value || 'USD',
            exchange_rate: invoice.ExchangeRate || 1,
            
            // Status
            email_status: invoice.EmailStatus,
            print_status: invoice.PrintStatus,
            
            // Addresses
            bill_email: invoice.BillEmail?.Address,
            billing_address: invoice.BillAddr ? JSON.stringify(invoice.BillAddr) : null,
            shipping_address: invoice.ShipAddr ? JSON.stringify(invoice.ShipAddr) : null,
            
            // Line Items (stored as JSON)
            line_items: invoice.Line ? JSON.stringify(invoice.Line) : null,
            
            // Metadata
            qb_created_at: invoice.MetaData?.CreateTime,
            qb_updated_at: invoice.MetaData?.LastUpdatedTime,
          };

          // Check if invoice exists
          const { data: existing } = await supabaseService
            .from('quickbooks_invoices')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('qb_invoice_id', invoice.Id)
            .single();

          if (existing) {
            await supabaseService
              .from('quickbooks_invoices')
              .update(invoiceData)
              .eq('id', existing.id);
            invoicesUpdated++;
          } else {
            await supabaseService
              .from('quickbooks_invoices')
              .insert(invoiceData);
            invoicesCreated++;
          }

          invoiceCount++;
        } catch (err) {
          console.error(`Error upserting invoice ${invoice.Id}:`, err);
        }
      }

      console.log(`✅ Synced ${invoiceCount} invoices (${invoicesCreated} created, ${invoicesUpdated} updated)`);

      // Update sync log as completed
      const totalRecords = customerCount + invoiceCount;
      if (syncLog) {
        await supabase
          .from('quickbooks_sync_log')
          .update({
            status: 'completed',
            records_fetched: customersFetched + invoicesFetched,
            records_created: customersCreated + invoicesCreated,
            records_updated: customersUpdated + invoicesUpdated,
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

