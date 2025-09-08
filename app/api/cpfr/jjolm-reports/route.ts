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

    // Find all relevant columns
    const columnMapping = {
      // Required columns
      mode: -1,
      shipmentReferenceNumber: -1,
      customerReferenceNumber: -1,
      
      // Optional but important columns
      origin: -1,
      destination: -1,
      carrier: -1,
      serviceType: -1,
      status: -1,
      trackingNumber: -1,
      
      // Date columns
      pickupDate: -1,
      deliveryDate: -1,
      estimatedDeliveryDate: -1,
      shipDate: -1,
      etd: -1,
      eta: -1,
    };

    // Map headers to column indexes (case-insensitive, flexible matching)
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      
      // Mode column
      if (normalizedHeader.includes('mode')) {
        columnMapping.mode = index;
      }
      // Shipment reference (JJOLM number)
      else if (normalizedHeader.includes('shipment') && normalizedHeader.includes('reference')) {
        columnMapping.shipmentReferenceNumber = index;
      }
      // Customer reference
      else if (normalizedHeader.includes('customer') && normalizedHeader.includes('reference')) {
        columnMapping.customerReferenceNumber = index;
      }
      // Origin/From
      else if (normalizedHeader.includes('origin') || normalizedHeader.includes('from') || normalizedHeader.includes('pickup')) {
        columnMapping.origin = index;
      }
      // Destination/To
      else if (normalizedHeader.includes('destination') || normalizedHeader.includes('to') || normalizedHeader.includes('delivery location')) {
        columnMapping.destination = index;
      }
      // Carrier/Shipping line
      else if (normalizedHeader.includes('carrier') || normalizedHeader.includes('shipping') || normalizedHeader.includes('line')) {
        columnMapping.carrier = index;
      }
      // Service type
      else if (normalizedHeader.includes('service') && (normalizedHeader.includes('type') || normalizedHeader.includes('level'))) {
        columnMapping.serviceType = index;
      }
      // Status
      else if (normalizedHeader.includes('status') || normalizedHeader.includes('state')) {
        columnMapping.status = index;
      }
      // Tracking number
      else if (normalizedHeader.includes('tracking') && normalizedHeader.includes('number')) {
        columnMapping.trackingNumber = index;
      }
      // Dates - pickup/ship
      else if ((normalizedHeader.includes('pickup') || normalizedHeader.includes('ship')) && normalizedHeader.includes('date')) {
        columnMapping.pickupDate = index;
      }
      // Dates - delivery
      else if (normalizedHeader.includes('delivery') && normalizedHeader.includes('date')) {
        columnMapping.deliveryDate = index;
      }
      // Dates - estimated delivery
      else if (normalizedHeader.includes('estimated') && normalizedHeader.includes('delivery')) {
        columnMapping.estimatedDeliveryDate = index;
      }
      // ETD/ETA
      else if (normalizedHeader === 'etd' || normalizedHeader.includes('estimated departure')) {
        columnMapping.etd = index;
      }
      else if (normalizedHeader === 'eta' || normalizedHeader.includes('estimated arrival')) {
        columnMapping.eta = index;
      }
    });

    // Validate required columns found
    if (columnMapping.shipmentReferenceNumber === -1) {
      return NextResponse.json({ 
        error: 'Required column "Shipment Reference Number" not found in Excel file' 
      }, { status: 400 });
    }

    console.log('📍 Column mapping:', columnMapping);
    
    // Log which columns were found
    const foundColumns = Object.entries(columnMapping).filter(([key, index]) => index !== -1);
    console.log('✅ Found columns:', foundColumns.map(([key, index]) => `${key}: ${headers[index]} (col ${index})`));

    // Process data rows
    const dataRows = jsonData.slice(headerRowIndex + 1) as any[][];
    console.log('📋 Sample first data row:', dataRows[0]);
    const processedRecords = [];
    const errors = [];
    let newRecords = 0;
    let updatedRecords = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      try {
        // Extract JJOLM number
        const jjolmNumber = String(row[columnMapping.shipmentReferenceNumber] || '').trim();
        if (!jjolmNumber) {
          continue; // Skip empty JJOLM numbers
        }

        // Helper function to extract and clean data
        const extractData = (columnIndex: number) => {
          if (columnIndex === -1) return null;
          const value = row[columnIndex];
          if (value === undefined || value === null || value === '') return null;
          return String(value).trim();
        };

        // Helper function to parse dates
        const parseDate = (columnIndex: number) => {
          const value = extractData(columnIndex);
          if (!value) return null;
          
          try {
            // Try parsing as Excel serial date first
            if (!isNaN(Number(value))) {
              const excelDate = new Date((Number(value) - 25569) * 86400 * 1000);
              if (excelDate.getFullYear() > 1900) {
                return excelDate.toISOString().split('T')[0]; // YYYY-MM-DD format
              }
            }
            
            // Try parsing as regular date string
            const parsedDate = new Date(value);
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate.toISOString().split('T')[0];
            }
          } catch (error) {
            console.warn(`Could not parse date: ${value}`);
          }
          
          return value; // Return original value if parsing fails
        };

        // Extract all mapped data
        const extractedData = {
          mode: extractData(columnMapping.mode),
          customerReferenceNumber: extractData(columnMapping.customerReferenceNumber),
          origin: extractData(columnMapping.origin),
          destination: extractData(columnMapping.destination),
          carrier: extractData(columnMapping.carrier),
          serviceType: extractData(columnMapping.serviceType),
          status: extractData(columnMapping.status),
          trackingNumber: extractData(columnMapping.trackingNumber),
          
          // Parse dates
          pickupDate: parseDate(columnMapping.pickupDate) || parseDate(columnMapping.shipDate),
          deliveryDate: parseDate(columnMapping.deliveryDate),
          estimatedDeliveryDate: parseDate(columnMapping.estimatedDeliveryDate) || parseDate(columnMapping.eta),
        };

        // Log extracted data for first few records
        if (i < 3) {
          console.log(`📊 Row ${i + 1} extracted data for ${jjolmNumber}:`, extractedData);
        }

        // Build additional data from remaining columns (not already mapped)
        const additionalData: any = {};
        const mappedColumns = Object.values(columnMapping);
        headers.forEach((header, colIndex) => {
          if (!mappedColumns.includes(colIndex)) {
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
          // Update existing record - track all changes for history
          const changes: any[] = [];
          
          // Compare all fields and track changes
          const fieldsToCheck = [
            { field: 'mode', oldValue: existingRecord.mode, newValue: extractedData.mode },
            { field: 'customerReferenceNumber', oldValue: existingRecord.customerReferenceNumber, newValue: extractedData.customerReferenceNumber },
            { field: 'origin', oldValue: existingRecord.origin, newValue: extractedData.origin },
            { field: 'destination', oldValue: existingRecord.destination, newValue: extractedData.destination },
            { field: 'carrier', oldValue: existingRecord.carrier, newValue: extractedData.carrier },
            { field: 'serviceType', oldValue: existingRecord.serviceType, newValue: extractedData.serviceType },
            { field: 'status', oldValue: existingRecord.status, newValue: extractedData.status },
            { field: 'trackingNumber', oldValue: existingRecord.trackingNumber, newValue: extractedData.trackingNumber },
            { field: 'pickupDate', oldValue: existingRecord.pickupDate, newValue: extractedData.pickupDate },
            { field: 'deliveryDate', oldValue: existingRecord.deliveryDate, newValue: extractedData.deliveryDate },
            { field: 'estimatedDeliveryDate', oldValue: existingRecord.estimatedDeliveryDate, newValue: extractedData.estimatedDeliveryDate },
          ];

          for (const fieldCheck of fieldsToCheck) {
            if (fieldCheck.oldValue !== fieldCheck.newValue && fieldCheck.newValue !== null) {
              changes.push(fieldCheck);
            }
          }

          // Update record with all new data
          await db
            .update(jjolmTracking)
            .set({
              mode: extractedData.mode || existingRecord.mode,
              customerReferenceNumber: extractedData.customerReferenceNumber || existingRecord.customerReferenceNumber,
              origin: extractedData.origin || existingRecord.origin,
              destination: extractedData.destination || existingRecord.destination,
              carrier: extractedData.carrier || existingRecord.carrier,
              serviceType: extractedData.serviceType || existingRecord.serviceType,
              status: extractedData.status || existingRecord.status,
              trackingNumber: extractedData.trackingNumber || existingRecord.trackingNumber,
              pickupDate: extractedData.pickupDate || existingRecord.pickupDate,
              deliveryDate: extractedData.deliveryDate || existingRecord.deliveryDate,
              estimatedDeliveryDate: extractedData.estimatedDeliveryDate || existingRecord.estimatedDeliveryDate,
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
          // Create new record with all extracted data
          await db.insert(jjolmTracking).values({
            jjolmNumber,
            mode: extractedData.mode,
            customerReferenceNumber: extractedData.customerReferenceNumber,
            origin: extractedData.origin,
            destination: extractedData.destination,
            carrier: extractedData.carrier,
            serviceType: extractedData.serviceType,
            status: extractedData.status,
            trackingNumber: extractedData.trackingNumber,
            pickupDate: extractedData.pickupDate,
            deliveryDate: extractedData.deliveryDate,
            estimatedDeliveryDate: extractedData.estimatedDeliveryDate,
            additionalData,
            sourceFileName: fileName,
            uploadedBy: requestingUser.authId,
          });

          newRecords++;
        }

        processedRecords.push({ 
          jjolmNumber, 
          mode: extractedData.mode,
          customerRef: extractedData.customerReferenceNumber,
          origin: extractedData.origin,
          destination: extractedData.destination,
          status: extractedData.status,
        });

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
