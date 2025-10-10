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

// GET - Fetch budget vs actual analysis
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch from the budget_vs_actual_analysis view
    const { data: analysisData, error: analysisError } = await supabase
      .from('budget_vs_actual_analysis')
      .select('*')
      .order('fiscal_year', { ascending: false });

    if (analysisError) {
      // If view doesn't exist yet, return empty array
      if (analysisError.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      throw analysisError;
    }

    // Convert snake_case to camelCase
    const formattedAnalysis = analysisData.map((a: any) => ({
      budgetTargetId: a.budget_target_id,
      projectName: a.project_name,
      skuCode: a.sku_code,
      budgetCategory: a.budget_category,
      fiscalYear: a.fiscal_year,
      targetAmount: a.target_amount,
      actualAmount: a.actual_amount,
      varianceAmount: a.variance_amount,
      variancePercentage: a.variance_percentage,
      budgetStatus: a.budget_status,
      status: a.status,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

    return NextResponse.json(formattedAnalysis);
  } catch (error: any) {
    console.error('Error fetching budget analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch budget analysis' },
      { status: 500 }
    );
  }
}

