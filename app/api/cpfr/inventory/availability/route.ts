import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoices, invoiceLineItems, productSkus } from '@/lib/db/schema';
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

    console.log('🔍 Calculating inventory availability from invoices...');

    // Calculate available quantities by SKU from confirmed/shipped invoices
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
          // Only count confirmed, shipped, or delivered invoices as "available"
          sql`${invoices.status} IN ('confirmed', 'shipped', 'delivered')`,
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

    // Transform to a more usable format
    const availabilityMap = availabilityQuery.reduce((acc, item) => {
      acc[item.skuId] = {
        skuId: item.skuId,
        skuCode: item.skuCode,
        skuName: item.skuName,
        availableQuantity: item.totalQuantity,
        sourceInvoices: item.invoiceCount,
        deliveryWindow: {
          earliest: item.earliestDelivery,
          latest: item.latestDelivery
        }
      };
      return acc;
    }, {} as Record<string, any>);

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
