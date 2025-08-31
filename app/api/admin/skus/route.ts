import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { productSkus, users } from '@/lib/db/schema';
import { eq, and, isNull, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for SKU creation
const createSkuSchema = z.object({
  sku: z.string().min(1, 'SKU code is required'),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  model: z.string().optional(),
  version: z.string().optional(),
  dimensions: z.string().optional(),
  weight: z.number().positive().optional(),
  color: z.string().optional(),
  unitCost: z.number().positive().optional(),
  msrp: z.number().positive().optional(),
  moq: z.number().int().positive().default(1),
  leadTimeDays: z.number().int().positive().default(30),
  tags: z.array(z.string()).default([]),
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
    const conditions = [isNull(productSkus.createdAt)]; // Always include (dummy condition)
    
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

    // Fetch SKUs with creator info
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
        unitCost: productSkus.unitCost,
        msrp: productSkus.msrp,
        moq: productSkus.moq,
        leadTimeDays: productSkus.leadTimeDays,
        isActive: productSkus.isActive,
        isDiscontinued: productSkus.isDiscontinued,
        replacementSku: productSkus.replacementSku,
        tags: productSkus.tags,
        specifications: productSkus.specifications,
        createdAt: productSkus.createdAt,
        updatedAt: productSkus.updatedAt,
        createdBy: productSkus.createdBy,
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(productSkus)
      .leftJoin(users, eq(productSkus.createdBy, users.authId))
      .where(and(...conditions.filter(Boolean)))
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

    // Create the SKU
    const [newSku] = await db
      .insert(productSkus)
      .values({
        sku: validatedData.sku,
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        subcategory: validatedData.subcategory,
        model: validatedData.model,
        version: validatedData.version,
        dimensions: validatedData.dimensions,
        weight: validatedData.weight?.toString(),
        color: validatedData.color,
        unitCost: validatedData.unitCost?.toString(),
        msrp: validatedData.msrp?.toString(),
        moq: validatedData.moq,
        leadTimeDays: validatedData.leadTimeDays,
        tags: validatedData.tags,
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
