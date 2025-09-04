import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { productionFiles, organizations, organizationConnections } from '@/lib/db/schema';
import { eq, and, or, inArray, gte, lte, desc, count } from 'drizzle-orm';
import { authenticateApiRequest, hasApiPermission } from '@/lib/auth/api-auth';

/**
 * GET /api/v1/production-files
 * 
 * Public API endpoint for external partners to access production files
 * Requires valid API key with production_files_read permission
 * 
 * Query Parameters:
 * - limit: Number of files to return (default: 100, max: 1000)
 * - offset: Number of files to skip for pagination (default: 0)
 * - organization: Filter by organization code (optional)
 * - shipment_id: Filter by BDI shipment number (optional)
 * - file_type: Filter by file type (optional)
 * - from_date: Filter files created after this date (ISO format)
 * - to_date: Filter files created before this date (ISO format)
 * 
 * Response Format:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "fileName": "production_data_2025.xlsx",
 *       "fileSize": 1024000,
 *       "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 *       "shipmentNumber": "BDI-2025-001234",
 *       "deviceCount": 5000,
 *       "fileType": "production",
 *       "organizationCode": "MTN",
 *       "organizationName": "Mountain Networks",
 *       "createdAt": "2025-01-15T10:30:00Z",
 *       "downloadUrl": "/api/v1/production-files/uuid/download"
 *     }
 *   ],
 *   "pagination": {
 *     "total": 150,
 *     "limit": 100,
 *     "offset": 0,
 *     "hasMore": true
 *   },
 *   "meta": {
 *     "organization": "GPN",
 *     "permissions": ["production_files_read"],
 *     "rateLimitRemaining": 995
 *   }
 * }
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

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const organizationFilter = url.searchParams.get('organization');
    const shipmentIdFilter = url.searchParams.get('shipment_id');
    const fileTypeFilter = url.searchParams.get('file_type');
    const fromDate = url.searchParams.get('from_date');
    const toDate = url.searchParams.get('to_date');

    console.log(`📡 API Request from ${authResult.organization?.code}: production-files (limit: ${limit}, offset: ${offset})`);

    // Determine which files this organization can access based on their permissions
    let accessibleOrganizationIds: string[] = [authResult.organization!.id]; // Always include own organization

    // If they have advanced reporting, they can see all files
    if (hasApiPermission(authResult, 'advanced_reporting')) {
      // Get all organization IDs (they can see everything)
      const allOrgs = await db
        .select({ id: organizations.id })
        .from(organizations);
      accessibleOrganizationIds = allOrgs.map(org => org.id);
      console.log(`🌐 Advanced Reporting access - can see files from all organizations`);
    } else {
      // Check organization connections for additional file access
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
        const permissions = connection.permissions as any;
        if (permissions?.canViewFiles === true || permissions?.canDownloadFiles === true) {
          accessibleOrganizationIds.push(connection.targetOrganizationId);
        }
      }
      
      console.log(`📁 File access via connections: ${accessibleOrganizationIds.length} organizations`);
    }

    // Build the query conditions
    let whereConditions: any[] = [
      inArray(productionFiles.organizationId, accessibleOrganizationIds)
    ];

    // Add filters
    if (organizationFilter) {
      // Filter by organization code
      const [filterOrg] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.code, organizationFilter.toUpperCase()))
        .limit(1);
      
      if (filterOrg) {
        whereConditions.push(eq(productionFiles.organizationId, filterOrg.id));
      }
    }

    if (shipmentIdFilter) {
      whereConditions.push(eq(productionFiles.bdiShipmentNumber, shipmentIdFilter));
    }

    if (fileTypeFilter) {
      whereConditions.push(eq(productionFiles.fileType, fileTypeFilter));
    }

    if (fromDate) {
      whereConditions.push(gte(productionFiles.createdAt, new Date(fromDate)));
    }

    if (toDate) {
      whereConditions.push(lte(productionFiles.createdAt, new Date(toDate)));
    }

    // Get total count for pagination
    const [totalCount] = await db
      .select({ count: count() })
      .from(productionFiles)
      .leftJoin(organizations, eq(productionFiles.organizationId, organizations.id))
      .where(and(...whereConditions));

    // Fetch the files with pagination
    const files = await db
      .select({
        id: productionFiles.id,
        fileName: productionFiles.fileName,
        fileSize: productionFiles.fileSize,
        contentType: productionFiles.contentType,
        shipmentNumber: productionFiles.bdiShipmentNumber,
        deviceCount: productionFiles.deviceMetadata,
        fileType: productionFiles.fileType,
        description: productionFiles.description,
        tags: productionFiles.tags,
        createdAt: productionFiles.createdAt,
        updatedAt: productionFiles.updatedAt,
        // Organization info
        organizationCode: organizations.code,
        organizationName: organizations.name,
      })
      .from(productionFiles)
      .leftJoin(organizations, eq(productionFiles.organizationId, organizations.id))
      .where(and(...whereConditions))
      .orderBy(desc(productionFiles.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform device metadata for API response
    const transformedFiles = files.map(file => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      contentType: file.contentType,
      shipmentNumber: file.shipmentNumber,
      deviceCount: file.deviceCount ? JSON.parse(file.deviceCount as string)?.deviceCount || 0 : 0,
      fileType: file.fileType,
      organizationCode: file.organizationCode,
      organizationName: file.organizationName,
      description: file.description,
      tags: file.tags || [],
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      downloadUrl: `/api/v1/production-files/${file.id}/download`
    }));

    console.log(`📊 API Response: ${transformedFiles.length} files for ${authResult.organization?.code}`);

    return NextResponse.json({
      success: true,
      data: transformedFiles,
      pagination: {
        total: totalCount.count,
        limit: limit,
        offset: offset,
        hasMore: (offset + limit) < totalCount.count
      },
      meta: {
        organization: authResult.organization?.code,
        permissions: Object.keys(authResult.apiKey?.permissions || {}).filter(
          key => authResult.apiKey?.permissions[key] === true
        ),
        rateLimitRemaining: authResult.apiKey?.rateLimitPerHour || 0 // TODO: Calculate actual remaining
      }
    });
    
  } catch (error) {
    console.error('Error in production files API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
