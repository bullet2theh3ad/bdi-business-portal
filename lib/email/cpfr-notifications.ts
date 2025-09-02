import { Resend } from 'resend';
import { db } from '@/lib/db/drizzle';
import { organizations, invoices, invoiceLineItems, productSkus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// CPFR Email Templates
const CPFR_TEMPLATES = {
  FACTORY_RESPONSE_NEEDED: {
    subject: (mfgCode: string) => `🏭 CPFR Alert: ${mfgCode} Factory Response Required`,
    getHtml: (data: any) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CPFR Factory Response Required</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .alert-box { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 15px; margin: 20px 0; }
          .forecast-details { background: #F0F9FF; border: 1px solid #0EA5E9; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .action-button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .footer { background: #F3F4F6; padding: 20px; text-align: center; font-size: 12px; color: #6B7280; }
          .status-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px; background: #F9FAFB; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>🏭 CPFR Factory Response Required</h1>
            <p>Boundless Devices Inc → ${data.mfgCode} Manufacturing</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            <div class="alert-box">
              <h2 style="margin: 0 0 10px 0; color: #D97706;">⚡ Immediate Action Required</h2>
              <p style="margin: 0;">BDI Sales has submitted a new forecast requiring ${data.mfgCode} factory confirmation.</p>
            </div>
            
            <div class="forecast-details">
              <h3 style="color: #0EA5E9; margin-top: 0;">📋 Forecast Details</h3>
              
              <div class="status-row">
                <strong>SKU:</strong>
                <span>${data.sku} - ${data.skuName}</span>
              </div>
              
              <div class="status-row">
                <strong>Quantity:</strong>
                <span>${data.quantity.toLocaleString()} units</span>
              </div>
              
              <div class="status-row">
                <strong>Unit Cost:</strong>
                <span>$${data.unitCost}</span>
              </div>
              
              <div class="status-row">
                <strong>Total Value:</strong>
                <span><strong>$${data.totalValue.toLocaleString()}</strong></span>
              </div>
              
              <div class="status-row">
                <strong>EXW Delivery Week:</strong>
                <span><strong>${data.deliveryWeek}</strong> (${data.deliveryDateRange})</span>
              </div>
              
              <div class="status-row">
                <strong>Shipping Method:</strong>
                <span>${data.shippingMethod}</span>
              </div>
              
              ${data.invoiceNumber ? `
              <div class="status-row">
                <strong>Invoice Reference:</strong>
                <span><strong>${data.invoiceNumber}</strong></span>
              </div>
              ` : ''}
              
              ${data.notes ? `
              <div class="status-row">
                <strong>Special Notes:</strong>
                <span>${data.notes}</span>
              </div>
              ` : ''}
            </div>
            
            <div style="background: #ECFDF5; border: 1px solid #10B981; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #059669; margin-top: 0;">🎯 Required Actions for ${data.mfgCode}:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Confirm production capacity</strong> for ${data.quantity.toLocaleString()} units</li>
                <li><strong>Validate EXW delivery schedule</strong> for ${data.deliveryWeek}</li>
                <li><strong>Update factory signal</strong> in CPFR portal</li>
                <li><strong>Respond within 24 hours</strong> to avoid escalation</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.portalLink}" class="action-button">
                🔗 Respond in CPFR Portal
              </a>
              <p style="font-size: 12px; color: #6B7280; margin-top: 10px;">
                Click above to access your secure CPFR dashboard and update factory signals
              </p>
            </div>
            
            <div style="background: #FEE2E2; border: 1px solid #EF4444; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #DC2626; font-size: 14px;">
                ⏰ <strong>Escalation Notice:</strong> If no response is received within 24 hours, 
                this alert will be escalated to ${data.mfgCode} operations leadership and BDI management.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>This is an automated CPFR (Collaborative Planning, Forecasting, and Replenishment) notification.</p>
            <p>Boundless Devices Inc | CPFR Supply Chain Automation</p>
            <p style="font-size: 10px;">Forecast ID: ${data.forecastId} | Sent: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  SHIPPING_RESPONSE_NEEDED: {
    subject: (mfgCode: string) => `🚚 CPFR Alert: ${mfgCode} Shipping Response Required`,
    getHtml: (data: any) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CPFR Shipping Response Required</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .action-button { display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚚 CPFR Shipping Response Required</h1>
            <p>Factory Confirmed → ${data.mfgCode} Shipping Coordination</p>
          </div>
          
          <div class="content">
            <p><strong>Factory has confirmed production.</strong> Shipping coordination required for:</p>
            <ul>
              <li><strong>SKU:</strong> ${data.sku} (${data.quantity.toLocaleString()} units)</li>
              <li><strong>EXW Date:</strong> ${data.deliveryWeek}</li>
              <li><strong>Shipping Method:</strong> ${data.shippingMethod}</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.portalLink}" class="action-button">
                🔗 Coordinate Shipping
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  ESCALATION_NOTICE: {
    subject: (mfgCode: string) => `🚨 CPFR ESCALATION: ${mfgCode} Factory Response Overdue`,
    getHtml: (data: any) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CPFR Escalation Notice</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #EF4444, #DC2626); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .escalation-box { background: #FEE2E2; border: 2px solid #EF4444; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .action-button { display: inline-block; background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 CPFR ESCALATION NOTICE</h1>
            <p>${data.mfgCode} Factory Response Overdue</p>
          </div>
          
          <div class="content">
            <div class="escalation-box">
              <h2 style="margin: 0 0 15px 0; color: #DC2626;">⏰ 24-Hour Response Window Exceeded</h2>
              <p style="margin: 0;">
                <strong>Original Request:</strong> ${data.originalSentTime}<br>
                <strong>Escalation Time:</strong> ${new Date().toLocaleString()}<br>
                <strong>SKU:</strong> ${data.sku} (${data.quantity.toLocaleString()} units)<br>
                <strong>Total Value:</strong> $${data.totalValue.toLocaleString()}
              </p>
            </div>
            
            <p>This forecast requires immediate ${data.mfgCode} factory attention to maintain supply chain commitments.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.portalLink}" class="action-button">
                🚨 Urgent: Respond Now
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

// CPFR Notification Types
export type CPFRNotificationType = 'FACTORY_RESPONSE_NEEDED' | 'ESCALATION_NOTICE' | 'SHIPPING_RESPONSE_NEEDED';

export interface CPFRNotificationData {
  forecastId: string;
  mfgCode: string;
  sku: string;
  skuName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  deliveryWeek: string;
  deliveryDateRange: string;
  shippingMethod: string;
  notes?: string;
  portalLink: string;
  originalSentTime?: string;
  invoiceNumber?: string;
}

// Main CPFR Notification Function
export async function sendCPFRNotification(
  type: CPFRNotificationType,
  data: CPFRNotificationData
): Promise<boolean> {
  try {
    if (!resend) {
      console.error('❌ Resend not configured - CPFR email not sent');
      return false;
    }

    console.log(`📧 Sending CPFR notification: ${type} to ${data.mfgCode}`);

    // Get organization and CPFR contacts
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, data.mfgCode))
      .limit(1);

    if (!organization) {
      console.error(`❌ Organization not found: ${data.mfgCode}`);
      return false;
    }

    const cpfrContacts = organization.cpfrContacts as any;
    if (!cpfrContacts || !cpfrContacts.primary_contacts) {
      console.error(`❌ No CPFR contacts configured for ${data.mfgCode}`);
      return false;
    }

    // Get recipient emails
    let recipients: string[] = [];
    
    if (type === 'FACTORY_RESPONSE_NEEDED') {
      // Send to primary contacts
      recipients = cpfrContacts.primary_contacts
        .filter((contact: any) => contact.active && contact.email)
        .map((contact: any) => contact.email);
    } else if (type === 'ESCALATION_NOTICE') {
      // Send to both primary and escalation contacts
      const primaryEmails = cpfrContacts.primary_contacts
        .filter((contact: any) => contact.active && contact.email)
        .map((contact: any) => contact.email);
      
      const escalationEmails = cpfrContacts.escalation_contacts
        .filter((contact: any) => contact.active && contact.email)
        .map((contact: any) => contact.email);
        
      recipients = [...primaryEmails, ...escalationEmails];
      
      // Also add BDI escalation contacts (you, Dariush, technical team)
      recipients.push('scistulli@boundlessdevices.com'); // Personal
      recipients.push('dzand@boundlessdevices.com'); // Primary business
      // Add technical team if enabled
      if (cpfrContacts.notification_preferences?.include_technical_team) {
        recipients.push('tech@boundlessdevices.com'); // Technical team
      }
    }

    if (recipients.length === 0) {
      console.error(`❌ No valid recipients for ${data.mfgCode} CPFR notification`);
      return false;
    }

    // Remove duplicates
    recipients = [...new Set(recipients)];
    
    console.log(`📧 Sending to ${recipients.length} recipients:`, recipients);

    // Get email template
    const template = CPFR_TEMPLATES[type];
    if (!template) {
      console.error(`❌ Unknown CPFR notification type: ${type}`);
      return false;
    }

    // Send email (using verified domain)
    const result = await resend.emails.send({
      from: 'CPFR System <cpfr@bdibusinessportal.com>',
      to: recipients,
      subject: template.subject(data.mfgCode),
      html: template.getHtml(data),
      tags: [
        { name: 'type', value: 'cpfr-notification' },
        { name: 'mfg-code', value: data.mfgCode },
        { name: 'notification-type', value: type },
        { name: 'forecast-id', value: data.forecastId }
      ]
    });

    console.log('✅ CPFR email sent successfully:', result);
    return true;

  } catch (error) {
    console.error('❌ Error sending CPFR notification:', error);
    return false;
  }
}

// Helper function to get forecast data for email
export async function getForecastEmailData(
  forecastId: string
): Promise<CPFRNotificationData | null> {
  try {
    // This will be implemented to fetch forecast + invoice + SKU data
    // For now, return null - we'll implement this next
    console.log(`🔍 Getting forecast email data for ID: ${forecastId}`);
    return null;
  } catch (error) {
    console.error('❌ Error getting forecast email data:', error);
    return null;
  }
}

// Generate portal link for specific forecast response
export function generateCPFRPortalLink(
  forecastId: string,
  mfgCode: string,
  action: 'factory_response' | 'shipping_response'
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.boundlessdevices.com';
  return `${baseUrl}/cpfr/forecasts?forecast=${forecastId}&mfg=${mfgCode}&action=${action}`;
}

// Log notification for tracking and escalation
export async function logCPFRNotification(
  type: CPFRNotificationType,
  forecastId: string,
  mfgCode: string,
  recipients: string[],
  success: boolean
): Promise<void> {
  try {
    // For now, just console log - we can add a notifications log table later
    console.log(`📝 CPFR Notification Log:`, {
      type,
      forecastId,
      mfgCode,
      recipients: recipients.length,
      success,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error logging CPFR notification:', error);
  }
}
