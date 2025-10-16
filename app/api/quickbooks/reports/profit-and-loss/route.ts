import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * QuickBooks Profit & Loss (P&L) Report API
 * 
 * This endpoint fetches the actual P&L report from QuickBooks,
 * which includes ALL expenses categorized properly (not just Cash purchases).
 * 
 * The P&L Report shows:
 * - Income (by account/category)
 * - Cost of Goods Sold (COGS)
 * - Expenses (by account/category) - THIS IS THE KEY
 * - Net Income
 * 
 * Use this for complete expense visibility, not just the Purchase/Expense entities.
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
        { error: 'No active QuickBooks connection found' },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || getFirstDayOfYear();
    const endDate = searchParams.get('end_date') || getTodayDate();
    const accountingMethod = searchParams.get('accounting_method') || 'Accrual'; // Accrual or Cash
    const summarizeColumnBy = searchParams.get('summarize_column_by') || 'Month'; // Month, Quarter, Year, Total

    console.log('📊 Fetching P&L Report:', { startDate, endDate, accountingMethod, summarizeColumnBy });

    // Determine API base URL
    const apiBaseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    // Fetch P&L Report from QuickBooks
    const reportUrl = `${apiBaseUrl}/v3/company/${connection.realm_id}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&accounting_method=${accountingMethod}&summarize_column_by=${summarizeColumnBy}`;
    
    const reportResponse = await fetch(reportUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${connection.access_token}`,
      },
    });

    if (!reportResponse.ok) {
      const errorBody = await reportResponse.text();
      console.error('QuickBooks P&L Report API Error:', errorBody);
      return NextResponse.json(
        { 
          error: 'Failed to fetch P&L Report from QuickBooks',
          details: errorBody,
          status: reportResponse.status
        },
        { status: reportResponse.status }
      );
    }

    const reportData = await reportResponse.json();

    // Extract key metrics from P&L
    const columns = reportData.Columns?.Column || [];
    const rows = reportData.Rows?.Row || [];

    // Parse the report structure
    const parsedReport = parseProfitAndLoss(reportData);

    return NextResponse.json({
      success: true,
      reportName: reportData.Header?.ReportName,
      reportDate: reportData.Header?.Time,
      currency: reportData.Header?.Currency,
      startDate,
      endDate,
      accountingMethod,
      rawData: reportData, // Full QuickBooks report structure
      parsed: parsedReport, // Simplified structure for UI
      message: 'P&L Report fetched successfully'
    });

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/profit-and-loss:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Parse QuickBooks P&L Report into a simplified structure
 */
function parseProfitAndLoss(reportData: any) {
  const rows = reportData.Rows?.Row || [];
  const parsed: any = {
    income: { total: 0, categories: [] },
    cogs: { total: 0, categories: [] },
    expenses: { total: 0, categories: [] },
    netIncome: 0,
  };

  // QuickBooks P&L structure:
  // - Income section
  // - COGS section  
  // - Gross Profit
  // - Expenses section
  // - Net Income

  for (const row of rows) {
    if (row.type === 'Section') {
      const sectionName = row.Header?.ColData?.[0]?.value || '';
      
      if (sectionName.toLowerCase().includes('income')) {
        parsed.income = parseSection(row);
      } else if (sectionName.toLowerCase().includes('cost of goods sold')) {
        parsed.cogs = parseSection(row);
      } else if (sectionName.toLowerCase().includes('expenses')) {
        parsed.expenses = parseSection(row);
      }
    } else if (row.type === 'Data' && row.Summary) {
      const label = row.Summary?.ColData?.[0]?.value || '';
      const amount = parseFloat(row.Summary?.ColData?.[1]?.value || '0');
      
      if (label.toLowerCase().includes('net income') || label.toLowerCase().includes('net operating income')) {
        parsed.netIncome = amount;
      }
    }
  }

  return parsed;
}

/**
 * Parse a P&L section (Income, COGS, or Expenses)
 */
function parseSection(section: any) {
  const categories: any[] = [];
  let total = 0;

  const rows = section.Rows?.Row || [];
  
  for (const row of rows) {
    if (row.type === 'Data' && row.ColData) {
      const name = row.ColData[0]?.value || '';
      const amount = parseFloat(row.ColData[1]?.value || '0');
      
      if (name && !name.toLowerCase().includes('total')) {
        categories.push({
          name,
          amount,
          id: row.ColData[0]?.id || null,
        });
      }
    } else if (row.Summary) {
      // This is the section total
      total = parseFloat(row.Summary.ColData[1]?.value || '0');
    }
  }

  return { total, categories };
}

/**
 * Get first day of current year
 */
function getFirstDayOfYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

