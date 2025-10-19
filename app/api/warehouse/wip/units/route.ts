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
    
    if (!isBDIUser && userOrgMembership.length > 0) {
      const userOrganization = userOrgMembership[0].organization;
      console.log(`🔒 Partner org ${userOrganization.code} - filtering WIP units by owned SKUs`);
      
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
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    let importBatchId = searchParams.get('importBatchId');
    const sku = searchParams.get('sku');
    const source = searchParams.get('source');
    const stage = searchParams.get('stage');
    const search = searchParams.get('search'); // For serial number search
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

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
        console.log(`📦 WIP Units: Using most recent import batch: ${importBatchId}`);
      }
    }

    // Build query
    let query = supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact' });

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
    if (stage) {
      query = query.eq('stage', stage);
    }
    if (search) {
      query = query.ilike('serial_number', `%${search}%`);
    }
    if (dateFrom) {
      query = query.gte('received_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('received_date', dateTo);
    }

    // Apply pagination and sorting
    query = query
      .order('received_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: allUnits, count, error } = await query;

    if (error) {
      throw error;
    }

    // Apply fuzzy matching filter for partner organizations
    let units = allUnits;
    let filteredCount = count;
    
    if (!isBDIUser && allowedSkuCodes.length > 0 && allUnits) {
      console.log(`🔍 Applying fuzzy matching for WIP units...`);
      
      // Extract base SKU prefixes for fuzzy matching (e.g., "MNQ1525" from "MNQ1525-30W-U")
      const skuPrefixes = allowedSkuCodes.map(sku => {
        const match = sku.match(/^([A-Z]+\d+)/i);
        return match ? match[1] : sku;
      });
      
      const uniquePrefixes = [...new Set(skuPrefixes)];
      console.log(`🔍 WIP units SKU prefixes for fuzzy matching:`, uniquePrefixes);
      
      // Filter units using fuzzy matching
      units = allUnits.filter((unit: any) => {
        if (!unit.model_number) return false;
        const itemModel = unit.model_number.toUpperCase();
        
        // Check if the model starts with any of our SKU prefixes
        return uniquePrefixes.some(prefix => itemModel.startsWith(prefix.toUpperCase()));
      });
      
      filteredCount = units.length;
      console.log(`🔍 After fuzzy matching: ${units.length} WIP units (from ${allUnits.length} total)`);
    }

    return NextResponse.json({
      units: units || [],
      total: filteredCount || 0,
      page,
      limit,
      totalPages: filteredCount ? Math.ceil(filteredCount / limit) : 0,
    });

  } catch (error: any) {
    console.error('❌ Units API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

