import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { productSkus, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify BDI Admin permission
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - BDI Admin required' }, { status: 403 });
    }

    const body = await request.json();
    const { id: skuId } = await params;

    console.log('Update body:', body);
    console.log('SKU ID:', skuId);
    console.log('HTS Code from body:', body.htsCode);

    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    // Update the SKU
    const [updatedSku] = await db
      .update(productSkus)
      .set({
        name: body.name.trim(),
        description: body.description || null,
        
        // New dimensional fields (metric) - save as numbers, not strings
        boxLengthCm: body.boxLength || null,
        boxWidthCm: body.boxWidth || null,
        boxHeightCm: body.boxHeight || null,
        boxWeightKg: body.boxWeight || null,
        cartonLengthCm: body.cartonLength || null,
        cartonWidthCm: body.cartonWidth || null,
        cartonHeightCm: body.cartonHeight || null,
        cartonWeightKg: body.cartonWeight || null,
        boxesPerCarton: body.boxesPerCarton,
        palletLengthCm: body.palletLength || null,
        palletWidthCm: body.palletWidth || null,
        palletHeightCm: body.palletHeight || null,
        palletWeightKg: body.palletWeight || null,
              palletMaterialType: body.palletMaterialType,
      palletNotes: body.palletNotes,
      mpStartDate: body.editMpStartDate ? new Date(body.editMpStartDate) : null,
      mfg: body.editMfg,
        
        // Business terms
        moq: body.moq,
        leadTimeDays: body.leadTimeDays,
        standardCost: body.standardCost ? body.standardCost.toString() : null,
        htsCode: body.htsCode || null,
        
        updatedAt: new Date(),
      })
      .where(eq(productSkus.id, skuId))
      .returning();

    return NextResponse.json({
      success: true,
      sku: updatedSku
    });

  } catch (error) {
    console.error('Error updating SKU:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify BDI Admin permission
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - BDI Admin required' }, { status: 403 });
    }

    const { id: skuId } = await params;

    // Check if SKU exists
    const [existingSku] = await db
      .select()
      .from(productSkus)
      .where(eq(productSkus.id, skuId))
      .limit(1);

    if (!existingSku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }

    // Delete the SKU
    try {
      await db
        .delete(productSkus)
        .where(eq(productSkus.id, skuId));

      console.log(`✅ SKU deleted: ${existingSku.sku} (${existingSku.name})`);

      return NextResponse.json({
        success: true,
        message: `SKU "${existingSku.sku}" deleted successfully`
      });
    } catch (deleteError: any) {
      // Handle foreign key constraint violations
      if (deleteError.code === '23503') {
        console.error('Foreign key constraint violation:', deleteError.detail);
        
        // Extract table name from error for better messaging
        let referencingTable = 'other records';
        if (deleteError.detail?.includes('invoice_line_items')) {
          referencingTable = 'invoice line items';
        } else if (deleteError.detail?.includes('purchase_order_line_items')) {
          referencingTable = 'purchase order line items';
        } else if (deleteError.detail?.includes('sales_forecasts')) {
          referencingTable = 'sales forecasts';
        }

        return NextResponse.json({
          error: `Cannot delete SKU "${existingSku.sku}" because it is currently being used in ${referencingTable}. Please remove all references to this SKU before deleting it.`,
          code: 'FOREIGN_KEY_CONSTRAINT',
          referencingTable: referencingTable
        }, { status: 409 }); // 409 Conflict
      }
      
      // Re-throw other database errors
      throw deleteError;
    }

  } catch (error) {
    console.error('Error deleting SKU:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
