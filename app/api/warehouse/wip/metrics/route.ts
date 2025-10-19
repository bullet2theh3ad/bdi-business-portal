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
      console.log(`🔒 Partner org ${userOrganization.code} - filtering WIP metrics by owned SKUs`);
      
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
      
      console.log(`🔍 Partner ${userOrganization.code} allowed SKU prefixes:`, skuPrefixes);
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    let importBatchId = searchParams.get('importBatchId');
    const sku = searchParams.get('sku');
    const source = searchParams.get('source');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    
    // Use direct Supabase client for queries
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
    
    // If no importBatchId specified, use the most recent completed import
    if (!importBatchId) {
      const { data: latestImport } = await supabaseService
        .from('warehouse_wip_imports')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestImport) {
        importBatchId = latestImport.id;
        console.log(`📦 Using most recent import batch: ${importBatchId}`);
      }
    }

    // Helper function to apply fuzzy matching filter
    const applyFuzzyFilter = (units: any[]) => {
      if (isBDIUser || skuPrefixes.length === 0) {
        return units;
      }
      return units.filter((unit: any) => {
        if (!unit.model_number) return false;
        const itemModel = unit.model_number.toUpperCase();
        return skuPrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
    };

    // Fetch ALL data once for partner orgs (need to apply fuzzy matching after fetch)
    // For BDI, we can still use count-only queries
    const needsFullFetch = !isBDIUser && skuPrefixes.length > 0;

    // Fetch ALL data iteratively to bypass Supabase 1000 record limit
    console.log('📊 Fetching all WIP units...');
    let allUnits: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabaseService
        .from('warehouse_wip_units')
        .select('serial_number, model_number, stage, aging_days, received_date, source')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters
      if (importBatchId) {
        query = query.eq('import_batch_id', importBatchId);
      }
      if (sku) {
        query = query.eq('model_number', sku);
      }
      if (source) {
        query = query.eq('source', source);
      }
      if (fromDate) {
        query = query.gte('received_date', fromDate);
      }
      if (toDate) {
        query = query.lte('received_date', toDate);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error(`❌ Error fetching page ${page}:`, error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allUnits = allUnits.concat(data);
        console.log(`📦 Fetched page ${page + 1}: ${data.length} records (total: ${allUnits.length})`);
        
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`✅ Total records fetched: ${allUnits.length}`);
    
    if (needsFullFetch) {
      // Apply fuzzy matching for partner orgs
      const filteredUnits = applyFuzzyFilter(allUnits || []);
      
      console.log(`🔍 WIP metrics fuzzy filter: ${filteredUnits.length} rows (from ${allUnits?.length || 0} total)`);

      // Calculate metrics from filtered data using UNIQUE serial numbers
      const uniqueSerials = new Set(filteredUnits.map((u: any) => u.serial_number).filter(Boolean));
      const totalIntake = uniqueSerials.size;
      
      // For stage counts, get unique serials per stage
      const wipSerials = new Set(filteredUnits.filter((u: any) => u.stage === 'WIP').map((u: any) => u.serial_number).filter(Boolean));
      const rmaSerials = new Set(filteredUnits.filter((u: any) => u.stage === 'RMA').map((u: any) => u.serial_number).filter(Boolean));
      const outflowSerials = new Set(filteredUnits.filter((u: any) => u.stage === 'Outflow').map((u: any) => u.serial_number).filter(Boolean));
      const intakeSerials = new Set(filteredUnits.filter((u: any) => u.stage === 'Intake' || u.stage === 'Other Intake').map((u: any) => u.serial_number).filter(Boolean));

      // Calculate average aging
      const wipUnitsWithAging = filteredUnits.filter((u: any) => u.stage === 'WIP' && u.aging_days != null);
      const avgAgingDays = wipUnitsWithAging.length > 0
        ? Math.round(wipUnitsWithAging.reduce((sum: number, item: any) => sum + (item.aging_days || 0), 0) / wipUnitsWithAging.length)
        : 0;

      return NextResponse.json({
        metrics: {
          totalIntake,
          activeWip: wipSerials.size || 0,
          rma: rmaSerials.size || 0,
          outflow: outflowSerials.size || 0,
          intake: intakeSerials.size || 0,
          avgAging: avgAgingDays,
        },
      });
    } else {
      // BDI users: count unique serial numbers from fetched data
      const uniqueSerials = new Set((allUnits || []).map((u: any) => u.serial_number).filter(Boolean));
      const totalIntake = uniqueSerials.size;
      
      // Count unique serials per stage
      const wipSerials = new Set((allUnits || []).filter((u: any) => u.stage === 'WIP').map((u: any) => u.serial_number).filter(Boolean));
      const rmaSerials = new Set((allUnits || []).filter((u: any) => u.stage === 'RMA').map((u: any) => u.serial_number).filter(Boolean));
      const outflowSerials = new Set((allUnits || []).filter((u: any) => u.stage === 'Outflow').map((u: any) => u.serial_number).filter(Boolean));
      const intakeSerials = new Set((allUnits || []).filter((u: any) => u.stage === 'Intake' || u.stage === 'Other Intake').map((u: any) => u.serial_number).filter(Boolean));

      // Calculate average aging for active WIP
      const wipUnitsWithAging = (allUnits || []).filter((u: any) => u.stage === 'WIP' && u.aging_days != null);
      const avgAgingDays = wipUnitsWithAging.length > 0
        ? Math.round(wipUnitsWithAging.reduce((sum: number, u: any) => sum + (u.aging_days || 0), 0) / wipUnitsWithAging.length)
        : 0;

      return NextResponse.json({
        totalIntake: totalIntake || 0,
        intake: intakeSerials.size || 0,
        wip: wipSerials.size || 0,
        rma: rmaSerials.size || 0,
        outflow: outflowSerials.size || 0,
        avgAgingDays,
      });
    }

  } catch (error: any) {
    console.error('❌ Metrics API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to build filter object
function buildFilters(
  importBatchId?: string | null,
  sku?: string | null,
  source?: string | null,
  fromDate?: string | null,
  toDate?: string | null
) {
  const filters: any = {};
  
  if (importBatchId) filters.import_batch_id = importBatchId;
  if (sku) filters.model_number = sku;
  // Note: source uses ilike, handle separately in queries
  
  return filters;
}

