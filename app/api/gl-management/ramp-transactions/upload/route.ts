import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * POST /api/gl-management/ramp-transactions/upload
 * Handle Ramp Register XLS/XLSX file upload
 * Row 1 contains title header, Row 2 contains column headers, Data starts at Row 3
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

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON, starting from row 3 (skip title row 1 and header row 2)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      range: 2, // Start from row 3 (0-indexed, so 2 = row 3)
      defval: null,
      raw: false // Get formatted values
    });

    console.log(`📊 [Ramp Upload] Parsed ${jsonData.length} rows from file`);

    // Use service role for database operations
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

    const transactions: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row: any = jsonData[i];
      
      try {
        // Map Excel columns to database fields
        const transaction = {
          transaction_date: parseExcelDate(row['Date']),
          ref_no: row['Ref No.'] || null,
          payee: row['Payee'] || null,
          memo: row['Memo'] || null,
          class: row['Class'] || null,
          foreign_currency: row['Foreign Currency'] || null,
          charge_usd: parseAmount(row['Charge (USD)']),
          payment_usd: parseAmount(row['Payment (USD)']),
          reconciliation_status: row['Reconciliation Status'] || null,
          balance_usd: parseAmount(row['Balance (USD)']),
          type: row['Type'] || null,
          account: row['Account'] || null,
          store: row['Store'] || null,
          exchange_rate: row['Exchange Rate'] || null,
          added_in_banking: row['Added in Banking'] || null,
          category: 'unassigned',
          account_type: 'Unclassified',
          uploaded_by: user.id,
          created_by: user.id,
          original_line: JSON.stringify(row),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Validate required fields
        if (!transaction.transaction_date) {
          errors.push(`Row ${i + 3}: Missing transaction date`);
          continue;
        }

        transactions.push(transaction);
      } catch (error: any) {
        errors.push(`Row ${i + 3}: ${error.message}`);
        console.error(`Error parsing row ${i + 3}:`, error);
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { 
          error: 'No valid transactions to import', 
          details: errors 
        },
        { status: 400 }
      );
    }

    // Insert transactions
    const { data, error: insertError } = await supabaseService
      .from('ramp_transactions')
      .insert(transactions)
      .select();

    if (insertError) {
      console.error('Error inserting Ramp transactions:', insertError);
      return NextResponse.json(
        { error: 'Failed to save transactions', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`✅ [Ramp Upload] Successfully imported ${data?.length || 0} transactions`);

    return NextResponse.json({
      success: true,
      imported: data?.length || 0,
      skipped: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('Error uploading Ramp file:', error);
    return NextResponse.json(
      { error: 'Failed to process file', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to parse Excel date
function parseExcelDate(value: any): string | null {
  if (!value) return null;

  // If it's already a date string
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // If it's an Excel date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }

  return null;
}

// Helper function to parse amount
function parseAmount(value: any): number | null {
  if (!value) return null;
  
  // Remove currency symbols, commas, etc.
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

