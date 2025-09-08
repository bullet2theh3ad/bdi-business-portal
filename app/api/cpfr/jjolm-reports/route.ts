import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, jjolmTracking, jjolmHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

    // Get all JJOLM records for dropdown
    const jjolmRecords = await db
      .select({
        id: jjolmTracking.id,
        jjolmNumber: jjolmTracking.jjolmNumber,
        customerReferenceNumber: jjolmTracking.customerReferenceNumber,
        mode: jjolmTracking.mode,
        origin: jjolmTracking.origin,
        destination: jjolmTracking.destination,
        status: jjolmTracking.status,
        pickupDate: jjolmTracking.pickupDate,
        deliveryDate: jjolmTracking.deliveryDate,
        estimatedDeliveryDate: jjolmTracking.estimatedDeliveryDate,
        lastUpdated: jjolmTracking.lastUpdated,
        updateCount: jjolmTracking.updateCount,
      })
      .from(jjolmTracking)
      .orderBy(jjolmTracking.lastUpdated);

    return NextResponse.json({
      success: true,
      data: jjolmRecords,
      count: jjolmRecords.length
    });

  } catch (error) {
    console.error('Error fetching JJOLM records:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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

    // Get the requesting user
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins and super admins can upload JJOLM reports
    if (!['admin', 'super_admin'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only Excel files (.xlsx, .xls) are supported.' 
      }, { status: 400 });
    }

    // Validate filename pattern
    const fileName = file.name;
    const expectedPattern = /^BOUNDLESS-DEVICES-SHIPMENT-REPORT_.*\.(xlsx|xls)$/i;
    
    if (!expectedPattern.test(fileName)) {
      return NextResponse.json({ 
        error: 'Invalid filename. Expected format: BOUNDLESS-DEVICES-SHIPMENT-REPORT_[date].xlsx' 
      }, { status: 400 });
    }

    console.log(`📊 Processing JJOLM report: ${fileName}`);

    // Parse Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return NextResponse.json({ 
        error: 'Excel file must contain at least a header row and one data row' 
      }, { status: 400 });
    }

    // Find header row (first row with data below row 1)
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (row && row.length > 0 && row.some(cell => cell && typeof cell === 'string')) {
        // Check if this looks like a header row
        const potentialHeaders = row.map(cell => String(cell || '').trim()).filter(h => h);
        if (potentialHeaders.length >= 3) {
          headers = potentialHeaders;
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ 
        error: 'Could not find header row in Excel file' 
      }, { status: 400 });
    }

    console.log(`📋 Found headers at row ${headerRowIndex + 1}:`, headers);

    // Find required columns
    const requiredColumns = {
      mode: -1,
      shipmentReferenceNumber: -1,
      customerReferenceNumber: -1,
    };

    // Map headers to column indexes (case-insensitive)
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      
      if (normalizedHeader.includes('mode')) {
        requiredColumns.mode = index;
      } else if (normalizedHeader.includes('shipment') && normalizedHeader.includes('reference')) {
        requiredColumns.shipmentReferenceNumber = index;
      } else if (normalizedHeader.includes('customer') && normalizedHeader.includes('reference')) {
        requiredColumns.customerReferenceNumber = index;
      }
    });

    // Validate required columns found
    if (requiredColumns.shipmentReferenceNumber === -1) {
      return NextResponse.json({ 
        error: 'Required column "Shipment Reference Number" not found in Excel file' 
      }, { status: 400 });
    }

    console.log('📍 Column mapping:', requiredColumns);

    // Process data rows
    const dataRows = jsonData.slice(headerRowIndex + 1) as any[][];
    const processedRecords = [];
    const errors = [];
    let newRecords = 0;
    let updatedRecords = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      try {
        // Extract JJOLM number
        const jjolmNumber = String(row[requiredColumns.shipmentReferenceNumber] || '').trim();
        if (!jjolmNumber) {
          continue; // Skip empty JJOLM numbers
        }

        // Extract other data
        const mode = requiredColumns.mode >= 0 ? String(row[requiredColumns.mode] || '').trim() : '';
        const customerRef = requiredColumns.customerReferenceNumber >= 0 ? 
          String(row[requiredColumns.customerReferenceNumber] || '').trim() : '';

        // Build additional data from remaining columns
        const additionalData: any = {};
        headers.forEach((header, colIndex) => {
          if (colIndex !== requiredColumns.mode && 
              colIndex !== requiredColumns.shipmentReferenceNumber && 
              colIndex !== requiredColumns.customerReferenceNumber) {
            const value = row[colIndex];
            if (value !== undefined && value !== null && value !== '') {
              additionalData[header] = value;
            }
          }
        });

        // Check if record exists
        const [existingRecord] = await db
          .select()
          .from(jjolmTracking)
          .where(eq(jjolmTracking.jjolmNumber, jjolmNumber))
          .limit(1);

        if (existingRecord) {
          // Update existing record
          const changes: any[] = [];
          
          // Track what changed for history
          if (existingRecord.mode !== mode) {
            changes.push({ field: 'mode', oldValue: existingRecord.mode, newValue: mode });
          }
          if (existingRecord.customerReferenceNumber !== customerRef) {
            changes.push({ field: 'customerReferenceNumber', oldValue: existingRecord.customerReferenceNumber, newValue: customerRef });
          }

          // Update record
          await db
            .update(jjolmTracking)
            .set({
              mode: mode || existingRecord.mode,
              customerReferenceNumber: customerRef || existingRecord.customerReferenceNumber,
              additionalData,
              sourceFileName: fileName,
              uploadedBy: requestingUser.authId,
            })
            .where(eq(jjolmTracking.jjolmNumber, jjolmNumber));

          // Log changes to history
          for (const change of changes) {
            await db.insert(jjolmHistory).values({
              jjolmNumber,
              fieldName: change.field,
              oldValue: change.oldValue,
              newValue: change.newValue,
              changedBy: requestingUser.authId,
              sourceFileName: fileName,
              jjolmTrackingId: existingRecord.id,
            });
          }

          updatedRecords++;
        } else {
          // Create new record
          await db.insert(jjolmTracking).values({
            jjolmNumber,
            mode,
            customerReferenceNumber: customerRef,
            additionalData,
            sourceFileName: fileName,
            uploadedBy: requestingUser.authId,
          });

          newRecords++;
        }

        processedRecords.push({ jjolmNumber, mode, customerRef });

      } catch (rowError) {
        console.error(`Error processing row ${i + headerRowIndex + 2}:`, rowError);
        errors.push(`Row ${i + headerRowIndex + 2}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    console.log(`✅ JJOLM processing complete: ${newRecords} new, ${updatedRecords} updated, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedRecords.length} JJOLM records`,
      summary: {
        totalProcessed: processedRecords.length,
        newRecords,
        updatedRecords,
        errors: errors.length,
        fileName,
      },
      data: {
        processed: processedRecords.slice(0, 10), // First 10 for preview
        errors: errors.slice(0, 5), // First 5 errors
      }
    });

  } catch (error) {
    console.error('Error processing JJOLM report:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
