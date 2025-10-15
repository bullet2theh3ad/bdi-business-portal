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
    const importBatchId = searchParams.get('importBatchId');
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

    // Build base query for total intake
    let query = supabaseService.from('warehouse_wip_units').select(needsFullFetch ? 'model_number, stage, aging_days, received_date, source' : '*', { count: 'exact', head: !needsFullFetch });

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

    if (needsFullFetch) {
      // Fetch all data and apply fuzzy matching for partner orgs
      const { data: allUnits } = await query;
      const filteredUnits = applyFuzzyFilter(allUnits || []);
      
      console.log(`🔍 WIP metrics fuzzy filter: ${filteredUnits.length} units (from ${allUnits?.length || 0} total)`);

      // Calculate metrics from filtered data
      const totalIntake = filteredUnits.length;
      const wipCount = filteredUnits.filter((u: any) => u.stage === 'WIP').length;
      const rmaCount = filteredUnits.filter((u: any) => u.stage === 'RMA').length;
      const outflowCount = filteredUnits.filter((u: any) => u.stage === 'Outflow').length;
      const intakeCount = filteredUnits.filter((u: any) => u.stage === 'Intake' || u.stage === 'Other Intake').length;

      // Calculate average aging
      const wipUnitsWithAging = filteredUnits.filter((u: any) => u.stage === 'WIP' && u.aging_days != null);
      const avgAgingDays = wipUnitsWithAging.length > 0
        ? Math.round(wipUnitsWithAging.reduce((sum: number, item: any) => sum + (item.aging_days || 0), 0) / wipUnitsWithAging.length)
        : 0;

      return NextResponse.json({
        metrics: {
          totalIntake,
          activeWip: wipCount || 0,
          rma: rmaCount || 0,
          outflow: outflowCount || 0,
          intake: intakeCount || 0,
          avgAging: avgAgingDays,
        },
      });
    } else {
      // BDI users: use efficient count-only queries
      const { count: totalIntake } = await query;

      // Get counts by stage
      let wipQuery = supabaseService
        .from('warehouse_wip_units')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'WIP');
      if (importBatchId) wipQuery = wipQuery.eq('import_batch_id', importBatchId);
      if (sku) wipQuery = wipQuery.eq('model_number', sku);
      if (source) wipQuery = wipQuery.eq('source', source);
      if (fromDate) wipQuery = wipQuery.gte('received_date', fromDate);
      if (toDate) wipQuery = wipQuery.lte('received_date', toDate);
      const { count: wipCount } = await wipQuery;

      let rmaQuery = supabaseService
        .from('warehouse_wip_units')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'RMA');
      if (importBatchId) rmaQuery = rmaQuery.eq('import_batch_id', importBatchId);
      if (sku) rmaQuery = rmaQuery.eq('model_number', sku);
      if (source) rmaQuery = rmaQuery.eq('source', source);
      if (fromDate) rmaQuery = rmaQuery.gte('received_date', fromDate);
      if (toDate) rmaQuery = rmaQuery.lte('received_date', toDate);
      const { count: rmaCount } = await rmaQuery;

      let outflowQuery = supabaseService
        .from('warehouse_wip_units')
        .select('*', { count: 'exact', head: true })
        .eq('stage', 'Outflow');
      if (importBatchId) outflowQuery = outflowQuery.eq('import_batch_id', importBatchId);
      if (sku) outflowQuery = outflowQuery.eq('model_number', sku);
      if (source) outflowQuery = outflowQuery.eq('source', source);
      if (fromDate) outflowQuery = outflowQuery.gte('received_date', fromDate);
      if (toDate) outflowQuery = outflowQuery.lte('received_date', toDate);
      const { count: outflowCount } = await outflowQuery;

      let intakeQuery = supabaseService
        .from('warehouse_wip_units')
        .select('*', { count: 'exact', head: true })
        .in('stage', ['Intake', 'Other Intake']);
      if (importBatchId) intakeQuery = intakeQuery.eq('import_batch_id', importBatchId);
      if (sku) intakeQuery = intakeQuery.eq('model_number', sku);
      if (source) intakeQuery = intakeQuery.eq('source', source);
      if (fromDate) intakeQuery = intakeQuery.gte('received_date', fromDate);
      if (toDate) intakeQuery = intakeQuery.lte('received_date', toDate);
      const { count: intakeCount } = await intakeQuery;

      // Calculate average aging for active WIP
      let agingQuery = supabaseService
        .from('warehouse_wip_units')
        .select('aging_days')
        .eq('stage', 'WIP')
        .not('aging_days', 'is', null);
      if (importBatchId) agingQuery = agingQuery.eq('import_batch_id', importBatchId);
      if (sku) agingQuery = agingQuery.eq('model_number', sku);
      if (source) agingQuery = agingQuery.eq('source', source);
      if (fromDate) agingQuery = agingQuery.gte('received_date', fromDate);
      if (toDate) agingQuery = agingQuery.lte('received_date', toDate);
      const { data: agingData } = await agingQuery;

      const avgAgingDays = agingData && agingData.length > 0
        ? Math.round(agingData.reduce((sum: number, u: any) => sum + (u.aging_days || 0), 0) / agingData.length)
        : 0;

      return NextResponse.json({
        totalIntake: totalIntake || 0,
        intake: intakeCount || 0,
        wip: wipCount || 0,
        rma: rmaCount || 0,
        outflow: outflowCount || 0,
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

