import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params;
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info
    const requestingUser = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission (admin, super_admin, operations, or member)
    const userRole = requestingUser[0].role;
    if (!['super_admin', 'admin', 'operations', 'member'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    console.log('🔄 Updating warehouse:', warehouseId, body);

    // Validate required fields
    if (!body.warehouseCode || !body.name || !body.type || !body.address || !body.city || !body.country) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Update warehouse in database
    const { data: updatedWarehouse, error: updateError } = await supabase
      .from('warehouses')
      .update({
        warehouse_code: body.warehouseCode,
        name: body.name,
        type: body.type,
        address: body.address,
        city: body.city,
        state: body.state || null,
        country: body.country,
        postal_code: body.postalCode || null,
        timezone: body.timezone || 'UTC',
        capabilities: body.capabilities || {},
        operating_hours: body.operatingHours || null,
        // Store primary contact in legacy fields for backward compatibility
        contact_name: body.contacts?.[0]?.name || null,
        contact_email: body.contacts?.[0]?.email || null,
        contact_phone: body.contacts?.[0]?.phone || null,
        // Store all contacts in JSON field (if it exists)
        contacts: body.contacts || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', warehouseId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating warehouse:', updateError);
      return NextResponse.json({ error: 'Failed to update warehouse' }, { status: 500 });
    }

    console.log('✅ Warehouse updated successfully:', updatedWarehouse);

    return NextResponse.json({
      success: true,
      warehouse: updatedWarehouse
    });

  } catch (error) {
    console.error('Error updating warehouse:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params;
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info
    const requestingUser = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has admin permissions for delete
    const userRole = requestingUser[0].role;
    if (!['super_admin', 'admin'].includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required for deletion' }, { status: 403 });
    }

    console.log('🗑️ Deleting warehouse:', warehouseId);

    // Delete warehouse from database
    const { error: deleteError } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', warehouseId);

    if (deleteError) {
      console.error('Error deleting warehouse:', deleteError);
      return NextResponse.json({ error: 'Failed to delete warehouse' }, { status: 500 });
    }

    console.log('✅ Warehouse deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Warehouse deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting warehouse:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
