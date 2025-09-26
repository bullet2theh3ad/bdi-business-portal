import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('🔐 Custom Password Reset - Processing for:', email);

    // Check if user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, auth_id, name, email, is_active')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !userData) {
      // Don't reveal if user exists for security
      return NextResponse.json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    if (!userData.is_active) {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 400 });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('auth_id', userData.auth_id);

    if (updateError) {
      console.error('Error storing reset token:', updateError);
      return NextResponse.json({ error: 'Failed to process password reset' }, { status: 500 });
    }

    // Send password reset email using Resend
    const resetUrl = `https://bdibusinessportal.com/reset-password?token=${resetToken}`;
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: [email],
      subject: 'Reset your BDI Business Portal password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🏢 BDI Business Portal</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Boundless Devices Inc.</p>
          </div>
          
          <h2 style="color: #374151;">Reset Your Password</h2>
          
          <p style="color: #6b7280; font-size: 16px;">
            Hi ${userData.name || 'there'} 👋
          </p>
          
          <p style="color: #6b7280; font-size: 16px;">
            We received a request to reset your password for your BDI Business Portal account.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 14px;">
            If you can't click the button, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
          </p>
          
          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="color: #b91c1c; margin: 0; font-size: 14px;">
              ⚠️ <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            <strong>BDI Business Portal</strong><br>
            Boundless Devices Inc<br>
            <a href="mailto:support@bdibusinessportal.com" style="color: #2563eb;">support@bdibusinessportal.com</a>
          </p>
        </div>
      `,
      text: `
Reset Your BDI Business Portal Password

Hi ${userData.name || 'there'},

We received a request to reset your password for your BDI Business Portal account.

Click here to reset your password: ${resetUrl}

This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.

Best regards,
BDI Business Portal Team
Boundless Devices Inc
      `
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 });
    }

    console.log('✅ Password reset email sent via Resend:', emailData?.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset email sent successfully',
      emailId: emailData?.id 
    });

  } catch (error) {
    console.error('Password reset API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
