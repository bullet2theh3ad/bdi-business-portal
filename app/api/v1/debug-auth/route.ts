import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Debug endpoint to test API key authentication step by step
 * This will help us identify exactly where the authentication is failing
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Missing Authorization header',
        debug: {
          step: 'header_check',
          headers: Object.fromEntries(request.headers.entries())
        }
      });
    }

    let apiKeyValue: string;
    
    if (authHeader.startsWith('Bearer ')) {
      apiKeyValue = authHeader.substring(7);
    } else if (authHeader.startsWith('ApiKey ')) {
      apiKeyValue = authHeader.substring(7);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid Authorization header format',
        debug: {
          step: 'format_check',
          authHeader: authHeader.substring(0, 20) + '...',
          expected: 'Bearer <key> or ApiKey <key>'
        }
      });
    }

    if (!apiKeyValue) {
      return NextResponse.json({
        success: false,
        error: 'Missing API key value',
        debug: {
          step: 'key_extraction',
          keyLength: apiKeyValue?.length || 0
        }
      });
    }

    // Test crypto hashing
    let keyHash: string;
    try {
      keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');
    } catch (cryptoError) {
      return NextResponse.json({
        success: false,
        error: 'Crypto hashing failed',
        debug: {
          step: 'crypto_hash',
          cryptoError: cryptoError instanceof Error ? cryptoError.message : 'Unknown crypto error',
          keyPrefix: apiKeyValue.substring(0, 10)
        }
      });
    }

    // Test database connection
    let dbConnectionTest;
    try {
      const { db } = await import('@/lib/db/drizzle');
      dbConnectionTest = 'Database import successful';
      
      // Try a simple database query
      const testQuery = await db.$count(db.select().from(db.organizations));
      dbConnectionTest = `Database connection successful, found ${testQuery} organizations`;
    } catch (dbError) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        debug: {
          step: 'database_connection',
          dbError: dbError instanceof Error ? dbError.message : 'Unknown database error',
          keyHash: keyHash.substring(0, 16) + '...'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication debug successful',
      debug: {
        step: 'all_checks_passed',
        keyPrefix: apiKeyValue.substring(0, 10) + '...',
        keyHash: keyHash.substring(0, 16) + '...',
        keyLength: apiKeyValue.length,
        dbConnection: dbConnectionTest,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Debug endpoint failed',
      debug: {
        step: 'catch_block',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
