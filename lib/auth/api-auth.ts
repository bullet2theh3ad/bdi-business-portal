import { NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { apiKeys, users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface ApiAuthResult {
  success: boolean;
  user?: {
    id: string;
    authId: string;
    name: string;
    email: string;
    role: string;
  };
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  apiKey?: {
    id: string;
    keyName: string;
    permissions: any;
    rateLimitPerHour: number;
  };
  error?: string;
}

/**
 * Authenticate API requests using API keys
 * Supports both Bearer token and API key authentication
 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return { success: false, error: 'Missing Authorization header' };
    }

    let apiKeyValue: string;
    
    // Support both "Bearer <key>" and "ApiKey <key>" formats
    if (authHeader.startsWith('Bearer ')) {
      apiKeyValue = authHeader.substring(7);
    } else if (authHeader.startsWith('ApiKey ')) {
      apiKeyValue = authHeader.substring(7);
    } else {
      return { success: false, error: 'Invalid Authorization header format. Use "Bearer <key>" or "ApiKey <key>"' };
    }

    if (!apiKeyValue) {
      return { success: false, error: 'Missing API key value' };
    }

    // Hash the provided API key to match against stored hash
    const keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');

    // Find the API key in the database
    const [apiKeyRecord] = await db
      .select({
        id: apiKeys.id,
        keyName: apiKeys.keyName,
        permissions: apiKeys.permissions,
        rateLimitPerHour: apiKeys.rateLimitPerHour,
        lastUsedAt: apiKeys.lastUsedAt,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        // User info
        userId: users.id,
        userAuthId: users.authId,
        userName: users.name,
        userEmail: users.email,
        userRole: users.role,
        userIsActive: users.isActive,
        // Organization info
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationCode: organizations.code,
        organizationType: organizations.type,
        organizationIsActive: organizations.isActive,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.userAuthId, users.authId))
      .leftJoin(organizations, eq(apiKeys.organizationUuid, organizations.id))
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!apiKeyRecord) {
      return { success: false, error: 'Invalid API key' };
    }

    // Check if API key is active
    if (!apiKeyRecord.isActive) {
      return { success: false, error: 'API key is inactive' };
    }

    // Check if API key has expired
    if (apiKeyRecord.expiresAt && new Date() > new Date(apiKeyRecord.expiresAt)) {
      return { success: false, error: 'API key has expired' };
    }

    // Check if user is active
    if (!apiKeyRecord.userIsActive) {
      return { success: false, error: 'User account is inactive' };
    }

    // Check if organization is active
    if (!apiKeyRecord.organizationIsActive) {
      return { success: false, error: 'Organization is inactive' };
    }

    // Update last used timestamp (async, don't wait)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id))
      .execute()
      .catch(error => console.error('Failed to update API key last used timestamp:', error));

    console.log(`✅ API authentication successful for ${apiKeyRecord.organizationCode} - ${apiKeyRecord.keyName}`);

    return {
      success: true,
      user: {
        id: apiKeyRecord.userId!,
        authId: apiKeyRecord.userAuthId!,
        name: apiKeyRecord.userName!,
        email: apiKeyRecord.userEmail!,
        role: apiKeyRecord.userRole!,
      },
      organization: {
        id: apiKeyRecord.organizationId!,
        name: apiKeyRecord.organizationName!,
        code: apiKeyRecord.organizationCode!,
        type: apiKeyRecord.organizationType!,
      },
      apiKey: {
        id: apiKeyRecord.id,
        keyName: apiKeyRecord.keyName,
        permissions: apiKeyRecord.permissions,
        rateLimitPerHour: apiKeyRecord.rateLimitPerHour || 1000,
      }
    };
    
  } catch (error) {
    console.error('Error during API authentication:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Check if an API key has a specific permission
 */
export function hasApiPermission(apiAuthResult: ApiAuthResult, permission: string): boolean {
  if (!apiAuthResult.success || !apiAuthResult.apiKey) {
    return false;
  }

  const permissions = apiAuthResult.apiKey.permissions as any;
  return permissions?.[permission] === true;
}

/**
 * Validate API rate limit (basic implementation)
 * In production, you'd want to use Redis or a proper rate limiting service
 */
export async function checkRateLimit(apiKeyId: string, rateLimitPerHour: number): Promise<boolean> {
  // For now, return true (no rate limiting)
  // TODO: Implement proper rate limiting with Redis
  return true;
}
