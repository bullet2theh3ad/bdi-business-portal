import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoices, invoiceLineItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    // Verify user has sales/admin access
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin', 'sales', 'member'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - Sales access required' }, { status: 403 });
    }

    // Query invoices from database
    const invoicesList = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerName: invoices.customerName,
        invoiceDate: invoices.invoiceDate,
        requestedDeliveryWeek: invoices.requestedDeliveryWeek,
        status: invoices.status,
        terms: invoices.terms,
        incoterms: invoices.incoterms,
        incotermsLocation: invoices.incotermsLocation,
        totalValue: invoices.totalValue,
        documents: invoices.documents,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        createdBy: invoices.createdBy,
      })
      .from(invoices)
      .orderBy(invoices.createdAt);

    console.log('Fetched invoices:', invoicesList.length);
    return NextResponse.json(invoicesList);

  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    // Verify user has sales/admin access
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin', 'sales', 'member'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - Sales access required' }, { status: 403 });
    }

    const body = await request.json();
    console.log('Creating Invoice with data:', body);

    // Insert invoice into database
    const [newInvoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber: body.poNumber, // Form field name is still poNumber
        customerName: body.supplierName, // Form field name is still supplierName
        invoiceDate: new Date(body.orderDate), // Form field name is still orderDate
        requestedDeliveryWeek: body.requestedDeliveryWeek ? new Date(body.requestedDeliveryWeek) : null,
        status: 'draft',
        terms: body.terms,
        incoterms: body.incoterms,
        incotermsLocation: body.incotermsLocation,
        totalValue: body.totalValue.toString(),
        notes: body.notes,
        createdBy: requestingUser.authId,
      })
      .returning();

    console.log('Created invoice:', newInvoice);

    // Insert line items if provided
    if (body.lineItems && body.lineItems.length > 0) {
      const lineItemsToInsert = body.lineItems.map((item: any) => ({
        invoiceId: newInvoice.id,
        skuId: item.skuId,
        skuCode: item.sku,
        skuName: item.skuName,
        quantity: item.quantity,
        unitCost: item.unitCost.toString(),
        lineTotal: item.lineTotal.toString(),
      }));

      const insertedLineItems = await db
        .insert(invoiceLineItems)
        .values(lineItemsToInsert)
        .returning();

      console.log('Created line items:', insertedLineItems.length);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Invoice created successfully!',
      invoice: newInvoice
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
