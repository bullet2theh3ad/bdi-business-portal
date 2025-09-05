import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple test endpoint to verify API infrastructure
 * No authentication required - just tests basic API functionality
 */
export async function GET(request: NextRequest) {
  try {
    // Basic test without database or authentication
    return NextResponse.json({
      success: true,
      message: 'API infrastructure is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  } catch (error) {
    console.error('Error in test API:', error);
    return NextResponse.json({
      success: false,
      error: 'Test API failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
