import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { skuFinancialScenarios, users, organizations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for updating SKU Financial Scenario
const updateSkuScenarioSchema = z.object({
  scenarioName: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  
  // SKU & Market
  skuName: z.string().min(1).optional(),
  channel: z.string().min(1).optional(),
  countryCode: z.string().length(2).or(z.string().length(3)).optional(),
  
  // Pricing & Deductions
  asp: z.number().min(0).optional(),
  resellerMarginPercent: z.number().min(0).max(100).optional(),
  marketingReservePercent: z.number().min(0).max(100).optional(),
  fulfillmentCosts: z.number().min(0).optional(),
  
  // Product Costs
  productCostFob: z.number().min(0).optional(),
  swLicenseFee: z.number().min(0).optional(),
  otherProductCosts: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).optional(),
  
  // CoGS
  returnsFreight: z.number().min(0).optional(),
  returnsHandling: z.number().min(0).optional(),
  doaChannelCredit: z.number().min(0).optional(),
  financingCost: z.number().min(0).optional(),
  ppsHandlingFee: z.number().min(0).optional(),
  inboundShippingCost: z.number().min(0).optional(),
  outboundShippingCost: z.number().min(0).optional(),
  greenfileMarketing: z.number().min(0).optional(),
  otherCogs: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).optional(),
  
  // Metadata
  organizationId: z.string().uuid().optional().nullable(),
  isTemplate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET - Fetch a specific scenario by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    const scenarioId = params.id;

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch the scenario with creator and org info
    const [scenario] = await db
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
        isActive: skuFinancialScenarios.isActive,
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
      .where(eq(skuFinancialScenarios.id, scenarioId))
      .limit(1);

    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Check access: user owns it OR super_admin
    if (scenario.createdBy !== authUser.id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ scenario });

  } catch (error) {
    console.error('Error fetching SKU scenario:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update a scenario
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    const scenarioId = params.id;

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if scenario exists and user has access
    const [existingScenario] = await db
      .select()
      .from(skuFinancialScenarios)
      .where(eq(skuFinancialScenarios.id, scenarioId))
      .limit(1);

    if (!existingScenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Check access: user owns it OR super_admin
    if (existingScenario.createdBy !== authUser.id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateSkuScenarioSchema.parse(body);

    // Convert numeric fields to strings for Drizzle
    const updateData: any = { ...validatedData };
    if (updateData.asp !== undefined) updateData.asp = updateData.asp.toString();
    if (updateData.resellerMarginPercent !== undefined) updateData.resellerMarginPercent = updateData.resellerMarginPercent.toString();
    if (updateData.marketingReservePercent !== undefined) updateData.marketingReservePercent = updateData.marketingReservePercent.toString();
    if (updateData.fulfillmentCosts !== undefined) updateData.fulfillmentCosts = updateData.fulfillmentCosts.toString();
    if (updateData.productCostFob !== undefined) updateData.productCostFob = updateData.productCostFob.toString();
    if (updateData.swLicenseFee !== undefined) updateData.swLicenseFee = updateData.swLicenseFee.toString();
    if (updateData.returnsFreight !== undefined) updateData.returnsFreight = updateData.returnsFreight.toString();
    if (updateData.returnsHandling !== undefined) updateData.returnsHandling = updateData.returnsHandling.toString();
    if (updateData.doaChannelCredit !== undefined) updateData.doaChannelCredit = updateData.doaChannelCredit.toString();
    if (updateData.financingCost !== undefined) updateData.financingCost = updateData.financingCost.toString();
    if (updateData.ppsHandlingFee !== undefined) updateData.ppsHandlingFee = updateData.ppsHandlingFee.toString();
    if (updateData.inboundShippingCost !== undefined) updateData.inboundShippingCost = updateData.inboundShippingCost.toString();
    if (updateData.outboundShippingCost !== undefined) updateData.outboundShippingCost = updateData.outboundShippingCost.toString();
    if (updateData.greenfileMarketing !== undefined) updateData.greenfileMarketing = updateData.greenfileMarketing.toString();

    // Update the scenario
    const [updatedScenario] = await db
      .update(skuFinancialScenarios)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(skuFinancialScenarios.id, scenarioId))
      .returning();

    console.log('✅ Updated SKU financial scenario:', updatedScenario.id);

    return NextResponse.json({ 
      message: 'Scenario updated successfully', 
      scenario: updatedScenario 
    });

  } catch (error) {
    console.error('Error updating SKU scenario:', error);
    
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

// DELETE - Soft delete a scenario
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
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

    const scenarioId = params.id;

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if scenario exists and user has access
    const [existingScenario] = await db
      .select()
      .from(skuFinancialScenarios)
      .where(eq(skuFinancialScenarios.id, scenarioId))
      .limit(1);

    if (!existingScenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Check access: user owns it OR super_admin
    if (existingScenario.createdBy !== authUser.id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete by setting isActive to false
    await db
      .update(skuFinancialScenarios)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(skuFinancialScenarios.id, scenarioId));

    console.log('✅ Deleted (soft) SKU financial scenario:', scenarioId);

    return NextResponse.json({ 
      message: 'Scenario deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting SKU scenario:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

