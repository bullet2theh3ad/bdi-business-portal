import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';
import * as XLSX from 'xlsx';

/**
 * POST /api/gl-management/bank-statements/upload
 * Upload bank statement CSV or Excel file and store in database
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate batch ID for this upload
    const batchId = crypto.randomUUID();

    // Determine file type and parse accordingly
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    
    let headers: string[];
    let dataRows: string[][];

    if (isExcel) {
      // Parse Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to array of arrays
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (data.length === 0) {
        return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
      }
      
      // First row is headers
      headers = data[0].map((h: any) => String(h || '').trim());
      
      // Rest are data rows
      dataRows = data.slice(1).filter(row => row && row.length > 0).map(row => 
        row.map((cell: any) => String(cell || '').trim())
      );
    } else {
      // Parse CSV file
      const fileContent = await file.text();
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
      }

      // Parse CSV header
      const headerLine = lines[0];
      headers = parseCSVLine(headerLine);
      
      // Parse data rows
      dataRows = lines.slice(1).map(line => parseCSVLine(line));
    }

    // Common column name variations
    const dateColumns = ['date', 'transaction_date', 'transaction date', 'posting_date', 'posting date'];
    const descriptionColumns = ['description', 'memo', 'transaction_description', 'transaction description'];
    const debitColumns = ['debit', 'amount', 'withdrawal', 'withdrawals', 'debit amount'];
    const creditColumns = ['credit', 'deposit', 'deposits', 'credit amount'];
    const balanceColumns = ['balance', 'running_balance', 'running balance', 'ending_balance', 'ending balance'];
    const checkColumns = ['check', 'check_number', 'check number', 'check_num', 'check num'];
    const customerRefColumns = ['customer reference', 'customer_reference', 'cust ref', 'customer ref'];
    const bankRefColumns = ['bank reference', 'bank_reference', 'bank ref', 'reference', 'ref'];
    const accountColumns = ['account', 'account_name', 'account name', 'bank account', 'bank_account'];

    // Find column indices (case insensitive)
    const findColumnIndex = (possibleNames: string[]) => {
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      for (const name of possibleNames) {
        const index = lowerHeaders.indexOf(name.toLowerCase());
        if (index !== -1) return index;
      }
      return -1;
    };

    const dateIdx = findColumnIndex(dateColumns);
    const descIdx = findColumnIndex(descriptionColumns);
    const debitIdx = findColumnIndex(debitColumns);
    const creditIdx = findColumnIndex(creditColumns);
    const balanceIdx = findColumnIndex(balanceColumns);
    const checkIdx = findColumnIndex(checkColumns);
    const customerRefIdx = findColumnIndex(customerRefColumns);
    const bankRefIdx = findColumnIndex(bankRefColumns);
    const accountIdx = findColumnIndex(accountColumns);

    if (dateIdx === -1 || descIdx === -1) {
      return NextResponse.json({
        error: 'Invalid CSV format: missing required columns (date and description)',
        headers: headers,
        foundColumns: {
          date: dateIdx !== -1,
          description: descIdx !== -1,
          debit: debitIdx !== -1,
          credit: creditIdx !== -1,
          balance: balanceIdx !== -1,
          check: checkIdx !== -1,
          customerRef: customerRefIdx !== -1,
          bankRef: bankRefIdx !== -1,
          account: accountIdx !== -1,
        },
        hint: 'Expected columns like: date, description, withdrawals, deposits'
      }, { status: 400 });
    }

    // Parse data rows
    const statements = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const values = dataRows[i];
      if (!values || values.length === 0) continue;

      try {
        
        // Extract values
        const dateStr = values[dateIdx]?.trim();
        const description = values[descIdx]?.trim();
        const debitStr = debitIdx !== -1 ? values[debitIdx]?.trim().replace(/[$,]/g, '') : '';
        const creditStr = creditIdx !== -1 ? values[creditIdx]?.trim().replace(/[$,]/g, '') : '';
        const balanceStr = balanceIdx !== -1 ? values[balanceIdx]?.trim().replace(/[$,]/g, '') : '';
        const checkNumber = checkIdx !== -1 ? values[checkIdx]?.trim() : '';
        const customerRef = customerRefIdx !== -1 ? values[customerRefIdx]?.trim() : '';
        const bankRef = bankRefIdx !== -1 ? values[bankRefIdx]?.trim() : '';
        const accountName = accountIdx !== -1 ? values[accountIdx]?.trim() : '';

        // Validate required fields
        if (!dateStr) {
          errors.push({ line: i + 2, error: 'Missing date', data: values.join(', ').substring(0, 50) });
          continue;
        }
        
        if (!description) {
          errors.push({ line: i + 2, error: 'Missing description', data: values.join(', ').substring(0, 50) });
          continue;
        }

        // Parse date
        let transactionDate;
        try {
          transactionDate = parseDate(dateStr);
        } catch (err) {
          errors.push({ line: i + 2, error: `Invalid date format: ${dateStr}` });
          continue;
        }

        // Parse amounts
        const debit = debitStr ? parseFloat(debitStr) || 0 : 0;
        const credit = creditStr ? parseFloat(creditStr) || 0 : 0;
        const balance = balanceStr ? parseFloat(balanceStr) || null : null;
        
        // Calculate net amount (credit - debit for bank perspective)
        const amount = credit - debit;

        statements.push({
          transaction_date: transactionDate,
          description,
          amount, // Net amount
          debit: debit > 0 ? debit : null,
          credit: credit > 0 ? credit : null,
          balance,
          reference_number: checkNumber || bankRef || customerRef || null,
          bank_account_name: accountName || null,
          original_line: values.join('|').substring(0, 500), // Store for debugging
          category: 'unassigned',
          high_level_category: 'unassigned',
          notes: null,
          is_matched: false,
          matched_qb_transaction_type: null,
          matched_qb_transaction_id: null,
          upload_batch_id: batchId,
          created_by: user.id,
        });

      } catch (err) {
        errors.push({ line: i + 2, error: err instanceof Error ? err.message : 'Parse error' });
      }
    }

    if (statements.length === 0) {
      return NextResponse.json({
        error: 'No valid statements to import',
        errors,
      }, { status: 400 });
    }

    // Bulk insert
    const { data: inserted, error: insertError } = await supabaseService
      .from('bank_statements')
      .insert(statements)
      .select();

    if (insertError) {
      console.error('Error inserting bank statements:', insertError);
      return NextResponse.json({
        error: 'Failed to save bank statements',
        details: insertError.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      batchId,
      imported: inserted?.length || 0,
      skipped: dataRows.length - statements.length,
      totalLines: dataRows.length,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined, // Show first 20 errors
      totalErrors: errors.length,
      message: `Successfully imported ${inserted?.length || 0} of ${dataRows.length} bank statement transactions`,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/gl-management/bank-statements/upload:', error);
    return NextResponse.json(
      { error: 'Failed to upload bank statements', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse date from various formats including Excel date numbers
 */
function parseDate(dateStr: string): string {
  // Handle Excel date numbers (days since 1900-01-01)
  const num = parseFloat(dateStr);
  if (!isNaN(num) && num > 0 && num < 100000) {
    // Excel date number
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch is Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + num * 86400000); // Add days in milliseconds
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Format: YYYY-MM-DD (already correct)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Format: MM/DD/YYYY or M/D/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format: MM-DD-YYYY or M-D-YYYY
  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const month = dashMatch[1].padStart(2, '0');
    const day = dashMatch[2].padStart(2, '0');
    const year = dashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try JavaScript Date parsing as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  throw new Error(`Unable to parse date: ${dateStr}`);
}

