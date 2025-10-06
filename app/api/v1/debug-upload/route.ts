/**
 * Debug Upload API Endpoint
 * 
 * Simplified version to debug exactly where CBN upload is failing
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasApiPermission } from '@/lib/auth/api-auth';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Starting upload debug...');

    // Step 1: Test authentication
    console.log('🔍 DEBUG: Testing authentication...');
    const authResult = await authenticateApiRequest(request);
    
    if (!authResult.success) {
      console.log('❌ DEBUG: Authentication failed:', authResult.error);
      return NextResponse.json({
        success: false,
        error: authResult.error,
        code: 'AUTHENTICATION_FAILED',
        debug: 'Authentication step failed'
      }, { status: 401 });
    }

    console.log('✅ DEBUG: Authentication successful');
    console.log('🔍 DEBUG: User:', authResult.user);
    console.log('🔍 DEBUG: Organization:', authResult.organization);
    console.log('🔍 DEBUG: API Key:', authResult.apiKey);

    // Step 2: Test permissions
    console.log('🔍 DEBUG: Testing permissions...');
    if (!hasApiPermission(authResult, 'production_files_upload')) {
      console.log('❌ DEBUG: Permission check failed');
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        debug: 'Permission check failed'
      }, { status: 403 });
    }

    console.log('✅ DEBUG: Permissions OK');

    // Step 3: Test form data parsing
    console.log('🔍 DEBUG: Testing form data parsing...');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log('❌ DEBUG: No file in form data');
      return NextResponse.json({
        success: false,
        error: 'No file provided',
        code: 'MISSING_FILE',
        debug: 'Form data parsing - no file found'
      }, { status: 400 });
    }

    console.log('✅ DEBUG: File parsed successfully');
    console.log('🔍 DEBUG: File details:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Step 4: Test file type validation
    console.log('🔍 DEBUG: Testing file type validation...');
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain',
      'application/json',
    ];

    if (!allowedTypes.includes(file.type)) {
      console.log('❌ DEBUG: File type validation failed');
      return NextResponse.json({
        success: false,
        error: `Invalid file type "${file.type}"`,
        code: 'INVALID_FILE_TYPE',
        debug: 'File type validation failed'
      }, { status: 400 });
    }

    console.log('✅ DEBUG: File type validation passed');

    // Return success without actually uploading (for debugging)
    return NextResponse.json({
      success: true,
      message: 'Debug test completed successfully - all steps passed',
      debug: {
        authenticationPassed: true,
        permissionsPassed: true,
        formDataParsed: true,
        fileTypeValid: true,
        user: authResult.user?.name,
        organization: authResult.organization?.code,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      }
    });

  } catch (error) {
    console.error('❌ DEBUG: Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Debug test failed',
      code: 'DEBUG_ERROR',
      debug: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      }
    }, { status: 500 });
  }
}
