import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { apiKeys, users, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Debug endpoint to test API key database lookup specifically
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid Authorization header'
      });
    }

    const apiKeyValue = authHeader.substring(7);
    const keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');

    console.log('🔍 Looking for API key with hash:', keyHash.substring(0, 16) + '...');

    // Test API key lookup step by step
    try {
      // First, check if api_keys table exists and has data
      const allKeys = await db.select().from(apiKeys).limit(5);
      console.log('📊 Found', allKeys.length, 'total API keys in database');

      // Look for the specific API key
      const [apiKeyRecord] = await db
        .select({
          id: apiKeys.id,
          keyName: apiKeys.keyName,
          keyPrefix: apiKeys.keyPrefix,
          permissions: apiKeys.permissions,
          isActive: apiKeys.isActive,
          organizationUuid: apiKeys.organizationUuid,
        })
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);

      if (!apiKeyRecord) {
        return NextResponse.json({
          success: false,
          error: 'API key not found in database',
          debug: {
            totalKeysInDb: allKeys.length,
            searchedHash: keyHash.substring(0, 16) + '...',
            keyPrefix: apiKeyValue.substring(0, 10) + '...',
            allKeyPrefixes: allKeys.map(k => k.keyPrefix)
          }
        });
      }

      // Test organization lookup
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, apiKeyRecord.organizationUuid))
        .limit(1);

      return NextResponse.json({
        success: true,
        message: 'API key lookup successful',
        debug: {
          keyFound: true,
          keyName: apiKeyRecord.keyName,
          keyPrefix: apiKeyRecord.keyPrefix,
          isActive: apiKeyRecord.isActive,
          permissions: apiKeyRecord.permissions,
          organizationFound: !!organization,
          organizationCode: organization?.code,
          organizationName: organization?.name,
          totalKeysInDb: allKeys.length
        }
      });

    } catch (dbError) {
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        debug: {
          step: 'api_key_lookup',
          dbError: dbError instanceof Error ? dbError.message : 'Unknown database error',
          keyHash: keyHash.substring(0, 16) + '...'
        }
      });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Debug key lookup failed',
      debug: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
