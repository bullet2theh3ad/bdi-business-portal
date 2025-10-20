import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { amazonInventorySnapshots } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Sales Velocity] Fetching Amazon inventory from database...');

    // Get the most recent snapshot date
    const latestSnapshot = await db
      .select({
        snapshotDate: amazonInventorySnapshots.snapshotDate,
      })
      .from(amazonInventorySnapshots)
      .orderBy(sql`${amazonInventorySnapshots.snapshotDate} DESC`)
      .limit(1);

    if (latestSnapshot.length === 0) {
      return NextResponse.json({
        totalSKUs: 0,
        totalUnits: 0,
        lastSyncDate: null,
        skuDetails: [],
      });
    }

    const lastSyncDate = latestSnapshot[0].snapshotDate;

    // Get all inventory for the latest snapshot
    const inventoryData = await db
      .select({
        sku: amazonInventorySnapshots.sellerSku,
        asin: amazonInventorySnapshots.asin,
        fnsku: amazonInventorySnapshots.fnsku,
        condition: amazonInventorySnapshots.condition,
        totalQuantity: amazonInventorySnapshots.afnTotalQuantity,
      })
      .from(amazonInventorySnapshots)
      .where(sql`${amazonInventorySnapshots.snapshotDate} = ${lastSyncDate}`)
      .orderBy(sql`${amazonInventorySnapshots.afnTotalQuantity} DESC`);

    // Calculate totals
    const totalUnits = inventoryData.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
    const uniqueSKUs = new Set(inventoryData.map(item => item.sku)).size;

    console.log(`[Sales Velocity] Found ${uniqueSKUs} SKUs, ${totalUnits} total units`);

    return NextResponse.json({
      totalSKUs: uniqueSKUs,
      totalUnits,
      lastSyncDate: lastSyncDate?.toString() || null,
      skuDetails: inventoryData.map(item => ({
        sku: item.sku || '',
        asin: item.asin || '',
        fnsku: item.fnsku || '',
        condition: item.condition || 'SELLABLE',
        totalQuantity: item.totalQuantity || 0,
      })),
    });
  } catch (error: any) {
    console.error('[Sales Velocity] Error fetching Amazon inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Amazon inventory', details: error.message },
      { status: 500 }
    );
  }
}

