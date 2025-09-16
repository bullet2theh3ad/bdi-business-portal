import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoices, invoiceLineItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    console.log('🔍 INDIVIDUAL INVOICE API - Full invoice data:', invoice);
    console.log('📄 PDF URL field check:', {
      approvedPdfUrl: invoice.approvedPdfUrl
    });

    return NextResponse.json(invoice);

  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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
    const invoiceId = params.id;
    
    console.log('✏️ UPDATING Invoice ID:', invoiceId, 'with data:', body);

    // Check if this is a status-only update (from CFO approval/rejection)
    const isStatusOnlyUpdate = Object.keys(body).length <= 4 && 
      (body.status || body.financeApproverName || body.financeApprovalDate || body.rejectionReason);

    let updateData: any = {};

    if (isStatusOnlyUpdate) {
      // Status-only update - only update the fields that are provided
      if (body.status) updateData.status = body.status;
      if (body.financeApproverName) updateData.notes = (body.notes || '') + `\n[Finance Approved by: ${body.financeApproverName}]`;
      if (body.rejectionReason) updateData.notes = (body.notes || '') + `\n[Rejected by Finance: ${body.rejectionReason}]`;
      if (body.approvedPdfUrl) updateData.approved_pdf_url = body.approvedPdfUrl; // Store PDF URL (snake_case for DB)
      updateData.updatedAt = new Date();
    } else {
      // Full invoice update - update all fields
      updateData = {
        invoiceNumber: body.invoiceNumber || body.poNumber,
        customerName: body.customerName || body.supplierName,
        invoiceDate: new Date(body.invoiceDate || body.orderDate),
        requestedDeliveryWeek: body.requestedDeliveryWeek ? new Date(body.requestedDeliveryWeek) : null,
        status: body.status || 'draft',
        terms: body.terms,
        incoterms: body.incoterms,
        incotermsLocation: body.incotermsLocation,
        totalValue: body.totalValue ? body.totalValue.toString() : undefined,
        notes: body.notes,
        // NEW FIELDS: Addresses and shipping
        customerAddress: body.customerAddress || null,
        shipToAddress: body.shipToAddress || null,
        shipDate: body.shipDate || null,
        // NEW FIELDS: Bank information
        bankName: body.bankName || null,
        bankAccountNumber: body.bankAccountNumber || null,
        bankRoutingNumber: body.bankRoutingNumber || null,
        bankSwiftCode: body.bankSwiftCode || null,
        bankIban: body.bankIban || null,
        bankAddress: body.bankAddress || null,
        bankCountry: body.bankCountry || null,
        bankCurrency: body.bankCurrency || 'USD',
        updatedAt: new Date(),
      };
    }

    // Update invoice in database
    const [updatedInvoice] = await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId))
      .returning();

    console.log('✅ Updated invoice:', updatedInvoice);

    // Update line items if provided
    if (body.lineItems && body.lineItems.length > 0) {
      // Delete existing line items
      await db
        .delete(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoiceId));

      // Insert updated line items
      const lineItemsToInsert = body.lineItems.map((item: any) => {
        const unitCost = parseFloat(item.unitCost || item.unitPrice || 0);
        const quantity = parseInt(item.quantity || 0);
        const lineTotal = item.lineTotal || item.totalCost || (quantity * unitCost);
        
        return {
          invoiceId: invoiceId,
          skuId: item.skuId,
          skuCode: item.sku || item.skuCode,
          skuName: item.skuName,
          description: item.description || null,
          quantity: quantity,
          unitCost: unitCost.toString(),
          lineTotal: parseFloat(lineTotal || 0).toString(),
        };
      });

      const insertedLineItems = await db
        .insert(invoiceLineItems)
        .values(lineItemsToInsert)
        .returning();

      console.log('✅ Updated line items:', insertedLineItems.length);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Invoice updated successfully!',
      id: updatedInvoice.id,
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    // Verify user has admin access for deletion
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin', 'admin_cfo'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required for deletion' }, { status: 403 });
    }

    const invoiceId = params.id;
    console.log('🗑️ DELETING Invoice ID:', invoiceId);

    // Delete line items first (due to foreign key constraints)
    const deletedLineItems = await db
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .returning();

    console.log(`🗑️ Deleted ${deletedLineItems.length} line items`);

    // Delete the invoice
    const deletedInvoice = await db
      .delete(invoices)
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (deletedInvoice.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    console.log('✅ Successfully deleted invoice:', deletedInvoice[0].invoiceNumber);
    
    return NextResponse.json({ 
      success: true, 
      message: `Invoice ${deletedInvoice[0].invoiceNumber} deleted successfully`,
      deletedInvoice: deletedInvoice[0]
    });

  } catch (error) {
    console.error('❌ Error deleting invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}