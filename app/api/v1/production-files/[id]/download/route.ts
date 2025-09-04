import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, organizations, organizationConnections } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { authenticateApiRequest, hasApiPermission } from '@/lib/auth/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/v1/production-files/[id]/download
 * 
 * Download a specific production file via API
 * Requires valid API key with production_files_download permission
 * 
 * Response: 
 * - Success: Redirects to signed download URL
 * - Error: JSON error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Check for production files download permission
    if (!hasApiPermission(authResult, 'production_files_download')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions. Requires production_files_download permission.',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, { status: 403 });
    }

    const { id } = await params;

    // Get the file
    const [file] = await db
      .select()
      .from(productionFiles)
      .where(eq(productionFiles.id, id))
      .limit(1);

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      }, { status: 404 });
    }

    // Check if user has access to this file's organization
    let canAccess = file.organizationId === authResult.organization!.id; // Own file

    // If not own file, check connection permissions
    if (!canAccess) {
      // Check if they have advanced reporting (can access all files)
      if (hasApiPermission(authResult, 'advanced_reporting')) {
        canAccess = true;
        console.log(`📊 API download access granted via Advanced Reporting`);
      } else {
        // Check organization connections
        const connections = await db
          .select({
            targetOrganizationId: organizationConnections.targetOrganizationId,
            permissions: organizationConnections.permissions,
          })
          .from(organizationConnections)
          .where(
            and(
              eq(organizationConnections.sourceOrganizationId, authResult.organization!.id),
              eq(organizationConnections.status, 'active')
            )
          );

        for (const connection of connections) {
          if (connection.targetOrganizationId === file.organizationId) {
            const permissions = connection.permissions as any;
            if (permissions?.canViewFiles === true || permissions?.canDownloadFiles === true) {
              canAccess = true;
              console.log(`📁 API download access granted via connection permissions`);
              break;
            }
          }
        }
      }
    }

    if (!canAccess) {
      return NextResponse.json({
        success: false,
        error: 'Access denied. You do not have permission to download this file.',
        code: 'ACCESS_DENIED'
      }, { status: 403 });
    }

    // Generate signed URL for download
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('organization-documents')
      .createSignedUrl(file.filePath, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Failed to generate signed URL:', signedUrlError);
      return NextResponse.json({
        success: false,
        error: 'Failed to generate download URL',
        code: 'DOWNLOAD_ERROR'
      }, { status: 500 });
    }

    console.log(`📥 API download: ${file.fileName} for ${authResult.organization?.code}`);

    // Return the signed URL for download
    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: signedUrlData.signedUrl,
        fileName: file.fileName,
        fileSize: file.fileSize,
        contentType: file.contentType,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
      },
      meta: {
        organization: authResult.organization?.code,
        fileId: file.id,
      }
    });
    
  } catch (error) {
    console.error('Error in production files download API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
