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
      console.error(`[GL Summary] Access denied for user: ${user.email}`);
      return NextResponse.json({ 
        error: 'Access denied', 
        details: 'User does not have permission to access GL Management data. Contact admin if you believe this is an error.',
        userEmail: user.email 
      }, { status: 403 });
    }
    
    console.log(`[GL Summary] Access granted for user: ${user.email}`);

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

    // Debug: Log raw data fetched
    console.log('🔍 [GL Summary] Raw data fetched:');
    console.log('  - Expenses:', expensesRes.data?.length || 0);
    console.log('  - Bills:', billsRes.data?.length || 0);
    console.log('  - Deposits:', depositsRes.data?.length || 0);
    console.log('  - Payments:', paymentsRes.data?.length || 0);
    console.log('  - Bill Payments:', billPaymentsRes.data?.length || 0);
    console.log('  - Bank Statements:', bankStatementsRes.data?.length || 0);
    console.log('  - Overrides:', overridesRes.data?.length || 0);
    console.log('  - NRE Payments:', nrePaymentsRes.data?.length || 0);
    console.log('  - Inventory Payments:', inventoryPaymentsRes.data?.length || 0);

    // Create overrides map
    const overridesMap = new Map();
    let revenueOverrideCount = 0;
    let revenueWithAccountTypeCount = 0;
    (overridesRes.data || []).forEach((override: any) => {
      const key = `${override.transaction_source}:${override.transaction_id}:${override.line_item_index || ''}`;
      overridesMap.set(key, override);
      
      // Count revenue overrides and those with account types
      if (override.override_category === 'revenue') {
        revenueOverrideCount++;
        if (override.override_account_type) {
          revenueWithAccountTypeCount++;
          if (revenueWithAccountTypeCount <= 5) {
            console.log(`✅ [Revenue Override] Key: ${key}, AccountType: ${override.override_account_type}`);
          }
        } else {
          if (revenueOverrideCount - revenueWithAccountTypeCount <= 5) {
            console.log(`❌ [Revenue Override] Key: ${key}, AccountType: MISSING`);
          }
        }
      }
      
      // Debug: Log each override for verification
      console.log(`🔧 [Override] Key: ${key}, Category: ${override.override_category}`);
    });
    
    console.log(`\n📊 [Revenue Overrides Summary]`);
    console.log(`  - Total revenue overrides: ${revenueOverrideCount}`);
    console.log(`  - With accountType: ${revenueWithAccountTypeCount}`);
    console.log(`  - Missing accountType: ${revenueOverrideCount - revenueWithAccountTypeCount}\n`);

    // Initialize category totals from MANUAL CATEGORIZATION (QB + Bank Statements)
    const categorizedTotals: { [key: string]: number } = {
      nre: 0,
      inventory: 0,
      cogs: 0,
      opex: 0,
      marketing: 0,
      labor: 0,
      loans: 0,
      loan_interest: 0,
      investments: 0,
      revenue: 0,
      other: 0,
      unassigned: 0,
    };

    // Initialize category totals from INTERNAL DB (Trusted Source)
    const internalDBTotals: { [key: string]: number } = {
      nre: 0,
      inventory: 0,
    };

    // Initialize breakdown by status (for internal DB only)
    const breakdown: { [category: string]: { paid: number; overdue: number; toBePaid: number } } = {
      nre: { paid: 0, overdue: 0, toBePaid: 0 },
      inventory: { paid: 0, overdue: 0, toBePaid: 0 },
    };
    
    // Initialize labor breakdown from bank auto-detection (for "From Bank/QB")
    const laborBankBreakdown = {
      payroll: 0,
      taxes: 0,
      overhead: 0,
    };
    
    // Initialize labor breakdown from manual categorizations (for "Categorized")
    const laborManualBreakdown = {
      payroll: 0,
      taxes: 0,
      overhead: 0,
    };
    
    // Initialize revenue breakdown by channel
    const revenueBreakdown = {
      d2c: 0,
      b2b: 0,
      b2b_factored: 0,
    };

    // Helper function to add to CATEGORIZED totals (manual assignments)
    const addToCategorized = (category: string, amount: number, accountType?: string) => {
      // Debug: Log NRE additions
      if (category === 'nre' && amount !== 0) {
        console.log(`➕ [NRE Add] Amount: $${amount.toFixed(2)} (before: $${categorizedTotals.nre.toFixed(2)}, after: $${(categorizedTotals.nre + amount).toFixed(2)})`);
      }
      
      if (category && categorizedTotals.hasOwnProperty(category)) {
        categorizedTotals[category] += amount;
      } else {
        categorizedTotals.unassigned += amount;
      }
      
      // Track revenue breakdown by account type
      if (category === 'revenue' && accountType) {
        const absAmount = Math.abs(amount);
        if (accountType === 'D2C Sales') {
          console.log(`💰 [Revenue Breakdown] D2C += $${absAmount.toFixed(2)} (total now: $${(revenueBreakdown.d2c + absAmount).toFixed(2)})`);
          revenueBreakdown.d2c += absAmount; // Revenue is negative, so use abs
        } else if (accountType === 'B2B Sales') {
          console.log(`💰 [Revenue Breakdown] B2B += $${absAmount.toFixed(2)} (total now: $${(revenueBreakdown.b2b + absAmount).toFixed(2)})`);
          revenueBreakdown.b2b += absAmount;
        } else if (accountType === 'B2B Factored Sales') {
          console.log(`💰 [Revenue Breakdown] B2B Factored += $${absAmount.toFixed(2)} (total now: $${(revenueBreakdown.b2b_factored + absAmount).toFixed(2)})`);
          revenueBreakdown.b2b_factored += absAmount;
        } else {
          console.log(`⚠️  [Revenue Breakdown] Unknown accountType: "${accountType}" for amount $${absAmount.toFixed(2)}`);
        }
      } else if (category === 'revenue' && !accountType) {
        console.log(`⚠️  [Revenue Breakdown] MISSING accountType for revenue amount $${Math.abs(amount).toFixed(2)}`);
      }
      
      // Track labor breakdown by account type (manual categorizations)
      if (category === 'labor' && accountType) {
        const absAmount = Math.abs(amount);
        if (accountType === 'Payroll') {
          laborManualBreakdown.payroll += absAmount;
        } else if (accountType === 'Payroll Taxes' || accountType === 'Benefits') {
          laborManualBreakdown.taxes += absAmount; // Combine Payroll Taxes + Benefits into Taxes/Overhead
        } else if (accountType === 'Payroll Charges') {
          laborManualBreakdown.overhead += absAmount;
        }
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
    let expenseCount = 0;
    let expenseLineItemCount = 0;
    (expensesRes.data || []).forEach((exp: any) => {
      if (!isInDateRange(exp.expense_date)) return;
      expenseCount++;

      const lineItems = exp.line_items ? (typeof exp.line_items === 'string' ? JSON.parse(exp.line_items) : exp.line_items) : [];
      
      if (lineItems.length > 0) {
        lineItems.forEach((line: any, index: number) => {
          expenseLineItemCount++;
          // Try line-specific override first, then parent-level override
          const lineNum = line.LineNum || line.Id || (index + 1); // Use QB LineNum (1-based)
          const lineOverrideKey = `expense:${exp.qb_expense_id}:${lineNum}`;
          const parentOverrideKey = `expense:${exp.qb_expense_id}:`;
          const override = overridesMap.get(lineOverrideKey) || overridesMap.get(parentOverrideKey);
          const category = override?.override_category || line.category || exp.category || 'unassigned';
          const accountType = override?.override_account_type;
          const amount = parseFloat(line.Amount || '0');
          if (override) {
            console.log(`✏️  [Applied Override] expense:${exp.qb_expense_id}:${lineNum} → ${category} ($${amount.toFixed(2)}) AccountType: ${accountType || 'NONE'}`);
          }
          addToCategorized(category, amount, accountType);
        });
      } else {
        const overrideKey = `expense:${exp.qb_expense_id}:`;
        const override = overridesMap.get(overrideKey);
        const category = override?.override_category || exp.category || 'unassigned';
        const accountType = override?.override_account_type;
        const amount = parseFloat(exp.total_amount || '0');
        addToCategorized(category, amount, accountType);
      }
    });
    console.log(`✅ Processed ${expenseCount} expenses (${expenseLineItemCount} line items)`);

    // Process bills
    (billsRes.data || []).forEach((bill: any) => {
      if (!isInDateRange(bill.bill_date)) return;

      const lineItems = bill.line_items ? (typeof bill.line_items === 'string' ? JSON.parse(bill.line_items) : bill.line_items) : [];
      
      if (lineItems.length > 0) {
        lineItems.forEach((line: any, index: number) => {
          // Try line-specific override first, then parent-level override
          const lineNum = line.LineNum || line.Id || (index + 1); // Use QB LineNum (1-based)
          const lineOverrideKey = `bill:${bill.qb_bill_id}:${lineNum}`;
          const parentOverrideKey = `bill:${bill.qb_bill_id}:`;
          const override = overridesMap.get(lineOverrideKey) || overridesMap.get(parentOverrideKey);
          const category = override?.override_category || 'unassigned';
          const accountType = override?.override_account_type;
          const amount = parseFloat(line.Amount || '0');
          if (override) {
            console.log(`✏️  [Applied Override] bill:${bill.qb_bill_id}:${lineNum} → ${category} ($${amount.toFixed(2)}) AccountType: ${accountType || 'NONE'}`);
          }
          addToCategorized(category, amount, accountType);
        });
      } else {
        const overrideKey = `bill:${bill.qb_bill_id}:`;
        const override = overridesMap.get(overrideKey);
        const category = override?.override_category || 'unassigned';
        const accountType = override?.override_account_type;
        const amount = parseFloat(bill.total_amount || '0');
        addToCategorized(category, amount, accountType);
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
          const accountType = override?.override_account_type;
          const amount = parseFloat(line.Amount || '0');
          addToCategorized(category, -amount, accountType); // Negative because it's income
        });
      } else {
        const overrideKey = `deposit:${dep.qb_deposit_id}:`;
        const override = overridesMap.get(overrideKey);
        const category = override?.override_category || 'revenue';
        const accountType = override?.override_account_type;
        const amount = parseFloat(dep.total_amount || '0');
        addToCategorized(category, -amount, accountType); // Negative because it's income
      }
    });

    // Process payments (revenue - negative in cash flow context)
    let paymentRevenueCount = 0;
    (paymentsRes.data || []).forEach((pmt: any) => {
      if (!isInDateRange(pmt.payment_date)) return;

      const overrideKey = `payment:${pmt.qb_payment_id}:`;
      const override = overridesMap.get(overrideKey);
      const category = override?.override_category || 'revenue';
      const accountType = override?.override_account_type;
      const amount = parseFloat(pmt.total_amount || '0');
      
      // Debug: Log revenue payments
      if (category === 'revenue') {
        paymentRevenueCount++;
        if (paymentRevenueCount <= 5) {
          console.log(`💵 [QB Payment ${paymentRevenueCount}] $${amount.toFixed(2)} - AccountType: ${accountType || 'MISSING'} - Payment ID: ${pmt.qb_payment_id}`);
        }
      }
      
      addToCategorized(category, -amount, accountType); // Negative because it's income
    });
    
    console.log(`💵 [QB Payments] Found ${paymentRevenueCount} revenue payments`);

    // Process bill payments
    (billPaymentsRes.data || []).forEach((bp: any) => {
      if (!isInDateRange(bp.txn_date)) return;

      const overrideKey = `bill_payment:${bp.qb_payment_id}:`;
      const override = overridesMap.get(overrideKey);
      const category = override?.override_category || 'unassigned';
      const accountType = override?.override_account_type;
      const amount = parseFloat(bp.total_amount || '0');
      addToCategorized(category, amount, accountType);
    });

    // Process bank statements
    let laborCount = 0;
    let laborTotal = 0;
    let bankStatementSampleCount = 0;
    (bankStatementsRes.data || []).forEach((stmt: any) => {
      if (!isInDateRange(stmt.transaction_date)) return;

      // Skip if already matched to QB transaction to avoid double counting
      // ONLY skip if actually linked to a QB transaction (not just checkbox marked)
      if (stmt.is_matched && stmt.matched_qb_transaction_id) {
        console.log(`⏭️  [Skip Matched] Bank statement ${stmt.id} matched to QB transaction ${stmt.matched_qb_transaction_id}`);
        return;
      }

      const description = (stmt.description || '').toUpperCase();
      const debit = parseFloat(stmt.debit || '0');
      const credit = parseFloat(stmt.credit || '0');
      
      // Debug: Show first 10 bank statement descriptions to help identify patterns
      if (bankStatementSampleCount < 10) {
        console.log(`🏦 [Bank Statement ${bankStatementSampleCount + 1}] ${stmt.description?.substring(0, 80)} | Debit: ${debit} | Credit: ${credit}`);
        bankStatementSampleCount++;
      }
      
      // Auto-categorize transactions
      let category = stmt.category || stmt.high_level_category;
      
      if (description.includes('CORPORATE XFER TO DDA TIDE ROCK')) {
        // Interest payment (debit = money out)
        category = 'loan_interest';
        if (debit > 0) {
          addToCategorized(category, debit);
        }
        return;
      } else if (description.includes('CORPORATE XFER FROM DDA TIDE RO')) {
        // Loan received (credit = money in)
        category = 'loans';
        if (credit > 0) {
          addToCategorized(category, -credit); // Negative because it's income/loan proceeds
        }
        return;
      } else if (description.includes('334843 BOUNDLESS')) {
        // Direct deposit payroll (labor cost) - matches "334843 BOUNDLESS1364227403DIR..."
        category = 'labor';
        if (debit > 0) {
          laborCount++;
          laborTotal += debit;
          laborBankBreakdown.payroll += debit;
          addToCategorized(category, debit);
          console.log(`💼 [Labor - Payroll] $${debit.toFixed(2)} - ${stmt.description?.substring(0, 60)}`);
        }
        return;
      } else if (description.includes('PAYLOCITY') && (description.includes('CORPOR') || description.includes('COPOR')) && description.includes('TAX')) {
        // Payroll taxes - matches "PAYLOCITY CORPOR7364227403TAX..."
        category = 'labor';
        if (debit > 0) {
          laborCount++;
          laborTotal += debit;
          laborBankBreakdown.taxes += debit;
          addToCategorized(category, debit);
          console.log(`💼 [Labor - Taxes] $${debit.toFixed(2)} - ${stmt.description?.substring(0, 60)}`);
        }
        return;
      } else if (description.includes('EMPOWER') || description.includes('WEX HEALTH') || description.includes('COLONIAL LIFE') || description.includes('UNITED HEALTHCAR')) {
        // Labor overhead - benefits and insurance
        category = 'labor';
        if (debit > 0) {
          laborCount++;
          laborTotal += debit;
          laborBankBreakdown.overhead += debit;
          addToCategorized(category, debit);
          console.log(`💼 [Labor - Overhead] $${debit.toFixed(2)} - ${stmt.description?.substring(0, 60)}`);
        }
        return;
      }
      
      // For other transactions, use the assigned category
      category = category || 'unassigned';
      const accountType = stmt.account_type; // Get account type from bank statement
      const netAmount = debit - credit; // debit is outflow (positive), credit is inflow (negative)
      
      // Debug: Log revenue bank statements
      if (category === 'revenue') {
        console.log(`💰 [Bank Revenue] $${netAmount.toFixed(2)} - ${accountType || 'No Account Type'} - ${stmt.description?.substring(0, 60)} - Matched: ${stmt.is_matched ? 'YES' : 'NO'}`);
      }
      
      addToCategorized(category, netAmount, accountType);
    });
    
    // Debug: Log labor totals
    if (laborCount > 0) {
      console.log(`\n💼 [Labor Bank Auto-Detection] Found ${laborCount} labor transactions totaling $${laborTotal.toFixed(2)}`);
      console.log(`  - Payroll: $${laborBankBreakdown.payroll.toFixed(2)}`);
      console.log(`  - Taxes: $${laborBankBreakdown.taxes.toFixed(2)}`);
      console.log(`  - Overhead: $${laborBankBreakdown.overhead.toFixed(2)}`);
    }
    
    // Debug: Log manual labor categorizations
    const manualLaborTotal = laborManualBreakdown.payroll + laborManualBreakdown.taxes + laborManualBreakdown.overhead;
    if (manualLaborTotal > 0) {
      console.log(`\n👤 [Labor Manual Categorizations] Total: $${manualLaborTotal.toFixed(2)}`);
      console.log(`  - Payroll: $${laborManualBreakdown.payroll.toFixed(2)}`);
      console.log(`  - Taxes/Overhead: $${laborManualBreakdown.taxes.toFixed(2)}`);
      console.log(`  - Overhead Charges: $${laborManualBreakdown.overhead.toFixed(2)}\n`);
    } else {
      console.log(`\n👤 [Labor Manual Categorizations] No manual labor categorizations found\n`);
    }
    
    // Debug: Log NRE final total BEFORE processing internal DB
    console.log(`\n🔍 [NRE CATEGORIZED TOTAL] = $${categorizedTotals.nre.toFixed(2)} (raw, before Math.abs)`);
    console.log(`🔍 [NRE CATEGORIZED TOTAL] = $${Math.abs(categorizedTotals.nre).toFixed(2)} (after Math.abs, this is what shows as "Categorized")`);
    console.log(`ℹ️  This represents ALL transactions YOU manually categorized as NRE (expenses + bills combined)\n`);
    
    // Debug: Log Inventory final total
    console.log(`📦 [INVENTORY CATEGORIZED TOTAL] = $${categorizedTotals.inventory.toFixed(2)} (raw, before Math.abs)`);
    console.log(`📦 [INVENTORY CATEGORIZED TOTAL] = $${Math.abs(categorizedTotals.inventory).toFixed(2)} (after Math.abs, this is what shows as "Categorized")`);
    console.log(`ℹ️  This represents ALL transactions YOU manually categorized as Inventory (expenses + bills combined)\n`);

    // Process NRE payments from INTERNAL DB (Trusted Source)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (nrePaymentsRes.data || []).forEach((payment: any) => {
      if (!isInDateRange(payment.payment_date)) return;

      const amount = parseFloat(payment.amount || '0');
      const paymentDate = new Date(payment.payment_date);
      paymentDate.setHours(0, 0, 0, 0);

      // Add to INTERNAL DB total (trusted source)
      internalDBTotals.nre += amount;

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

    // Process Inventory payments from INTERNAL DB (Trusted Source)
    (inventoryPaymentsRes.data || []).forEach((payment: any) => {
      if (!isInDateRange(payment.payment_date)) return;

      const amount = parseFloat(payment.amount || '0');
      const paymentDate = new Date(payment.payment_date);
      paymentDate.setHours(0, 0, 0, 0);

      // Add to INTERNAL DB total (trusted source)
      internalDBTotals.inventory += amount;

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

    // Create combined summary for display (using internal DB where available, categorized otherwise)
    const summary: { [key: string]: number } = {
      nre: internalDBTotals.nre, // Use internal DB
      inventory: internalDBTotals.inventory, // Use internal DB
      opex: categorizedTotals.opex,
      marketing: categorizedTotals.marketing,
      labor: categorizedTotals.labor,
      loans: categorizedTotals.loans,
      loan_interest: categorizedTotals.loan_interest,
      investments: categorizedTotals.investments,
      revenue: categorizedTotals.revenue,
      other: categorizedTotals.other,
      unassigned: categorizedTotals.unassigned,
    };

    // Calculate total labor from bank auto-detection and manual categorizations
    const laborBankTotal = laborBankBreakdown.payroll + laborBankBreakdown.taxes + laborBankBreakdown.overhead;
    const laborManualTotal = laborManualBreakdown.payroll + laborManualBreakdown.taxes + laborManualBreakdown.overhead;

    // Calculate reconciliation deltas for NRE and Inventory
    // Compare categorized amounts (as positive) to PAID amounts only
    const reconciliation = {
      nre: {
        internalDB: breakdown.nre.paid, // Compare to Paid, not total
        categorized: Math.abs(categorizedTotals.nre), // Categorized as positive
        delta: breakdown.nre.paid - Math.abs(categorizedTotals.nre),
        isReconciled: Math.abs(breakdown.nre.paid - Math.abs(categorizedTotals.nre)) < 1, // Within $1
      },
      inventory: {
        internalDB: breakdown.inventory.paid, // Compare to Paid, not total
        categorized: Math.abs(categorizedTotals.inventory), // Categorized as positive
        delta: breakdown.inventory.paid - Math.abs(categorizedTotals.inventory),
        isReconciled: Math.abs(breakdown.inventory.paid - Math.abs(categorizedTotals.inventory)) < 1, // Within $1
      },
      revenue: {
        internalDB: Math.abs(categorizedTotals.revenue), // From QB/Bank only
        categorized: Math.abs(categorizedTotals.revenue), // Same source
        delta: 0, // No delta since we only have one source
        isReconciled: true, // Always reconciled since only one source
      },
      loans: {
        internalDB: Math.abs(categorizedTotals.loans), // From bank statements only
        categorized: Math.abs(categorizedTotals.loans), // Same source
        delta: 0, // No delta since we only have one source
        isReconciled: true, // Always reconciled since only one source
      },
      loan_interest: {
        internalDB: categorizedTotals.loan_interest, // Loan interest from bank (auto-categorized)
        categorized: Math.abs(categorizedTotals.loan_interest), // Same source for now
        delta: 0, // No delta since we only have one source
        isReconciled: true, // Always reconciled since only one source
      },
      labor: {
        internalDB: laborBankTotal, // From bank auto-detection (payroll + taxes + overhead)
        categorized: laborManualTotal, // From manual categorizations (payroll + taxes/overhead + overhead charges)
        delta: laborBankTotal - laborManualTotal, // Actual delta between bank and manual
        isReconciled: Math.abs(laborBankTotal - laborManualTotal) < 1, // Within $1
      },
      marketing: {
        internalDB: Math.abs(categorizedTotals.marketing), // From manual categorizations only
        categorized: Math.abs(categorizedTotals.marketing), // Same source
        delta: 0, // No delta since we only have one source
        isReconciled: true, // Always reconciled since only one source
      },
      opex: {
        internalDB: Math.abs(categorizedTotals.opex), // From manual categorizations only
        categorized: Math.abs(categorizedTotals.opex), // Same source
        delta: 0, // No delta since we only have one source
        isReconciled: true, // Always reconciled since only one source
      },
    };

    // Calculate totals
    const totalOutflows = summary.nre + summary.inventory + summary.opex + summary.marketing + summary.labor + summary.loans + summary.loan_interest + summary.investments + summary.other + summary.unassigned;
    const totalInflows = Math.abs(summary.revenue);
    const netCashFlow = totalInflows - totalOutflows;

    // Debug: Final summary totals
    console.log('📊 [GL Summary] Final category totals:');
    Object.keys(summary).forEach(cat => {
      if (cat === 'labor' && summary[cat] > 0) {
        console.log(`  - ${cat}: $${summary[cat].toFixed(2)} ⭐ (from ${laborCount} payroll transactions)`);
      } else {
        console.log(`  - ${cat}: $${summary[cat].toFixed(2)}`);
      }
    });
    console.log('💰 [GL Summary] Aggregated totals:');
    console.log(`  - Total Outflows: $${totalOutflows.toFixed(2)}`);
    console.log(`  - Total Inflows: $${totalInflows.toFixed(2)}`);
    console.log(`  - Net Cash Flow: $${netCashFlow.toFixed(2)}`);
    
    // Debug: Reconciliation status
    console.log('🔄 [GL Summary] Reconciliation Status:');
    console.log(`  - NRE: Paid (DB) = $${reconciliation.nre.internalDB.toFixed(2)}, Categorized = $${reconciliation.nre.categorized.toFixed(2)}, Delta = $${reconciliation.nre.delta.toFixed(2)} ${reconciliation.nre.isReconciled ? '✅' : '⚠️'}`);
    console.log(`     ⚠️  NRE RAW categorizedTotals.nre = $${categorizedTotals.nre.toFixed(2)} (before Math.abs)`);
    console.log(`  - Inventory: Paid (DB) = $${reconciliation.inventory.internalDB.toFixed(2)}, Categorized = $${reconciliation.inventory.categorized.toFixed(2)}, Delta = $${reconciliation.inventory.delta.toFixed(2)} ${reconciliation.inventory.isReconciled ? '✅' : '⚠️'}`);
    console.log(`     ⚠️  Inventory RAW categorizedTotals.inventory = $${categorizedTotals.inventory.toFixed(2)} (before Math.abs)`);
    console.log(`  - Loan Interest: From Bank = $${reconciliation.loan_interest.internalDB.toFixed(2)}, Categorized = $${reconciliation.loan_interest.categorized.toFixed(2)}, Delta = $${reconciliation.loan_interest.delta.toFixed(2)} ${reconciliation.loan_interest.isReconciled ? '✅' : '⚠️'}`);
    
    // Debug: Breakdown details
    console.log('📈 [GL Summary] NRE Breakdown:', breakdown.nre);
    console.log('📈 [GL Summary] Inventory Breakdown:', breakdown.inventory);
    console.log('💰 [GL Summary] Revenue Breakdown:', revenueBreakdown);

    return NextResponse.json({
      summary,
      categorizedTotals, // For debugging
      internalDBTotals, // For debugging
      reconciliation, // Deltas and status
      breakdown,
      laborBankBreakdown, // Bank auto-detected labor (for "From Bank/QB")
      laborManualBreakdown, // Manual categorizations (for "Categorized")
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

