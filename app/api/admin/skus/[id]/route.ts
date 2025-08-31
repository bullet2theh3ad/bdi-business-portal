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
        
        // New dimensional fields (metric)
        boxLengthCm: body.boxLength ? body.boxLength.toString() : null,
        boxWidthCm: body.boxWidth ? body.boxWidth.toString() : null,
        boxHeightCm: body.boxHeight ? body.boxHeight.toString() : null,
        boxWeightKg: body.boxWeight ? body.boxWeight.toString() : null,
        cartonLengthCm: body.cartonLength ? body.cartonLength.toString() : null,
        cartonWidthCm: body.cartonWidth ? body.cartonWidth.toString() : null,
        cartonHeightCm: body.cartonHeight ? body.cartonHeight.toString() : null,
        cartonWeightKg: body.cartonWeight ? body.cartonWeight.toString() : null,
        boxesPerCarton: body.boxesPerCarton,
        palletLengthCm: body.palletLength ? body.palletLength.toString() : null,
        palletWidthCm: body.palletWidth ? body.palletWidth.toString() : null,
        palletHeightCm: body.palletHeight ? body.palletHeight.toString() : null,
        palletWeightKg: body.palletWeight ? body.palletWeight.toString() : null,
        palletMaterialType: body.palletMaterialType,
        palletNotes: body.palletNotes,
        
        // Business terms
        moq: body.moq,
        leadTimeDays: body.leadTimeDays,
        
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
