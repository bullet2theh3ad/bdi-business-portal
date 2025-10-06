import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, organizations, organizationConnections, apiKeys } from '@/lib/db/schema';
import { eq, and, or, inArray, gte, lte, desc, count } from 'drizzle-orm';
import { authenticateApiRequest, hasApiPermission } from '@/lib/auth/api-auth';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 📧 Send CPFR notification for production file uploads (same as GUI)
async function sendProductionFileNotification(fileData: any, uploaderOrgCode: string) {
  console.log('📧 CPFR NOTIFICATION (API) - Production file uploaded by org:', uploaderOrgCode);
  console.log('📧 CPFR NOTIFICATION (API) - Notifying GPN CPFR team about new file');

  // ALWAYS notify GPN organization when ANY org uploads production files

  // Get GPN organization CPFR contacts
  const [gpnOrg] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      code: organizations.code,
      cpfrContacts: organizations.cpfrContacts
    })
    .from(organizations)
    .where(eq(organizations.code, 'GPN'))
    .limit(1);

  if (!gpnOrg) {
    console.log('📧 CPFR NOTIFICATION (API) - GPN organization not found');
    return;
  }

  const cpfrContacts = gpnOrg.cpfrContacts as any;
  if (!cpfrContacts || !cpfrContacts.primary_contacts) {
    console.log('📧 CPFR NOTIFICATION (API) - No CPFR contacts configured for GPN');
    return;
  }

  const primaryContacts = cpfrContacts.primary_contacts || [];
  const activeContacts = primaryContacts.filter((contact: any) => contact.active && contact.email);

  if (activeContacts.length === 0) {
    console.log('📧 CPFR NOTIFICATION (API) - No active CPFR contacts found for GPN');
    return;
  }

  console.log(`📧 CPFR NOTIFICATION (API) - Sending to ${activeContacts.length} GPN contacts`);

  if (!resend) {
    console.log('📧 CPFR NOTIFICATION (API) - Resend not configured, skipping email');
    return;
  }

  // Send notification email
  try {
    const recipients = activeContacts.map((contact: any) => contact.email);
    
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
      to: recipients,
      subject: `🔔 New Production File Uploaded by ${uploaderOrgCode} - ${fileData.fileName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🔔 New Production File Available</h2>
          
          <p>Hello GPN CPFR Team,</p>
          
          <p>A new production file has been uploaded by <strong>${uploaderOrgCode} organization</strong> via API and is ready for review:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">File Details:</h3>
            <p><strong>Uploaded by:</strong> ${uploaderOrgCode} Organization (via API)</p>
            <p><strong>File Name:</strong> ${fileData.fileName}</p>
            <p><strong>File Type:</strong> ${fileData.fileType}</p>
            <p><strong>Upload Date:</strong> ${new Date().toLocaleString()}</p>
            ${fileData.description ? `<p><strong>Description:</strong> ${fileData.description}</p>` : ''}
            ${fileData.bdiShipmentNumber ? `<p><strong>BDI Shipment:</strong> ${fileData.bdiShipmentNumber}</p>` : ''}
          </div>
          
          <p><strong>Next Steps:</strong> Please log into the BDI Business Portal to review and process this production file.</p>
          
          <p><a href="https://bdibusinessportal.com/inventory/production-files" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Production Files</a></p>
          
          <p>Best regards,<br>BDI Business Portal Team</p>
        </div>
      `
    });

    if (emailError) {
      console.error('📧 CPFR NOTIFICATION (API) - Email failed:', emailError);
    } else {
      console.log('📧 CPFR NOTIFICATION (API) - Email sent successfully:', emailData?.id);
    }

  } catch (error) {
    console.error('📧 CPFR NOTIFICATION (API) - Error sending email:', error);
  }
}

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
 * - file_type: Filter by file type - PRODUCTION_FILE, ROYALTY_ZONE_1, ROYALTY_ZONE_2, ROYALTY_ZONE_3, ROYALTY_ZONE_4, ROYALTY_ZONE_5, MAC_ADDRESS_LIST, SERIAL_NUMBER_LIST, PRODUCTION_REPORT, TEST_RESULTS, CALIBRATION_DATA, FIRMWARE_VERSION, QUALITY_CONTROL, PACKAGING_LIST, GENERIC (optional)
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

    // Get API key's allowed file types from database
    const [apiKeyData] = await db
      .select({ allowedFileTypes: apiKeys.allowedFileTypes })
      .from(apiKeys)
      .where(eq(apiKeys.id, authResult.apiKey!.id))
      .limit(1);

    const allowedFileTypes = apiKeyData?.allowedFileTypes || [];

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

    // Enforce file type permissions - only show file types this API key can access
    if (allowedFileTypes.length > 0) {
      whereConditions.push(inArray(productionFiles.fileType, allowedFileTypes));
      console.log(`🔐 File type restrictions: ${allowedFileTypes.join(', ')}`);
    }

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
      // Validate file type
      const validFileTypes = [
        'PRODUCTION_FILE', 'ROYALTY_ZONE_1', 'ROYALTY_ZONE_2', 'ROYALTY_ZONE_3', 
        'ROYALTY_ZONE_4', 'ROYALTY_ZONE_5', 'MAC_ADDRESS_LIST', 'SERIAL_NUMBER_LIST',
        'PRODUCTION_REPORT', 'TEST_RESULTS', 'CALIBRATION_DATA', 'FIRMWARE_VERSION',
        'QUALITY_CONTROL', 'PACKAGING_LIST', 'GENERIC'
      ];
      
      if (!validFileTypes.includes(fileTypeFilter.toUpperCase())) {
        return NextResponse.json({
          success: false,
          error: `Invalid file_type. Valid types: ${validFileTypes.join(', ')}`,
          code: 'INVALID_FILE_TYPE'
        }, { status: 400 });
      }
      
      whereConditions.push(eq(productionFiles.fileType, fileTypeFilter.toUpperCase()));
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

    // Transform device metadata for API response with user-friendly categories
    const transformedFiles = files.map(file => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      contentType: file.contentType,
      shipmentNumber: file.shipmentNumber,
      deviceCount: (() => {
        try {
          if (!file.deviceCount) return 0;
          if (typeof file.deviceCount === 'object') return (file.deviceCount as any).deviceCount || 0;
          if (typeof file.deviceCount === 'string') return JSON.parse(file.deviceCount)?.deviceCount || 0;
          return 0;
        } catch (e) {
          console.warn('Failed to parse deviceCount:', file.deviceCount);
          return 0;
        }
      })(),
      fileType: file.fileType,
      fileCategory: (() => {
        // Map technical file types to user-friendly categories
        switch (file.fileType) {
          case 'PRODUCTION_FILE': return 'Production Files';
          case 'ROYALTY_ZONE_4': return 'Royalty Zone 4 Files';
          case 'production': return 'Production Files';
          case 'quality_control': return 'Quality Control Files';
          case 'manufacturing': return 'Manufacturing Files';
          case 'testing': return 'Testing & Validation Files';
          default: return file.fileType || 'Other Files';
        }
      })(),
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

/**
 * POST /api/v1/production-files
 * 
 * Upload production files via API (for ODM partners like MTN)
 * Requires valid API key with production_files_upload permission
 * 
 * Request Format (multipart/form-data):
 * - file: The production file to upload
 * - shipmentNumber: BDI shipment number (optional, will be auto-generated)
 * - description: File description (optional)
 * - tags: JSON array of tags (optional)
 * - manufacturingDate: Manufacturing date (ISO format)
 * - deviceType: Type of devices in this production run
 * 
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "fileName": "MTN_Production_Q1_2025.xlsx",
 *     "fileSize": 2048000,
 *     "shipmentNumber": "BDI-2025-001234",
 *     "deviceCount": 5000,
 *     "organizationCode": "MTN",
 *     "uploadUrl": "/api/v1/production-files/uuid"
 *   },
 *   "meta": {
 *     "organization": "MTN",
 *     "uploadedBy": "api_user",
 *     "uploadedAt": "2025-01-15T10:30:00Z"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
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

    // Check for production files upload permission
    if (!hasApiPermission(authResult, 'production_files_upload')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions. Requires production_files_upload permission.',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, { status: 403 });
    }

    console.log(`📤 API Upload request from ${authResult.organization?.code}`);

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const shipmentNumber = formData.get('shipmentNumber') as string;
    const description = formData.get('description') as string;
    const tags = formData.get('tags') as string;
    const manufacturingDate = formData.get('manufacturingDate') as string;
    const deviceType = formData.get('deviceType') as string;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided',
        code: 'MISSING_FILE'
      }, { status: 400 });
    }

    console.log(`📁 File received: ${file.name}, Type: ${file.type}, Size: ${file.size}`);

    // Validate file type (production files should be spreadsheets or text files)
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'text/plain', // .txt
      'application/json', // .json
    ];

    if (!allowedTypes.includes(file.type)) {
      console.log(`❌ File type rejected: "${file.type}" not in allowed types:`, allowedTypes);
      return NextResponse.json({
        success: false,
        error: `Invalid file type "${file.type}". Allowed types: Excel (.xlsx, .xls), CSV (.csv), Text (.txt), JSON (.json)`,
        code: 'INVALID_FILE_TYPE'
      }, { status: 400 });
    }

    // Generate BDI shipment number if not provided
    const finalShipmentNumber = shipmentNumber || `BDI-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000) + 100000}`;

    // Parse tags if provided
    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        parsedTags = tags.split(',').map(tag => tag.trim());
      }
    }

    // Parse device count from file content (for CSV/TXT files)
    let deviceCount = 0;
    if (file.type === 'text/csv' || file.type === 'text/plain') {
      try {
        const fileContent = await file.text();
        const lines = fileContent.split('\n').filter(line => line.trim() !== '');
        deviceCount = Math.max(0, lines.length - 1); // Subtract header line
      } catch (error) {
        console.warn('Could not parse device count from file:', error);
      }
    }

    // Create file path for Supabase storage (match GUI structure with org folders)
    const fileExtension = file.name.split('.').pop() || 'txt';
    const fileName = `${authResult.organization?.code}_${Date.now()}_${finalShipmentNumber}.${fileExtension}`;
    const orgFolder = authResult.organization?.code; // Use org code (BDI, CBN, MTN, etc.)
    const filePath = `production-files/${orgFolder}/${fileName}`; // Org-specific subfolder

    // Upload to Supabase Storage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileBuffer = await file.arrayBuffer();
    
    // Supabase automatically creates folders when uploading with path separators
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('organization-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        duplex: 'half'
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: 'File upload failed',
        code: 'UPLOAD_ERROR'
      }, { status: 500 });
    }

    // Create database record
    console.log('📝 Attempting database insert with:', {
      fileName: file.name,
      filePath: filePath,
      fileSize: file.size,
      contentType: file.type,
      organizationId: authResult.organization!.id,
      uploadedBy: authResult.user!.authId,
      userEmail: authResult.user!.email,
    });

    const [newFile] = await db
      .insert(productionFiles)
      .values({
        fileName: file.name,
        filePath: filePath,
        fileSize: file.size,
        contentType: file.type,
        bdiShipmentNumber: finalShipmentNumber,
        deviceMetadata: JSON.stringify({
          deviceCount: deviceCount,
          deviceType: deviceType || 'Unknown',
          manufacturingDate: manufacturingDate || new Date().toISOString(),
          uploadedViaApi: true,
          apiKeyId: authResult.apiKey?.id,
        }),
        fileType: 'PRODUCTION_FILE',
        organizationId: authResult.organization!.id,
        uploadedBy: authResult.user!.authId,
        description: description || `Production file uploaded via API by ${authResult.organization?.code}`,
        tags: parsedTags,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    console.log('✅ Database insert successful:', newFile.id);

    console.log(`✅ API Upload successful: ${file.name} by ${authResult.organization?.code}`);

    // 📧 CPFR Notification: Send email to GPN organization (same as GUI uploads)
    try {
      await sendProductionFileNotification(newFile, authResult.organization?.code || 'UNKNOWN');
    } catch (emailError) {
      console.error('⚠️ Failed to send CPFR notification (file upload still successful):', emailError);
      // Don't fail the upload if email fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newFile.id,
        fileName: newFile.fileName,
        fileSize: newFile.fileSize,
        contentType: newFile.contentType,
        shipmentNumber: newFile.bdiShipmentNumber,
        deviceCount: deviceCount,
        organizationCode: authResult.organization?.code,
        organizationName: authResult.organization?.name,
        description: newFile.description,
        tags: newFile.tags || [],
        createdAt: newFile.createdAt,
        uploadUrl: `/api/v1/production-files/${newFile.id}`
      },
      meta: {
        organization: authResult.organization?.code,
        uploadedBy: authResult.user?.email,
        uploadedAt: new Date().toISOString(),
        apiKeyUsed: authResult.apiKey?.keyName
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error in production files upload API:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      detail: error.detail || undefined
    }, { status: 500 });
  }
}
