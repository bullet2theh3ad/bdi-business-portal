import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { inventoryPaymentPlans, inventoryPaymentLineItems } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// PUT - Update a payment plan
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const planId = parseInt(id);

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

    // Verify user has access to this plan
    const [existingPlan] = await db
      .select()
      .from(inventoryPaymentPlans)
      .where(
        and(
          eq(inventoryPaymentPlans.id, planId),
          inArray(inventoryPaymentPlans.organizationId, orgIds)
        )
      );

    if (!existingPlan) {
      return NextResponse.json({ error: 'Payment plan not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, status, lineItems } = body;

    // Update the payment plan
    const [updatedPlan] = await db
      .update(inventoryPaymentPlans)
      .set({
        name,
        status,
        updatedAt: new Date(),
      })
      .where(eq(inventoryPaymentPlans.id, planId))
      .returning();

    // Delete existing line items
    await db
      .delete(inventoryPaymentLineItems)
      .where(eq(inventoryPaymentLineItems.paymentPlanId, planId));

    // Insert updated line items
    if (lineItems && lineItems.length > 0) {
      const lineItemsToInsert = lineItems.map((item: any) => ({
        paymentPlanId: planId,
        description: item.description,
        project: item.project, // Required field
        amount: item.amount.toString(),
        paymentDate: item.date,
        reference: item.reference || '',
        referenceType: item.referenceType || 'other',
        isPaid: item.isPaid || false,
        paidAt: item.isPaid ? (item.paidAt || new Date()) : null,
      }));

      await db.insert(inventoryPaymentLineItems).values(lineItemsToInsert);
    }

    // Fetch the updated line items
    const updatedLineItems = await db
      .select()
      .from(inventoryPaymentLineItems)
      .where(eq(inventoryPaymentLineItems.paymentPlanId, planId));

    return NextResponse.json({
      ...updatedPlan,
      lineItems: updatedLineItems,
    });
  } catch (error) {
    console.error('Error updating payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to update payment plan' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a payment plan
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const planId = parseInt(id);

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

    // Verify user has access to this plan
    const [existingPlan] = await db
      .select()
      .from(inventoryPaymentPlans)
      .where(
        and(
          eq(inventoryPaymentPlans.id, planId),
          inArray(inventoryPaymentPlans.organizationId, orgIds)
        )
      );

    if (!existingPlan) {
      return NextResponse.json({ error: 'Payment plan not found' }, { status: 404 });
    }

    // Delete the payment plan (cascade will delete line items)
    await db
      .delete(inventoryPaymentPlans)
      .where(eq(inventoryPaymentPlans.id, planId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment plan' },
      { status: 500 }
    );
  }
}

