import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/transactions
 * Fetch all QuickBooks transactions (expenses, bills, deposits, payments, bill_payments)
 * merged with user overrides from gl_transaction_overrides
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Use service role for data access
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const glCode = searchParams.get('glCode');
    const transactionType = searchParams.get('transactionType');

    // Fetch all transaction types in parallel
    const [expensesRes, billsRes, depositsRes, paymentsRes, billPaymentsRes, overridesRes, glCodesRes] = await Promise.all([
      supabaseService.from('quickbooks_expenses').select('*'),
      supabaseService.from('quickbooks_bills').select('*'),
      supabaseService.from('quickbooks_deposits').select('*'),
      supabaseService.from('quickbooks_payments').select('*'),
      supabaseService.from('quickbooks_bill_payments').select('*'),
      supabaseService.from('gl_transaction_overrides').select('*'),
      supabaseService.from('quickbooks_accounts').select('qb_account_id, name, account_number'),
    ]);

    // Create maps for quick lookups
    const overridesMap = new Map();
    (overridesRes.data || []).forEach((override: any) => {
      const key = `${override.transaction_source}:${override.transaction_id}:${override.line_item_index || ''}`;
      overridesMap.set(key, override);
    });

    const glCodesMap = new Map();
    (glCodesRes.data || []).forEach((gl: any) => {
      glCodesMap.set(gl.qb_account_id, gl);
    });

    // Process expenses
    const expenses = (expensesRes.data || []).map((exp: any) => {
      // Parse line items if they exist
      const lineItems = exp.line_items ? (typeof exp.line_items === 'string' ? JSON.parse(exp.line_items) : exp.line_items) : [];
      
      // If line items exist, expand them
      if (lineItems.length > 0) {
        return lineItems.map((line: any, index: number) => {
          const overrideKey = `expense:${exp.qb_expense_id}:${index}`;
          const override = overridesMap.get(overrideKey);
          
          return {
            id: `${exp.qb_expense_id}-${index}`,
            source: 'expense' as const,
            sourceId: exp.qb_expense_id,
            lineItemIndex: index,
            date: exp.expense_date,
            vendor: exp.vendor_name,
            description: override?.override_description || line.description || exp.memo || '',
            amount: parseFloat(line.amount || '0'),
            glCode: override?.assigned_gl_code || line.account_ref || exp.account_ref,
            glCodeName: glCodesMap.get(override?.assigned_gl_code || line.account_ref || exp.account_ref)?.name || '',
            category: override?.override_category || line.category || exp.category || 'unassigned',
            notes: override?.notes || '',
            bankTransactionNumber: override?.bank_transaction_number || '',
            hasOverride: !!override,
          };
        });
      } else {
        // Single line expense
        const overrideKey = `expense:${exp.qb_expense_id}:`;
        const override = overridesMap.get(overrideKey);
        
        return [{
          id: exp.qb_expense_id,
          source: 'expense' as const,
          sourceId: exp.qb_expense_id,
          lineItemIndex: null,
          date: exp.expense_date,
          vendor: exp.vendor_name,
          description: override?.override_description || exp.memo || '',
          amount: parseFloat(exp.total_amount || '0'),
          glCode: override?.assigned_gl_code || exp.account_ref,
          glCodeName: glCodesMap.get(override?.assigned_gl_code || exp.account_ref)?.name || '',
          category: override?.override_category || exp.category || 'unassigned',
          notes: override?.notes || '',
          bankTransactionNumber: override?.bank_transaction_number || '',
          hasOverride: !!override,
        }];
      }
    }).flat();

    // Process bills
    const bills = (billsRes.data || []).map((bill: any) => {
      const lineItems = bill.line_items ? (typeof bill.line_items === 'string' ? JSON.parse(bill.line_items) : bill.line_items) : [];
      
      if (lineItems.length > 0) {
        return lineItems.map((line: any, index: number) => {
          const overrideKey = `bill:${bill.qb_bill_id}:${index}`;
          const override = overridesMap.get(overrideKey);
          
          return {
            id: `${bill.qb_bill_id}-${index}`,
            source: 'bill' as const,
            sourceId: bill.qb_bill_id,
            lineItemIndex: index,
            date: bill.bill_date,
            vendor: bill.vendor_name,
            description: override?.override_description || line.description || '',
            amount: parseFloat(line.amount || '0'),
            glCode: override?.assigned_gl_code || line.account_ref,
            glCodeName: glCodesMap.get(override?.assigned_gl_code || line.account_ref)?.name || '',
            category: override?.override_category || 'unassigned',
            notes: override?.notes || '',
            bankTransactionNumber: override?.bank_transaction_number || '',
            hasOverride: !!override,
          };
        });
      } else {
        const overrideKey = `bill:${bill.qb_bill_id}:`;
        const override = overridesMap.get(overrideKey);
        
        return [{
          id: bill.qb_bill_id,
          source: 'bill' as const,
          sourceId: bill.qb_bill_id,
          lineItemIndex: null,
          date: bill.bill_date,
          vendor: bill.vendor_name,
          description: override?.override_description || bill.bill_number || '',
          amount: parseFloat(bill.total_amount || '0'),
          glCode: override?.assigned_gl_code || '',
          glCodeName: glCodesMap.get(override?.assigned_gl_code || '')?.name || '',
          category: override?.override_category || 'unassigned',
          notes: override?.notes || '',
          bankTransactionNumber: override?.bank_transaction_number || '',
          hasOverride: !!override,
        }];
      }
    }).flat();

    // Process deposits
    const deposits = (depositsRes.data || []).map((dep: any) => {
      const lineItems = dep.line_items ? (typeof dep.line_items === 'string' ? JSON.parse(dep.line_items) : dep.line_items) : [];
      
      if (lineItems.length > 0) {
        return lineItems.map((line: any, index: number) => {
          const overrideKey = `deposit:${dep.qb_deposit_id}:${index}`;
          const override = overridesMap.get(overrideKey);
          
          return {
            id: `${dep.qb_deposit_id}-${index}`,
            source: 'deposit' as const,
            sourceId: dep.qb_deposit_id,
            lineItemIndex: index,
            date: dep.txn_date,
            vendor: line.entity_name || dep.deposit_to_account_name || '',
            description: override?.override_description || line.description || dep.private_note || '',
            amount: parseFloat(line.amount || '0'),
            glCode: override?.assigned_gl_code || line.account_ref,
            glCodeName: glCodesMap.get(override?.assigned_gl_code || line.account_ref)?.name || '',
            category: override?.override_category || 'revenue',
            notes: override?.notes || '',
            bankTransactionNumber: override?.bank_transaction_number || '',
            hasOverride: !!override,
          };
        });
      } else {
        const overrideKey = `deposit:${dep.qb_deposit_id}:`;
        const override = overridesMap.get(overrideKey);
        
        return [{
          id: dep.qb_deposit_id,
          source: 'deposit' as const,
          sourceId: dep.qb_deposit_id,
          lineItemIndex: null,
          date: dep.txn_date,
          vendor: dep.deposit_to_account_name || '',
          description: override?.override_description || dep.private_note || '',
          amount: parseFloat(dep.total_amount || '0'),
          glCode: override?.assigned_gl_code || dep.deposit_to_account_ref,
          glCodeName: glCodesMap.get(override?.assigned_gl_code || dep.deposit_to_account_ref)?.name || '',
          category: override?.override_category || 'revenue',
          notes: override?.notes || '',
          bankTransactionNumber: override?.bank_transaction_number || '',
          hasOverride: !!override,
        }];
      }
    }).flat();

    // Process payments (customer payments)
    const payments = (paymentsRes.data || []).map((pmt: any) => {
      const overrideKey = `payment:${pmt.qb_payment_id}:`;
      const override = overridesMap.get(overrideKey);
      
      return {
        id: pmt.qb_payment_id,
        source: 'payment' as const,
        sourceId: pmt.qb_payment_id,
        lineItemIndex: null,
        date: pmt.payment_date,
        vendor: pmt.customer_name,
        description: override?.override_description || `Payment ${pmt.reference_number || ''}`,
        amount: parseFloat(pmt.total_amount || '0'),
        glCode: override?.assigned_gl_code || pmt.deposit_to_account,
        glCodeName: glCodesMap.get(override?.assigned_gl_code || pmt.deposit_to_account)?.name || '',
        category: override?.override_category || 'revenue',
        notes: override?.notes || '',
        bankTransactionNumber: override?.bank_transaction_number || pmt.reference_number || '',
        hasOverride: !!override,
      };
    });

    // Process bill payments
    const billPayments = (billPaymentsRes.data || []).map((bp: any) => {
      const overrideKey = `bill_payment:${bp.qb_payment_id}:`;
      const override = overridesMap.get(overrideKey);
      
      return {
        id: bp.qb_payment_id,
        source: 'bill_payment' as const,
        sourceId: bp.qb_payment_id,
        lineItemIndex: null,
        date: bp.txn_date,
        vendor: bp.vendor_name,
        description: override?.override_description || `Bill Payment ${bp.doc_number || ''}`,
        amount: parseFloat(bp.total_amount || '0'),
        glCode: override?.assigned_gl_code || bp.payment_account_ref,
        glCodeName: glCodesMap.get(override?.assigned_gl_code || bp.payment_account_ref)?.name || '',
        category: override?.override_category || 'unassigned',
        notes: override?.notes || '',
        bankTransactionNumber: override?.bank_transaction_number || bp.check_num || '',
        hasOverride: !!override,
      };
    });

    // Combine all transactions
    let allTransactions = [...expenses, ...bills, ...deposits, ...payments, ...billPayments];

    // Apply filters
    if (startDate) {
      allTransactions = allTransactions.filter(t => t.date >= startDate);
    }
    if (endDate) {
      allTransactions = allTransactions.filter(t => t.date <= endDate);
    }
    if (category && category !== 'all') {
      allTransactions = allTransactions.filter(t => t.category === category);
    }
    if (glCode) {
      allTransactions = allTransactions.filter(t => t.glCode === glCode);
    }
    if (transactionType && transactionType !== 'all') {
      allTransactions = allTransactions.filter(t => t.source === transactionType);
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      transactions: allTransactions,
      count: allTransactions.length,
      message: 'Transactions retrieved successfully',
    });

  } catch (error) {
    console.error('Error in GET /api/gl-management/transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

