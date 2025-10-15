/**
 * SKU Mappings API
 * Manages external channel identifier mappings for product SKUs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { db } from '@/lib/db/drizzle';
import { skuMappings, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/admin/skus/[id]/mappings - Get all mappings for a SKU
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: skuId } = await params;

    // Fetch all mappings for this SKU
    const mappings = await db
      .select()
      .from(skuMappings)
      .where(eq(skuMappings.internalSkuId, skuId))
      .orderBy(skuMappings.createdAt);

    return NextResponse.json(mappings);

  } catch (error) {
    console.error('[SKU Mappings GET] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch mappings'
    }, { status: 500 });
  }
}

// POST /api/admin/skus/[id]/mappings - Add new mapping(s) to a SKU
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser || !['super_admin', 'admin'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id: skuId } = await params;
    const body = await request.json();
    const { mappings: mappingsToAdd } = body;

    if (!Array.isArray(mappingsToAdd) || mappingsToAdd.length === 0) {
      return NextResponse.json({ error: 'mappings array is required' }, { status: 400 });
    }

    // Insert all mappings
    const newMappings = await db
      .insert(skuMappings)
      .values(
        mappingsToAdd.map((mapping: any) => ({
          internalSkuId: skuId,
          externalIdentifier: mapping.externalIdentifier,
          channel: mapping.channel,
          notes: mapping.notes || null,
          createdBy: authUser.id,
        }))
      )
      .returning();

    return NextResponse.json({
      success: true,
      mappings: newMappings,
      count: newMappings.length
    });

  } catch (error) {
    console.error('[SKU Mappings POST] Error:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return NextResponse.json({
        error: 'Duplicate mapping: This external identifier already exists for this channel'
      }, { status: 409 });
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create mappings'
    }, { status: 500 });
  }
}

// DELETE /api/admin/skus/[id]/mappings?mappingId=xxx - Delete a specific mapping
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser || !['super_admin', 'admin'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mappingId = searchParams.get('mappingId');

    if (!mappingId) {
      return NextResponse.json({ error: 'mappingId is required' }, { status: 400 });
    }

    const { id: skuId } = await params;

    // Delete the mapping (only if it belongs to this SKU)
    const deleted = await db
      .delete(skuMappings)
      .where(
        and(
          eq(skuMappings.id, mappingId),
          eq(skuMappings.internalSkuId, skuId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Mapping deleted successfully'
    });

  } catch (error) {
    console.error('[SKU Mappings DELETE] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to delete mapping'
    }, { status: 500 });
  }
}

