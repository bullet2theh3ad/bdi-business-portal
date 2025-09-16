import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      invoiceId,
      invoiceNumber, 
      pdfUrl, 
      recipients, 
      ccRecipients, 
      customerName, 
      totalValue 
    } = body;

    console.log('📧 Preparing to send invoice email:', {
      invoiceNumber,
      recipients,
      ccRecipients,
      pdfUrl: pdfUrl ? 'Present' : 'Missing'
    });

    console.log('📧 Full request body received:', body);

    // Validate required fields
    if (!invoiceNumber || !pdfUrl || !recipients) {
      const missingFields = [];
      if (!invoiceNumber) missingFields.push('invoiceNumber');
      if (!pdfUrl) missingFields.push('pdfUrl');
      if (!recipients) missingFields.push('recipients');
      
      console.log('❌ Missing required fields:', missingFields);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse recipients
    const toEmails = recipients.split(',').map((email: string) => email.trim()).filter(Boolean);
    const ccEmails = ccRecipients ? ccRecipients.split(',').map((email: string) => email.trim()).filter(Boolean) : [];

    // Download the PDF from Supabase
    console.log('📄 Downloading PDF from:', pdfUrl);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    // Create email subject and body
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = `BDI Portal Invoice - ${invoiceNumber} - ${currentDate}`;
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2563eb; margin: 0 0 10px 0;">BDI Business Portal</h2>
          <h3 style="color: #374151; margin: 0;">Invoice Ready for Review</h3>
        </div>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <p style="color: #374151; line-height: 1.6;">
            Dear Team,
          </p>
          
          <p style="color: #374151; line-height: 1.6;">
            Please find the approved invoice attached to this email:
          </p>
          
          
          <p style="color: #374151; line-height: 1.6;">
            The invoice PDF is attached to this email. Please review and process accordingly.
          </p>
          
          <p style="color: #374151; line-height: 1.6;">
            If you have any questions or need additional information, please contact the finance team.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            Best regards,<br>
            <strong>BDI Business Portal</strong><br>
            Automated Invoice System
          </p>
        </div>
      </div>
    `;

    // Send email with Resend
    const emailData = {
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: toEmails,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      subject: subject,
      html: htmlBody,
      attachments: [
        {
          filename: `${invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    };

    console.log('📤 Sending email via Resend to:', toEmails);
    if (ccEmails.length > 0) {
      console.log('📤 CC:', ccEmails);
    }

    const result = await resend.emails.send(emailData);
    
    console.log('✅ Email sent successfully:', result);

    return NextResponse.json({ 
      success: true, 
      messageId: result.data?.id,
      recipients: toEmails,
      ccRecipients: ccEmails
    });

  } catch (error) {
    console.error('❌ Error sending invoice email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
