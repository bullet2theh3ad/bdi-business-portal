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
