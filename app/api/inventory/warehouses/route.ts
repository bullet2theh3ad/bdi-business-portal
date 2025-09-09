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

    // Use Drizzle ORM like forecasts API - this bypasses Supabase RLS issues
    console.log(`🔍 Using Drizzle ORM for warehouse queries (like forecasts API)`);
    
    let warehousesList;
    
    if (isBDIUser) {
      // BDI users can see all warehouses
      console.log(`🔓 BDI user can see all warehouses`);
      warehousesList = await db
        .select()
        .from(warehouses)
        .orderBy(desc(warehouses.createdAt));
    } else {
      // Partner users can see their own warehouses + BDI warehouses (for CPFR)
      console.log(`🔒 Partner user ${userOrganization.code} - can see own + BDI warehouses`);
      
      const bdiOrgResult = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.code, 'BDI'))
        .limit(1);
      
      const bdiOrgId = bdiOrgResult[0]?.id;
      console.log(`🔍 BDI org ID found:`, bdiOrgId);
      
      if (bdiOrgId) {
        const [ownWarehouses, bdiWarehouses] = await Promise.all([
          db.select()
            .from(warehouses)
            .where(eq(warehouses.organizationId, userOrganization.id))
            .orderBy(desc(warehouses.createdAt)),
          db.select()
            .from(warehouses)
            .where(eq(warehouses.organizationId, bdiOrgId))
            .orderBy(desc(warehouses.createdAt))
        ]);
        
        console.log(`🔍 Own warehouses (Drizzle): ${ownWarehouses.length}`);
        console.log(`🔍 BDI warehouses (Drizzle): ${bdiWarehouses.length}`);
        
        // Combine warehouses
        warehousesList = [...ownWarehouses, ...bdiWarehouses];
        console.log(`🔍 Combined warehouses: ${warehousesList.length}`);
      } else {
        console.log(`🔍 No BDI org found - only own warehouses`);
        warehousesList = await db
          .select()
          .from(warehouses)
          .where(eq(warehouses.organizationId, userOrganization.id))
          .orderBy(desc(warehouses.createdAt));
      }
    }

    const warehousesData = warehousesList;
    const warehousesError = null;

    if (warehousesError) {
      console.error('Database error:', warehousesError);
      return NextResponse.json([]);
    }

    // Transform data to match frontend interface (Drizzle returns camelCase)
    const transformedWarehouses = (warehousesData || []).map((row: any) => ({
      id: row.id,
      warehouseCode: row.warehouseCode,
      name: row.name,
      type: row.type,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postalCode,
      timezone: row.timezone,
      capabilities: row.capabilities,
      mainCapabilities: (() => {
        try {
          return row.mainCapabilities && row.mainCapabilities !== '' ? JSON.parse(row.mainCapabilities) : [];
        } catch (e) {
          console.warn('Invalid mainCapabilities JSON:', row.mainCapabilities);
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
      operatingHours: row.operatingHours,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      maxPalletHeight: row.maxPalletHeightCm,
      maxPalletWeight: row.maxPalletWeightKg,
      loadingDockCount: row.loadingDockCount,
      storageCapacity: row.storageCapacitySqm,
      isActive: row.isActive,
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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
