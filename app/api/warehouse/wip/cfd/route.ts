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
      console.log(`🔒 Partner org ${userOrganization.code} - filtering WIP CFD by owned SKUs`);
      
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
      
      console.log(`🔍 Partner ${userOrganization.code} CFD allowed SKU prefixes:`, skuPrefixes);
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    let importBatchId = searchParams.get('importBatchId');
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
        console.log(`📦 WIP CFD: Using most recent import batch: ${importBatchId}`);
      }
    }

    // Build query
    let query = supabaseService
      .from('warehouse_wip_units')
      .select('iso_year_week_received, stage, model_number')
      .not('iso_year_week_received', 'is', null)
      .not('stage', 'is', null);

    // Apply filters
    if (importBatchId) {
      query = query.eq('import_batch_id', importBatchId);
    }
    if (sku) {
      query = query.eq('model_number', sku);
    }
    if (source) {
      query = query.ilike('source', `%${source}%`);
    }

    const { data: allUnits, error } = await query;

    if (error) {
      throw error;
    }

    // Apply fuzzy matching filter for partner organizations
    let units = allUnits;
    if (!isBDIUser && skuPrefixes.length > 0 && allUnits) {
      units = allUnits.filter((unit: any) => {
        if (!unit.model_number) return false;
        const itemModel = unit.model_number.toUpperCase();
        return skuPrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
      console.log(`🔍 CFD fuzzy filter: ${units.length} units (from ${allUnits.length} total)`);
    }

    // Group by week
    // For Intake: count units received in that week (regardless of current stage)
    // For other stages: count units in that stage received in/before that week
    const weeklyData: Record<string, Record<string, number>> = {};

    units?.forEach((unit: any) => {
      const week = unit.iso_year_week_received;

      if (!weeklyData[week]) {
        weeklyData[week] = {
          Intake: 0,
          WIP: 0,
          RMA: 0,
          Outflow: 0,
        };
      }

      // Count all units received this week as Intake
      weeklyData[week].Intake++;

      // Also count by current stage for the other metrics
      const stage = unit.stage;
      if (stage === 'WIP') {
        weeklyData[week].WIP++;
      } else if (stage === 'RMA') {
        weeklyData[week].RMA++;
      } else if (stage === 'Outflow') {
        weeklyData[week].Outflow++;
      }
    });

    // Sort weeks and format for chart
    const sortedWeeks = Object.keys(weeklyData).sort();
    
    const result = sortedWeeks.map((week) => ({
      week,
      ...weeklyData[week],
    }));

    return NextResponse.json({ cfd: result });

  } catch (error: any) {
    console.error('❌ CFD API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

