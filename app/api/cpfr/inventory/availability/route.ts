import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoices, invoiceLineItems, productSkus, purchaseOrders, purchaseOrderLineItems } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

    // Verify user has access
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin', 'sales', 'member'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('🔍 Calculating inventory availability from invoices AND purchase orders...');

    // Calculate total quantities by SKU from ALL invoices (not just confirmed)
    const availabilityQuery = await db
      .select({
        skuId: invoiceLineItems.skuId,
        skuCode: invoiceLineItems.skuCode,
        skuName: invoiceLineItems.skuName,
        totalQuantity: sql<number>`SUM(${invoiceLineItems.quantity})`,
        invoiceCount: sql<number>`COUNT(DISTINCT ${invoiceLineItems.invoiceId})`,
        earliestDelivery: sql<string>`MIN(${invoices.requestedDeliveryWeek})`,
        latestDelivery: sql<string>`MAX(${invoices.requestedDeliveryWeek})`,
      })
      .from(invoiceLineItems)
      .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
      .innerJoin(productSkus, eq(invoiceLineItems.skuId, productSkus.id))
      .where(
        and(
          // Count ALL invoices as available quantity (total supply)
          eq(productSkus.isActive, true)
        )
      )
      .groupBy(
        invoiceLineItems.skuId,
        invoiceLineItems.skuCode,
        invoiceLineItems.skuName
      )
      .orderBy(invoiceLineItems.skuCode);

    console.log(`Found availability data for ${availabilityQuery.length} SKUs`);

    // Calculate total quantities by SKU from ALL purchase orders
    const poAvailabilityQuery = await db
      .select({
        skuId: purchaseOrderLineItems.skuId,
        skuCode: purchaseOrderLineItems.skuCode,
        skuName: purchaseOrderLineItems.skuName,
        totalQuantity: sql<number>`SUM(${purchaseOrderLineItems.quantity})`,
        poCount: sql<number>`COUNT(DISTINCT ${purchaseOrderLineItems.purchaseOrderId})`,
      })
      .from(purchaseOrderLineItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrders.id))
      .innerJoin(productSkus, eq(purchaseOrderLineItems.skuId, productSkus.id))
      .where(
        and(
          // Count ALL purchase orders as available quantity (total supply)
          eq(productSkus.isActive, true)
        )
      )
      .groupBy(
        purchaseOrderLineItems.skuId,
        purchaseOrderLineItems.skuCode,
        purchaseOrderLineItems.skuName
      )
      .orderBy(purchaseOrderLineItems.skuCode);

    console.log(`Found PO availability data for ${poAvailabilityQuery.length} SKUs`);

    // Calculate already allocated quantities from existing forecasts
    let allocationsMap: Record<string, number> = {};
    
    try {
      const { data: allocationsData, error: allocationsError } = await supabase
        .from('sales_forecasts')
        .select('sku_id, quantity');

      if (allocationsError) {
        console.log('📊 No allocations table found, using zero allocations');
        allocationsMap = {};
      } else {
        // Sum quantities by SKU
        allocationsMap = (allocationsData || []).reduce((acc: any, row: any) => {
          const skuId = row.sku_id;
          const quantity = parseInt(row.quantity) || 0;
          acc[skuId] = (acc[skuId] || 0) + quantity;
          return acc;
        }, {});
      }
    } catch (allocError) {
      console.log('📊 Error calculating allocations, using zero:', allocError);
      allocationsMap = {};
    }

    console.log('📊 Calculated forecast allocations:', allocationsMap);

    // Create PO quantities map
    const poQuantitiesMap = poAvailabilityQuery.reduce((acc, item) => {
      if (item.skuId) {
        acc[item.skuId] = {
          totalFromPOs: item.totalQuantity,
          sourcePOs: item.poCount
        };
      }
      return acc;
    }, {} as Record<string, { totalFromPOs: number; sourcePOs: number }>);

    // Transform to a more usable format with net available calculation
    // PRIORITY: Use PO quantities if available, otherwise use invoice quantities
    const availabilityMap = availabilityQuery.reduce((acc, item) => {
      const totalFromInvoices = item.totalQuantity;
      const poData = poQuantitiesMap[item.skuId];
      const totalFromPOs = poData?.totalFromPOs || 0;
      
      // PRIORITY LOGIC: Use PO quantities if available, otherwise invoices
      const totalAvailable = totalFromPOs > 0 ? totalFromPOs : totalFromInvoices;
      const primarySource = totalFromPOs > 0 ? 'PO' : 'Invoice';
      
      const alreadyAllocated = allocationsMap[item.skuId] || 0;
      const netAvailable = totalAvailable - alreadyAllocated;

      acc[item.skuId] = {
        skuId: item.skuId,
        skuCode: item.skuCode,
        skuName: item.skuName,
        totalFromInvoices: totalFromInvoices,
        totalFromPOs: totalFromPOs,
        totalAvailable: totalAvailable,
        primarySource: primarySource,
        alreadyAllocated: alreadyAllocated,
        availableQuantity: Math.max(0, netAvailable), // Never show negative
        sourceInvoices: item.invoiceCount,
        sourcePOs: poData?.sourcePOs || 0,
        deliveryWindow: {
          earliest: item.earliestDelivery,
          latest: item.latestDelivery
        }
      };
      return acc;
    }, {} as Record<string, any>);

    // Add SKUs that only exist in POs (not in invoices)
    poAvailabilityQuery.forEach(poItem => {
      if (poItem.skuId && !availabilityMap[poItem.skuId]) {
        const alreadyAllocated = allocationsMap[poItem.skuId] || 0;
        const netAvailable = poItem.totalQuantity - alreadyAllocated;
        
        availabilityMap[poItem.skuId] = {
          skuId: poItem.skuId,
          skuCode: poItem.skuCode,
          skuName: poItem.skuName,
          totalFromInvoices: 0,
          totalFromPOs: poItem.totalQuantity,
          totalAvailable: poItem.totalQuantity,
          primarySource: 'PO',
          alreadyAllocated: alreadyAllocated,
          availableQuantity: Math.max(0, netAvailable),
          sourceInvoices: 0,
          sourcePOs: poItem.poCount,
          deliveryWindow: {
            earliest: null,
            latest: null
          }
        };
      }
    });

    return NextResponse.json({
      success: true,
      availability: availabilityMap,
      summary: {
        totalSkusWithInventory: availabilityQuery.length,
        totalUnitsAvailable: availabilityQuery.reduce((sum, item) => sum + item.totalQuantity, 0),
        calculatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error calculating inventory availability:', error);
    return NextResponse.json({ error: 'Failed to calculate availability' }, { status: 500 });
  }
}
