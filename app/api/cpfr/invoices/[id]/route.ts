import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoices, invoiceLineItems, invoicePaymentLineItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 📧 Send rejection notification email
async function sendRejectionNotification(invoiceData: any, rejectionReason: string, rejectorName: string) {
  console.log('📧 REJECTION NOTIFICATION - Invoice rejected:', invoiceData.invoiceNumber);
  
  if (!resend) {
    console.log('📧 REJECTION NOTIFICATION - Resend not configured, skipping email');
    return;
  }

  try {
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: ['invoices@boundlessdevices.com'],
      cc: ['dzand@boundlessdevices.com'],
      subject: `❌ Invoice Rejected for Revisions - ${invoiceData.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">❌ Invoice Rejected for Revisions</h2>
          
          <p>Hello Team,</p>
          
          <p>Invoice <strong>${invoiceData.invoiceNumber}</strong> has been rejected by <strong>${rejectorName}</strong> and requires revisions:</p>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Rejection Details:</h3>
            <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
            <p><strong>Customer:</strong> ${invoiceData.customerName}</p>
            <p><strong>Total Value:</strong> $${Number(invoiceData.totalValue).toLocaleString()}</p>
            <p><strong>Rejected by:</strong> ${rejectorName}</p>
            <p><strong>Rejection Date:</strong> ${new Date().toLocaleString()}</p>
            
            <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin-top: 15px;">
              <h4 style="margin-top: 0; color: #991b1b;">Rejection Reason:</h4>
              <p style="margin: 0; font-style: italic; color: #374151;">"${rejectionReason}"</p>
            </div>
          </div>
          
          <p><strong>Next Steps:</strong> Please review the rejection reason and make necessary revisions before resubmitting.</p>
          
          <p><a href="https://bdibusinessportal.com/cpfr/invoices" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Invoices</a></p>
          
          <p>Best regards,<br>BDI Business Portal Team</p>
        </div>
      `
    });

    if (emailError) {
      console.error('📧 REJECTION NOTIFICATION - Email failed:', emailError);
    } else {
      console.log('📧 REJECTION NOTIFICATION - Email sent successfully to invoices@boundlessdevices.com:', emailData?.id);
    }

  } catch (error) {
    console.error('📧 REJECTION NOTIFICATION - Error sending email:', error);
  }
}

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

    // Check if this is a status-only update (from CFO approval/rejection) OR payment-only update
    const isStatusOnlyUpdate = Object.keys(body).length <= 4 && 
      (body.status || body.financeApproverName || body.financeApprovalDate || body.rejectionReason);
    
    const isPaymentOnlyUpdate = Object.keys(body).length === 1 && body.paymentLineItems;

    let updateData: any = {};

    if (isPaymentOnlyUpdate) {
      // Payment-only update - don't update the invoice itself, just the payment line items
      console.log('💰 Payment-only update detected - skipping invoice update');
    } else if (isStatusOnlyUpdate) {
      // Status-only update - only update the fields that are provided
      if (body.status) updateData.status = body.status;
      if (body.financeApproverName) updateData.notes = (body.notes || '') + `\n[Finance Approved by: ${body.financeApproverName}]`;
      if (body.rejectionReason) updateData.notes = (body.notes || '') + `\n[Rejected by Finance: ${body.rejectionReason}]`;
      if (body.approvedPdfUrl) {
        updateData.approvedPdfUrl = body.approvedPdfUrl; // Store PDF URL (camelCase for Drizzle)
        console.log('💾 STORING FILE PATH:', body.approvedPdfUrl);
        console.log('🔧 DRIZZLE FIX: Using camelCase approvedPdfUrl instead of snake_case');
      }
    } else {
      // Full invoice update - update all fields
      updateData = {
        invoiceNumber: body.invoiceNumber || body.poNumber,
        customerName: body.customerName || body.supplierName,
        invoiceDate: body.invoiceDate || body.orderDate, // Pass string directly, let Drizzle handle conversion
        requestedDeliveryWeek: body.requestedDeliveryWeek && body.requestedDeliveryWeek.trim() !== '' ? body.requestedDeliveryWeek : null,
        status: body.status || 'draft',
        terms: body.terms,
        incoterms: body.incoterms,
        incotermsLocation: body.incotermsLocation,
        totalValue: body.totalValue ? body.totalValue.toString() : undefined,
        notes: body.notes,
        // NEW FIELDS: Addresses and shipping
        customerAddress: body.customerAddress || null,
        shipToAddress: body.shipToAddress || null,
        shipDate: body.shipDate && body.shipDate.trim() !== '' ? body.shipDate : null,
        // NEW FIELDS: Bank information
        bankName: body.bankName || null,
        bankAccountNumber: body.bankAccountNumber || null,
        bankRoutingNumber: body.bankRoutingNumber || null,
        bankSwiftCode: body.bankSwiftCode || null,
        bankIban: body.bankIban || null,
        bankAddress: body.bankAddress || null,
        bankCountry: body.bankCountry || null,
        bankCurrency: body.bankCurrency || 'USD',
        // Don't manually set updatedAt - let the database trigger handle it
      };
    }

    // Update invoice in database (skip if payment-only update)
    let updatedInvoice;
    if (!isPaymentOnlyUpdate) {
      [updatedInvoice] = await db
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, invoiceId))
        .returning();

      console.log('✅ Updated invoice:', updatedInvoice);
    } else {
      console.log('⏭️  Skipping invoice update for payment-only change');
    }

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

    // Update payment line items if provided
    if (body.paymentLineItems !== undefined) {
      try {
        console.log('💰 Updating payment line items for invoice:', invoiceId);
        console.log('💰 Payment items received:', body.paymentLineItems);
        
        // Delete existing payment line items
        await db
          .delete(invoicePaymentLineItems)
          .where(eq(invoicePaymentLineItems.invoiceId, invoiceId));

        // Insert updated payment line items (if any)
        if (body.paymentLineItems.length > 0) {
          const paymentItemsToInsert = body.paymentLineItems.map((payment: any) => ({
            invoiceId: invoiceId,
            paymentNumber: payment.paymentNumber,
            paymentDate: payment.paymentDate, // Keep as string, Drizzle will handle conversion
            amount: parseFloat(payment.amount).toString(),
            notes: payment.notes || null,
            isPaid: payment.isPaid || false,
            createdBy: requestingUser.authId,
          }));

          console.log('💰 Inserting payment items:', paymentItemsToInsert);

          const insertedPaymentItems = await db
            .insert(invoicePaymentLineItems)
            .values(paymentItemsToInsert)
            .returning();

          console.log('✅ Updated payment line items:', insertedPaymentItems.length);
        } else {
          console.log('✅ Cleared all payment line items');
        }
      } catch (paymentError) {
        console.error('❌ Error updating payment line items:', paymentError);
        console.error('❌ Payment error details:', JSON.stringify(paymentError, null, 2));
        throw new Error(`Failed to update payment line items: ${paymentError}`);
      }
    }

    // 📧 Send rejection notification if invoice was rejected
    if (body.status === 'rejected_by_finance' && body.rejectionReason) {
      console.log('📧 REJECTION NOTIFICATION - Invoice rejected, sending notification');
      try {
        await sendRejectionNotification(updatedInvoice, body.rejectionReason, body.financeApproverName || 'Finance Team');
      } catch (emailError) {
        console.error('⚠️ Failed to send rejection notification (invoice update still successful):', emailError);
        // Don't fail the invoice update if email fails
      }
    }
    
    return NextResponse.json({
      success: true, 
      message: 'Invoice updated successfully!',
      id: invoiceId,
      invoice: updatedInvoice || { id: invoiceId }
    });

  } catch (error) {
    console.error('❌ Error updating invoice:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined 
    }, { status: 500 });
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