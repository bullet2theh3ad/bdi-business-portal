import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * DELETE /api/warehouse/wip/imports/[id]
 * Delete a specific WIP import batch and all its associated data
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Initialize Supabase client with auth
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database to check role
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('email', authUser.email)
      .single();

    // Only super_admin, admin, or operations can delete imports
    if (!dbUser || !['super_admin', 'admin', 'operations'].includes(dbUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    console.log(`🗑️  Deleting import batch: ${id}`);

    // Use service role client for deletion (bypass RLS)
    const supabaseService = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Delete all units associated with this import
    const { error: unitsError } = await supabaseService
      .from('warehouse_wip_units')
      .delete()
      .eq('import_batch_id', id);

    if (unitsError) {
      console.error('❌ Error deleting units:', unitsError);
      throw new Error(`Failed to delete units: ${unitsError.message}`);
    }

    // Delete weekly summary data
    const { error: weeklyError } = await supabaseService
      .from('warehouse_wip_weekly_summary')
      .delete()
      .eq('import_batch_id', id);

    if (weeklyError) {
      console.error('❌ Error deleting weekly summary:', weeklyError);
      // Don't fail - this is optional data
    }

    // Delete the import batch record itself
    const { error: batchError } = await supabaseService
      .from('warehouse_wip_imports')
      .delete()
      .eq('id', id);

    if (batchError) {
      console.error('❌ Error deleting import batch:', batchError);
      throw new Error(`Failed to delete import batch: ${batchError.message}`);
    }

    console.log(`✅ Successfully deleted import batch: ${id}`);

    return NextResponse.json({ 
      success: true,
      message: 'Import batch and all associated data deleted successfully'
    });

  } catch (error: any) {
    console.error('❌ Delete import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete import' },
      { status: 500 }
    );
  }
}

