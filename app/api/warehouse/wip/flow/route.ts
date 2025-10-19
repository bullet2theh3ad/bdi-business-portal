import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers, productSkus } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

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
    
    if (!isBDIUser && userOrgMembership.length > 0) {
      const userOrganization = userOrgMembership[0].organization;
      console.log(`🔒 Partner org ${userOrganization.code} - filtering WIP flow by owned SKUs`);
      
      // Get SKUs that this organization OWNS (by manufacturer) - same logic as other APIs
      const ownedSkus = await db
        .select({
          sku: productSkus.sku,
          model: productSkus.model,
        })
        .from(productSkus)
        .where(eq(productSkus.mfg, userOrganization.code!));
      
      allowedSkuCodes = ownedSkus.map(s => s.sku);
      const allowedModels = ownedSkus.map(s => s.model).filter(m => m !== null);
      
      // Combine both SKU and model for matching (WIP uses "model_number" field)
      allowedSkuCodes = [...new Set([...allowedSkuCodes, ...allowedModels])];
      
      console.log(`🔍 Partner ${userOrganization.code} allowed SKUs/Models:`, allowedSkuCodes);
      
      if (allowedSkuCodes.length === 0) {
        console.log(`⚠️  No SKUs found for ${userOrganization.code} - returning empty flow data`);
        return NextResponse.json({
          nodes: [],
          links: [],
          stageCounts: {
            Intake: 0,
            'Other Intake': 0,
            WIP: 0,
            RMA: 0,
            Outflow: 0,
          }
        });
      }
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
        console.log(`📦 WIP Flow: Using most recent import batch: ${importBatchId}`);
      }
    }

    // Build query
    let query = supabaseService
      .from('warehouse_wip_units')
      .select('stage, model_number')
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
    if (!isBDIUser && allowedSkuCodes.length > 0) {
      console.log(`🔍 Applying fuzzy matching for WIP flow...`);
      
      // Extract base SKU prefixes for fuzzy matching (e.g., "MNQ1525" from "MNQ1525-30W-U")
      const skuPrefixes = allowedSkuCodes.map(sku => {
        const match = sku.match(/^([A-Z]+\d+)/i);
        return match ? match[1] : sku;
      });
      
      const uniquePrefixes = [...new Set(skuPrefixes)];
      console.log(`🔍 WIP SKU prefixes for fuzzy matching:`, uniquePrefixes);
      
      // Filter units using fuzzy matching
      units = allUnits?.filter((unit: any) => {
        if (!unit.model_number) return false;
        const itemModel = unit.model_number.toUpperCase();
        
        // Check if the model starts with any of our SKU prefixes
        return uniquePrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      }) || [];
      
      console.log(`🔍 After fuzzy matching: ${units.length} WIP units (from ${allUnits?.length || 0} total)`);
    }

    // Count by stage
    const stageCounts: Record<string, number> = {
      Intake: 0,
      'Other Intake': 0,
      WIP: 0,
      RMA: 0,
      Outflow: 0,
    };

    units?.forEach((unit: any) => {
      if (stageCounts.hasOwnProperty(unit.stage)) {
        stageCounts[unit.stage]++;
      }
    });

    // Build Sankey nodes and links
    // Simplified flow: Intake -> WIP -> Outflow
    //                  Intake -> RMA -> Outflow
    const nodes = [
      { id: 0, name: 'Intake' },
      { id: 1, name: 'WIP' },
      { id: 2, name: 'RMA' },
      { id: 3, name: 'Outflow' },
    ];

    const totalIntake = stageCounts['Intake'] + stageCounts['Other Intake'];

    const links = [
      {
        source: 0, // Intake
        target: 1, // WIP
        value: stageCounts['WIP'] || 0,
      },
      {
        source: 0, // Intake
        target: 2, // RMA
        value: stageCounts['RMA'] || 0,
      },
      {
        source: 1, // WIP
        target: 3, // Outflow
        value: Math.floor(stageCounts['Outflow'] * 0.7) || 0, // Approximate 70% from WIP
      },
      {
        source: 2, // RMA
        target: 3, // Outflow
        value: Math.floor(stageCounts['Outflow'] * 0.3) || 0, // Approximate 30% from RMA
      },
    ];

    return NextResponse.json({
      nodes,
      links: links.filter(l => l.value > 0), // Only include non-zero links
      stageCounts,
    });

  } catch (error: any) {
    console.error('❌ Flow API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

