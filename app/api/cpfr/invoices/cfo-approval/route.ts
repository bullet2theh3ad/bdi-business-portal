import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 📧 Send approval notification when invoice is approved by CFO
async function sendApprovalNotification(invoiceData: any, approverName: string, recipientEmail: string) {
  if (!resend) {
    console.log('📧 RESEND not configured - skipping approval notification');
    return;
  }

  try {
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: [recipientEmail],
      cc: ['invoices@boundlessdevices.com'],
      subject: `✅ Invoice Approved - ${invoiceData.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">✅ Invoice Approved by Finance</h2>
          
          <p>Hello,</p>
          
          <p>Great news! Your invoice has been approved by <strong>${approverName}</strong> and is ready for processing:</p>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="margin-top: 0; color: #1f2937;">Invoice Details:</h3>
            <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
            <p><strong>Customer:</strong> ${invoiceData.customerName}</p>
            <p><strong>Total Value:</strong> $${Number(invoiceData.totalValue).toLocaleString()}</p>
            <p><strong>Terms:</strong> ${invoiceData.terms}</p>
            <p><strong>Approved by:</strong> ${approverName}</p>
            <p><strong>Approval Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>The approved invoice PDF has been sent to: <strong>${recipientEmail}</strong></p>
          
          <p><a href="https://bdibusinessportal.com/cpfr/invoices" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Invoice</a></p>
          
          <p>Best regards,<br>BDI Business Portal Team</p>
        </div>
      `
    });

    if (emailError) {
      console.error('❌ Error sending approval notification:', emailError);
    } else {
      console.log('✅ Approval notification sent successfully');
    }
  } catch (error) {
    console.error('❌ Error sending approval notification:', error);
  }
}

// 📧 Send rejection notification when invoice is rejected by CFO
async function sendRejectionNotification(invoiceData: any, rejectorName: string, rejectionReason: string) {
  if (!resend) {
    console.log('📧 RESEND not configured - skipping rejection notification');
    return;
  }

  try {
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: ['invoices@boundlessdevices.com'],
      subject: `❌ Invoice Rejected - ${invoiceData.invoiceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">❌ Invoice Rejected by Finance</h2>
          
          <p>Hello Finance Team,</p>
          
          <p>An invoice has been rejected by <strong>${rejectorName}</strong> and requires revision:</p>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #1f2937;">Invoice Details:</h3>
            <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber}</p>
            <p><strong>Customer:</strong> ${invoiceData.customerName}</p>
            <p><strong>Total Value:</strong> $${Number(invoiceData.totalValue).toLocaleString()}</p>
            <p><strong>Terms:</strong> ${invoiceData.terms}</p>
            <p><strong>Rejected by:</strong> ${rejectorName}</p>
            <p><strong>Rejection Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background-color: #fff7ed; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e;">Rejection Reason:</h4>
            <p style="color: #92400e; font-style: italic;">"${rejectionReason}"</p>
          </div>
          
          <p><strong>Next Steps:</strong> Please log into the BDI Business Portal to revise this invoice based on the feedback.</p>
          
          <p><a href="https://bdibusinessportal.com/cpfr/invoices" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Revise Invoice</a></p>
          
          <p>Best regards,<br>BDI Business Portal Team</p>
        </div>
      `
    });

    if (emailError) {
      console.error('❌ Error sending rejection notification:', emailError);
    } else {
      console.log('✅ Rejection notification sent successfully');
    }
  } catch (error) {
    console.error('❌ Error sending rejection notification:', error);
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

    // Verify user has CFO/Super Admin access
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin_cfo'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - CFO access required' }, { status: 403 });
    }

    const body = await request.json();
    const { invoiceId, action, approvalEmail, rejectionReason } = body;
    
    console.log('🎯 CFO APPROVAL API:', { invoiceId, action, approvalEmail, rejectionReason });

    if (!invoiceId || !action) {
      return NextResponse.json({ error: 'Invoice ID and action are required' }, { status: 400 });
    }

    // Get the invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    let updateData: any = {};
    let emailRecipient = approvalEmail;

    if (action === 'approved') {
      if (!approvalEmail) {
        return NextResponse.json({ error: 'Approval email is required' }, { status: 400 });
      }
      
      updateData = {
        status: 'approved_by_finance',
        notes: (invoice.notes || '') + `\n[Finance Approved by: ${requestingUser.name || requestingUser.email} on ${new Date().toLocaleString()}]`,
        updatedAt: new Date(),
      };
      
      console.log('✅ APPROVING invoice:', invoiceId);
    } else if (action === 'rejected') {
      if (!rejectionReason) {
        return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
      }
      
      updateData = {
        status: 'rejected_by_finance',
        notes: (invoice.notes || '') + `\n[Rejected by Finance: ${rejectionReason} - ${requestingUser.name || requestingUser.email} on ${new Date().toLocaleString()}]`,
        updatedAt: new Date(),
      };
      
      console.log('❌ REJECTING invoice:', invoiceId);
    } else {
      return NextResponse.json({ error: 'Invalid action. Must be "approved" or "rejected"' }, { status: 400 });
    }

    // Update invoice in database
    const [updatedInvoice] = await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId))
      .returning();

    console.log('✅ Updated invoice status:', updatedInvoice.status);

    // Send notification emails
    if (action === 'approved') {
      // Send approval notification to specified email and BDI finance
      await sendApprovalNotification(updatedInvoice, requestingUser.name || requestingUser.email, approvalEmail);
      
      // Also send the approved invoice PDF to the recipient
      try {
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/cpfr/invoices/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipients: approvalEmail,
            ccRecipients: 'invoices@boundlessdevices.com',
            invoiceNumber: updatedInvoice.invoiceNumber,
            pdfUrl: updatedInvoice.approvedPdfUrl
          }),
        });
        
        if (emailResponse.ok) {
          console.log('✅ Approved invoice PDF sent successfully');
        } else {
          console.error('❌ Failed to send approved invoice PDF');
        }
      } catch (error) {
        console.error('❌ Error sending approved invoice PDF:', error);
      }
    } else if (action === 'rejected') {
      // Send rejection notification
      await sendRejectionNotification(updatedInvoice, requestingUser.name || requestingUser.email, rejectionReason);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Invoice ${action} successfully!`,
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Error in CFO approval:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
