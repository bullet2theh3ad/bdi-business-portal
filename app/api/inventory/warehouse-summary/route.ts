import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, emgInventoryTracking, catvInventoryTracking, organizations, organizationMembers, invoices, invoiceLineItems, productSkus, skuMappings } from '@/lib/db/schema';
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
      // Partner organizations can only see SKUs they OWN (by manufacturer) - same logic as forecasts/invoices
      console.log(`🔒 Partner org ${userOrganization.code} - filtering by owned SKUs`);
      
      const partnerSkus = await db
        .select({
          sku: productSkus.sku,
          model: productSkus.model,
        })
        .from(productSkus)
        .where(eq(productSkus.mfg, userOrganization.code!));
      
      allowedSkuCodes = partnerSkus.map(s => s.sku);
      const allowedModels = partnerSkus.map(s => s.model).filter(m => m !== null);
      
      // Combine both SKU and model for matching (EMG uses "model", WIP uses "model_number")
      allowedSkuCodes = [...new Set([...allowedSkuCodes, ...allowedModels])];
      
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

    // Extract SKU prefixes for fuzzy matching (e.g., "MNQ1525" from "MNQ1525-30W-U")
    let skuPrefixes: string[] = [];
    if (!isBDIUser && allowedSkuCodes.length > 0) {
      skuPrefixes = allowedSkuCodes.map(sku => {
        const match = sku.match(/^([A-Z]+\d+)/i);
        return match ? match[1] : sku;
      });
      skuPrefixes = [...new Set(skuPrefixes)];
      console.log(`🔍 Warehouse Summary SKU prefixes for fuzzy matching:`, skuPrefixes);
    }

    // Get EMG Inventory Summary (filtered by SKU if partner org)
    // For partner orgs, we fetch all and then apply fuzzy matching
    let emgInventory = await db
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
      .orderBy(desc(emgInventoryTracking.uploadDate));

    // Apply fuzzy matching filter for partner organizations
    if (!isBDIUser && skuPrefixes.length > 0) {
      emgInventory = emgInventory.filter((item: any) => {
        if (!item.model) return false;
        const itemModel = item.model.toUpperCase();
        return skuPrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
      console.log(`🔍 EMG fuzzy filter: ${emgInventory.length} items matched`);
    }

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

    // Get the most recent import batch ID to avoid accumulating old data
    console.log('📦 Finding most recent WIP import...');
    const { data: latestImport } = await supabaseService
      .from('warehouse_wip_imports')
      .select('id')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!latestImport) {
      console.log('⚠️  No completed WIP imports found');
    } else {
      console.log(`✅ Using most recent import batch: ${latestImport.id}`);
    }

    // Get WIP units ONLY from the most recent import (using pagination to bypass 1000-row limit)
    console.log('📦 Fetching WIP units from latest import in batches...');
    const BATCH_SIZE = 1000; // Supabase max rows per request
    let allWipUnits: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabaseService
        .from('warehouse_wip_units')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('received_date', { ascending: false });
      
      // Filter by most recent import batch if available
      if (latestImport) {
        query = query.eq('import_batch_id', latestImport.id);
      }
      
      const { data: batch, error } = await query;
      
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

    // Filter WIP units by allowed SKUs for partner organizations using fuzzy matching
    let wipUnits = allWipUnits;
    
    if (!isBDIUser && skuPrefixes.length > 0) {
      wipUnits = allWipUnits.filter((unit: any) => {
        if (!unit.model_number) return false;
        const itemModel = unit.model_number.toUpperCase();
        // Use fuzzy matching to handle EMG naming variations
        return skuPrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
      console.log(`🔍 WIP fuzzy filter for ${userOrganization.code}: ${wipUnits.length} of ${allWipUnits.length} units`);
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
    // Count UNIQUE serial numbers, not total rows
    const uniqueSerials = new Set((wipUnits || []).map((u: any) => u.serial_number).filter(Boolean));
    
    const catvWipTotals = {
      totalUnits: uniqueSerials.size,
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

    // Calculate CATV metrics like the WIP dashboard - using UNIQUE serial numbers
    const wipSerials = new Set((wipUnits || []).filter((u: any) => u.stage === 'WIP').map((u: any) => u.serial_number).filter(Boolean));
    const rmaSerials = new Set((wipUnits || []).filter((u: any) => u.stage === 'RMA').map((u: any) => u.serial_number).filter(Boolean));
    const outflowSerials = new Set((wipUnits || []).filter((u: any) => u.stage === 'Outflow').map((u: any) => u.serial_number).filter(Boolean));
    
    const catvMetrics = {
      totalIntake: uniqueSerials.size, // Unique serial numbers
      activeWip: wipSerials.size,
      rma: rmaSerials.size,
      outflow: outflowSerials.size,
      avgAging: (wipUnits || []).reduce((sum: number, unit: any) => sum + (unit.aging_days || 0), 0) / (wipUnits?.length || 1),
    };

    // Top EMG SKUs by quantity (will be updated with cost data later)
    const topEmgSkus = emgInventory
      .sort((a, b) => (b.qtyOnHand || 0) - (a.qtyOnHand || 0))
      .slice(0, 10)
      .map(item => ({
        model: item.model,
        description: item.description,
        location: item.location,
        qtyOnHand: item.qtyOnHand || 0,
        netStock: item.netStock || 0,
        hasCost: false, // Will be updated below
        standardCost: 0, // Will be updated below
      }));

    // Top CATV SKUs by WIP units (will be updated with cost data later)
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
        hasCost: false, // Will be updated below
        standardCost: 0, // Will be updated below
      }));

    // Calculate inventory values using standard cost from product_skus
    console.log('[Warehouse Summary] Calculating inventory values and SKU mappings...');
    
    // Get all unique SKUs from both warehouses
    const emgSkuModels = emgInventory.map(item => item.model).filter(Boolean);
    const catvSkuModels = Object.keys(catvWipTotals.bySku).filter(Boolean);
    const allSkuModels = [...new Set([...emgSkuModels, ...catvSkuModels])].filter((sku): sku is string => Boolean(sku));
    
    console.log(`[Warehouse Summary] Found ${allSkuModels.length} unique SKUs across warehouses`);
    
    // Fetch SKU mappings (to match warehouse model names to BDI SKUs)
    // Join with productSkus to get the actual SKU code
    const allMappings = await db
      .select({
        externalIdentifier: skuMappings.externalIdentifier,
        internalSku: productSkus.sku,
      })
      .from(skuMappings)
      .leftJoin(productSkus, eq(skuMappings.internalSkuId, productSkus.id));
    
    console.log(`[Warehouse Summary] Found ${allMappings.length} SKU mappings`);
    
    // Create a map of external identifier -> BDI SKU (case-insensitive)
    const skuLookup = new Map<string, string>();
    allMappings.forEach(mapping => {
      if (mapping.externalIdentifier && mapping.internalSku) {
        skuLookup.set(mapping.externalIdentifier.toLowerCase(), mapping.internalSku);
      }
    });
    
    // Fetch standard costs for all SKUs (both warehouse models and BDI SKUs)
    const allPossibleSkus = [...allSkuModels, ...Array.from(skuLookup.values())];
    const uniqueSkusForCost = [...new Set(allPossibleSkus)].filter(Boolean);
    
    let skuCosts: Array<{ sku: string; standardCost: string | null }> = [];
    if (uniqueSkusForCost.length > 0) {
      skuCosts = await db
        .select({
          sku: productSkus.sku,
          standardCost: productSkus.standardCost,
        })
        .from(productSkus)
        .where(inArray(productSkus.sku, uniqueSkusForCost));
    }
    
    console.log(`[Warehouse Summary] Found standard costs for ${skuCosts.length} SKUs`);
    
    // Create a map of SKU -> standard cost
    const skuCostMap = new Map(
      skuCosts.map(item => [item.sku, parseFloat(String(item.standardCost || 0))])
    );
    
    // Helper function to get BDI SKU and cost for a warehouse model
    const getBdiSkuAndCost = (warehouseModel: string) => {
      const bdiSku = skuLookup.get(warehouseModel.toLowerCase());
      const costFromWarehouseModel = skuCostMap.get(warehouseModel);
      const costFromBdiSku = bdiSku ? skuCostMap.get(bdiSku) : undefined;
      const standardCost = costFromBdiSku || costFromWarehouseModel || 0;
      
      return {
        bdiSku: bdiSku || undefined,
        mappingStatus: bdiSku ? 'mapped' : (skuLookup.size === 0 ? 'no_mapping' : 'no_sku') as 'mapped' | 'no_mapping' | 'no_sku',
        standardCost,
        hasCost: standardCost > 0,
      };
    };
    
    // Update EMG top SKUs with BDI SKU mapping and cost data
    topEmgSkus.forEach(item => {
      if (item.model) {
        const mappingData = getBdiSkuAndCost(item.model);
        item.hasCost = mappingData.hasCost;
        item.standardCost = mappingData.standardCost;
        (item as any).bdiSku = mappingData.bdiSku;
        (item as any).mappingStatus = mappingData.mappingStatus;
        (item as any).totalValue = (item.qtyOnHand || 0) * mappingData.standardCost;
      }
    });
    
    // Update CATV top SKUs with BDI SKU mapping and cost data
    topCatvSkus.forEach(item => {
      if (item.sku) {
        const mappingData = getBdiSkuAndCost(item.sku);
        item.hasCost = mappingData.hasCost;
        item.standardCost = mappingData.standardCost;
        (item as any).bdiSku = mappingData.bdiSku;
        (item as any).mappingStatus = mappingData.mappingStatus;
        (item as any).totalValue = (item.totalUnits as number) * mappingData.standardCost;
      }
    });
    
    // Calculate EMG inventory value
    let emgTotalValue = 0;
    let emgSkusWithCost = 0;
    let emgSkusWithoutCost = 0;
    
    emgInventory.forEach(item => {
      if (!item.model) return;
      const mappingData = getBdiSkuAndCost(item.model);
      if (mappingData.hasCost) {
        emgTotalValue += (item.qtyOnHand || 0) * mappingData.standardCost;
        emgSkusWithCost++;
      } else {
        emgSkusWithoutCost++;
      }
    });
    
    // Calculate CATV inventory value (using unique serial numbers)
    let catvTotalValue = 0;
    let catvSkusWithCost = 0;
    let catvSkusWithoutCost = 0;
    
    Object.entries(catvWipTotals.bySku).forEach(([sku, count]) => {
      const mappingData = getBdiSkuAndCost(sku);
      if (mappingData.hasCost) {
        catvTotalValue += (count as number) * mappingData.standardCost;
        catvSkusWithCost++;
      } else {
        catvSkusWithoutCost++;
      }
    });
    
    console.log(`[Warehouse Summary] EMG Value: $${emgTotalValue.toFixed(2)} (${emgSkusWithCost} SKUs with cost, ${emgSkusWithoutCost} without)`);
    console.log(`[Warehouse Summary] CATV Value: $${catvTotalValue.toFixed(2)} (${catvSkusWithCost} SKUs with cost, ${catvSkusWithoutCost} without)`);

    return NextResponse.json({
      success: true,
      data: {
        emg: {
          totals: emgTotals,
          inventory: emgInventory,
          topSkus: topEmgSkus,
          lastUpdated: emgInventory.length > 0 ? emgInventory[0].lastUpdated : null,
          inventoryValue: {
            totalValue: emgTotalValue,
            skusWithCost: emgSkusWithCost,
            skusWithoutCost: emgSkusWithoutCost,
            hasCostData: emgSkusWithCost > 0,
          },
        },
        catv: {
          totals: catvTotals,
          wipTotals: catvWipTotals,
          metrics: catvMetrics,
          inventory: catvInventory,
          wipSummary: wipUnits || [],
          topSkus: topCatvSkus,
          lastUpdated: catvInventory.length > 0 ? catvInventory[0].lastUpdated : null,
          inventoryValue: {
            totalValue: catvTotalValue,
            skusWithCost: catvSkusWithCost,
            skusWithoutCost: catvSkusWithoutCost,
            hasCostData: catvSkusWithCost > 0,
          },
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
