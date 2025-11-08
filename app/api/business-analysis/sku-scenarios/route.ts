import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { skuFinancialScenarios, users } from '@/lib/db/schema';
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
  
  // Top Section - ASP and Marketplace Fees
  asp: z.number().min(0),
  fbaFeePercent: z.number().min(0).max(100).default(0),
  fbaFeeAmount: z.number().min(0).default(0),
  amazonReferralFeePercent: z.number().min(0).max(100).default(0),
  amazonReferralFeeAmount: z.number().min(0).default(0),
  acosPercent: z.number().min(0).max(100).default(0),
  acosAmount: z.number().min(0).default(0),
  otherFeesAndAdvertising: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).default([]),
  
  // Less Frontend Section
  motorolaRoyaltiesPercent: z.number().min(0).max(100).default(0),
  motorolaRoyaltiesAmount: z.number().min(0).default(0),
  rtvFreightAssumptions: z.number().min(0).default(0),
  rtvRepairCosts: z.number().min(0).default(0),
  doaCreditsPercent: z.number().min(0).max(100).default(0),
  doaCreditsAmount: z.number().min(0).default(0),
  invoiceFactoringNet: z.number().min(0).default(0),
  salesCommissionsPercent: z.number().min(0).max(100).default(0),
  salesCommissionsAmount: z.number().min(0).default(0),
  otherFrontendCosts: z.array(z.object({
    label: z.string(),
    value: z.number()
  })).default([]),
  
  // Landed DDP Calculations Section
  importDutiesPercent: z.number().min(0).max(100).default(0),
  importDutiesAmount: z.number().min(0).default(0),
  exWorksStandard: z.number().min(0).default(0),
  importShippingSea: z.number().min(0).default(0),
  gryphonSoftware: z.number().min(0).default(0),
  otherLandedCosts: z.array(z.object({
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
    const conditions = [];

    // Only super_admins can see all scenarios, others see their own
    if (user.role !== 'super_admin') {
      conditions.push(eq(skuFinancialScenarios.userId, user.id));
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

    // Templates filter removed - isTemplate column doesn't exist in DB

    // Fetch scenarios with creator info and calculated fields from view
    let query = db
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
      .orderBy(desc(skuFinancialScenarios.createdAt));

    // Apply conditions only if there are any
    const scenarios = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;

    // Calculate GP for each scenario
    const scenariosWithGP = scenarios.map(scenario => {
      const asp = parseFloat(scenario.asp || '0');
      
      // Calculate total fees
      const fbaFee = parseFloat(scenario.fbaFeeAmount || '0');
      const referralFee = parseFloat(scenario.amazonReferralFeeAmount || '0');
      const acos = parseFloat(scenario.acosAmount || '0');
      const otherFees = (scenario.otherFeesAndAdvertising as any[] || []).reduce((sum, item) => sum + (item.value || 0), 0);
      
      // Calculate Net Sales
      const netSales = asp - fbaFee - referralFee - acos - otherFees;
      
      // Calculate total frontend costs
      const motorolaRoyalties = parseFloat(scenario.motorolaRoyaltiesAmount || '0');
      const rtvFreight = parseFloat(scenario.rtvFreightAssumptions || '0');
      const rtvRepair = parseFloat(scenario.rtvRepairCosts || '0');
      const doaCredits = parseFloat(scenario.doaCreditsAmount || '0');
      const invoiceFactoring = parseFloat(scenario.invoiceFactoringNet || '0');
      const salesCommissions = parseFloat(scenario.salesCommissionsAmount || '0');
      const otherFrontend = (scenario.otherFrontendCosts as any[] || []).reduce((sum, item) => sum + (item.value || 0), 0);
      
      const totalFrontendCosts = motorolaRoyalties + rtvFreight + rtvRepair + doaCredits + invoiceFactoring + salesCommissions + otherFrontend;
      
      // Calculate total landed costs
      const importDuties = parseFloat(scenario.importDutiesAmount || '0');
      const exWorks = parseFloat(scenario.exWorksStandard || '0');
      const importShipping = parseFloat(scenario.importShippingSea || '0');
      const gryphonSoftware = parseFloat(scenario.gryphonSoftware || '0');
      const otherLanded = (scenario.otherLandedCosts as any[] || []).reduce((sum, item) => sum + (item.value || 0), 0);
      
      const totalLandedCosts = importDuties + exWorks + importShipping + gryphonSoftware + otherLanded;
      
      // Calculate Gross Profit
      const grossProfit = netSales - totalFrontendCosts - totalLandedCosts;
      
      // Calculate Gross Margin %
      const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
      
      return {
        ...scenario,
        netSales: netSales.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent: grossMarginPercent.toFixed(2),
      };
    });

    return NextResponse.json({ scenarios: scenariosWithGP, count: scenariosWithGP.length });

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

    // Convert numeric fields to strings for Drizzle - ONLY include fields that exist in DB
    const insertData: any = {
      // Metadata
      scenarioName: validatedData.scenarioName,
      description: validatedData.description,
      skuName: validatedData.skuName,
      channel: validatedData.channel,
      countryCode: validatedData.countryCode,
      userId: user.id,
      // Note: Only these columns exist in the actual DB table
      
      // Numeric fields converted to strings
      asp: validatedData.asp.toString(),
      fbaFeePercent: validatedData.fbaFeePercent.toString(),
      fbaFeeAmount: validatedData.fbaFeeAmount.toString(),
      amazonReferralFeePercent: validatedData.amazonReferralFeePercent.toString(),
      amazonReferralFeeAmount: validatedData.amazonReferralFeeAmount.toString(),
      acosPercent: validatedData.acosPercent.toString(),
      acosAmount: validatedData.acosAmount.toString(),
      otherFeesAndAdvertising: validatedData.otherFeesAndAdvertising,
      motorolaRoyaltiesPercent: validatedData.motorolaRoyaltiesPercent.toString(),
      motorolaRoyaltiesAmount: validatedData.motorolaRoyaltiesAmount.toString(),
      rtvFreightAssumptions: validatedData.rtvFreightAssumptions.toString(),
      rtvRepairCosts: validatedData.rtvRepairCosts.toString(),
      doaCreditsPercent: validatedData.doaCreditsPercent.toString(),
      doaCreditsAmount: validatedData.doaCreditsAmount.toString(),
      invoiceFactoringNet: validatedData.invoiceFactoringNet.toString(),
      salesCommissionsPercent: validatedData.salesCommissionsPercent.toString(),
      salesCommissionsAmount: validatedData.salesCommissionsAmount.toString(),
      importDutiesPercent: validatedData.importDutiesPercent.toString(),
      importDutiesAmount: validatedData.importDutiesAmount.toString(),
      exWorksStandard: validatedData.exWorksStandard.toString(),
      importShippingSea: validatedData.importShippingSea.toString(),
      gryphonSoftware: validatedData.gryphonSoftware.toString(),
      
      // JSONB fields
      otherFrontendCosts: validatedData.otherFrontendCosts,
      otherLandedCosts: validatedData.otherLandedCosts,
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

