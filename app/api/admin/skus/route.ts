import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { productSkus, users } from '@/lib/db/schema';
import { eq, and, isNull, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for SKU creation - Updated for new dimensional data format
const createSkuSchema = z.object({
  sku: z.string().min(1, 'SKU code is required'),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  
  // Box dimensions/weights (metric)
  boxLength: z.number().positive().optional(),
  boxWidth: z.number().positive().optional(),
  boxHeight: z.number().positive().optional(),
  boxWeight: z.number().positive().optional(),
  
  // Carton dimensions/weights (metric)
  cartonLength: z.number().positive().optional(),
  cartonWidth: z.number().positive().optional(),
  cartonHeight: z.number().positive().optional(),
  cartonWeight: z.number().positive().optional(),
  boxesPerCarton: z.number().int().positive().optional(),
  
  // Pallet dimensions/weights (metric)
  palletLength: z.number().positive().optional(),
  palletWidth: z.number().positive().optional(),
  palletHeight: z.number().positive().optional(),
  palletWeight: z.number().positive().optional(),
  palletMaterialType: z.enum([
    'WOOD_HT', 'WOOD_MB', 'PLASTIC_HDPE', 'PLASTIC_PP', 
    'PRESSWOOD', 'PLYWOOD_OSB', 'STEEL', 'ALUMINUM', 'PAPERBOARD'
  ]).optional(),
  palletNotes: z.string().optional(),
  mpStartDate: z.string().optional(), // Will be converted to timestamp
  mfg: z.string().optional(),
  
  // Business/Forecast Terms
  moq: z.number().int().positive().optional().default(1),
  leadTimeDays: z.number().int().positive().optional().default(30),
  
  // Trade Classification
  htsCode: z.string().regex(/^\d{4}\.\d{2}\.\d{4}$/, 'HTS Code must be in format NNNN.NN.NNNN').optional(),
});

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

    // Verify BDI Admin permission
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - BDI Admin required' }, { status: 403 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    // Build query conditions
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(productSkus.sku, `%${search}%`),
          ilike(productSkus.name, `%${search}%`),
          ilike(productSkus.description, `%${search}%`)
        )!
      );
    }
    
    if (category && category !== 'all') {
      conditions.push(eq(productSkus.category, category));
    }

    // Fetch SKUs with creator info and new dimensional fields
    const skusList = await db
      .select({
        id: productSkus.id,
        sku: productSkus.sku,
        name: productSkus.name,
        description: productSkus.description,
        category: productSkus.category,
        subcategory: productSkus.subcategory,
        model: productSkus.model,
        version: productSkus.version,
        dimensions: productSkus.dimensions,
        weight: productSkus.weight,
        color: productSkus.color,
        moq: productSkus.moq,
        leadTimeDays: productSkus.leadTimeDays,
        mpStartDate: productSkus.mpStartDate,
        mfg: productSkus.mfg,
        isActive: productSkus.isActive,
        isDiscontinued: productSkus.isDiscontinued,
        replacementSku: productSkus.replacementSku,
        tags: productSkus.tags,
        specifications: productSkus.specifications,
        
        // New dimensional fields (metric)
        boxLengthCm: productSkus.boxLengthCm,
        boxWidthCm: productSkus.boxWidthCm,
        boxHeightCm: productSkus.boxHeightCm,
        boxWeightKg: productSkus.boxWeightKg,
        cartonLengthCm: productSkus.cartonLengthCm,
        cartonWidthCm: productSkus.cartonWidthCm,
        cartonHeightCm: productSkus.cartonHeightCm,
        cartonWeightKg: productSkus.cartonWeightKg,
        boxesPerCarton: productSkus.boxesPerCarton,
        palletLengthCm: productSkus.palletLengthCm,
        palletWidthCm: productSkus.palletWidthCm,
        palletHeightCm: productSkus.palletHeightCm,
        palletWeightKg: productSkus.palletWeightKg,
        palletMaterialType: productSkus.palletMaterialType,
        palletNotes: productSkus.palletNotes,
        
        createdAt: productSkus.createdAt,
        updatedAt: productSkus.updatedAt,
        createdBy: productSkus.createdBy,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(productSkus)
      .leftJoin(users, eq(productSkus.createdBy, users.authId))
      .where(conditions.length > 0 ? and(...conditions.filter(Boolean)) : undefined)
      .orderBy(productSkus.createdAt);



    return NextResponse.json(skusList);

  } catch (error) {
    console.error('Error fetching SKUs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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
    const validatedData = createSkuSchema.parse(body);

    // Check if SKU code already exists
    const existingSku = await db
      .select()
      .from(productSkus)
      .where(eq(productSkus.sku, validatedData.sku))
      .limit(1);

    if (existingSku.length > 0) {
      return NextResponse.json(
        { error: 'SKU code already exists' },
        { status: 400 }
      );
    }

    // Create the SKU with full dimensional data
    const [newSku] = await db
      .insert(productSkus)
      .values({
        sku: validatedData.sku,
        name: validatedData.name,
        description: validatedData.description,
        category: 'device', // Default category
        subcategory: null,
        model: null,
        version: null,
        dimensions: null,
        weight: null,
        color: null,
        moq: validatedData.moq || 1,
        leadTimeDays: validatedData.leadTimeDays || 30,
        htsCode: validatedData.htsCode || null,
        tags: [],
        
        // New dimensional fields (metric)
        boxLengthCm: validatedData.boxLength ? validatedData.boxLength.toString() : null,
        boxWidthCm: validatedData.boxWidth ? validatedData.boxWidth.toString() : null,
        boxHeightCm: validatedData.boxHeight ? validatedData.boxHeight.toString() : null,
        boxWeightKg: validatedData.boxWeight ? validatedData.boxWeight.toString() : null,
        cartonLengthCm: validatedData.cartonLength ? validatedData.cartonLength.toString() : null,
        cartonWidthCm: validatedData.cartonWidth ? validatedData.cartonWidth.toString() : null,
        cartonHeightCm: validatedData.cartonHeight ? validatedData.cartonHeight.toString() : null,
        cartonWeightKg: validatedData.cartonWeight ? validatedData.cartonWeight.toString() : null,
        boxesPerCarton: validatedData.boxesPerCarton,
        palletLengthCm: validatedData.palletLength ? validatedData.palletLength.toString() : null,
        palletWidthCm: validatedData.palletWidth ? validatedData.palletWidth.toString() : null,
        palletHeightCm: validatedData.palletHeight ? validatedData.palletHeight.toString() : null,
        palletWeightKg: validatedData.palletWeight ? validatedData.palletWeight.toString() : null,
        palletMaterialType: validatedData.palletMaterialType,
        palletNotes: validatedData.palletNotes,
        mpStartDate: validatedData.mpStartDate ? new Date(validatedData.mpStartDate) : null,
        mfg: validatedData.mfg,
        
        createdBy: requestingUser.authId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      sku: newSku
    });

  } catch (error) {
    console.error('Error creating SKU:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
