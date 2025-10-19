import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { skuFinancialScenarios, users } from '@/lib/db/schema';
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
  
  // Pricing
  asp: z.number().min(0).optional(),
  fbaFeePercent: z.number().min(0).max(100).optional(),
  fbaFeeAmount: z.number().min(0).optional(),
  amazonReferralFeePercent: z.number().min(0).max(100).optional(),
  amazonReferralFeeAmount: z.number().min(0).optional(),
  acosPercent: z.number().min(0).max(100).optional(),
  acosAmount: z.number().min(0).optional(),
  otherFeesAndAdvertising: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).optional(),
  
  // Backend Costs
  motorolaRoyaltiesPercent: z.number().min(0).max(100).optional(),
  motorolaRoyaltiesAmount: z.number().min(0).optional(),
  rtvFreightAssumptions: z.number().min(0).optional(),
  rtvRepairCosts: z.number().min(0).optional(),
  doaCreditsPercent: z.number().min(0).max(100).optional(),
  doaCreditsAmount: z.number().min(0).optional(),
  invoiceFactoringNet: z.number().min(0).optional(),
  salesCommissionsPercent: z.number().min(0).max(100).optional(),
  salesCommissionsAmount: z.number().min(0).optional(),
  otherFrontendCosts: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).optional(),
  
  // Landed Costs
  importDutiesPercent: z.number().min(0).max(100).optional(),
  importDutiesAmount: z.number().min(0).optional(),
  exWorksStandard: z.number().min(0).optional(),
  importShippingSea: z.number().min(0).optional(),
  gryphonSoftware: z.number().min(0).optional(),
  otherLandedCosts: z.array(z.object({
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
        fbaFeePercent: skuFinancialScenarios.fbaFeePercent,
        fbaFeeAmount: skuFinancialScenarios.fbaFeeAmount,
        amazonReferralFeePercent: skuFinancialScenarios.amazonReferralFeePercent,
        amazonReferralFeeAmount: skuFinancialScenarios.amazonReferralFeeAmount,
        acosPercent: skuFinancialScenarios.acosPercent,
        acosAmount: skuFinancialScenarios.acosAmount,
        otherFeesAndAdvertising: skuFinancialScenarios.otherFeesAndAdvertising,
        
        // Backend Costs
        motorolaRoyaltiesPercent: skuFinancialScenarios.motorolaRoyaltiesPercent,
        motorolaRoyaltiesAmount: skuFinancialScenarios.motorolaRoyaltiesAmount,
        rtvFreightAssumptions: skuFinancialScenarios.rtvFreightAssumptions,
        rtvRepairCosts: skuFinancialScenarios.rtvRepairCosts,
        doaCreditsPercent: skuFinancialScenarios.doaCreditsPercent,
        doaCreditsAmount: skuFinancialScenarios.doaCreditsAmount,
        invoiceFactoringNet: skuFinancialScenarios.invoiceFactoringNet,
        salesCommissionsPercent: skuFinancialScenarios.salesCommissionsPercent,
        salesCommissionsAmount: skuFinancialScenarios.salesCommissionsAmount,
        otherFrontendCosts: skuFinancialScenarios.otherFrontendCosts,
        
        // Landed Costs
        importDutiesPercent: skuFinancialScenarios.importDutiesPercent,
        importDutiesAmount: skuFinancialScenarios.importDutiesAmount,
        exWorksStandard: skuFinancialScenarios.exWorksStandard,
        importShippingSea: skuFinancialScenarios.importShippingSea,
        gryphonSoftware: skuFinancialScenarios.gryphonSoftware,
        otherLandedCosts: skuFinancialScenarios.otherLandedCosts,
        
        // Metadata
        userId: skuFinancialScenarios.userId,
        createdAt: skuFinancialScenarios.createdAt,
        updatedAt: skuFinancialScenarios.updatedAt,
        
        // Creator info
        creatorName: users.name,
        creatorEmail: users.email,
      })
      .from(skuFinancialScenarios)
      .leftJoin(users, eq(skuFinancialScenarios.userId, users.id))
      .where(eq(skuFinancialScenarios.id, scenarioId))
      .limit(1);

    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Check access: user owns it OR super_admin
    if (scenario.userId !== user.id && user.role !== 'super_admin') {
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
    if (existingScenario.userId !== user.id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateSkuScenarioSchema.parse(body);

    // Convert numeric fields to strings for Drizzle
    const updateData: any = { ...validatedData };
    if (updateData.asp !== undefined) updateData.asp = updateData.asp.toString();
    if (updateData.fbaFeePercent !== undefined) updateData.fbaFeePercent = updateData.fbaFeePercent.toString();
    if (updateData.fbaFeeAmount !== undefined) updateData.fbaFeeAmount = updateData.fbaFeeAmount.toString();
    if (updateData.amazonReferralFeePercent !== undefined) updateData.amazonReferralFeePercent = updateData.amazonReferralFeePercent.toString();
    if (updateData.amazonReferralFeeAmount !== undefined) updateData.amazonReferralFeeAmount = updateData.amazonReferralFeeAmount.toString();
    if (updateData.acosPercent !== undefined) updateData.acosPercent = updateData.acosPercent.toString();
    if (updateData.acosAmount !== undefined) updateData.acosAmount = updateData.acosAmount.toString();
    if (updateData.motorolaRoyaltiesPercent !== undefined) updateData.motorolaRoyaltiesPercent = updateData.motorolaRoyaltiesPercent.toString();
    if (updateData.motorolaRoyaltiesAmount !== undefined) updateData.motorolaRoyaltiesAmount = updateData.motorolaRoyaltiesAmount.toString();
    if (updateData.rtvFreightAssumptions !== undefined) updateData.rtvFreightAssumptions = updateData.rtvFreightAssumptions.toString();
    if (updateData.rtvRepairCosts !== undefined) updateData.rtvRepairCosts = updateData.rtvRepairCosts.toString();
    if (updateData.doaCreditsPercent !== undefined) updateData.doaCreditsPercent = updateData.doaCreditsPercent.toString();
    if (updateData.doaCreditsAmount !== undefined) updateData.doaCreditsAmount = updateData.doaCreditsAmount.toString();
    if (updateData.invoiceFactoringNet !== undefined) updateData.invoiceFactoringNet = updateData.invoiceFactoringNet.toString();
    if (updateData.salesCommissionsPercent !== undefined) updateData.salesCommissionsPercent = updateData.salesCommissionsPercent.toString();
    if (updateData.salesCommissionsAmount !== undefined) updateData.salesCommissionsAmount = updateData.salesCommissionsAmount.toString();
    if (updateData.importDutiesPercent !== undefined) updateData.importDutiesPercent = updateData.importDutiesPercent.toString();
    if (updateData.importDutiesAmount !== undefined) updateData.importDutiesAmount = updateData.importDutiesAmount.toString();
    if (updateData.exWorksStandard !== undefined) updateData.exWorksStandard = updateData.exWorksStandard.toString();
    if (updateData.importShippingSea !== undefined) updateData.importShippingSea = updateData.importShippingSea.toString();
    if (updateData.gryphonSoftware !== undefined) updateData.gryphonSoftware = updateData.gryphonSoftware.toString();

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
    if (existingScenario.userId !== user.id && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Hard delete (no soft delete since isActive column doesn't exist)
    await db
      .delete(skuFinancialScenarios)
      .where(eq(skuFinancialScenarios.id, scenarioId));

    console.log('✅ Deleted SKU financial scenario:', scenarioId);

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

