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

    // Fetch warehouses from database using Supabase client
    const { data: warehousesData, error: warehousesError } = await supabase
      .from('warehouses')
      .select(`
        id,
        warehouse_code,
        name,
        type,
        address,
        city,
        state,
        country,
        postal_code,
        timezone,
        capabilities,
        operating_hours,
        contact_name,
        contact_email,
        contact_phone,
        max_pallet_height_cm,
        max_pallet_weight_kg,
        loading_dock_count,
        storage_capacity_sqm,
        is_active,
        notes,
        created_by,
        created_at,
        updated_at
      `)
      .eq('organization_id', userOrganization.id)
      .order('created_at', { ascending: false });

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
    if (!body.warehouseCode || !body.name || !body.capabilities || !Array.isArray(body.capabilities) || body.capabilities.length === 0 || !body.address || !body.city || !body.country) {
      return NextResponse.json({ error: 'Missing required fields. At least one capability must be selected.' }, { status: 400 });
    }

    // Create warehouse in database
    const { data: newWarehouse, error: insertError } = await supabase
      .from('warehouses')
      .insert({
        warehouse_code: body.warehouseCode,
        name: body.name,
        capabilities: JSON.stringify(body.capabilities), // Store capabilities array as JSON
        address: body.address,
        city: body.city,
        state: body.state || null,
        country: body.country,
        postal_code: body.postalCode || null,
        timezone: body.timezone || 'UTC',
        additional_capabilities: body.additionalCapabilities || {},
        operating_hours: body.operatingHours || null,
        contact_name: body.contactName || null,
        contact_email: body.contactEmail || null,
        contact_phone: body.contactPhone || null,
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
