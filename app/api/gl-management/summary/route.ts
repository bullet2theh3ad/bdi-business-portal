import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/summary
 * Calculate real-time totals by high-level category
 * Returns aggregated amounts for: nre, inventory, opex, labor, loans, investments, revenue, other
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

    // Fetch all data in parallel
    const [
      expensesRes, 
      billsRes, 
      depositsRes, 
      paymentsRes, 
      billPaymentsRes, 
      bankStatementsRes, 
      overridesRes,
      nrePaymentsRes,
      inventoryPaymentsRes
    ] = await Promise.all([
      supabaseService.from('quickbooks_expenses').select('*'),
      supabaseService.from('quickbooks_bills').select('*'),
      supabaseService.from('quickbooks_deposits').select('*'),
      supabaseService.from('quickbooks_payments').select('*'),
      supabaseService.from('quickbooks_bill_payments').select('*'),
      supabaseService.from('bank_statements').select('*'),
      supabaseService.from('gl_transaction_overrides').select('*'),
      supabaseService.from('nre_budget_payment_line_items').select('*'),
      supabaseService.from('inventory_payment_line_items').select('*'),
    ]);

    // Create overrides map
    const overridesMap = new Map();
    (overridesRes.data || []).forEach((override: any) => {
      const key = `${override.transaction_source}:${override.transaction_id}:${override.line_item_index || ''}`;
      overridesMap.set(key, override);
    });

    // Initialize category totals
    const summary: { [key: string]: number } = {
      nre: 0,
      inventory: 0,
      opex: 0,
      labor: 0,
      loans: 0,
      loan_interest: 0, // Interest paid on Tide Rock loans
      investments: 0,
      revenue: 0,
      other: 0,
      unassigned: 0,
    };

    // Initialize breakdown by status
    const breakdown: { [category: string]: { paid: number; overdue: number; toBePaid: number } } = {
      nre: { paid: 0, overdue: 0, toBePaid: 0 },
      inventory: { paid: 0, overdue: 0, toBePaid: 0 },
    };
    
    // Initialize revenue breakdown by channel
    const revenueBreakdown = {
      d2c: 0,
      b2b: 0,
      b2b_factored: 0,
    };

    // Helper function to add to category
    const addToCategory = (category: string, amount: number) => {
      if (category && summary.hasOwnProperty(category)) {
        summary[category] += amount;
      } else {
        summary.unassigned += amount;
      }
    };

    // Helper to check date range
    const isInDateRange = (date: string) => {
      if (!date) return true;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };

    // Process expenses
    (expensesRes.data || []).forEach((exp: any) => {
      if (!isInDateRange(exp.expense_date)) return;

      const lineItems = exp.line_items ? (typeof exp.line_items === 'string' ? JSON.parse(exp.line_items) : exp.line_items) : [];
      
      if (lineItems.length > 0) {
        lineItems.forEach((line: any, index: number) => {
          const overrideKey = `expense:${exp.qb_expense_id}:${index}`;
          const override = overridesMap.get(overrideKey);
          const category = override?.override_category || line.category || exp.category || 'unassigned';
          const amount = parseFloat(line.amount || '0');
          addToCategory(category, amount);
        });
      } else {
        const overrideKey = `expense:${exp.qb_expense_id}:`;
        const override = overridesMap.get(overrideKey);
        const category = override?.override_category || exp.category || 'unassigned';
        const amount = parseFloat(exp.total_amount || '0');
        addToCategory(category, amount);
      }
    });

    // Process bills
    (billsRes.data || []).forEach((bill: any) => {
      if (!isInDateRange(bill.bill_date)) return;

      const lineItems = bill.line_items ? (typeof bill.line_items === 'string' ? JSON.parse(bill.line_items) : bill.line_items) : [];
      
      if (lineItems.length > 0) {
        lineItems.forEach((line: any, index: number) => {
          const overrideKey = `bill:${bill.qb_bill_id}:${index}`;
          const override = overridesMap.get(overrideKey);
          const category = override?.override_category || 'unassigned';
          const amount = parseFloat(line.amount || '0');
          addToCategory(category, amount);
        });
      } else {
        const overrideKey = `bill:${bill.qb_bill_id}:`;
        const override = overridesMap.get(overrideKey);
        const category = override?.override_category || 'unassigned';
        const amount = parseFloat(bill.total_amount || '0');
        addToCategory(category, amount);
      }
    });

    // Process deposits (revenue - negative in cash flow context)
    (depositsRes.data || []).forEach((dep: any) => {
      if (!isInDateRange(dep.txn_date)) return;

      const lineItems = dep.line_items ? (typeof dep.line_items === 'string' ? JSON.parse(dep.line_items) : dep.line_items) : [];
      
      if (lineItems.length > 0) {
        lineItems.forEach((line: any, index: number) => {
          const overrideKey = `deposit:${dep.qb_deposit_id}:${index}`;
          const override = overridesMap.get(overrideKey);
          const category = override?.override_category || 'revenue';
          const amount = parseFloat(line.amount || '0');
          addToCategory(category, -amount); // Negative because it's income
        });
      } else {
        const overrideKey = `deposit:${dep.qb_deposit_id}:`;
        const override = overridesMap.get(overrideKey);
        const category = override?.override_category || 'revenue';
        const amount = parseFloat(dep.total_amount || '0');
        addToCategory(category, -amount); // Negative because it's income
      }
    });

    // Process payments (revenue - negative in cash flow context)
    (paymentsRes.data || []).forEach((pmt: any) => {
      if (!isInDateRange(pmt.payment_date)) return;

      const overrideKey = `payment:${pmt.qb_payment_id}:`;
      const override = overridesMap.get(overrideKey);
      const category = override?.override_category || 'revenue';
      const amount = parseFloat(pmt.total_amount || '0');
      addToCategory(category, -amount); // Negative because it's income
    });

    // Process bill payments
    (billPaymentsRes.data || []).forEach((bp: any) => {
      if (!isInDateRange(bp.txn_date)) return;

      const overrideKey = `bill_payment:${bp.qb_payment_id}:`;
      const override = overridesMap.get(overrideKey);
      const category = override?.override_category || 'unassigned';
      const amount = parseFloat(bp.total_amount || '0');
      addToCategory(category, amount);
    });

    // Process bank statements
    (bankStatementsRes.data || []).forEach((stmt: any) => {
      if (!isInDateRange(stmt.transaction_date)) return;

      // Skip if already matched to QB transaction to avoid double counting
      if (stmt.is_matched) return;

      const description = (stmt.description || '').toUpperCase();
      const debit = parseFloat(stmt.debit || '0');
      const credit = parseFloat(stmt.credit || '0');
      
      // Auto-categorize Tide Rock loan transactions
      let category = stmt.category || stmt.high_level_category;
      
      if (description.includes('CORPORATE XFER TO DDA TIDE ROCK')) {
        // Interest payment (debit = money out)
        category = 'loan_interest';
        if (debit > 0) {
          addToCategory(category, debit);
        }
        return;
      } else if (description.includes('CORPORATE XFER FROM DDA TIDE RO')) {
        // Loan received (credit = money in)
        category = 'loans';
        if (credit > 0) {
          addToCategory(category, -credit); // Negative because it's income/loan proceeds
        }
        return;
      }
      
      // For other transactions, use the assigned category
      category = category || 'unassigned';
      const netAmount = debit - credit; // debit is outflow (positive), credit is inflow (negative)
      
      addToCategory(category, netAmount);
    });

    // Process NRE payments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (nrePaymentsRes.data || []).forEach((payment: any) => {
      if (!isInDateRange(payment.payment_date)) return;

      const amount = parseFloat(payment.amount || '0');
      const paymentDate = new Date(payment.payment_date);
      paymentDate.setHours(0, 0, 0, 0);

      // Add to NRE category total
      summary.nre += amount;

      // Categorize by status - check explicitly for true
      if (payment.is_paid === true || payment.isPaid === true) {
        breakdown.nre.paid += amount;
      } else if (paymentDate < today) {
        // Payment date has passed but not paid = overdue
        breakdown.nre.overdue += amount;
      } else {
        // Future payment date or today = to be paid
        breakdown.nre.toBePaid += amount;
      }
    });

    // Process Inventory payments
    (inventoryPaymentsRes.data || []).forEach((payment: any) => {
      if (!isInDateRange(payment.payment_date)) return;

      const amount = parseFloat(payment.amount || '0');
      const paymentDate = new Date(payment.payment_date);
      paymentDate.setHours(0, 0, 0, 0);

      // Add to Inventory category total
      summary.inventory += amount;

      // Categorize by status - check explicitly for true
      if (payment.is_paid === true || payment.isPaid === true) {
        breakdown.inventory.paid += amount;
      } else if (paymentDate < today) {
        // Payment date has passed but not paid = overdue
        breakdown.inventory.overdue += amount;
      } else {
        // Future payment date or today = to be paid
        breakdown.inventory.toBePaid += amount;
      }
    });

    // Calculate totals
    const totalOutflows = summary.nre + summary.inventory + summary.opex + summary.labor + summary.loans + summary.investments + summary.other + summary.unassigned;
    const totalInflows = Math.abs(summary.revenue);
    const netCashFlow = totalInflows - totalOutflows;

    // Debug logging
    console.log('NRE Breakdown:', breakdown.nre);
    console.log('Inventory Breakdown:', breakdown.inventory);
    console.log('NRE Payments count:', nrePaymentsRes.data?.length);
    console.log('Inventory Payments count:', inventoryPaymentsRes.data?.length);

    return NextResponse.json({
      summary,
      breakdown,
      revenueBreakdown, // D2C, B2B, B2B (factored)
      totalOutflows,
      totalInflows,
      netCashFlow,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });

  } catch (error) {
    console.error('Error in GET /api/gl-management/summary:', error);
    return NextResponse.json(
      { error: 'Failed to calculate summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

