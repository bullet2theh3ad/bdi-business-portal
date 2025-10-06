/**
 * Amazon SP-API Configuration
 * Manages credentials and configuration from environment variables
 * Based on: BDI_2/config_aws.py
 */

import { AmazonCredentials } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Load Amazon SP-API credentials from environment variables
 * 
 * Required environment variables:
 * - AMAZON_CLIENT_ID
 * - AMAZON_CLIENT_SECRET
 * - AMAZON_REFRESH_TOKEN
 * - AMAZON_ACCESS_KEY (AWS IAM)
 * - AMAZON_SECRET_KEY (AWS IAM)
 * - AMAZON_REGION (optional, defaults to us-east-1)
 * - AMAZON_SELLER_ID (optional)
 */
export function getAmazonCredentials(): AmazonCredentials {
  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;
  const refreshToken = process.env.AMAZON_REFRESH_TOKEN;
  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;

  if (!clientId || !clientSecret || !refreshToken || !accessKey || !secretKey) {
    throw new Error(
      'Missing required Amazon SP-API credentials. Please set: ' +
      'AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, AMAZON_REFRESH_TOKEN, ' +
      'AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY'
    );
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    accessKey,
    secretKey,
    region: process.env.AMAZON_REGION || 'us-east-1',
    sellerId: process.env.AMAZON_SELLER_ID,
  };
}

/**
 * Validate Amazon SP-API credentials
 */
export function validateAmazonCredentials(credentials: AmazonCredentials): boolean {
  const required = [
    'clientId',
    'clientSecret',
    'refreshToken',
    'accessKey',
    'secretKey',
  ] as const;

  for (const field of required) {
    if (!credentials[field]) {
      console.error(`[Amazon Config] Missing required field: ${field}`);
      return false;
    }
  }

  return true;
}

/**
 * Get Amazon credentials with validation
 */
export function getValidatedAmazonCredentials(): AmazonCredentials {
  const credentials = getAmazonCredentials();
  
  if (!validateAmazonCredentials(credentials)) {
    throw new Error('Invalid Amazon SP-API credentials');
  }

  return credentials;
}

// ============================================================================
// CREDENTIAL STORAGE (Optional - for database storage)
// ============================================================================

/**
 * Interface for storing credentials in database
 * Useful for multi-seller support
 */
export interface StoredAmazonCredentials extends AmazonCredentials {
  id: string;
  organizationId: string;
  sellerName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

/**
 * Encrypt sensitive credentials before storing
 * Note: Implement proper encryption in production
 */
export function encryptCredentials(credentials: AmazonCredentials): string {
  // TODO: Implement proper encryption using crypto
  // For now, just JSON stringify (NOT SECURE - placeholder only)
  console.warn('[Amazon Config] Using placeholder encryption - implement proper encryption!');
  return Buffer.from(JSON.stringify(credentials)).toString('base64');
}

/**
 * Decrypt stored credentials
 * Note: Implement proper decryption in production
 */
export function decryptCredentials(encrypted: string): AmazonCredentials {
  // TODO: Implement proper decryption using crypto
  // For now, just JSON parse (NOT SECURE - placeholder only)
  return JSON.parse(Buffer.from(encrypted, 'base64').toString('utf-8'));
}

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

/**
 * Check if Amazon SP-API is configured
 */
export function isAmazonConfigured(): boolean {
  try {
    getAmazonCredentials();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get configuration status for debugging
 */
export function getConfigStatus(): {
  configured: boolean;
  missingFields: string[];
} {
  const requiredFields = [
    'AMAZON_CLIENT_ID',
    'AMAZON_CLIENT_SECRET',
    'AMAZON_REFRESH_TOKEN',
    'AMAZON_ACCESS_KEY',
    'AMAZON_SECRET_KEY',
  ];

  const missingFields = requiredFields.filter(field => !process.env[field]);

  return {
    configured: missingFields.length === 0,
    missingFields,
  };
}
