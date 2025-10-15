import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers, productSkus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization for filtering
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, user.id))
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
    let skuPrefixes: string[] = [];
    
    if (!isBDIUser && userOrgMembership.length > 0) {
      const userOrganization = userOrgMembership[0].organization;
      console.log(`🔒 Partner org ${userOrganization.code} - filtering WIP aging by owned SKUs`);
      
      // Get SKUs that this organization OWNS (by manufacturer)
      const ownedSkus = await db
        .select({
          sku: productSkus.sku,
          model: productSkus.model,
        })
        .from(productSkus)
        .where(eq(productSkus.mfg, userOrganization.code!));
      
      allowedSkuCodes = ownedSkus.map(s => s.sku);
      const allowedModels = ownedSkus.map(s => s.model).filter(m => m !== null);
      
      // Combine both SKU and model for matching
      allowedSkuCodes = [...new Set([...allowedSkuCodes, ...allowedModels])];
      
      // Extract base SKU prefixes for fuzzy matching
      skuPrefixes = allowedSkuCodes.map(sku => {
        const match = sku.match(/^([A-Z]+\d+)/i);
        return match ? match[1] : sku;
      });
      skuPrefixes = [...new Set(skuPrefixes)];
      
      console.log(`🔍 Partner ${userOrganization.code} Aging allowed SKU prefixes:`, skuPrefixes);
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const importBatchId = searchParams.get('importBatchId');
    const sku = searchParams.get('sku');
    const source = searchParams.get('source');

    // Use direct Supabase client
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

    // Build base query for active WIP units (not outflow)
    let baseQuery = supabaseService
      .from('warehouse_wip_units')
      .select('aging_bucket, model_number')
      .neq('stage', 'Outflow')
      .not('aging_bucket', 'is', null);

    // Apply filters
    if (importBatchId) {
      baseQuery = baseQuery.eq('import_batch_id', importBatchId);
    }
    if (sku) {
      baseQuery = baseQuery.eq('model_number', sku);
    }
    if (source) {
      baseQuery = baseQuery.ilike('source', `%${source}%`);
    }

    const { data: allAgingData, error } = await baseQuery;

    if (error) {
      throw error;
    }

    // Apply fuzzy matching filter for partner organizations
    let agingData = allAgingData;
    if (!isBDIUser && skuPrefixes.length > 0 && allAgingData) {
      agingData = allAgingData.filter((unit: any) => {
        if (!unit.model_number) return false;
        const itemModel = unit.model_number.toUpperCase();
        return skuPrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
      console.log(`🔍 Aging fuzzy filter: ${agingData.length} units (from ${allAgingData.length} total)`);
    }

    // Count by bucket
    const bucketCounts: Record<string, number> = {
      '0-7': 0,
      '8-14': 0,
      '15-30': 0,
      '>30': 0,
    };

    agingData?.forEach((unit: any) => {
      if (unit.aging_bucket && bucketCounts.hasOwnProperty(unit.aging_bucket)) {
        bucketCounts[unit.aging_bucket]++;
      }
    });

    // Format for chart
    const result = Object.entries(bucketCounts).map(([bucket, count]) => ({
      bucket,
      count,
    }));

    return NextResponse.json({ aging: result });

  } catch (error: any) {
    console.error('❌ Aging API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

