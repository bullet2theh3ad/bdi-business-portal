import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, warehouses, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

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

    // Get the requesting user and their organization membership
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
        role: organizationMembers.role
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (userOrgMembership.length === 0) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership[0].organization;

    // Determine warehouse access based on organization type
    const isBDIUser = userOrganization.code === 'BDI' && userOrganization.type === 'internal';
    
    console.log(`🏭 Fetching warehouses - User org: ${userOrganization.code} (${userOrganization.type}), isBDI: ${isBDIUser}`);

    let warehousesData: any[] = [];
    let warehousesError: any = null;

    if (isBDIUser) {
      // BDI users can see all warehouses (their own + partner warehouses for CPFR)
      const result = await supabase
        .from('warehouses')
        .select(`*`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      warehousesData = result.data || [];
      warehousesError = result.error;
    } else {
      // Partner users (MTN, etc.) can see:
      // 1. Their own organization's warehouses
      // 2. BDI warehouses (like EMG) for CPFR coordination
      const bdiOrgResult = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.code, 'BDI'))
        .limit(1);
      
      const bdiOrgId = bdiOrgResult[0]?.id;
      
      if (bdiOrgId) {
        console.log(`🔍 Partner org ${userOrganization.code} can see warehouses where:`);
        console.log(`   - organization_id = ${userOrganization.id} (own warehouses) OR`);
        console.log(`   - organization_id = ${bdiOrgId} (BDI warehouses like EMG)`);
        
        // Try separate queries instead of complex .in() query
        const [ownWarehouses, bdiWarehouses] = await Promise.all([
          supabase
            .from('warehouses')
            .select(`*`)
            .eq('organization_id', userOrganization.id)
            .eq('is_active', true),
          supabase
            .from('warehouses')
            .select(`*`)
            .eq('organization_id', bdiOrgId)
            .eq('is_active', true)
        ]);

        const combinedWarehouses = [
          ...(ownWarehouses.data || []),
          ...(bdiWarehouses.data || [])
        ];

        console.log(`🔍 Own warehouses: ${ownWarehouses.data?.length || 0}`);
        console.log(`🔍 BDI warehouses: ${bdiWarehouses.data?.length || 0}`);
        console.log(`🔍 Combined warehouses: ${combinedWarehouses.length}`);

        warehousesData = combinedWarehouses;
        warehousesError = ownWarehouses.error || bdiWarehouses.error;
      } else {
        console.log(`🔍 No BDI org found - ${userOrganization.code} can only see own warehouses`);
        const result = await supabase
          .from('warehouses')
          .select(`*`)
          .eq('organization_id', userOrganization.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        
        warehousesData = result.data || [];
        warehousesError = result.error;
      }
    }

    if (warehousesError) {
      console.error('Database error:', warehousesError);
      return NextResponse.json([]);
    }

    // Transform data to match frontend interface
    const transformedWarehouses = (warehousesData || []).map((row: any) => ({
      id: row.id,
      warehouseCode: row.warehouse_code,
      name: row.name,
      type: row.type,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
      timezone: row.timezone,
      capabilities: row.capabilities,
      mainCapabilities: (() => {
        try {
          return row.main_capabilities && row.main_capabilities !== '' ? JSON.parse(row.main_capabilities) : [];
        } catch (e) {
          console.warn('Invalid main_capabilities JSON:', row.main_capabilities);
          return [];
        }
      })(),
      contacts: (() => {
        try {
          // Check if contacts is already an object/array or a string
          if (typeof row.contacts === 'string') {
            return row.contacts && row.contacts !== '' ? JSON.parse(row.contacts) : [];
          } else if (Array.isArray(row.contacts)) {
            return row.contacts;
          } else {
            return [];
          }
        } catch (e) {
          console.warn('Invalid contacts JSON:', row.contacts);
          return [];
        }
      })(),
      operatingHours: row.operating_hours,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      maxPalletHeight: row.max_pallet_height_cm,
      maxPalletWeight: row.max_pallet_weight_kg,
      loadingDockCount: row.loading_dock_count,
      storageCapacity: row.storage_capacity_sqm,
      isActive: row.is_active,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    console.log(`🏭 Fetching warehouses - returning ${transformedWarehouses.length} warehouses`);
    console.log('📍 Warehouse codes:', transformedWarehouses.map(w => `${w.warehouseCode} (${w.name})`));
    
    return NextResponse.json(transformedWarehouses);

  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (userOrgMembership.length === 0) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership[0].organization;

    const body = await request.json();
    console.log('🔄 Creating warehouse:', body);

    // Validate required fields
    if (!body.warehouseCode || !body.name || !body.type || !body.address || !body.city || !body.country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create warehouse in database
    const { data: newWarehouse, error: insertError } = await supabase
      .from('warehouses')
      .insert({
        warehouse_code: body.warehouseCode,
        name: body.name,
        type: body.type, // Primary warehouse type
        address: body.address,
        city: body.city,
        state: body.state || null,
        country: body.country,
        postal_code: body.postalCode || null,
        timezone: body.timezone || 'UTC',
        capabilities: body.capabilities || {},
        main_capabilities: JSON.stringify(body.mainCapabilities || []), // Store main capabilities array
        contacts: JSON.stringify(body.contacts || []), // Store contacts array
        operating_hours: body.operatingHours || null,
        contact_name: body.contacts?.[0]?.name || body.contactName || null, // Legacy compatibility
        contact_email: body.contacts?.[0]?.email || body.contactEmail || null, // Legacy compatibility
        contact_phone: body.contacts?.[0]?.phone || body.contactPhone || null, // Legacy compatibility
        max_pallet_height_cm: body.maxPalletHeight || 180,
        max_pallet_weight_kg: body.maxPalletWeight || 1000,
        loading_dock_count: body.loadingDockCount || 1,
        storage_capacity_sqm: body.storageCapacity || 1000,
        notes: body.notes || null,
        created_by: requestingUser.authId,
        organization_id: userOrganization.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log('✅ Warehouse created in database:', newWarehouse);

    return NextResponse.json({
      success: true,
      message: 'Warehouse created successfully!',
      warehouse: newWarehouse
    });

  } catch (error) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json({ error: 'Failed to create warehouse' }, { status: 500 });
  }
}
