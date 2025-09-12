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

    // Verify user exists and has appropriate permissions
    const dbUser = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    console.log(`📋 CATV file sheets:`, workbook.SheetNames);

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
    const metrics = {
      receivedIn: 0,
      shippedJiraOut: 0, 
      shippedEmgOut: 0,
      wipInHouse: 0
    };

    // Parse the summary data to extract weekly metrics
    // This will need to be customized based on the actual file structure
    console.log(`🔍 Parsing CATV metrics from ${summaryData.length} rows`);

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
        uploadDate: new Date().toISOString()
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
