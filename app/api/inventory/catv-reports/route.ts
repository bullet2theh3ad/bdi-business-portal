import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, catvInventoryTracking } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return placeholder data until we implement the full system
    return NextResponse.json({
      success: true,
      data: {
        weeklyMetrics: [],
        pivotData: [],
        lastUpdated: null
      }
    });

  } catch (error) {
    console.error('Error fetching CATV inventory data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch CATV inventory data' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 CATV API POST request received');
    
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    console.log('👤 Auth user:', authUser ? 'Found' : 'Not found');
    
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user exists and has appropriate permissions
    console.log('🔍 Looking up user in database...');
    const dbUser = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    console.log('👤 DB user found:', dbUser.length > 0 ? 'Yes' : 'No');
    
    if (!dbUser.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('🔐 User role:', dbUser[0].role);
    
    // For now, only allow super_admin to upload CATV reports
    if (dbUser[0].role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an XLS or XLSX file.' }, { status: 400 });
    }

    console.log(`📊 Processing CATV inventory file: ${file.name} (${file.size} bytes)`);

    // Read and parse the Excel file
    const buffer = await file.arrayBuffer();
    console.log(`📥 File buffer size: ${buffer.byteLength} bytes`);
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log(`📋 CATV file sheets:`, workbook.SheetNames);
    
    if (!workbook.SheetNames.length) {
      console.error('❌ No sheets found in workbook');
      return NextResponse.json({ error: 'No sheets found in the uploaded file' }, { status: 400 });
    }

    // Process Tab 1 (Summary metrics)
    const summarySheetName = workbook.SheetNames[0];
    const summarySheet = workbook.Sheets[summarySheetName];
    const summaryData = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
    
    console.log(`📊 Summary sheet "${summarySheetName}" has ${summaryData.length} rows`);
    console.log(`📊 Summary data preview:`, summaryData.slice(0, 5));

    // Process Tab 2 (Pivot data)
    let pivotData: any[] = [];
    if (workbook.SheetNames.length > 1) {
      const pivotSheetName = workbook.SheetNames[1];
      const pivotSheet = workbook.Sheets[pivotSheetName];
      pivotData = XLSX.utils.sheet_to_json(pivotSheet, { header: 1 });
      
      console.log(`📋 Pivot sheet "${pivotSheetName}" has ${pivotData.length} rows`);
      console.log(`📋 Pivot data preview:`, pivotData.slice(0, 3));
    }

    // Extract the 4 key metrics from the summary data
    // Looking for: Received (IN), Shipped via Jira (OUT), Shipped to EMG (OUT), WIP (IN HOUSE)
    let metrics = {
      receivedIn: 0,
      shippedJiraOut: 0, 
      shippedEmgOut: 0,
      wipInHouse: 0
    };

    // Parse the summary data to extract weekly metrics
    console.log(`🔍 Parsing CATV metrics from ${summaryData.length} rows`);
    
    // Find the metrics rows in the summary data
    for (const row of summaryData) {
      if (Array.isArray(row) && row.length > 0) {
        const firstCell = row[0];
        if (typeof firstCell === 'string') {
          if (firstCell.includes('Received (IN)')) {
            // Sum all numeric values EXCLUDING the Grand Total column (last column)
            const weeklyValues = row.slice(1, -1); // Exclude first cell (label) and last cell (Grand Total)
            metrics.receivedIn = weeklyValues.reduce((sum: number, val: any) => {
              return sum + (typeof val === 'number' ? val : 0);
            }, 0);
            console.log(`📈 Received (IN) weekly sum: ${metrics.receivedIn} (excluding Grand Total)`);
            console.log(`📈 Grand Total in file: ${row[row.length - 1]} (should match calculated sum)`);
          } else if (firstCell.includes('Shipped Via Jira (OUT)')) {
            // Sum all numeric values EXCLUDING the Grand Total column (last column)
            const weeklyValues = row.slice(1, -1); // Exclude first cell (label) and last cell (Grand Total)
            metrics.shippedJiraOut = weeklyValues.reduce((sum: number, val: any) => {
              return sum + (typeof val === 'number' ? val : 0);
            }, 0);
            console.log(`📈 Shipped Via Jira (OUT) weekly sum: ${metrics.shippedJiraOut} (excluding Grand Total)`);
            console.log(`📈 Grand Total in file: ${row[row.length - 1]} (should match calculated sum)`);
          } else if (firstCell.includes('Count of EMG Shipped (OUT)')) {
            // Sum all numeric values EXCLUDING the Grand Total column (last column)
            const weeklyValues = row.slice(1, -1); // Exclude first cell (label) and last cell (Grand Total)
            metrics.shippedEmgOut = weeklyValues.reduce((sum: number, val: any) => {
              return sum + (typeof val === 'number' ? val : 0);
            }, 0);
            console.log(`📈 Shipped to EMG (OUT) weekly sum: ${metrics.shippedEmgOut} (excluding Grand Total)`);
            console.log(`📈 Grand Total in file: ${row[row.length - 1]} (should match calculated sum)`);
          } else if (firstCell.includes('WIP')) {
            // Sum all numeric values EXCLUDING the Grand Total column (last column)
            const weeklyValues = row.slice(1, -1); // Exclude first cell (label) and last cell (Grand Total)
            metrics.wipInHouse = weeklyValues.reduce((sum: number, val: any) => {
              return sum + (typeof val === 'number' ? val : 0);
            }, 0);
            console.log(`📈 WIP (IN HOUSE) weekly sum: ${metrics.wipInHouse} (excluding Grand Total)`);
            console.log(`📈 Grand Total in file: ${row[row.length - 1]} (should match calculated sum)`);
          }
        }
      }
    }

    // Process and format the pivot data for display
    const formattedPivotData = pivotData.slice(1).map((row: any) => {
      if (Array.isArray(row) && row.length > 0) {
        // Convert Excel date number to readable date
        const excelDate = row[4]; // datestamp column
        let formattedDate = '';
        if (typeof excelDate === 'number') {
          // Excel date conversion: Excel epoch starts Jan 1, 1900
          const excelEpoch = new Date(1900, 0, 1);
          const jsDate = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
          formattedDate = jsDate.toLocaleDateString();
        } else {
          formattedDate = excelDate || '';
        }

        return {
          lineitem: row[0] || '',
          serialnumber: row[1] || '',
          modelnumber: row[2] || '',
          iso_yearweek: row[3] || '',
          datestamp: formattedDate, // Formatted date
          emg_iso_yearweek: row[5] || '',
          emg_ship_date: row[6] || '',
          shipped_to_emg: row[7] || 0,
          shipped_to_jira: row[8] || 0,
          transferinvoice: row[9] || '',
          jira_iso_yearweek: row[10] || '',
          invoicedate: row[11] || '',
          wip: row[12] || 0
        };
      }
      return null;
    }).filter(item => item !== null);

    console.log(`📋 Formatted ${formattedPivotData.length} pivot records`);
    console.log(`📋 Sample formatted record:`, formattedPivotData[0]);

    return NextResponse.json({
      success: true,
      message: `Successfully processed CATV inventory file: ${file.name}`,
      data: {
        fileName: file.name,
        fileSize: file.size,
        summaryRows: summaryData.length,
        pivotRows: pivotData.length,
        metrics: metrics,
        sheets: workbook.SheetNames,
        uploadDate: new Date().toISOString(),
        pivotData: formattedPivotData // Include all formatted pivot data
      }
    });

  } catch (error) {
    console.error('Error processing CATV inventory file:', error);
    return NextResponse.json({ 
      error: 'Failed to process CATV inventory file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
