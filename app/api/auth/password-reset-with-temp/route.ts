import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('🔐 Password Reset (Invitation Pattern) - Processing for:', email);

    // Create Supabase admin client (same as invitations)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user exists in Supabase Auth
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error checking existing users:', listError);
      return NextResponse.json({ error: 'Failed to process password reset' }, { status: 500 });
    }

    const existingUser = existingUsers.users.find(u => u.email === email.toLowerCase());
    
    if (!existingUser) {
      // Don't reveal if user exists for security
      return NextResponse.json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset email has been sent.' 
      });
    }

    // Generate temporary password (same pattern as invitations)
    const tempPassword = `BDI${Math.random().toString(36).substring(2, 8).toUpperCase()}!`;
    
    console.log('🔑 Generated temporary password for reset:', email);

    // Update user password in Supabase Auth (same as invitations)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      { 
        password: tempPassword,
        email_confirm: true // Ensure email is confirmed
      }
    );

    if (updateError) {
      console.error('Error updating password in Supabase Auth:', updateError);
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
    }

    // Get user name from database for personalized email
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('auth_id', existingUser.id)
      .single();

    const userName = dbUser?.name || 'there';

    // Send password reset email via Resend (same pattern as invitations)
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: [email],
      subject: 'Your BDI Business Portal password has been reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🏢 BDI Business Portal</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Boundless Devices Inc.</p>
          </div>
          
          <h2 style="color: #374151;">Password Reset Complete</h2>
          
          <p style="color: #6b7280; font-size: 16px;">
            Hi ${userName} 👋
          </p>
          
          <p style="color: #6b7280; font-size: 16px;">
            Your password has been reset for your BDI Business Portal account. You can now login with your new temporary password.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Your New Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px;">${tempPassword}</code></p>
            <p style="color: #dc2626; font-size: 14px; margin-top: 15px;">
              <strong>Important:</strong> Please change your password after login for security.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://bdibusinessportal.com/sign-in" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Login to BDI Portal
            </a>
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
Password Reset Complete - BDI Business Portal

Hi ${userName},

Your password has been reset for your BDI Business Portal account.

Your new login credentials:
Email: ${email}
Temporary Password: ${tempPassword}

Login URL: https://bdibusinessportal.com/sign-in

Important: Please change your password after login for security.

Best regards,
BDI Business Portal Team
      `
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 });
    }

    console.log('✅ Password reset email sent via Resend (invitation pattern):', emailData?.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset email sent successfully' 
    });

  } catch (error) {
    console.error('Password reset API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
