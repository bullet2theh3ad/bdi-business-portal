/**
 * Sales Velocity Calculation API
 * 
 * Calculates sales velocity metrics from:
 * 1. Amazon Financial Events (historical sales data)
 * 2. Amazon Inventory Snapshots (current FBA inventory)
 * 3. EMG Warehouse Inventory (current warehouse stock)
 * 4. CATV WIP Units (current warehouse stock)
 * 
 * Stores results in sales_velocity_metrics table for fast retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { 
  salesVelocityCalculations, 
  salesVelocityMetrics,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Service role client for bypassing RLS
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface SKUSalesData {
  sku: string;
  asin?: string;
  productName?: string;
  totalUnitsSold: number;
  totalRevenue: number;
  unitsSold30d: number;
  revenue30d: number;
  unitsSold7d: number;
  revenue7d: number;
  lastSaleDate: string | null;
  firstSaleDate: string | null;
}

interface SKUInventoryData {
  sku: string;
  amazonFba: number;
  amazonInbound: number;
  emgWarehouse: number;
  catvWarehouse: number;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => {
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

    // Check if user is super_admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 });
    }

    console.log('🚀 Starting Sales Velocity Calculation (Full Orchestration)...');

    // =====================================================
    // STEP 0: Sync Amazon Inventory (Current Snapshot)
    // =====================================================
    console.log('📦 Step 0a: Syncing Amazon FBA Inventory...');
    try {
      const inventorySyncResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/amazon/inventory/sync`, {
        method: 'POST',
        headers: {
          'Cookie': cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; '),
        },
      });
      
      if (inventorySyncResponse.ok) {
        const inventorySyncData = await inventorySyncResponse.json();
        console.log(`✅ Amazon Inventory synced: ${inventorySyncData.recordsInserted || 0} records`);
      } else {
        console.warn('⚠️  Amazon Inventory sync failed (continuing anyway)');
      }
    } catch (error) {
      console.warn('⚠️  Amazon Inventory sync error (continuing anyway):', error);
    }

    // =====================================================
    // STEP 0b: Fetch Amazon Financial Data (Last 180 days max)
    // =====================================================
    console.log('💰 Step 0b: Fetching Amazon Financial Events (Last 180 days)...');
    let financialData: any = null;
    try {
      // Amazon API has a 180-day limit, so use last 180 days instead of Aug 2024
      const today = new Date();
      const days180Ago = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
      const startDate = days180Ago.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      console.log(`   Fetching from ${startDate} to ${endDate}`);
      
      // Call the financial data endpoint to get transaction data
      const financialResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/amazon/financial-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; '),
        },
        body: JSON.stringify({
          startDate,
          endDate,
          includeTransactions: true,
        }),
      });

      if (financialResponse.ok) {
        financialData = await financialResponse.json();
        console.log(`✅ Amazon Financial Data fetched successfully`);
        console.log(`   - Revenue: $${financialData.summary?.totalRevenue || 0}`);
        console.log(`   - Orders: ${financialData.summary?.uniqueOrders || 0}`);
        console.log(`   - SKUs: ${financialData.summary?.uniqueSKUs || 0}`);
      } else {
        const errorData = await financialResponse.json().catch(() => ({}));
        console.warn('⚠️  Amazon Financial data fetch failed:', errorData.error || 'Unknown error');
        console.warn('   Continuing with 0 sales data');
      }
    } catch (error: any) {
      console.warn('⚠️  Amazon Financial data error (continuing with 0 sales):', error.message);
    }

    console.log('🚀 Starting Sales Velocity Calculation (Data Collection Complete)...');

    // Define calculation period (last 180 days to match Amazon API limit)
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 180 * 24 * 60 * 60 * 1000);
    const calculationDate = new Date().toISOString().split('T')[0];
    
    const now = new Date();
    const date30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const date7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Step 1: Process sales data from Amazon Financial Events
    console.log('📊 Step 1: Processing sales data from Amazon Financial Events...');
    const salesData = await processSalesData(financialData, periodStart, periodEnd, date30DaysAgo, date7DaysAgo);
    console.log(`✅ Found sales data for ${salesData.length} SKUs`);

    // Step 2: Get current inventory positions
    console.log('📦 Step 2: Fetching current inventory positions...');
    const inventoryData = await fetchInventoryData();
    console.log(`✅ Found inventory data for ${Object.keys(inventoryData).length} SKUs`);

    // Step 3: Create or update calculation record
    console.log('💾 Step 3: Creating calculation record...');
    
    // Check if calculation for today already exists
    const existingCalculation = await db
      .select()
      .from(salesVelocityCalculations)
      .where(eq(salesVelocityCalculations.calculationDate, calculationDate))
      .limit(1);

    let calculation;
    if (existingCalculation.length > 0) {
      console.log('⚠️  Calculation for today already exists, deleting old metrics...');
      // Delete old metrics for this calculation
      await db
        .delete(salesVelocityMetrics)
        .where(eq(salesVelocityMetrics.calculationId, existingCalculation[0].id));
      
      // Update existing calculation
      const [updated] = await db
        .update(salesVelocityCalculations)
        .set({
          periodStart: periodStart.toISOString().split('T')[0],
          periodEnd: periodEnd.toISOString().split('T')[0],
          totalSkusAnalyzed: salesData.length,
          dataSources: {
            amazonFinancialEvents: true,
            amazonInventory: true,
            emgWarehouse: true,
            catvWarehouse: true,
          },
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(salesVelocityCalculations.id, existingCalculation[0].id))
        .returning();
      
      calculation = updated;
      console.log(`✅ Updated existing calculation record: ${calculation.id}`);
    } else {
      // Create new calculation
      const [created] = await db.insert(salesVelocityCalculations).values({
        calculationDate: calculationDate,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        totalSkusAnalyzed: salesData.length,
        dataSources: {
          amazonFinancialEvents: true,
          amazonInventory: true,
          emgWarehouse: true,
          catvWarehouse: true,
        },
        status: 'processing',
      }).returning();
      
      calculation = created;
      console.log(`✅ Calculation record created: ${calculation.id}`);
    }

    // Step 4: Calculate velocity metrics for each SKU
    console.log('🧮 Step 4: Calculating velocity metrics...');
    const metricsToInsert = [];
    const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

    for (const sale of salesData) {
      const inventory = inventoryData[sale.sku] || {
        amazonFba: 0,
        amazonInbound: 0,
        emgWarehouse: 0,
        catvWarehouse: 0,
      };

      const totalAvailableInventory = 
        inventory.amazonFba + 
        inventory.amazonInbound + 
        inventory.emgWarehouse + 
        inventory.catvWarehouse;

      // Calculate velocity
      const dailyVelocity = sale.totalUnitsSold / daysInPeriod;
      const weeklyVelocity = dailyVelocity * 7;
      const monthlyVelocity = dailyVelocity * 30;
      const dailyVelocity30d = sale.unitsSold30d / 30;
      const dailyVelocity7d = sale.unitsSold7d / 7;

      // Calculate days of inventory
      const daysOfInventory = dailyVelocity > 0 
        ? totalAvailableInventory / dailyVelocity 
        : null;

      // Determine stockout risk
      let stockoutRisk = 'LOW';
      if (daysOfInventory === null || daysOfInventory === 0) {
        stockoutRisk = 'CRITICAL';
      } else if (daysOfInventory < 7) {
        stockoutRisk = 'CRITICAL';
      } else if (daysOfInventory < 14) {
        stockoutRisk = 'HIGH';
      } else if (daysOfInventory < 30) {
        stockoutRisk = 'MEDIUM';
      }

      // Calculate velocity trend
      let velocityTrend = 'STABLE';
      let velocityChange30d = 0;
      let velocityChangePercent = 0;
      
      if (dailyVelocity > 0) {
        velocityChange30d = dailyVelocity30d - dailyVelocity;
        velocityChangePercent = (velocityChange30d / dailyVelocity) * 100;
        
        if (velocityChangePercent > 10) {
          velocityTrend = 'INCREASING';
        } else if (velocityChangePercent < -10) {
          velocityTrend = 'DECREASING';
        }
      }

      // Calculate financial metrics
      const averageSellingPrice = sale.totalUnitsSold > 0 
        ? sale.totalRevenue / sale.totalUnitsSold 
        : 0;
      const inventoryValue = averageSellingPrice * totalAvailableInventory;
      const dailyRevenueRate = averageSellingPrice * dailyVelocity;

      // Reorder calculations (assuming 30-day lead time)
      const leadTimeDays = 30;
      const reorderPoint = Math.ceil(dailyVelocity * leadTimeDays * 1.5); // 1.5x safety factor
      const recommendedOrderQuantity = Math.ceil(monthlyVelocity * 2); // 2 months supply

      metricsToInsert.push({
        calculationId: calculation.id,
        calculationDate: calculationDate,
        sku: sale.sku,
        asin: sale.asin || null,
        productName: sale.productName || null,
        
        // Historical metrics
        totalUnitsSold: sale.totalUnitsSold,
        totalRevenue: sale.totalRevenue.toFixed(2),
        daysInPeriod,
        dailySalesVelocity: dailyVelocity.toFixed(4),
        weeklySalesVelocity: weeklyVelocity.toFixed(4),
        monthlySalesVelocity: monthlyVelocity.toFixed(4),
        
        // Recent metrics
        unitsSold30d: sale.unitsSold30d,
        revenue30d: sale.revenue30d.toFixed(2),
        dailyVelocity30d: dailyVelocity30d.toFixed(4),
        unitsSold7d: sale.unitsSold7d,
        revenue7d: sale.revenue7d.toFixed(2),
        dailyVelocity7d: dailyVelocity7d.toFixed(4),
        
        // Inventory
        amazonFbaQuantity: inventory.amazonFba,
        amazonInboundQuantity: inventory.amazonInbound,
        emgWarehouseQuantity: inventory.emgWarehouse,
        catvWarehouseQuantity: inventory.catvWarehouse,
        totalAvailableInventory,
        
        // Calculated metrics
        daysOfInventory: daysOfInventory !== null ? daysOfInventory.toFixed(2) : null,
        stockoutRisk,
        reorderPoint,
        recommendedOrderQuantity,
        
        // Trends
        velocityTrend,
        velocityChange30d: velocityChange30d.toFixed(4),
        velocityChangePercent: velocityChangePercent.toFixed(2),
        
        // Financial
        averageSellingPrice: averageSellingPrice.toFixed(2),
        inventoryValue: inventoryValue.toFixed(2),
        dailyRevenueRate: dailyRevenueRate.toFixed(2),
        
        // Metadata
        lastSaleDate: sale.lastSaleDate,
        firstSaleDate: sale.firstSaleDate,
        isActive: true,
      });
    }

    // Step 5: Insert all metrics
    console.log(`💾 Step 5: Inserting ${metricsToInsert.length} velocity metrics...`);
    if (metricsToInsert.length > 0) {
      await db.insert(salesVelocityMetrics).values(metricsToInsert);
    }

    // Step 6: Update calculation status
    await db.update(salesVelocityCalculations)
      .set({ 
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(salesVelocityCalculations.id, calculation.id));

    console.log('✅ Sales Velocity Calculation Complete!');

    return NextResponse.json({
      success: true,
      calculationId: calculation.id,
      calculationDate,
      skusAnalyzed: salesData.length,
      metricsCreated: metricsToInsert.length,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
    });

  } catch (error: any) {
    console.error('❌ Error calculating sales velocity:', error);
    return NextResponse.json(
      { error: 'Failed to calculate sales velocity', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Process sales data from Amazon Financial API response
 */
async function processSalesData(
  financialData: any,
  periodStart: Date,
  periodEnd: Date,
  date30DaysAgo: Date,
  date7DaysAgo: Date
): Promise<SKUSalesData[]> {
  if (!financialData || !financialData.success) {
    console.log('⚠️  No financial data available, returning empty sales data');
    return [];
  }

  const skuMap = new Map<string, SKUSalesData>();

  // Process SKU-level data from financial API
  // The API returns data in summary.allSKUs array
  const allSKUs = financialData.summary?.allSKUs || [];
  
  console.log(`📊 Processing ${allSKUs.length} SKUs from financial data`);

  for (const skuEntry of allSKUs) {
    const sku = skuEntry.sku || skuEntry.bdiSku || 'UNKNOWN';
    
    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku,
        asin: undefined, // ASIN not directly available in summary
        productName: undefined,
        totalUnitsSold: 0,
        totalRevenue: 0,
        unitsSold30d: 0,
        revenue30d: 0,
        unitsSold7d: 0,
        revenue7d: 0,
        lastSaleDate: null,
        firstSaleDate: null,
      });
    }

    const skuData = skuMap.get(sku)!;
    
    // Aggregate totals (netUnits accounts for refunds)
    const netUnits = Math.abs(skuEntry.netUnits || skuEntry.units || 0);
    const netRevenue = Math.abs(skuEntry.net || skuEntry.revenue || 0);
    
    skuData.totalUnitsSold += netUnits;
    skuData.totalRevenue += netRevenue;
    
    // Note: The financial API doesn't provide date-level breakdown
    // So we'll use the total data as a proxy for now
    // Assume even distribution across the period for 30d and 7d estimates
    const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = netUnits / daysInPeriod;
    
    skuData.unitsSold30d = Math.floor(dailyRate * 30);
    skuData.revenue30d = (netRevenue / daysInPeriod) * 30;
    skuData.unitsSold7d = Math.floor(dailyRate * 7);
    skuData.revenue7d = (netRevenue / daysInPeriod) * 7;
  }

  console.log(`✅ Processed ${skuMap.size} unique SKUs`);
  return Array.from(skuMap.values());
}

/**
 * Fetch sales data from Amazon Financial Events (Database fallback)
 */
async function fetchSalesData(
  periodStart: Date,
  periodEnd: Date,
  date30DaysAgo: Date,
  date7DaysAgo: Date
): Promise<SKUSalesData[]> {
  const supabase = supabaseService;
  
  // Fetch all financial events in the period
  const { data: events, error } = await supabase
    .from('amazon_financial_events')
    .select('*')
    .gte('posted_date', periodStart.toISOString())
    .lte('posted_date', periodEnd.toISOString())
    .order('posted_date', { ascending: true });

  if (error) {
    console.error('Error fetching financial events:', error);
    return [];
  }

  // Aggregate by SKU
  const skuMap = new Map<string, SKUSalesData>();

  for (const event of events || []) {
    const sku = event.sku || 'UNKNOWN';
    const units = event.quantity || 0;
    const revenue = parseFloat(event.total_amount || '0');
    const eventDate = event.posted_date;

    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku,
        asin: event.asin,
        productName: event.product_name,
        totalUnitsSold: 0,
        totalRevenue: 0,
        unitsSold30d: 0,
        revenue30d: 0,
        unitsSold7d: 0,
        revenue7d: 0,
        lastSaleDate: null,
        firstSaleDate: null,
      });
    }

    const skuData = skuMap.get(sku)!;
    
    // Total metrics
    skuData.totalUnitsSold += units;
    skuData.totalRevenue += revenue;

    // 30-day metrics
    if (new Date(eventDate) >= date30DaysAgo) {
      skuData.unitsSold30d += units;
      skuData.revenue30d += revenue;
    }

    // 7-day metrics
    if (new Date(eventDate) >= date7DaysAgo) {
      skuData.unitsSold7d += units;
      skuData.revenue7d += revenue;
    }

    // Track first and last sale dates
    if (!skuData.firstSaleDate || eventDate < skuData.firstSaleDate) {
      skuData.firstSaleDate = eventDate;
    }
    if (!skuData.lastSaleDate || eventDate > skuData.lastSaleDate) {
      skuData.lastSaleDate = eventDate;
    }
  }

  return Array.from(skuMap.values());
}

/**
 * Fetch current inventory positions from all sources
 */
async function fetchInventoryData(): Promise<Record<string, SKUInventoryData>> {
  const supabase = supabaseService;
  const inventoryMap: Record<string, SKUInventoryData> = {};

  // 1. Amazon FBA Inventory (latest snapshot)
  const { data: amazonInventory } = await supabase
    .from('amazon_inventory_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1000);

  for (const item of amazonInventory || []) {
    const sku = item.seller_sku || item.asin;
    if (!sku) continue;

    if (!inventoryMap[sku]) {
      inventoryMap[sku] = {
        sku,
        amazonFba: 0,
        amazonInbound: 0,
        emgWarehouse: 0,
        catvWarehouse: 0,
      };
    }

    inventoryMap[sku].amazonFba += item.afn_fulfillable_quantity || 0;
    inventoryMap[sku].amazonInbound += 
      (item.afn_inbound_working_quantity || 0) +
      (item.afn_inbound_shipped_quantity || 0) +
      (item.afn_inbound_receiving_quantity || 0);
  }

  // 2. EMG Warehouse Inventory
  const { data: emgInventory } = await supabase
    .from('emg_inventory_tracking')
    .select('sku, quantity_on_hand')
    .gt('quantity_on_hand', 0);

  for (const item of emgInventory || []) {
    const sku = item.sku;
    if (!sku) continue;

    if (!inventoryMap[sku]) {
      inventoryMap[sku] = {
        sku,
        amazonFba: 0,
        amazonInbound: 0,
        emgWarehouse: 0,
        catvWarehouse: 0,
      };
    }

    inventoryMap[sku].emgWarehouse += item.quantity_on_hand || 0;
  }

  // 3. CATV Warehouse (Active WIP units)
  // Get latest import batch
  const { data: latestImport } = await supabase
    .from('warehouse_wip_imports')
    .select('id')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (latestImport) {
    // Fetch all WIP units from latest import
    let allUnits: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: wipUnits } = await supabase
        .from('warehouse_wip_units')
        .select('serial_number, model_number, stage')
        .eq('import_batch_id', latestImport.id)
        .eq('stage', 'WIP')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!wipUnits || wipUnits.length === 0) {
        hasMore = false;
      } else {
        allUnits = allUnits.concat(wipUnits);
        if (wipUnits.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    // Count unique serial numbers by model
    const modelCounts: Record<string, Set<string>> = {};
    for (const unit of allUnits) {
      const model = unit.model_number || 'UNKNOWN';
      if (!modelCounts[model]) {
        modelCounts[model] = new Set();
      }
      if (unit.serial_number) {
        modelCounts[model].add(unit.serial_number);
      }
    }

    // Add to inventory map
    for (const [model, serials] of Object.entries(modelCounts)) {
      if (!inventoryMap[model]) {
        inventoryMap[model] = {
          sku: model,
          amazonFba: 0,
          amazonInbound: 0,
          emgWarehouse: 0,
          catvWarehouse: 0,
        };
      }
      inventoryMap[model].catvWarehouse = serials.size;
    }
  }

  return inventoryMap;
}

