import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thewheelsapp.com';

export interface InvitationEmailParams {
  email: string;
  teamName: string;
  role: string;
  inviteId: number;
  inviterName: string;
}

export interface PasswordResetEmailParams {
  email: string;
  resetToken: string;
  userName: string;
}

export async function sendInvitationEmail({
  email,
  teamName,
  role,
  inviteId,
  inviterName
}: InvitationEmailParams) {
  const inviteUrl = `${APP_URL}/sign-up?inviteId=${inviteId}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'The Wheels App <noreply@thewheelsapp.com>',
      to: [email],
      subject: `Invitation to join ${teamName} on WHEELS`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">🛵 WHEELS</h1>
          
          <h2 style="color: #374151;">You're invited to join ${teamName}!</h2>
          
          <p style="color: #6b7280; font-size: 16px;">
            Hi there! 👋
          </p>
          
          <p style="color: #6b7280; font-size: 16px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on WHEELS as a <strong>${role}</strong>.
          </p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #374151; margin: 0;">
              🎯 <strong>What is WHEELS?</strong><br>
              Track your rides, monitor your team, and stay connected with real-time location sharing and ride analytics.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <!-- Mobile App Download Section -->
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 25px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #374151; margin-top: 0; text-align: center;">📱 Download the WHEELS Mobile App</h3>
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin-bottom: 20px;">
              Get the full WHEELS experience with real-time tracking and team features
            </p>
            
            <!-- App Store Buttons Row -->
            <table style="width: 100%; margin: 20px 0;">
              <tr>
                <td style="text-align: center; padding: 10px;">
                  <!-- Apple App Store -->
                  <a href="#" style="display: inline-block; margin: 0 10px;">
                    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" 
                         alt="Download on the App Store" 
                         style="height: 40px; width: auto;">
                  </a>
                </td>
                <td style="text-align: center; padding: 10px;">
                  <!-- Google Play Store -->
                  <a href="#" style="display: inline-block; margin: 0 10px;">
                    <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                         alt="Get it on Google Play" 
                         style="height: 40px; width: auto;">
                  </a>
                </td>
              </tr>
            </table>
            
            <!-- QR Codes Row -->
            <table style="width: 100%; margin: 20px 0;">
              <tr>
                <td style="text-align: center; padding: 10px;">
                  <div style="display: inline-block; text-align: center;">
                    <!-- Placeholder QR Code for iOS -->
                    <div style="width: 80px; height: 80px; border: 2px solid #d1d5db; border-radius: 8px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; background: #f9fafb;">
                      <span style="color: #9ca3af; font-size: 12px;">iOS QR</span>
                    </div>
                    <div style="color: #6b7280; font-size: 12px;">iPhone/iPad</div>
                  </div>
                </td>
                <td style="text-align: center; padding: 10px;">
                  <div style="display: inline-block; text-align: center;">
                    <!-- Placeholder QR Code for Android -->
                    <div style="width: 80px; height: 80px; border: 2px solid #d1d5db; border-radius: 8px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; background: #f9fafb;">
                      <span style="color: #9ca3af; font-size: 12px;">Android QR</span>
                    </div>
                    <div style="color: #6b7280; font-size: 12px;">Android</div>
                  </div>
                </td>
              </tr>
            </table>
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 0;">
              📷 Scan the QR code with your camera app or click the badges above
            </p>
          </div>
          
          <p style="color: #9ca3af; font-size: 14px;">
            If you can't click the button, copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This invitation was sent by ${inviterName}. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send invitation email:', error);
      throw new Error('Failed to send invitation email');
    }

    console.log('✅ Invitation email sent successfully:', data);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail({
  email,
  resetToken,
  userName
}: PasswordResetEmailParams) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'The Wheels App <noreply@thewheelsapp.com>',
      to: [email],
      subject: 'Reset your WHEELS password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">🛵 WHEELS</h1>
          
          <h2 style="color: #374151;">Reset Your Password</h2>
          
          <p style="color: #6b7280; font-size: 16px;">
            Hi ${userName || 'there'} 👋
          </p>
          
          <p style="color: #6b7280; font-size: 16px;">
            We received a request to reset your password for your WHEELS account.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
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
            For security reasons, this password reset link will expire in 1 hour.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }

    console.log('✅ Password reset email sent successfully:', data);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

export async function sendWelcomeEmail(email: string, userName: string, teamName: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'The Wheels App <noreply@thewheelsapp.com>',
      to: [email],
      subject: `Welcome to ${teamName} on WHEELS! 🎉`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">🛵 WHEELS</h1>
          
          <h2 style="color: #374151;">Welcome to ${teamName}! 🎉</h2>
          
          <p style="color: #6b7280; font-size: 16px;">
            Hi ${userName}! 👋
          </p>
          
          <p style="color: #6b7280; font-size: 16px;">
            Welcome to <strong>${teamName}</strong> on WHEELS! You're now part of the team and ready to start tracking your rides.
          </p>
          
          <div style="background: #f0f9ff; border: 1px solid #7dd3fc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0369a1; margin-top: 0;">🚀 Getting Started</h3>
            <ul style="color: #0369a1; margin: 0; padding-left: 20px;">
              <li>Check out the team map to see your teammates</li>
              <li>Start your first ride to begin tracking</li>
              <li>View analytics and insights from your rides</li>
              <li>Stay connected with real-time location sharing</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/dashboard" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
          
          <!-- Mobile App Download Section -->
          <div style="background: #f0f9ff; border: 1px solid #7dd3fc; padding: 25px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #0369a1; margin-top: 0; text-align: center;">📱 Don't Forget the Mobile App!</h3>
            <p style="color: #0369a1; font-size: 14px; text-align: center; margin-bottom: 20px;">
              Download WHEELS on your phone for real-time ride tracking and team features
            </p>
            
            <!-- App Store Buttons Row -->
            <table style="width: 100%; margin: 20px 0;">
              <tr>
                <td style="text-align: center; padding: 10px;">
                  <!-- Apple App Store -->
                  <a href="#" style="display: inline-block; margin: 0 10px;">
                    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" 
                         alt="Download on the App Store" 
                         style="height: 40px; width: auto;">
                  </a>
                </td>
                <td style="text-align: center; padding: 10px;">
                  <!-- Google Play Store -->
                  <a href="#" style="display: inline-block; margin: 0 10px;">
                    <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                         alt="Get it on Google Play" 
                         style="height: 40px; width: auto;">
                  </a>
                </td>
              </tr>
            </table>
            
            <!-- QR Codes Row -->
            <table style="width: 100%; margin: 20px 0;">
              <tr>
                <td style="text-align: center; padding: 10px;">
                  <div style="display: inline-block; text-align: center;">
                    <!-- Placeholder QR Code for iOS -->
                    <div style="width: 80px; height: 80px; border: 2px solid #7dd3fc; border-radius: 8px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; background: #f0f9ff;">
                      <span style="color: #0369a1; font-size: 12px;">iOS QR</span>
                    </div>
                    <div style="color: #0369a1; font-size: 12px;">iPhone/iPad</div>
                  </div>
                </td>
                <td style="text-align: center; padding: 10px;">
                  <div style="display: inline-block; text-align: center;">
                    <!-- Placeholder QR Code for Android -->
                    <div style="width: 80px; height: 80px; border: 2px solid #7dd3fc; border-radius: 8px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; background: #f0f9ff;">
                      <span style="color: #0369a1; font-size: 12px;">Android QR</span>
                    </div>
                    <div style="color: #0369a1; font-size: 12px;">Android</div>
                  </div>
                </td>
              </tr>
            </table>
            
            <p style="color: #0369a1; font-size: 12px; text-align: center; margin-bottom: 0;">
              📷 Scan the QR code with your camera app or click the badges above
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Happy riding! 🏍️<br>
            The WHEELS Team
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send welcome email:', error);
      throw new Error('Failed to send welcome email');
    }

    console.log('✅ Welcome email sent successfully:', data);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}