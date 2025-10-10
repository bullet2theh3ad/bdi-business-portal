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

// GET - Fetch single budget target
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: budgetTarget, error: budgetError } = await supabase
      .from('budget_targets')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (budgetError) throw budgetError;

    const { data: paymentPeriods, error: paymentsError } = await supabase
      .from('budget_target_payments')
      .select('*')
      .eq('budget_target_id', id)
      .order('payment_number', { ascending: true });

    if (paymentsError) throw paymentsError;

    return NextResponse.json({
      ...budgetTarget,
      paymentPeriods,
    });
  } catch (error: any) {
    console.error('Error fetching budget target:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch budget target' },
      { status: 500 }
    );
  }
}

// PUT - Update budget target
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Update budget target
    const { error: budgetError } = await supabase
      .from('budget_targets')
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (budgetError) throw budgetError;

    // Delete existing payment periods and insert new ones
    const { error: deleteError } = await supabase
      .from('budget_target_payments')
      .delete()
      .eq('budget_target_id', id);

    if (deleteError) throw deleteError;

    if (paymentPeriods && paymentPeriods.length > 0) {
      const paymentRows = paymentPeriods.map((p: any) => ({
        budget_target_id: id,
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
      message: 'Budget target updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating budget target:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update budget target' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete budget target
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('budget_targets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      message: 'Budget target deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting budget target:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete budget target' },
      { status: 500 }
    );
  }
}

