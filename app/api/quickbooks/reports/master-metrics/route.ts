import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canAccessQuickBooks(user.email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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

    // Fetch ALL QuickBooks data in parallel
    const [
      customersData,
      invoicesData,
      vendorsData,
      expensesData,
      paymentsData,
      billsData,
      salesReceiptsData,
      creditMemosData,
      purchaseOrdersData,
    ] = await Promise.all([
      supabaseService.from('quickbooks_customers').select('*'),
      supabaseService.from('quickbooks_invoices').select('*'),
      supabaseService.from('quickbooks_vendors').select('*'),
      supabaseService.from('quickbooks_expenses').select('*'),
      supabaseService.from('quickbooks_payments').select('*'),
      supabaseService.from('quickbooks_bills').select('*'),
      supabaseService.from('quickbooks_sales_receipts').select('*'),
      supabaseService.from('quickbooks_credit_memos').select('*'),
      supabaseService.from('quickbooks_purchase_orders_qb').select('*'),
    ]);

    const customers = customersData.data || [];
    const invoices = invoicesData.data || [];
    const vendors = vendorsData.data || [];
    const expenses = expensesData.data || [];
    const payments = paymentsData.data || [];
    const bills = billsData.data || [];
    const salesReceipts = salesReceiptsData.data || [];
    const creditMemos = creditMemosData.data || [];
    const purchaseOrders = purchaseOrdersData.data || [];

    // =============================================
    // MASTER METRICS CALCULATION
    // =============================================

    // Revenue Calculations
    const totalInvoiceRevenue = invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const totalSalesReceiptRevenue = salesReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const totalCreditMemos = creditMemos.reduce((sum, m) => sum + (m.total_amount || 0), 0);
    const netRevenue = totalInvoiceRevenue + totalSalesReceiptRevenue - totalCreditMemos;

    // Cash Flow Calculations
    const totalPaymentsReceived = payments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalExpensesPaid = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netCashFlow = totalPaymentsReceived - totalExpensesPaid;

    // AR & AP Calculations
    const totalAR = invoices.reduce((sum, i) => sum + (i.balance || 0), 0);
    const totalAP = bills.reduce((sum, b) => sum + (b.balance || 0), 0);
    const netPosition = totalAR - totalAP;

    // Outstanding Metrics
    const openPOs = purchaseOrders.filter(po => po.po_status === 'Open');
    const totalOpenPOValue = openPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0);
    const unpaidBills = bills.filter(b => (b.balance || 0) > 0);
    const totalUnpaidBills = unpaidBills.reduce((sum, b) => sum + (b.balance || 0), 0);
    const availableCredits = creditMemos.reduce((sum, m) => sum + (m.remaining_credit || 0), 0);

    // Average Metrics
    const avgInvoiceValue = invoices.length > 0 ? totalInvoiceRevenue / invoices.length : 0;
    const avgPaymentValue = payments.length > 0 ? totalPaymentsReceived / payments.length : 0;
    const avgBillValue = bills.length > 0 ? bills.reduce((sum, b) => sum + (b.total_amount || 0), 0) / bills.length : 0;

    // Timeline Data (last 12 weeks)
    const getWeekKey = (date: string) => {
      const d = new Date(date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split('T')[0];
    };

    // Revenue Timeline
    const revenueTimeline: Record<string, { week: string; invoices: number; salesReceipts: number; credits: number }> = {};
    
    invoices.forEach(inv => {
      if (inv.txn_date) {
        const week = getWeekKey(inv.txn_date);
        if (!revenueTimeline[week]) revenueTimeline[week] = { week, invoices: 0, salesReceipts: 0, credits: 0 };
        revenueTimeline[week].invoices += inv.total_amount || 0;
      }
    });

    salesReceipts.forEach(sr => {
      if (sr.txn_date) {
        const week = getWeekKey(sr.txn_date);
        if (!revenueTimeline[week]) revenueTimeline[week] = { week, invoices: 0, salesReceipts: 0, credits: 0 };
        revenueTimeline[week].salesReceipts += sr.total_amount || 0;
      }
    });

    creditMemos.forEach(cm => {
      if (cm.txn_date) {
        const week = getWeekKey(cm.txn_date);
        if (!revenueTimeline[week]) revenueTimeline[week] = { week, invoices: 0, salesReceipts: 0, credits: 0 };
        revenueTimeline[week].credits += cm.total_amount || 0;
      }
    });

    const revenueTimelineData = Object.values(revenueTimeline)
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    // Cash Flow Timeline
    const cashFlowTimeline: Record<string, { week: string; inflow: number; outflow: number }> = {};
    
    payments.forEach(p => {
      if (p.payment_date) {
        const week = getWeekKey(p.payment_date);
        if (!cashFlowTimeline[week]) cashFlowTimeline[week] = { week, inflow: 0, outflow: 0 };
        cashFlowTimeline[week].inflow += p.total_amount || 0;
      }
    });

    expenses.forEach(e => {
      if (e.txn_date) {
        const week = getWeekKey(e.txn_date);
        if (!cashFlowTimeline[week]) cashFlowTimeline[week] = { week, inflow: 0, outflow: 0 };
        cashFlowTimeline[week].outflow += e.amount || 0;
      }
    });

    const cashFlowTimelineData = Object.values(cashFlowTimeline)
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    // Top Customers by Revenue (Invoices + Sales Receipts - Credit Memos)
    const customerRevenue: Record<string, number> = {};
    invoices.forEach(i => {
      const name = i.customer_name || 'Unknown';
      customerRevenue[name] = (customerRevenue[name] || 0) + (i.total_amount || 0);
    });
    salesReceipts.forEach(r => {
      const name = r.customer_name || 'Unknown';
      customerRevenue[name] = (customerRevenue[name] || 0) + (r.total_amount || 0);
    });
    creditMemos.forEach(m => {
      const name = m.customer_name || 'Unknown';
      customerRevenue[name] = (customerRevenue[name] || 0) - (m.total_amount || 0);
    });

    const topCustomers = Object.entries(customerRevenue)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top Vendors by Spend (Expenses + Bills + POs)
    const vendorSpend: Record<string, number> = {};
    expenses.forEach(e => {
      const name = e.vendor_name || 'Unknown';
      vendorSpend[name] = (vendorSpend[name] || 0) + (e.amount || 0);
    });
    bills.forEach(b => {
      const name = b.vendor_name || 'Unknown';
      vendorSpend[name] = (vendorSpend[name] || 0) + (b.total_amount || 0);
    });
    purchaseOrders.forEach(po => {
      const name = po.vendor_name || 'Unknown';
      vendorSpend[name] = (vendorSpend[name] || 0) + (po.total_amount || 0);
    });

    const topVendors = Object.entries(vendorSpend)
      .map(([name, spend]) => ({ name, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    // Cash Flow Breakdown (for waterfall/sankey)
    const cashFlowBreakdown = {
      inflows: {
        payments: totalPaymentsReceived,
        salesReceipts: totalSalesReceiptRevenue,
      },
      outflows: {
        expenses: totalExpensesPaid,
        bills: totalUnpaidBills,
      }
    };

    return NextResponse.json({
      summary: {
        netRevenue,
        totalInvoiceRevenue,
        totalSalesReceiptRevenue,
        totalCreditMemos,
        totalPaymentsReceived,
        totalExpensesPaid,
        netCashFlow,
        totalAR,
        totalAP,
        netPosition,
        totalOpenPOValue,
        totalUnpaidBills,
        availableCredits,
        avgInvoiceValue,
        avgPaymentValue,
        avgBillValue,
        activeCustomers: customers.length,
        activeVendors: vendors.length,
        openPOsCount: openPOs.length,
        unpaidBillsCount: unpaidBills.length,
      },
      timelines: {
        revenue: revenueTimelineData,
        cashFlow: cashFlowTimelineData,
      },
      top: {
        customers: topCustomers,
        vendors: topVendors,
      },
      cashFlowBreakdown,
      message: 'Master metrics retrieved successfully'
    });

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/master-metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

