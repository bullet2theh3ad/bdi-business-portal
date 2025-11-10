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
      console.error(`[GL Transactions] Access denied for user: ${user.email}`);
      return NextResponse.json({ 
        error: 'Access denied', 
        details: 'User does not have permission to access GL Management data. Contact admin if you believe this is an error.',
        userEmail: user.email 
      }, { status: 403 });
    }
    
    console.log(`[GL Transactions] Access granted for user: ${user.email}`);

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

    // Debug: Log raw data fetched
    console.log('🔍 [GL Transactions] Raw data fetched:');
    console.log('  - Expenses:', expensesRes.data?.length || 0, 'records');
    console.log('  - Bills:', billsRes.data?.length || 0, 'records');
    console.log('  - Deposits:', depositsRes.data?.length || 0, 'records');
    console.log('  - Payments:', paymentsRes.data?.length || 0, 'records');
    console.log('  - Bill Payments:', billPaymentsRes.data?.length || 0, 'records');
    console.log('  - Overrides:', overridesRes.data?.length || 0, 'records');
    console.log('  - GL Codes:', glCodesRes.data?.length || 0, 'records');
    
    // Debug: Check for errors
    if (expensesRes.error) console.error('❌ Expenses fetch error:', expensesRes.error);
    if (billsRes.error) console.error('❌ Bills fetch error:', billsRes.error);
    if (depositsRes.error) console.error('❌ Deposits fetch error:', depositsRes.error);
    if (paymentsRes.error) console.error('❌ Payments fetch error:', paymentsRes.error);
    if (billPaymentsRes.error) console.error('❌ Bill Payments fetch error:', billPaymentsRes.error);

    // Create maps for quick lookups
    const overridesMap = new Map();
    (overridesRes.data || []).forEach((override: any) => {
      const key = `${override.transaction_source}:${override.transaction_id}:${override.line_item_index || ''}`;
      overridesMap.set(key, override);
    });
    
    // Debug: Log overrides loaded
    console.log(`📋 [Transactions API] Loaded ${overridesMap.size} overrides from database`);
    
    // Debug: Show sample overrides by category
    const overridesByCategory: any = {};
    (overridesRes.data || []).forEach((override: any) => {
      const cat = override.override_category || 'none';
      if (!overridesByCategory[cat]) overridesByCategory[cat] = 0;
      overridesByCategory[cat]++;
    });
    console.log('📋 [Transactions API] Overrides by category:', overridesByCategory);
    
    // Debug: Show sample inventory overrides
    const inventoryOverrides = (overridesRes.data || []).filter((o: any) => o.override_category === 'inventory');
    console.log(`📦 [Transactions API] Found ${inventoryOverrides.length} inventory overrides`);
    if (inventoryOverrides.length > 0) {
      console.log('📦 [Transactions API] Sample inventory override:', {
        source: inventoryOverrides[0].transaction_source,
        id: inventoryOverrides[0].transaction_id,
        lineItem: inventoryOverrides[0].line_item_index,
        category: inventoryOverrides[0].override_category,
        accountType: inventoryOverrides[0].override_account_type,
      });
      console.log('📦 [Transactions API] First 5 inventory override keys:');
      inventoryOverrides.slice(0, 5).forEach((o: any) => {
        const key = `${o.transaction_source}:${o.transaction_id}:${o.line_item_index || ''}`;
        console.log(`  - ${key} (${o.override_account_type})`);
      });
    }
    
    // Debug: Check for Askey transaction override specifically
    const askeyOverrides = (overridesRes.data || []).filter((o: any) => o.transaction_id === '1150040076');
    console.log(`🔍 [ASKEY] Found ${askeyOverrides.length} override(s) for transaction 1150040076 in database:`);
    askeyOverrides.forEach((o: any) => {
      const key = `${o.transaction_source}:${o.transaction_id}:${o.line_item_index || ''}`;
      console.log(`  - Key: ${key}, Category: ${o.override_category}, AccountType: ${o.override_account_type || 'NULL'}, ID: ${o.id}`);
    });

    const glCodesMap = new Map();
    (glCodesRes.data || []).forEach((gl: any) => {
      glCodesMap.set(gl.qb_account_id, gl);
    });

    // Process expenses
    const expenses = (expensesRes.data || []).map((exp: any) => {
      // Parse line items if they exist
      const lineItems = exp.line_items ? (typeof exp.line_items === 'string' ? JSON.parse(exp.line_items) : exp.line_items) : [];
      
      // Debug: Log first expense record structure
      if (expensesRes.data?.indexOf(exp) === 0) {
        console.log('🔍 [DEBUG] First expense record structure:');
        console.log('  - qb_expense_id:', exp.qb_expense_id);
        console.log('  - expense_date:', exp.expense_date);
        console.log('  - vendor_name:', exp.vendor_name);
        console.log('  - total_amount:', exp.total_amount);
        console.log('  - category:', exp.category);
        console.log('  - line_items type:', typeof exp.line_items);
        console.log('  - line_items length:', lineItems.length);
        if (lineItems.length > 0) {
          console.log('  - First line item keys:', Object.keys(lineItems[0]));
          console.log('  - First line item:', JSON.stringify(lineItems[0], null, 2));
        }
      }
      
      // If line items exist, expand them
      if (lineItems.length > 0) {
        return lineItems.map((line: any, index: number) => {
          // Try line-specific override first, then parent-level override
          const lineNum = line.LineNum || line.Id || (index + 1); // Use QB LineNum (1-based)
          const lineOverrideKey = `expense:${exp.qb_expense_id}:${lineNum}`;
          const parentOverrideKey = `expense:${exp.qb_expense_id}:`;
          const override = overridesMap.get(lineOverrideKey) || overridesMap.get(parentOverrideKey);
          
          // Debug: Log when we use parent fallback for inventory
          if (override && !overridesMap.get(lineOverrideKey) && override.override_category === 'inventory') {
            console.log(`🔄 [Parent Fallback] expense:${exp.qb_expense_id}: → ${override.override_account_type}`);
          }
          
          return {
            id: `${exp.qb_expense_id}-${index}`,
            source: 'expense' as const,
            sourceId: exp.qb_expense_id,
            lineItemIndex: index,
            date: exp.expense_date,
            vendor: exp.vendor_name,
            description: override?.override_description || line.Description || exp.memo || '',
            amount: parseFloat(line.Amount || '0'),
            glCode: override?.assigned_gl_code || line.AccountBasedExpenseLineDetail?.AccountRef?.value || exp.account_ref,
            glCodeName: glCodesMap.get(override?.assigned_gl_code || line.AccountBasedExpenseLineDetail?.AccountRef?.value || exp.account_ref)?.name || '',
            accountType: override?.override_account_type, // NEW: Apply override_account_type
            originalCategory: line.category || exp.category || 'unassigned', // NEW: Store original category
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
          accountType: override?.override_account_type, // NEW: Apply override_account_type
          originalCategory: exp.category || 'unassigned', // NEW: Store original category
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
      
      // Debug: Log first bill record structure
      if (billsRes.data?.indexOf(bill) === 0) {
        console.log('🔍 [DEBUG] First bill record structure:');
        console.log('  - qb_bill_id:', bill.qb_bill_id);
        console.log('  - bill_date:', bill.bill_date);
        console.log('  - vendor_name:', bill.vendor_name);
        console.log('  - total_amount:', bill.total_amount);
        console.log('  - line_items type:', typeof bill.line_items);
        console.log('  - line_items length:', lineItems.length);
        if (lineItems.length > 0) {
          console.log('  - First line item keys:', Object.keys(lineItems[0]));
          console.log('  - First line item:', JSON.stringify(lineItems[0], null, 2));
        }
      }
      
      if (lineItems.length > 0) {
        return lineItems.map((line: any, index: number) => {
          // Try line-specific override first, then parent-level override
          const lineNum = line.LineNum || line.Id || (index + 1); // Use QB LineNum (1-based)
          const lineOverrideKey = `bill:${bill.qb_bill_id}:${lineNum}`;
          const parentOverrideKey = `bill:${bill.qb_bill_id}:`;
          const override = overridesMap.get(lineOverrideKey) || overridesMap.get(parentOverrideKey);
          
          // Debug: Askey transaction specifically
          if (bill.qb_bill_id === '1150040076') {
            console.log(`🔍 [ASKEY ${bill.qb_bill_id}] Line ${index} (LineNum: ${lineNum})`);
            console.log(`  - Looking for: ${lineOverrideKey}`);
            console.log(`  - Or parent: ${parentOverrideKey}`);
            console.log(`  - Line override found: ${overridesMap.has(lineOverrideKey)}`);
            console.log(`  - Parent override found: ${overridesMap.has(parentOverrideKey)}`);
            if (override) {
              console.log(`  - Using override: Category=${override.override_category}, AccountType=${override.override_account_type || 'NULL'}`);
            } else {
              console.log(`  - NO OVERRIDE FOUND!`);
            }
          }
          
          // Debug: Log when we use parent fallback for inventory
          if (override && !overridesMap.get(lineOverrideKey) && override.override_category === 'inventory') {
            console.log(`🔄 [Parent Fallback] bill:${bill.qb_bill_id}: → ${override.override_account_type}`);
          }
          
          return {
            id: `${bill.qb_bill_id}-${index}`,
            source: 'bill' as const,
            sourceId: bill.qb_bill_id,
            lineItemIndex: index,
            date: bill.bill_date,
            vendor: bill.vendor_name,
            description: override?.override_description || line.Description || '',
            amount: parseFloat(line.Amount || '0'),
            glCode: override?.assigned_gl_code || line.AccountBasedExpenseLineDetail?.AccountRef?.value,
            glCodeName: glCodesMap.get(override?.assigned_gl_code || line.AccountBasedExpenseLineDetail?.AccountRef?.value)?.name || '',
            accountType: override?.override_account_type, // NEW: Apply override_account_type
            originalCategory: 'unassigned', // NEW: Store original category
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
          accountType: override?.override_account_type, // NEW: Apply override_account_type
          originalCategory: 'unassigned', // NEW: Store original category
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
            description: override?.override_description || line.Description || dep.private_note || '',
            amount: parseFloat(line.Amount || '0'),
            glCode: override?.assigned_gl_code || line.account_ref,
            glCodeName: glCodesMap.get(override?.assigned_gl_code || line.account_ref)?.name || '',
            accountType: override?.override_account_type, // NEW: Apply override_account_type
            originalCategory: 'revenue', // NEW: Store original category
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
          accountType: override?.override_account_type, // NEW: Apply override_account_type
          originalCategory: 'revenue', // NEW: Store original category
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
        accountType: override?.override_account_type, // NEW: Apply override_account_type
        originalCategory: 'revenue', // NEW: Store original category
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
        accountType: override?.override_account_type, // NEW: Apply override_account_type
        originalCategory: 'unassigned', // NEW: Store original category
        category: override?.override_category || 'unassigned',
        notes: override?.notes || '',
        bankTransactionNumber: override?.bank_transaction_number || bp.check_num || '',
        hasOverride: !!override,
      };
    });

    // Combine all transactions
    let allTransactions = [...expenses, ...bills, ...deposits, ...payments, ...billPayments];

    // Debug: Log processed transactions by category
    console.log('📊 [GL Transactions] Processed transaction counts:');
    console.log('  - Total expenses processed:', expenses.length);
    console.log('  - Total bills processed:', bills.length);
    console.log('  - Total deposits processed:', deposits.length);
    console.log('  - Total payments processed:', payments.length);
    console.log('  - Total bill payments processed:', billPayments.length);
    console.log('  - Combined total:', allTransactions.length);
    
    // Debug: Categorize and show amounts
    const categoryCounts: any = {};
    const categoryTotals: any = {};
    allTransactions.forEach(t => {
      const cat = t.category || 'null';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    });
    console.log('📈 [GL Transactions] By category:');
    Object.keys(categoryCounts).forEach(cat => {
      console.log(`  - ${cat}: ${categoryCounts[cat]} transactions, Total: $${categoryTotals[cat].toFixed(2)}`);
    });
    
    // Debug: Sample some unassigned transactions
    const unassignedSample = allTransactions.filter(t => t.category === 'unassigned').slice(0, 5);
    if (unassignedSample.length > 0) {
      console.log('🔍 [GL Transactions] Sample unassigned transactions:');
      unassignedSample.forEach((t, i) => {
        console.log(`  ${i + 1}. Source: ${t.source}, Amount: $${t.amount}, Date: ${t.date}, Vendor: ${t.vendor}`);
      });
    }
    
    // Debug: Sample inventory transactions to check accountType
    const inventorySample = allTransactions.filter(t => t.category === 'inventory').slice(0, 5);
    console.log(`📦 [GL Transactions] Found ${allTransactions.filter(t => t.category === 'inventory').length} inventory transactions`);
    if (inventorySample.length > 0) {
      console.log('📦 [GL Transactions] Sample inventory transactions:');
      inventorySample.forEach((t, i) => {
        console.log(`  ${i + 1}. Source: ${t.source}, ID: ${t.id}, Amount: $${t.amount}, AccountType: ${t.accountType || 'NULL'}, Category: ${t.category}`);
      });
    }

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

