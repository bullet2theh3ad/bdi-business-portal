import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, emgInventoryTracking, emgInventoryHistory, organizations, organizationMembers, productSkus } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

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

    // Get user's organization for filtering
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's organization membership
    const userOrgMembership = await db
      .select({
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type,
        }
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    const isBDIUser = userOrgMembership.length > 0 && 
      userOrgMembership[0].organization.code === 'BDI' && 
      userOrgMembership[0].organization.type === 'internal';

    // Get allowed SKU codes for this organization (partner orgs only see their SKUs)
    let allowedSkuCodes: string[] = [];
    
    if (!isBDIUser && userOrgMembership.length > 0) {
      const userOrganization = userOrgMembership[0].organization;
      console.log(`🔒 Partner org ${userOrganization.code} - filtering EMG inventory by owned SKUs`);
      
      // Get SKUs that this organization OWNS (by manufacturer) - same logic as warehouse summary
      const ownedSkus = await db
        .select({
          sku: productSkus.sku,
          model: productSkus.model,
        })
        .from(productSkus)
        .where(eq(productSkus.mfg, userOrganization.code!));
      
      allowedSkuCodes = ownedSkus.map(s => s.sku);
      const allowedModels = ownedSkus.map(s => s.model).filter(m => m !== null);
      
      // Combine both SKU and model for matching (EMG uses "model" field)
      allowedSkuCodes = [...new Set([...allowedSkuCodes, ...allowedModels])];
      
      console.log(`🔍 Partner ${userOrganization.code} allowed SKUs/Models:`, allowedSkuCodes);
      
      if (allowedSkuCodes.length === 0) {
        console.log(`⚠️  No SKUs found for ${userOrganization.code} - returning empty inventory`);
        return NextResponse.json({
          success: true,
          data: {
            currentInventory: [],
            history: [],
            summary: {
              totalSkus: 0,
              totalOnHand: 0,
              totalAllocated: 0,
              totalBackorder: 0,
            }
          }
        });
      }
    }

    // Get current inventory (latest snapshot per SKU) with organization filtering
    let currentInventory = await db
      .select()
      .from(emgInventoryTracking)
      .orderBy(desc(emgInventoryTracking.uploadDate));

    // Get inventory history for charts (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let inventoryHistory = await db
      .select()
      .from(emgInventoryHistory)
      .orderBy(desc(emgInventoryHistory.snapshotDate));

    // Apply fuzzy matching filter for partner organizations
    if (!isBDIUser && allowedSkuCodes.length > 0) {
      console.log(`🔍 Applying fuzzy matching for EMG inventory...`);
      
      // Extract base SKU prefixes for fuzzy matching (e.g., "MNQ1525" from "MNQ1525-30W-U")
      const skuPrefixes = allowedSkuCodes.map(sku => {
        // Extract the main part before the first dash or full string if no dash
        const match = sku.match(/^([A-Z]+\d+)/i);
        return match ? match[1] : sku;
      });
      
      const uniquePrefixes = [...new Set(skuPrefixes)];
      console.log(`🔍 SKU prefixes for fuzzy matching:`, uniquePrefixes);
      
      // Filter current inventory using fuzzy matching
      currentInventory = currentInventory.filter((item: any) => {
        if (!item.model) return false;
        const itemModel = item.model.toUpperCase();
        
        // Check if the EMG model starts with any of our SKU prefixes
        return uniquePrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
      
      // Filter inventory history using fuzzy matching
      inventoryHistory = inventoryHistory.filter((item: any) => {
        if (!item.model) return false;
        const itemModel = item.model.toUpperCase();
        
        // Check if the EMG model starts with any of our SKU prefixes
        return uniquePrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
      
      console.log(`🔍 After fuzzy matching: ${currentInventory.length} current items, ${inventoryHistory.length} history items`);
    }

    // Filter out items with zero inventory and sort by total quantity
    const filteredInventory = currentInventory
      .filter(item => {
        const totalQty = (item.qtyOnHand || 0) + (item.qtyAllocated || 0) + (item.qtyBackorder || 0);
        return totalQty > 0; // Only show items with actual inventory
      })
      .sort((a, b) => {
        const aTotal = (a.qtyOnHand || 0) + (a.qtyAllocated || 0) + (a.qtyBackorder || 0);
        const bTotal = (b.qtyOnHand || 0) + (b.qtyAllocated || 0) + (b.qtyBackorder || 0);
        return bTotal - aTotal; // Sort by total quantity descending
      });

    console.log(`📊 EMG Inventory: ${currentInventory.length} total items, ${filteredInventory.length} with inventory`);
    
    // DEBUG: Check if MT7711-10 is in the filtered results
    const mt7711Item = filteredInventory.find(item => item.model === 'MT7711-10');
    if (mt7711Item) {
      console.log(`🔍 DEBUG: MT7711-10 found in filtered inventory:`, {
        model: mt7711Item.model,
        qtyOnHand: mt7711Item.qtyOnHand,
        qtyAllocated: mt7711Item.qtyAllocated,
        qtyBackorder: mt7711Item.qtyBackorder,
        totalQty: (mt7711Item.qtyOnHand || 0) + (mt7711Item.qtyAllocated || 0) + (mt7711Item.qtyBackorder || 0),
        position: filteredInventory.findIndex(item => item.model === 'MT7711-10') + 1
      });
    } else {
      console.log(`🔍 DEBUG: MT7711-10 NOT found in filtered inventory`);
    }

    return NextResponse.json({
      success: true,
      data: {
        currentInventory: filteredInventory,
        history: inventoryHistory,
        summary: {
          totalSkus: filteredInventory.length,
          totalOnHand: filteredInventory.reduce((sum, item) => sum + (item.qtyOnHand || 0), 0),
          totalAllocated: filteredInventory.reduce((sum, item) => sum + (item.qtyAllocated || 0), 0),
          totalBackorder: filteredInventory.reduce((sum, item) => sum + (item.qtyBackorder || 0), 0),
        }
      }
    });

  } catch (error) {
    console.error('Error fetching EMG inventory:', error);
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

    // Only admins and super admins can upload inventory reports
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
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only CSV files are supported.' 
      }, { status: 400 });
    }

    // Validate filename pattern - allow any variation after "BOUNDLESS DEVICES" and "Inventory Report"
    const fileName = file.name;
    const flexiblePattern = /^BOUNDLESS DEVICES.*Inventory Report.*\.(csv|CSV)$/i;
    
    if (!flexiblePattern.test(fileName)) {
      return NextResponse.json({ 
        error: 'Invalid filename. Must contain "BOUNDLESS DEVICES" and "Inventory Report" (any variation allowed)' 
      }, { status: 400 });
    }
    
    console.log(`✅ Filename validation passed: ${fileName}`);

    console.log(`📦 Processing EMG inventory report: ${fileName}`);

    // Parse CSV file
    const csvText = await file.text();
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 2) {
      return NextResponse.json({ 
        error: 'CSV file must contain at least a header row and one data row' 
      }, { status: 400 });
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📋 CSV Headers:', headers);

    // Find required columns
    const columnMapping = {
      location: -1,
      upc: -1,
      model: -1,
      description: -1,
      qtyOnHand: -1,
      qtyAllocated: -1,
      qtyBackorder: -1,
      netStock: -1,
    };

    // Map headers to column indexes (case-insensitive)
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      
      if (normalizedHeader.includes('location')) {
        columnMapping.location = index;
      } else if (normalizedHeader.includes('upc')) {
        columnMapping.upc = index;
      } else if (normalizedHeader.includes('model')) {
        columnMapping.model = index;
      } else if (normalizedHeader.includes('description')) {
        columnMapping.description = index;
      } else if (normalizedHeader.includes('qty') && normalizedHeader.includes('hand')) {
        columnMapping.qtyOnHand = index;
      } else if (normalizedHeader.includes('qty') && normalizedHeader.includes('allocated')) {
        columnMapping.qtyAllocated = index;
      } else if (normalizedHeader.includes('qty') && normalizedHeader.includes('backorder')) {
        columnMapping.qtyBackorder = index;
      } else if (normalizedHeader.includes('net') && normalizedHeader.includes('stock')) {
        columnMapping.netStock = index;
      }
    });

    console.log('📍 Column mapping:', columnMapping);

    // Validate required columns
    if (columnMapping.upc === -1 && columnMapping.model === -1) {
      return NextResponse.json({ 
        error: 'Required columns "UPC" or "Model" not found in CSV file' 
      }, { status: 400 });
    }

    // Process data rows
    const dataLines = lines.slice(1);
    const processedRecords = [];
    const errors = [];
    let newRecords = 0;
    let updatedRecords = 0;

    console.log(`📊 Processing ${dataLines.length} data rows`);

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line) continue;

      try {
        // Parse CSV row (handle quoted values)
        const row = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
        
        // Helper function to extract and clean data
        const extractData = (columnIndex: number) => {
          if (columnIndex === -1) return null;
          const value = row[columnIndex];
          if (value === undefined || value === null || value === '') return null;
          return String(value).trim();
        };

        // Helper function to parse numbers
        const parseNumber = (columnIndex: number) => {
          const value = extractData(columnIndex);
          if (!value) return 0;
          const num = parseInt(value.replace(/[^0-9-]/g, ''), 10);
          return isNaN(num) ? 0 : num;
        };

        // Extract data
        const extractedData = {
          location: extractData(columnMapping.location),
          upc: extractData(columnMapping.upc),
          model: extractData(columnMapping.model),
          description: extractData(columnMapping.description),
          qtyOnHand: parseNumber(columnMapping.qtyOnHand),
          qtyAllocated: parseNumber(columnMapping.qtyAllocated),
          qtyBackorder: parseNumber(columnMapping.qtyBackorder),
          netStock: parseNumber(columnMapping.netStock),
        };

        // Skip rows without UPC or Model
        if (!extractedData.upc && !extractedData.model) {
          continue;
        }

        // Create unique key for this SKU
        const skuKey = extractedData.upc || extractedData.model;

        // Log extracted data for first few records
        if (i < 3) {
          console.log(`📦 Row ${i + 1} extracted data for ${skuKey}:`, extractedData);
        }

        // DEBUG: Track MT7711-10 specifically
        if (extractedData.model === 'MT7711-10' || extractedData.upc === 'MT7711-10') {
          console.log(`🔍 DEBUG: Found MT7711-10 in CSV row ${i + 1}:`, {
            model: extractedData.model,
            upc: extractedData.upc,
            qtyOnHand: extractedData.qtyOnHand,
            qtyAllocated: extractedData.qtyAllocated,
            netStock: extractedData.netStock,
            skuKey: skuKey
          });
        }

        // Build additional data from remaining columns
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

        // Check if record exists (by UPC or Model)
        const [existingRecord] = await db
          .select()
          .from(emgInventoryTracking)
          .where(
            extractedData.upc ? 
              eq(emgInventoryTracking.upc, extractedData.upc) :
              eq(emgInventoryTracking.model, extractedData.model!)
          )
          .limit(1);

        if (existingRecord) {
          // Calculate changes for history
          const qtyChange = (extractedData.qtyOnHand || 0) - (existingRecord.qtyOnHand || 0);
          const changeType = qtyChange > 0 ? 'increase' : qtyChange < 0 ? 'decrease' : 'no_change';

          // Update existing record
          await db
            .update(emgInventoryTracking)
            .set({
              location: extractedData.location || existingRecord.location,
              description: extractedData.description || existingRecord.description,
              qtyOnHand: extractedData.qtyOnHand,
              qtyAllocated: extractedData.qtyAllocated,
              qtyBackorder: extractedData.qtyBackorder,
              netStock: extractedData.netStock,
              additionalData,
              sourceFileName: fileName,
              uploadedBy: requestingUser.authId,
            })
            .where(eq(emgInventoryTracking.id, existingRecord.id));

          // Add to history
          await db.insert(emgInventoryHistory).values({
            upc: extractedData.upc || existingRecord.upc || null,
            model: extractedData.model || existingRecord.model || '',
            location: extractedData.location || existingRecord.location || null,
            qtyOnHand: extractedData.qtyOnHand || 0,
            qtyAllocated: extractedData.qtyAllocated || 0,
            qtyBackorder: extractedData.qtyBackorder || 0,
            netStock: extractedData.netStock || 0,
            qtyChange: qtyChange || 0,
            changeType,
            sourceFileName: fileName,
            uploadedBy: requestingUser.authId,
            emgInventoryId: existingRecord.id,
          });

          updatedRecords++;

          // DEBUG: Track MT7711-10 database update
          if (extractedData.model === 'MT7711-10' || extractedData.upc === 'MT7711-10') {
            console.log(`🔍 DEBUG: MT7711-10 updated in database:`, {
              id: existingRecord.id,
              model: extractedData.model,
              qtyOnHand: extractedData.qtyOnHand,
              qtyAllocated: extractedData.qtyAllocated,
              netStock: extractedData.netStock,
              qtyChange: qtyChange,
              changeType: changeType
            });
          }
        } else {
          // Create new record
          const [newRecord] = await db.insert(emgInventoryTracking).values({
            location: extractedData.location,
            upc: extractedData.upc,
            model: extractedData.model,
            description: extractedData.description,
            qtyOnHand: extractedData.qtyOnHand,
            qtyAllocated: extractedData.qtyAllocated,
            qtyBackorder: extractedData.qtyBackorder,
            netStock: extractedData.netStock,
            additionalData,
            sourceFileName: fileName,
            uploadedBy: requestingUser.authId,
          }).returning();

          // Add initial history record
          await db.insert(emgInventoryHistory).values({
            upc: extractedData.upc || null,
            model: extractedData.model || '',
            location: extractedData.location || null,
            qtyOnHand: extractedData.qtyOnHand || 0,
            qtyAllocated: extractedData.qtyAllocated || 0,
            qtyBackorder: extractedData.qtyBackorder || 0,
            netStock: extractedData.netStock || 0,
            qtyChange: extractedData.qtyOnHand || 0,
            changeType: 'initial',
            sourceFileName: fileName,
            uploadedBy: requestingUser.authId,
            emgInventoryId: newRecord.id,
          });

          newRecords++;

          // DEBUG: Track MT7711-10 database insertion
          if (extractedData.model === 'MT7711-10' || extractedData.upc === 'MT7711-10') {
            console.log(`🔍 DEBUG: MT7711-10 inserted into database:`, {
              id: newRecord.id,
              model: newRecord.model,
              qtyOnHand: newRecord.qtyOnHand,
              qtyAllocated: newRecord.qtyAllocated,
              netStock: newRecord.netStock
            });
          }
        }

        processedRecords.push({
          skuKey,
          location: extractedData.location,
          qtyOnHand: extractedData.qtyOnHand,
          netStock: extractedData.netStock,
        });

      } catch (rowError) {
        console.error(`Error processing row ${i + 2}:`, rowError);
        errors.push(`Row ${i + 2}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    console.log(`✅ EMG inventory processing complete: ${newRecords} new, ${updatedRecords} updated, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedRecords.length} inventory records`,
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
    console.error('Error processing EMG inventory report:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
