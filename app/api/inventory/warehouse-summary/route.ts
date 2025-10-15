import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, emgInventoryTracking, catvInventoryTracking, organizations, organizationMembers, invoices, invoiceLineItems, productSkus } from '@/lib/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';

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

    // Get the requesting user and their organization
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
        },
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (userOrgMembership.length === 0) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership[0].organization;
    const isBDIUser = userOrganization.code === 'BDI' && userOrganization.type === 'internal';

    console.log(`📊 Warehouse Summary - User org: ${userOrganization.code} (${userOrganization.type}), isBDI: ${isBDIUser}`);

    // Get allowed SKU codes for this organization (partner orgs only see their SKUs)
    let allowedSkuCodes: string[] = [];
    
    if (!isBDIUser) {
      // Partner organizations can only see SKUs they have in invoices
      console.log(`🔒 Partner org ${userOrganization.code} - filtering by invoice SKUs`);
      
      const partnerSkus = await db
        .select({
          sku: productSkus.sku,
          model: productSkus.model,
        })
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
        .innerJoin(productSkus, eq(productSkus.id, invoiceLineItems.skuId))
        .where(eq(invoices.customerName, userOrganization.code!));
      
      allowedSkuCodes = partnerSkus.map(s => s.sku);
      const allowedModels = partnerSkus.map(s => s.model).filter(m => m !== null);
      
      // Combine both SKU and model for matching (EMG uses "model", WIP uses "model_number")
      allowedSkuCodes = [...new Set([...allowedSkuCodes, ...allowedModels])];
      
      // Add fuzzy matching for SKU variations (e.g., MNQ1525-30W-U matches MNQ1525-M30W-E)
      const fuzzySkus: string[] = [];
      allowedSkuCodes.forEach(sku => {
        // Extract base SKU pattern (e.g., "MNQ1525" from "MNQ1525-30W-U")
        const basePattern = sku.split('-')[0]; // Get first part before first dash
        if (basePattern) {
          fuzzySkus.push(basePattern);
        }
      });
      
      // Add fuzzy patterns to allowed SKUs
      allowedSkuCodes = [...new Set([...allowedSkuCodes, ...fuzzySkus])];
      
      console.log(`🔍 Partner ${userOrganization.code} allowed SKUs/Models:`, allowedSkuCodes);
      
      if (allowedSkuCodes.length === 0) {
        console.log(`⚠️  No SKUs found for ${userOrganization.code} - returning empty data`);
        return NextResponse.json({
          success: true,
          data: {
            emg: {
              totals: { totalSkus: 0, totalOnHand: 0, totalAllocated: 0, totalBackorder: 0 },
              inventory: [],
              topSkus: [],
              lastUpdated: null,
            },
            catv: {
              totals: { totalWeeks: 0, totalReceivedIn: 0, totalShippedJiraOut: 0, totalShippedEmgOut: 0, totalWipInHouse: 0 },
              wipTotals: { totalUnits: 0, byStage: {}, bySku: {}, bySource: {} },
              metrics: { totalIntake: 0, activeWip: 0, rma: 0, outflow: 0, avgAging: 0 },
              inventory: [],
              wipSummary: [],
              topSkus: [],
              lastUpdated: null,
            },
            summary: {
              totalWarehouses: 2,
              totalSkus: 0,
              totalUnits: 0,
              lastUpdated: Date.now(),
            },
          },
        });
      }
    } else {
      console.log(`🔓 BDI user - can see all SKUs`);
    }

    // Get EMG Inventory Summary (filtered by SKU if partner org)
    const emgInventory = await db
      .select({
        model: emgInventoryTracking.model,
        description: emgInventoryTracking.description,
        location: emgInventoryTracking.location,
        qtyOnHand: emgInventoryTracking.qtyOnHand,
        qtyAllocated: emgInventoryTracking.qtyAllocated,
        qtyBackorder: emgInventoryTracking.qtyBackorder,
        netStock: emgInventoryTracking.netStock,
        lastUpdated: emgInventoryTracking.lastUpdated,
      })
      .from(emgInventoryTracking)
      .where(
        isBDIUser || allowedSkuCodes.length === 0
          ? sql`1=1` // BDI sees all
          : sql`${emgInventoryTracking.model} = ANY(${allowedSkuCodes}) OR ${emgInventoryTracking.model} LIKE ANY(${allowedSkuCodes.map(sku => `%${sku}%`)})` // Partners see their SKUs with fuzzy matching
      )
      .orderBy(desc(emgInventoryTracking.uploadDate));

    // Get CATV Inventory Summary (from CATV tracking table)
    const catvInventory = await db
      .select({
        weekNumber: catvInventoryTracking.weekNumber,
        weekDate: catvInventoryTracking.weekDate,
        receivedIn: catvInventoryTracking.receivedIn,
        shippedJiraOut: catvInventoryTracking.shippedJiraOut,
        shippedEmgOut: catvInventoryTracking.shippedEmgOut,
        wipInHouse: catvInventoryTracking.wipInHouse,
        lastUpdated: catvInventoryTracking.lastUpdated,
      })
      .from(catvInventoryTracking)
      .orderBy(desc(catvInventoryTracking.uploadDate));

    // Get CATV WIP Units Summary (from WIP flow table)
    const { createClient } = require('@supabase/supabase-js');
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get ALL WIP units for CATV data (using pagination to bypass 1000-row limit)
    console.log('📦 Fetching all WIP units in batches...');
    const BATCH_SIZE = 1000; // Supabase max rows per request
    let allWipUnits: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabaseService
        .from('warehouse_wip_units')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('received_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching WIP units batch:', error);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allWipUnits = allWipUnits.concat(batch);
        console.log(`✅ Fetched WIP batch: ${batch.length} units (total so far: ${allWipUnits.length})`);
        
        if (batch.length < BATCH_SIZE) {
          hasMore = false; // Last batch
        } else {
          offset += BATCH_SIZE;
        }
      }
    }

    // Filter WIP units by allowed SKUs for partner organizations
    let wipUnits = allWipUnits;
    
    if (!isBDIUser && allowedSkuCodes.length > 0) {
      wipUnits = allWipUnits.filter((unit: any) => {
        const modelNumber = unit.model_number;
        // Exact match
        if (allowedSkuCodes.includes(modelNumber)) return true;
        // Fuzzy match - check if any allowed SKU pattern is contained in the model number
        return allowedSkuCodes.some(allowedSku => modelNumber && modelNumber.includes(allowedSku));
      });
      console.log(`🔒 Filtered WIP units for ${userOrganization.code}: ${wipUnits.length} of ${allWipUnits.length} units`);
    }
    
    console.log(`✅ Total WIP units (after filtering): ${wipUnits.length}`);

    // Calculate EMG totals
    const emgTotals = {
      totalSkus: emgInventory.length,
      totalOnHand: emgInventory.reduce((sum, item) => sum + (item.qtyOnHand || 0), 0),
      totalAllocated: emgInventory.reduce((sum, item) => sum + (item.qtyAllocated || 0), 0),
      totalBackorder: emgInventory.reduce((sum, item) => sum + (item.qtyBackorder || 0), 0),
      totalNetStock: emgInventory.reduce((sum, item) => sum + (item.netStock || 0), 0),
    };

    // Calculate CATV totals from tracking table
    const catvTotals = {
      totalWeeks: catvInventory.length,
      totalReceivedIn: catvInventory.reduce((sum, item) => sum + (item.receivedIn || 0), 0),
      totalShippedJiraOut: catvInventory.reduce((sum, item) => sum + (item.shippedJiraOut || 0), 0),
      totalShippedEmgOut: catvInventory.reduce((sum, item) => sum + (item.shippedEmgOut || 0), 0),
      totalWipInHouse: catvInventory.reduce((sum, item) => sum + (item.wipInHouse || 0), 0),
    };

    // Calculate CATV WIP totals from actual WIP units data
    const catvWipTotals = {
      totalUnits: wipUnits?.length || 0,
      byStage: (wipUnits || []).reduce((acc: Record<string, number>, unit: any) => {
        const stage = unit.stage || 'Unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {}),
      bySku: (wipUnits || []).reduce((acc: Record<string, number>, unit: any) => {
        const sku = unit.model_number || 'Unknown';
        acc[sku] = (acc[sku] || 0) + 1;
        return acc;
      }, {}),
      bySource: (wipUnits || []).reduce((acc: Record<string, number>, unit: any) => {
        const source = unit.source || 'Unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {}),
    };

    // Calculate CATV metrics like the WIP dashboard
    const catvMetrics = {
      totalIntake: (wipUnits || []).length, // Total units received
      activeWip: (wipUnits || []).filter((unit: any) => unit.stage === 'WIP').length,
      rma: (wipUnits || []).filter((unit: any) => unit.stage === 'RMA').length,
      outflow: (wipUnits || []).filter((unit: any) => unit.stage === 'Outflow').length,
      avgAging: (wipUnits || []).reduce((sum: number, unit: any) => sum + (unit.aging_days || 0), 0) / (wipUnits?.length || 1),
    };

    // Top EMG SKUs by quantity
    const topEmgSkus = emgInventory
      .sort((a, b) => (b.qtyOnHand || 0) - (a.qtyOnHand || 0))
      .slice(0, 10)
      .map(item => ({
        model: item.model,
        description: item.description,
        location: item.location,
        qtyOnHand: item.qtyOnHand || 0,
        netStock: item.netStock || 0,
      }));

    // Top CATV SKUs by WIP units
    const topCatvSkus = Object.entries(catvWipTotals.bySku)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([sku, count]) => ({
        sku,
        totalUnits: count,
        stages: (wipUnits || [])
          .filter((unit: any) => unit.model_number === sku)
          .reduce((acc: Record<string, number>, unit: any) => {
            const stage = unit.stage || 'Unknown';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
          }, {}),
      }));

    return NextResponse.json({
      success: true,
      data: {
        emg: {
          totals: emgTotals,
          inventory: emgInventory,
          topSkus: topEmgSkus,
          lastUpdated: emgInventory.length > 0 ? emgInventory[0].lastUpdated : null,
        },
        catv: {
          totals: catvTotals,
          wipTotals: catvWipTotals,
          metrics: catvMetrics,
          inventory: catvInventory,
          wipSummary: wipUnits || [],
          topSkus: topCatvSkus,
          lastUpdated: catvInventory.length > 0 ? catvInventory[0].lastUpdated : null,
        },
        summary: {
          totalWarehouses: 2, // EMG and CATV
          totalSkus: emgTotals.totalSkus + Object.keys(catvWipTotals.bySku).length,
          totalUnits: emgTotals.totalOnHand + catvMetrics.activeWip, // EMG On Hand + CATV Active WIP (not total intake)
          lastUpdated: Math.max(
            emgInventory.length > 0 ? new Date(emgInventory[0].lastUpdated || 0).getTime() : 0,
            catvInventory.length > 0 ? new Date(catvInventory[0].lastUpdated || 0).getTime() : 0
          ),
        }
      }
    });

  } catch (error) {
    console.error('Error fetching warehouse summary:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
