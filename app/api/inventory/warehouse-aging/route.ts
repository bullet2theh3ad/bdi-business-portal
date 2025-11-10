import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, emgInventoryTracking, organizations, organizationMembers, productSkus, skuMappings } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

interface AgingBucket {
  bucket: string;
  days: string;
  totalUnits: number;
  totalValue: number;
  skuCount: number;
}

interface AgingData {
  emg: {
    buckets: AgingBucket[];
    totalValue: number;
    totalUnits: number;
    lastUpdated: string | null;
  };
  catv: {
    buckets: AgingBucket[];
    totalValue: number;
    totalUnits: number;
    lastUpdated: string | null;
  };
}

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

    console.log(`📊 Warehouse Aging - User org: ${userOrganization.code} (${userOrganization.type}), isBDI: ${isBDIUser}`);

    // Get allowed SKU codes for filtering (same logic as warehouse-summary)
    let allowedSkuCodes: string[] = [];
    
    if (!isBDIUser) {
      const partnerSkus = await db
        .select({
          sku: productSkus.sku,
          model: productSkus.model,
        })
        .from(productSkus)
        .where(eq(productSkus.mfg, userOrganization.code!));
      
      allowedSkuCodes = partnerSkus.map(s => s.sku);
      const allowedModels = partnerSkus.map(s => s.model).filter(m => m !== null);
      allowedSkuCodes = [...new Set([...allowedSkuCodes, ...allowedModels])];
      
      console.log(`🔍 Partner ${userOrganization.code} allowed SKUs/Models:`, allowedSkuCodes);
      
      if (allowedSkuCodes.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            emg: { buckets: [], totalValue: 0, totalUnits: 0, lastUpdated: null },
            catv: { buckets: [], totalValue: 0, totalUnits: 0, lastUpdated: null },
          },
        });
      }
    }

    // ========================================
    // EMG Warehouse Aging
    // ========================================
    // Calculate aging from first_seen to current date
    const emgInventory = await db.select().from(emgInventoryTracking);

    // Get ALL SKU mappings and costs
    const allMappings = await db
      .select({
        externalIdentifier: skuMappings.externalIdentifier,
        internalSku: productSkus.sku,
      })
      .from(skuMappings)
      .leftJoin(productSkus, eq(skuMappings.internalSkuId, productSkus.id));

    const allBdiSkus = await db.select().from(productSkus);
    const bdiSkuCostMap = new Map(allBdiSkus.map(s => [s.sku, Number(s.standardCost) || 0]));
    
    // Create a map of external identifier -> BDI SKU (case-insensitive)
    const skuLookup = new Map<string, string>();
    allMappings.forEach(mapping => {
      if (mapping.externalIdentifier && mapping.internalSku) {
        skuLookup.set(mapping.externalIdentifier.toLowerCase(), mapping.internalSku);
      }
    });

    // Filter EMG inventory by allowed SKUs if needed
    const filteredEmgInventory = isBDIUser 
      ? emgInventory 
      : emgInventory.filter(item => allowedSkuCodes.includes(item.model || ''));

    // Calculate aging buckets for EMG
    const emgBucketMap = new Map<string, { units: number; value: number; skus: Set<string> }>();
    let emgTotalValue = 0;
    let emgTotalUnits = 0;
    let emgLastUpdated = null as Date | null;

    filteredEmgInventory.forEach(item => {
      if (!item.model || item.qtyOnHand === 0) return;

      // Get aging in days from first_seen to now
      const firstSeenDate = item.firstSeen ? new Date(item.firstSeen) : new Date();
      const agingDays = Math.floor((Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24));

      // Determine aging bucket
      let bucket = '90+ days';
      if (agingDays <= 30) bucket = '0-30 days';
      else if (agingDays <= 60) bucket = '31-60 days';
      else if (agingDays <= 90) bucket = '61-90 days';

      // Get cost from BDI SKU mapping (case-insensitive)
      const bdiSku = skuLookup.get((item.model || '').toLowerCase());
      const standardCost: number = bdiSku ? (bdiSkuCostMap.get(bdiSku) || 0) : 0;
      const itemValue = (item.qtyOnHand || 0) * standardCost;

      // Update bucket totals
      if (!emgBucketMap.has(bucket)) {
        emgBucketMap.set(bucket, { units: 0, value: 0, skus: new Set() });
      }
      const bucketData = emgBucketMap.get(bucket)!;
      bucketData.units += item.qtyOnHand || 0;
      bucketData.value += itemValue;
      bucketData.skus.add(item.model);

      emgTotalUnits += item.qtyOnHand || 0;
      emgTotalValue += itemValue;

      // Track latest upload date
      if (item.uploadDate) {
        const uploadDate = new Date(item.uploadDate);
        if (!emgLastUpdated || uploadDate > emgLastUpdated) {
          emgLastUpdated = uploadDate;
        }
      }
    });

    // Convert EMG bucket map to array
    const emgBuckets: AgingBucket[] = [
      {
        bucket: '0-30 days',
        days: '0-30',
        totalUnits: emgBucketMap.get('0-30 days')?.units || 0,
        totalValue: emgBucketMap.get('0-30 days')?.value || 0,
        skuCount: emgBucketMap.get('0-30 days')?.skus.size || 0,
      },
      {
        bucket: '31-60 days',
        days: '31-60',
        totalUnits: emgBucketMap.get('31-60 days')?.units || 0,
        totalValue: emgBucketMap.get('31-60 days')?.value || 0,
        skuCount: emgBucketMap.get('31-60 days')?.skus.size || 0,
      },
      {
        bucket: '61-90 days',
        days: '61-90',
        totalUnits: emgBucketMap.get('61-90 days')?.units || 0,
        totalValue: emgBucketMap.get('61-90 days')?.value || 0,
        skuCount: emgBucketMap.get('61-90 days')?.skus.size || 0,
      },
      {
        bucket: '90+ days',
        days: '90+',
        totalUnits: emgBucketMap.get('90+ days')?.units || 0,
        totalValue: emgBucketMap.get('90+ days')?.value || 0,
        skuCount: emgBucketMap.get('90+ days')?.skus.size || 0,
      },
    ];

    // ========================================
    // CATV Warehouse Aging
    // ========================================
    // Fetch from warehouse_wip_units using Supabase client
    const BATCH_SIZE = 10000;
    let offset = 0;
    let allWipUnits: any[] = [];
    let hasMore = true;

    // Get latest import batch to filter by most recent data
    const { data: latestImport } = await supabase
      .from('warehouse_wip_imports')
      .select('id, imported_at')
      .order('imported_at', { ascending: false })
      .limit(1)
      .single();

    while (hasMore) {
      const { data: wipUnits, error } = await supabase
        .from('warehouse_wip_units')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('received_date', { ascending: false });

      if (error) {
        console.error('Error fetching WIP units:', error);
        break;
      }

      if (!wipUnits || wipUnits.length === 0) {
        hasMore = false;
        break;
      }

      allWipUnits = allWipUnits.concat(wipUnits);
      offset += BATCH_SIZE;

      if (wipUnits.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // Filter by latest import batch if available
    const filteredWipUnits = latestImport
      ? allWipUnits.filter((unit: any) => unit.import_batch_id === latestImport.id)
      : allWipUnits;

    // Filter by allowed SKUs if needed
    const finalWipUnits = isBDIUser
      ? filteredWipUnits
      : filteredWipUnits.filter((unit: any) => allowedSkuCodes.includes(unit.model_number || ''));

    // Calculate aging buckets for CATV
    const catvBucketMap = new Map<string, { units: number; value: number; skus: Set<string> }>();
    let catvTotalValue = 0;
    let catvTotalUnits = 0;
    let catvLastUpdated = null as Date | null;

    finalWipUnits.forEach((unit: any) => {
      if (!unit.model_number) return;

      // Calculate aging in days
      const receivedDate = unit.received_date ? new Date(unit.received_date) : null;
      const agingDays = receivedDate
        ? Math.floor((Date.now() - receivedDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Determine aging bucket
      let bucket = '90+ days';
      if (agingDays <= 30) bucket = '0-30 days';
      else if (agingDays <= 60) bucket = '31-60 days';
      else if (agingDays <= 90) bucket = '61-90 days';

      // Get cost from BDI SKU mapping (case-insensitive)
      const bdiSku = skuLookup.get((unit.model_number || '').toLowerCase());
      const standardCost: number = bdiSku ? (bdiSkuCostMap.get(bdiSku) || 0) : 0;
      const unitValue = standardCost;

      // Update bucket totals
      if (!catvBucketMap.has(bucket)) {
        catvBucketMap.set(bucket, { units: 0, value: 0, skus: new Set() });
      }
      const bucketData = catvBucketMap.get(bucket)!;
      bucketData.units += 1;
      bucketData.value += unitValue;
      bucketData.skus.add(unit.model_number);

      catvTotalUnits += 1;
      catvTotalValue += unitValue;

      // Track latest imported_at
      if (unit.imported_at) {
        const importedAt = new Date(unit.imported_at);
        if (!catvLastUpdated || importedAt > catvLastUpdated) {
          catvLastUpdated = importedAt;
        }
      }
    });

    // Convert CATV bucket map to array
    const catvBuckets: AgingBucket[] = [
      {
        bucket: '0-30 days',
        days: '0-30',
        totalUnits: catvBucketMap.get('0-30 days')?.units || 0,
        totalValue: catvBucketMap.get('0-30 days')?.value || 0,
        skuCount: catvBucketMap.get('0-30 days')?.skus.size || 0,
      },
      {
        bucket: '31-60 days',
        days: '31-60',
        totalUnits: catvBucketMap.get('31-60 days')?.units || 0,
        totalValue: catvBucketMap.get('31-60 days')?.value || 0,
        skuCount: catvBucketMap.get('31-60 days')?.skus.size || 0,
      },
      {
        bucket: '61-90 days',
        days: '61-90',
        totalUnits: catvBucketMap.get('61-90 days')?.units || 0,
        totalValue: catvBucketMap.get('61-90 days')?.value || 0,
        skuCount: catvBucketMap.get('61-90 days')?.skus.size || 0,
      },
      {
        bucket: '90+ days',
        days: '90+',
        totalUnits: catvBucketMap.get('90+ days')?.units || 0,
        totalValue: catvBucketMap.get('90+ days')?.value || 0,
        skuCount: catvBucketMap.get('90+ days')?.skus.size || 0,
      },
    ];

    console.log('📊 Aging Data Calculated:');
    console.log(`  EMG Total: ${emgTotalUnits} units, $${emgTotalValue.toFixed(2)}`);
    console.log(`  CATV Total: ${catvTotalUnits} units, $${catvTotalValue.toFixed(2)}`);

    const agingData: AgingData = {
      emg: {
        buckets: emgBuckets,
        totalValue: emgTotalValue,
        totalUnits: emgTotalUnits,
        lastUpdated: emgLastUpdated ? emgLastUpdated.toISOString() : null,
      },
      catv: {
        buckets: catvBuckets,
        totalValue: catvTotalValue,
        totalUnits: catvTotalUnits,
        lastUpdated: catvLastUpdated ? catvLastUpdated.toISOString() : null,
      },
    };

    return NextResponse.json({ success: true, data: agingData });

  } catch (error) {
    console.error('Error fetching warehouse aging data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch warehouse aging data' },
      { status: 500 }
    );
  }
}

