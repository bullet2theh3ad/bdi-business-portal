import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { productionFiles, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { authenticateApiRequest, hasApiPermission } from '@/lib/auth/api-auth';

/**
 * Simplified production files API - no complex connection logic
 * Just returns files that exist, for debugging
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the API request
    const authResult = await authenticateApiRequest(request);
    
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error,
        code: 'AUTHENTICATION_FAILED'
      }, { status: 401 });
    }

    // Check for production files read permission
    if (!hasApiPermission(authResult, 'production_files_read')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions. Requires production_files_read permission.',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, { status: 403 });
    }

    console.log(`📡 Simple API Request from ${authResult.organization?.code}`);

    // Simple query - just get all files (no complex connection logic)
    const files = await db
      .select({
        id: productionFiles.id,
        fileName: productionFiles.fileName,
        fileSize: productionFiles.fileSize,
        contentType: productionFiles.contentType,
        shipmentNumber: productionFiles.bdiShipmentNumber,
        fileType: productionFiles.fileType,
        organizationId: productionFiles.organizationId,
        description: productionFiles.description,
        tags: productionFiles.tags,
        createdAt: productionFiles.createdAt,
        // Organization info
        organizationCode: organizations.code,
        organizationName: organizations.name,
      })
      .from(productionFiles)
      .leftJoin(organizations, eq(productionFiles.organizationId, organizations.id))
      .orderBy(productionFiles.createdAt)
      .limit(10);

    console.log(`📊 Simple API found ${files.length} total files`);

    // Transform for API response
    const transformedFiles = files.map(file => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      contentType: file.contentType,
      shipmentNumber: file.shipmentNumber,
      fileType: file.fileType,
      organizationCode: file.organizationCode,
      organizationName: file.organizationName,
      description: file.description,
      tags: file.tags || [],
      createdAt: file.createdAt,
      downloadUrl: `/api/v1/production-files/${file.id}/download`
    }));

    return NextResponse.json({
      success: true,
      data: transformedFiles,
      meta: {
        organization: authResult.organization?.code,
        totalFiles: files.length,
        note: "Simplified API - shows all files without connection filtering"
      }
    });
    
  } catch (error) {
    console.error('Error in simple production files API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      errorDetails: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
