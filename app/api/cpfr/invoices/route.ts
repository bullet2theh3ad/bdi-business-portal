import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoices, invoiceLineItems, invoicePaymentLineItems, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 📧 Send finance notification when invoice submitted for approval
async function sendFinanceNotification(invoiceData: any, submitterName: string) {
  console.log('📧 FINANCE NOTIFICATION - Invoice submitted to finance:', invoiceData.invoiceNumber);
  
  if (!resend) {
    console.log('📧 FINANCE NOTIFICATION - Resend not configured, skipping email');
    return;
  }

  try {
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: ['invoices@boundlessdevices.com'],
      subject: `🔔 Invoice Ready for Finance Review - ${invoiceData.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🔔 Invoice Submitted for Finance Approval</h2>
          
          <p>Hello Finance Team,</p>
          
          <p>A new invoice has been submitted by <strong>${submitterName}</strong> and requires finance review and approval:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Invoice Details:</h3>
            <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
            <p><strong>Customer:</strong> ${invoiceData.customerName}</p>
            <p><strong>Total Value:</strong> $${Number(invoiceData.totalValue).toLocaleString()}</p>
            <p><strong>Terms:</strong> ${invoiceData.terms}</p>
            <p><strong>Submitted by:</strong> ${submitterName}</p>
            <p><strong>Submission Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p><strong>Next Steps:</strong> Please log into the BDI Business Portal to review and approve this invoice.</p>
          
          <p><a href="https://bdibusinessportal.com/cpfr/invoices" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Invoice</a></p>
          
          <p>Best regards,<br>BDI Business Portal Team</p>
        </div>
      `
    });

    if (emailError) {
      console.error('📧 FINANCE NOTIFICATION - Email failed:', emailError);
    } else {
      console.log('📧 FINANCE NOTIFICATION - Email sent successfully to invoices@boundlessdevices.com:', emailData?.id);
    }

  } catch (error) {
    console.error('📧 FINANCE NOTIFICATION - Error sending email:', error);
  }
}

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

    // Get user's organization to determine access level
    const userOrgMembership = await db
      .select({
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type,
        }
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    const isBDIUser = userOrgMembership.length > 0 && 
      userOrgMembership[0].organization.code === 'BDI' && 
      userOrgMembership[0].organization.type === 'internal';

    // Query invoices from database with organization-based filtering
    let invoicesList;
    
    if (isBDIUser) {
      // BDI users can see ALL invoices
      invoicesList = await db
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
          // NEW FIELDS: Addresses and bank info
          customerAddress: invoices.customerAddress,
          shipToAddress: invoices.shipToAddress,
          shipDate: invoices.shipDate,
          bankName: invoices.bankName,
          bankAccountNumber: invoices.bankAccountNumber,
          bankRoutingNumber: invoices.bankRoutingNumber,
          bankSwiftCode: invoices.bankSwiftCode,
          bankIban: invoices.bankIban,
          bankAddress: invoices.bankAddress,
          bankCountry: invoices.bankCountry,
          bankCurrency: invoices.bankCurrency,
        })
        .from(invoices)
        .orderBy(invoices.createdAt);
    } else {
      // Partner organizations only see invoices where they are the customer
      const orgCode = userOrgMembership[0]?.organization.code;
      if (!orgCode) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
      
      invoicesList = await db
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
          // NEW FIELDS: Addresses and bank info
          customerAddress: invoices.customerAddress,
          shipToAddress: invoices.shipToAddress,
          shipDate: invoices.shipDate,
          bankName: invoices.bankName,
          bankAccountNumber: invoices.bankAccountNumber,
          bankRoutingNumber: invoices.bankRoutingNumber,
          bankSwiftCode: invoices.bankSwiftCode,
          bankIban: invoices.bankIban,
          bankAddress: invoices.bankAddress,
          bankCountry: invoices.bankCountry,
          bankCurrency: invoices.bankCurrency,
        })
        .from(invoices)
        .where(eq(invoices.customerName, orgCode))
        .orderBy(invoices.createdAt);
    }

    // Fetch payment line items for each invoice
    const invoicesWithPayments = await Promise.all(
      invoicesList.map(async (invoice) => {
        const paymentLineItemsList = await db.select()
          .from(invoicePaymentLineItems)
          .where(eq(invoicePaymentLineItems.invoiceId, invoice.id))
          .orderBy(invoicePaymentLineItems.paymentNumber);

        return {
          ...invoice,
          paymentLineItems: paymentLineItemsList.map((payment) => ({
            id: payment.id,
            paymentNumber: payment.paymentNumber,
            paymentDate: payment.paymentDate,
            amount: parseFloat(payment.amount) || 0,
            notes: payment.notes,
            isPaid: payment.isPaid || false,
          })),
        };
      })
    );

    console.log('Fetched invoices:', invoicesWithPayments.length);
    return NextResponse.json(invoicesWithPayments);

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

    // Insert invoice into database with all new fields
    const invoiceData: any = {
        invoiceNumber: body.invoiceNumber || body.poNumber, // Support both new and old field names
        customerName: body.customerName || body.supplierName, // Support both new and old field names
        invoiceDate: body.invoiceDate || body.orderDate, // Pass string directly, let Drizzle handle conversion
        requestedDeliveryWeek: body.requestedDeliveryWeek && body.requestedDeliveryWeek.trim() !== '' ? body.requestedDeliveryWeek : null,
        status: body.status || 'draft', // Use provided status or default to 'draft'
        terms: body.terms,
        incoterms: body.incoterms,
        incotermsLocation: body.incotermsLocation,
        totalValue: body.totalValue.toString(),
        notes: body.notes,
        createdBy: requestingUser.authId,
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
    };

    const [newInvoice] = await db
      .insert(invoices)
      .values(invoiceData)
      .returning();

    console.log('Created invoice:', newInvoice);

    // Insert line items if provided
    if (body.lineItems && body.lineItems.length > 0) {
      const lineItemsToInsert = body.lineItems.map((item: any) => {
        const unitCost = parseFloat(item.unitCost || item.unitPrice || 0);
        const quantity = parseInt(item.quantity || 0);
        const lineTotal = item.lineTotal || item.totalCost || (quantity * unitCost);
        
        return {
          invoiceId: newInvoice.id,
          skuId: item.skuId,
          skuCode: item.sku || item.skuCode,
          skuName: item.skuName,
          description: item.description || null, // NEW: Editable description
          quantity: quantity,
          unitCost: unitCost.toString(),
          lineTotal: parseFloat(lineTotal || 0).toString(),
        };
      });

      const insertedLineItems = await db
        .insert(invoiceLineItems)
        .values(lineItemsToInsert)
        .returning();

      console.log('Created line items:', insertedLineItems.length);
    }

    // Insert payment line items if provided
    if (body.paymentLineItems && body.paymentLineItems.length > 0) {
      const paymentItemsToInsert = body.paymentLineItems.map((payment: any) => ({
        invoiceId: newInvoice.id,
        paymentNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate, // Keep as string, Drizzle will handle conversion
        amount: parseFloat(payment.amount).toString(),
        notes: payment.notes || null,
        isPaid: payment.isPaid || false,
        createdBy: requestingUser.authId,
      }));

      const insertedPaymentItems = await db
        .insert(invoicePaymentLineItems)
        .values(paymentItemsToInsert)
        .returning();

      console.log('Created payment line items:', insertedPaymentItems.length);
    }

    // 📧 Send finance notification if invoice submitted to finance
    if (newInvoice.status === 'submitted_to_finance') {
      console.log('📧 FINANCE NOTIFICATION - Invoice submitted to finance, sending notification');
      try {
        await sendFinanceNotification(newInvoice, requestingUser.name || requestingUser.email);
      } catch (emailError) {
        console.error('⚠️ Failed to send finance notification (invoice creation still successful):', emailError);
        // Don't fail the invoice creation if email fails
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Invoice created successfully!',
      id: newInvoice.id,
      invoice: newInvoice
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

