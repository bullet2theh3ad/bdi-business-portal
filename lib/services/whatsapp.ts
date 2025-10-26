/**
 * WhatsApp Service - Twilio Integration
 * 
 * This service handles sending WhatsApp messages via Twilio.
 * Configuration is stored in the database (whatsapp_config table).
 * 
 * Setup Instructions:
 * 1. Create Twilio account at https://www.twilio.com
 * 2. Register your WhatsApp Business Profile
 * 3. Get your Account SID, Auth Token, and WhatsApp number
 * 4. Store credentials in the database via Admin > Settings
 */

import { db } from '@/lib/db/drizzle';
import { whatsappConfig } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export interface WhatsAppMessage {
  to: string; // Phone number in E.164 format (e.g., +1234567890)
  body: string; // Message content
  mediaUrl?: string[]; // Optional media URLs
}

export interface WhatsAppMessageResponse {
  success: boolean;
  messageSid?: string; // Twilio message SID
  status?: string; // sent, delivered, failed, etc.
  error?: string;
  errorCode?: string;
}

export interface WhatsAppConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string; // Must be in whatsapp:+1234567890 format
  isEnabled: boolean;
}

/**
 * Get WhatsApp configuration from database
 * Supports organization-specific config or global default
 */
export async function getWhatsAppConfig(
  organizationId?: string
): Promise<WhatsAppConfig | null> {
  try {
    // Try to get organization-specific config first
    let config;
    
    if (organizationId) {
      config = await db.query.whatsappConfig.findFirst({
        where: and(
          eq(whatsappConfig.organizationId, organizationId),
          eq(whatsappConfig.isEnabled, true)
        ),
      });
    }
    
    // Fall back to global config if no org-specific config
    if (!config) {
      config = await db.query.whatsappConfig.findFirst({
        where: and(
          isNull(whatsappConfig.organizationId),
          eq(whatsappConfig.isEnabled, true)
        ),
      });
    }
    
    if (!config || !config.twilioAccountSid || !config.twilioAuthToken) {
      console.warn('WhatsApp is not configured or disabled');
      return null;
    }
    
    return {
      accountSid: config.twilioAccountSid,
      authToken: config.twilioAuthToken,
      fromNumber: config.twilioWhatsappNumber || '',
      isEnabled: config.isEnabled || false,
    };
  } catch (error) {
    console.error('Error fetching WhatsApp config:', error);
    return null;
  }
}

/**
 * Send a WhatsApp message via Twilio
 * 
 * @param message - Message details (to, body, optional media)
 * @param organizationId - Optional organization ID for org-specific config
 * @returns Response with success status and message SID or error details
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  organizationId?: string
): Promise<WhatsAppMessageResponse> {
  try {
    // Get configuration
    const config = await getWhatsAppConfig(organizationId);
    
    if (!config) {
      return {
        success: false,
        error: 'WhatsApp is not configured. Please configure it in Admin > Settings.',
        errorCode: 'NOT_CONFIGURED',
      };
    }
    
    // Validate phone number format
    if (!message.to.startsWith('+')) {
      return {
        success: false,
        error: 'Phone number must be in E.164 format (e.g., +1234567890)',
        errorCode: 'INVALID_PHONE_FORMAT',
      };
    }
    
    // Format WhatsApp number
    const to = message.to.startsWith('whatsapp:') 
      ? message.to 
      : `whatsapp:${message.to}`;
    
    const from = config.fromNumber.startsWith('whatsapp:')
      ? config.fromNumber
      : `whatsapp:${config.fromNumber}`;
    
    // Lazy load Twilio only when actually sending (so it doesn't error if not installed)
    let twilio;
    try {
      twilio = (await import('twilio')).default;
    } catch (error) {
      console.error('Twilio package not installed. Run: pnpm add twilio');
      return {
        success: false,
        error: 'Twilio package not installed',
        errorCode: 'PACKAGE_NOT_INSTALLED',
      };
    }
    
    // Initialize Twilio client
    const client = twilio(config.accountSid, config.authToken);
    
    // Prepare message payload
    const messagePayload: any = {
      body: message.body,
      from,
      to,
    };
    
    // Add media if provided
    if (message.mediaUrl && message.mediaUrl.length > 0) {
      messagePayload.mediaUrl = message.mediaUrl;
    }
    
    // Send message
    const twilioResponse = await client.messages.create(messagePayload);
    
    return {
      success: true,
      messageSid: twilioResponse.sid,
      status: twilioResponse.status,
    };
    
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message',
      errorCode: error.code || 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Check if WhatsApp is enabled and configured
 */
export async function isWhatsAppEnabled(organizationId?: string): Promise<boolean> {
  const config = await getWhatsAppConfig(organizationId);
  return config !== null && config.isEnabled;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Basic E.164 validation: +[country code][number]
  // Should be between 8-15 digits after the +
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Format phone number to E.164 (basic implementation)
 * For production, consider using libphonenumber-js for better validation
 */
export function formatPhoneNumber(phone: string, defaultCountryCode = '+1'): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If already has country code (starts with 1 for US/Canada), add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // If 10 digits, assume US/Canada and add country code
  if (cleaned.length === 10) {
    return `${defaultCountryCode}${cleaned}`;
  }
  
  // If already formatted or unknown format, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Default: add country code
  return `${defaultCountryCode}${cleaned}`;
}

/**
 * Send a templated message (for pre-approved WhatsApp templates)
 * Templates must be approved by WhatsApp before use
 */
export async function sendTemplatedMessage(
  to: string,
  templateName: string,
  variables: Record<string, string>,
  organizationId?: string
): Promise<WhatsAppMessageResponse> {
  // TODO: Implement template message sending
  // This requires Content Template SIDs from Twilio
  // For now, we'll use regular messages
  
  return {
    success: false,
    error: 'Template messages not yet implemented',
    errorCode: 'NOT_IMPLEMENTED',
  };
}

