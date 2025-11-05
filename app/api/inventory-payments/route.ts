import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { inventoryPaymentPlans, inventoryPaymentLineItems } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// GET - Fetch all payment plans for the user's organization
export async function GET() {
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization(s)
    const { data: orgMemberships, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_uuid')
      .eq('user_auth_id', user.id);

    if (orgError || !orgMemberships || orgMemberships.length === 0) {
      console.error('Organization lookup error:', orgError);
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    const orgIds = orgMemberships.map(m => m.organization_uuid);

    // Fetch payment plans with their line items
    const plans = await db
      .select()
      .from(inventoryPaymentPlans)
      .where(inArray(inventoryPaymentPlans.organizationId, orgIds))
      .orderBy(inventoryPaymentPlans.createdAt);

    // Fetch all line items for these plans
    const planIds = plans.map(p => p.id);
    const lineItems = planIds.length > 0
      ? await db
          .select()
          .from(inventoryPaymentLineItems)
          .where(inArray(inventoryPaymentLineItems.paymentPlanId, planIds))
          .orderBy(inventoryPaymentLineItems.paymentDate)
      : [];

    // Group line items by plan
    const plansWithLineItems = plans.map(plan => ({
      ...plan,
      lineItems: lineItems.filter(item => item.paymentPlanId === plan.id),
    }));

    return NextResponse.json(plansWithLineItems);
  } catch (error) {
    console.error('Error fetching payment plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment plans' },
      { status: 500 }
    );
  }
}

// POST - Create a new payment plan
export async function POST(request: Request) {
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's primary organization
    const { data: orgMemberships, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_uuid')
      .eq('user_auth_id', user.id)
      .limit(1)
      .single();

    if (orgError || !orgMemberships) {
      console.error('Organization lookup error:', orgError);
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    const body = await request.json();
    const { planNumber, name, status, lineItems } = body;

    // Create the payment plan
    const [newPlan] = await db
      .insert(inventoryPaymentPlans)
      .values({
        planNumber,
        name,
        status: status || 'draft',
        createdBy: user.id,
        organizationId: orgMemberships.organization_uuid,
      })
      .returning();

    // Create line items if provided
    if (lineItems && lineItems.length > 0) {
      const lineItemsToInsert = lineItems.map((item: any) => ({
        paymentPlanId: newPlan.id,
        description: item.description,
        project: item.project, // Required field
        amount: item.amount.toString(),
        paymentDate: item.date,
        reference: item.reference || '',
        referenceType: item.referenceType || 'other',
        isPaid: item.isPaid || false,
        paidAt: item.isPaid ? new Date() : null,
      }));

      await db.insert(inventoryPaymentLineItems).values(lineItemsToInsert);
    }

    // Fetch the complete plan with line items
    const createdLineItems = await db
      .select()
      .from(inventoryPaymentLineItems)
      .where(eq(inventoryPaymentLineItems.paymentPlanId, newPlan.id));

    return NextResponse.json({
      ...newPlan,
      lineItems: createdLineItems,
    });
  } catch (error) {
    console.error('Error creating payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to create payment plan' },
      { status: 500 }
    );
  }
}

