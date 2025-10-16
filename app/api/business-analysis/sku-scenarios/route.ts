import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { skuFinancialScenarios, users, organizations } from '@/lib/db/schema';
import { eq, and, desc, or, ilike } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for SKU Financial Scenario
const skuScenarioSchema = z.object({
  scenarioName: z.string().min(1, 'Scenario name is required'),
  description: z.string().optional(),
  
  // SKU & Market
  skuName: z.string().min(1, 'SKU name is required'),
  channel: z.string().min(1, 'Channel is required'),
  countryCode: z.string().length(2).or(z.string().length(3)),
  
  // Pricing & Deductions
  asp: z.number().min(0),
  resellerMarginPercent: z.number().min(0).max(100),
  marketingReservePercent: z.number().min(0).max(100),
  fulfillmentCosts: z.number().min(0),
  
  // Product Costs
  productCostFob: z.number().min(0),
  swLicenseFee: z.number().min(0),
  otherProductCosts: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).default([]),
  
  // CoGS
  returnsFreight: z.number().min(0).default(13.00),
  returnsHandling: z.number().min(0).default(0.45),
  doaChannelCredit: z.number().min(0).default(0),
  financingCost: z.number().min(0).default(0),
  ppsHandlingFee: z.number().min(0).default(0),
  inboundShippingCost: z.number().min(0).default(0),
  outboundShippingCost: z.number().min(0).default(0),
  greenfileMarketing: z.number().min(0).default(0),
  otherCogs: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).default([]),
  
  // Optional metadata
  organizationId: z.string().uuid().optional().nullable(),
  isTemplate: z.boolean().default(false),
});

// GET - List all scenarios for the authenticated user
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const skuFilter = searchParams.get('sku');
    const channelFilter = searchParams.get('channel');
    const countryFilter = searchParams.get('country');
    const templatesOnly = searchParams.get('templates') === 'true';

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build query conditions
    const conditions = [eq(skuFinancialScenarios.isActive, true)];

    // Only super_admins can see all scenarios, others see their own
    if (user.role !== 'super_admin') {
      conditions.push(eq(skuFinancialScenarios.createdBy, authUser.id));
    }

    if (search) {
      conditions.push(
        or(
          ilike(skuFinancialScenarios.scenarioName, `%${search}%`),
          ilike(skuFinancialScenarios.skuName, `%${search}%`),
          ilike(skuFinancialScenarios.description, `%${search}%`)
        )!
      );
    }

    if (skuFilter) {
      conditions.push(ilike(skuFinancialScenarios.skuName, `%${skuFilter}%`));
    }

    if (channelFilter) {
      conditions.push(eq(skuFinancialScenarios.channel, channelFilter));
    }

    if (countryFilter) {
      conditions.push(eq(skuFinancialScenarios.countryCode, countryFilter));
    }

    if (templatesOnly) {
      conditions.push(eq(skuFinancialScenarios.isTemplate, true));
    }

    // Fetch scenarios with creator info
    const scenarios = await db
      .select({
        // Scenario fields
        id: skuFinancialScenarios.id,
        scenarioName: skuFinancialScenarios.scenarioName,
        description: skuFinancialScenarios.description,
        skuName: skuFinancialScenarios.skuName,
        channel: skuFinancialScenarios.channel,
        countryCode: skuFinancialScenarios.countryCode,
        
        // Pricing
        asp: skuFinancialScenarios.asp,
        resellerMarginPercent: skuFinancialScenarios.resellerMarginPercent,
        marketingReservePercent: skuFinancialScenarios.marketingReservePercent,
        fulfillmentCosts: skuFinancialScenarios.fulfillmentCosts,
        
        // Product Costs
        productCostFob: skuFinancialScenarios.productCostFob,
        swLicenseFee: skuFinancialScenarios.swLicenseFee,
        otherProductCosts: skuFinancialScenarios.otherProductCosts,
        
        // CoGS
        returnsFreight: skuFinancialScenarios.returnsFreight,
        returnsHandling: skuFinancialScenarios.returnsHandling,
        doaChannelCredit: skuFinancialScenarios.doaChannelCredit,
        financingCost: skuFinancialScenarios.financingCost,
        ppsHandlingFee: skuFinancialScenarios.ppsHandlingFee,
        inboundShippingCost: skuFinancialScenarios.inboundShippingCost,
        outboundShippingCost: skuFinancialScenarios.outboundShippingCost,
        greenfileMarketing: skuFinancialScenarios.greenfileMarketing,
        otherCogs: skuFinancialScenarios.otherCogs,
        
        // Metadata
        createdBy: skuFinancialScenarios.createdBy,
        organizationId: skuFinancialScenarios.organizationId,
        createdAt: skuFinancialScenarios.createdAt,
        updatedAt: skuFinancialScenarios.updatedAt,
        isTemplate: skuFinancialScenarios.isTemplate,
        version: skuFinancialScenarios.version,
        parentScenarioId: skuFinancialScenarios.parentScenarioId,
        
        // Creator info
        creatorName: users.name,
        creatorEmail: users.email,
        
        // Organization info
        organizationName: organizations.name,
      })
      .from(skuFinancialScenarios)
      .leftJoin(users, eq(skuFinancialScenarios.createdBy, users.authId))
      .leftJoin(organizations, eq(skuFinancialScenarios.organizationId, organizations.id))
      .where(and(...conditions))
      .orderBy(desc(skuFinancialScenarios.createdAt));

    return NextResponse.json({ scenarios, count: scenarios.length });

  } catch (error) {
    console.error('Error fetching SKU scenarios:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create a new scenario
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

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = skuScenarioSchema.parse(body);

    // Convert numeric fields to strings for Drizzle
    const insertData: any = {
      ...validatedData,
      asp: validatedData.asp.toString(),
      resellerMarginPercent: validatedData.resellerMarginPercent.toString(),
      marketingReservePercent: validatedData.marketingReservePercent.toString(),
      fulfillmentCosts: validatedData.fulfillmentCosts.toString(),
      productCostFob: validatedData.productCostFob.toString(),
      swLicenseFee: validatedData.swLicenseFee.toString(),
      returnsFreight: validatedData.returnsFreight.toString(),
      returnsHandling: validatedData.returnsHandling.toString(),
      doaChannelCredit: validatedData.doaChannelCredit.toString(),
      financingCost: validatedData.financingCost.toString(),
      ppsHandlingFee: validatedData.ppsHandlingFee.toString(),
      inboundShippingCost: validatedData.inboundShippingCost.toString(),
      outboundShippingCost: validatedData.outboundShippingCost.toString(),
      greenfileMarketing: validatedData.greenfileMarketing.toString(),
      createdBy: authUser.id,
    };

    // Create the scenario
    const [newScenario] = await db
      .insert(skuFinancialScenarios)
      .values(insertData)
      .returning();

    console.log('✅ Created SKU financial scenario:', newScenario.id);

    return NextResponse.json(
      { 
        message: 'Scenario created successfully', 
        scenario: newScenario 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating SKU scenario:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

