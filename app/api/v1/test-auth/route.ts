/**
 * Simple API authentication test
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/auth/api-auth';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 TEST: Starting basic auth test...');
    
    const authResult = await authenticateApiRequest(request);
    
    console.log('🔍 TEST: Auth result:', authResult);
    
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error,
        debug: 'Basic authentication failed'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication test passed',
      user: authResult.user?.name,
      organization: authResult.organization?.code,
      permissions: authResult.apiKey?.permissions
    });

  } catch (error) {
    console.error('❌ TEST: Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
