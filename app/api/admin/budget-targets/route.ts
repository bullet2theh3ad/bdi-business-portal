import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

// GET - Fetch all budget targets
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch budget targets with payment periods
    const { data: budgetTargets, error: budgetError } = await supabase
      .from('budget_targets')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (budgetError) {
      // If table doesn't exist yet, return empty array
      if (budgetError.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      throw budgetError;
    }

    // Fetch payment periods for each budget
    const budgetIds = budgetTargets.map((b: any) => b.id);
    const { data: paymentPeriods, error: paymentsError } = await supabase
      .from('budget_target_payments')
      .select('*')
      .in('budget_target_id', budgetIds)
      .order('payment_number', { ascending: true });

    if (paymentsError) throw paymentsError;

    // Combine budget targets with their payment periods
    const budgetsWithPayments = budgetTargets.map((budget: any) => ({
      ...budget,
      paymentPeriods: paymentPeriods.filter((p: any) => p.budget_target_id === budget.id),
    }));

    // Convert snake_case to camelCase
    const formattedBudgets = budgetsWithPayments.map((b: any) => ({
      id: b.id,
      projectName: b.project_name,
      skuCode: b.sku_code,
      fiscalYear: b.fiscal_year,
      fiscalQuarter: b.fiscal_quarter,
      budgetCategory: b.budget_category,
      budgetDescription: b.budget_description,
      totalBudgetAmount: parseFloat(b.total_budget_amount),
      paymentFrequency: b.payment_frequency,
      startDate: b.start_date,
      endDate: b.end_date,
      notes: b.notes,
      assumptions: b.assumptions,
      status: b.status,
      isLocked: b.is_locked,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      paymentPeriods: b.paymentPeriods.map((p: any) => ({
        id: p.id,
        paymentNumber: p.payment_number,
        periodStart: p.payment_period_start,
        periodEnd: p.payment_period_end,
        label: p.payment_label,
        estimatedAmount: parseFloat(p.estimated_amount),
        notes: p.notes,
      })),
    }));

    return NextResponse.json(formattedBudgets);
  } catch (error: any) {
    console.error('Error fetching budget targets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch budget targets' },
      { status: 500 }
    );
  }
}

// POST - Create new budget target
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectName,
      skuCode,
      fiscalYear,
      fiscalQuarter,
      budgetCategory,
      budgetDescription,
      totalBudgetAmount,
      paymentFrequency,
      startDate,
      endDate,
      notes,
      assumptions,
      status,
      paymentPeriods,
    } = body;

    // Insert budget target
    const { data: budgetTarget, error: budgetError } = await supabase
      .from('budget_targets')
      .insert({
        project_name: projectName,
        sku_code: skuCode || null,
        fiscal_year: fiscalYear || new Date().getFullYear(),
        fiscal_quarter: fiscalQuarter || null,
        budget_category: budgetCategory || 'TOTAL_BUDGET',
        budget_description: budgetDescription || null,
        total_budget_amount: totalBudgetAmount,
        payment_frequency: paymentFrequency || 'monthly',
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes || null,
        assumptions: assumptions || null,
        status: status || 'active',
        created_by: user.id,
      })
      .select()
      .single();

    if (budgetError) throw budgetError;

    // Insert payment periods if provided
    if (paymentPeriods && paymentPeriods.length > 0) {
      const paymentRows = paymentPeriods.map((p: any) => ({
        budget_target_id: budgetTarget.id,
        payment_number: p.paymentNumber,
        payment_period_start: p.periodStart,
        payment_period_end: p.periodEnd,
        payment_label: p.label,
        estimated_amount: p.estimatedAmount,
        notes: p.notes,
      }));

      const { error: paymentsError } = await supabase
        .from('budget_target_payments')
        .insert(paymentRows);

      if (paymentsError) throw paymentsError;
    }

    return NextResponse.json({ 
      success: true, 
      budgetTargetId: budgetTarget.id,
      message: 'Budget target created successfully' 
    });
  } catch (error: any) {
    console.error('Error creating budget target:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create budget target' },
      { status: 500 }
    );
  }
}

