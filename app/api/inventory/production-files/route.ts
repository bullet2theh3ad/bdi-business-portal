import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, users, organizations, organizationMembers, organizationConnections } from '@/lib/db/schema';
import { eq, and, inArray, or } from 'drizzle-orm';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 📧 Send CPFR notification for production file uploads
async function sendProductionFileNotification(fileData: any, uploaderOrgCode: string) {
  console.log('📧 CPFR NOTIFICATION - Production file uploaded by org:', uploaderOrgCode);
  console.log('📧 CPFR NOTIFICATION - Notifying GPN CPFR team about new file');

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
    console.log('📧 CPFR NOTIFICATION - GPN organization not found');
    return;
  }

  const cpfrContacts = gpnOrg.cpfrContacts as any;
  if (!cpfrContacts || !cpfrContacts.primary_contacts) {
    console.log('📧 CPFR NOTIFICATION - No CPFR contacts configured for GPN');
    return;
  }

  const primaryContacts = cpfrContacts.primary_contacts || [];
  const activeContacts = primaryContacts.filter((contact: any) => contact.active && contact.email);

  if (activeContacts.length === 0) {
    console.log('📧 CPFR NOTIFICATION - No active CPFR contacts found for GPN');
    return;
  }

  console.log(`📧 CPFR NOTIFICATION - Sending to ${activeContacts.length} GPN contacts`);

  if (!resend) {
    console.log('📧 CPFR NOTIFICATION - Resend not configured, skipping email');
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
          
          <p>A new production file has been uploaded by <strong>${uploaderOrgCode} organization</strong> and is ready for review:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">File Details:</h3>
            <p><strong>Uploaded by:</strong> ${uploaderOrgCode} Organization</p>
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
      console.error('📧 CPFR NOTIFICATION - Email failed:', emailError);
    } else {
      console.log('📧 CPFR NOTIFICATION - Email sent successfully:', emailData?.id);
    }

  } catch (error) {
    console.error('📧 CPFR NOTIFICATION - Error sending email:', error);
  }
}

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

async function getCurrentUser() {
  const supabaseClient = await createSupabaseServerClient();
  const { data: { user: authUser }, error } = await supabaseClient.auth.getUser();
  
  if (error || !authUser) {
    return null;
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, authUser.email!))
    .limit(1);

  return dbUser;
}

export async function GET(request: NextRequest) {
  try {
    // Get current user using the same pattern as other working APIs
    const dbUser = await getCurrentUser();
    if (!dbUser) {
      console.log('No authenticated user found, returning empty array');
      return NextResponse.json([]);
    }

    // Get user's organization
    const userWithOrg = await db
      .select({
        userId: users.id,
        userRole: users.role,
        organizationId: organizationMembers.organizationUuid,
        organizationCode: organizations.code,
        organizationType: organizations.type
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .leftJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(users.authId, dbUser.authId))
      .limit(1);

    if (!userWithOrg.length) {
      console.log('User not found in organization, returning empty array');
      return NextResponse.json([]);
    }

    const userData = userWithOrg[0];

    // Check organization connections for file access permissions
    let hasAdvancedReporting = false;
    let connectedOrganizationIds: string[] = [];
    
    console.log(`🔍 Checking file access permissions for ${userData.organizationCode} (type: ${userData.organizationType})`);
    
    if (userData.organizationCode !== 'BDI') {
      // Get all active connections where this organization is the source (can access other org's files)
      const connections = await db
        .select({
          targetOrganizationId: organizationConnections.targetOrganizationId,
          permissions: organizationConnections.permissions,
          targetOrgCode: organizations.code,
          targetOrgName: organizations.name,
        })
        .from(organizationConnections)
        .leftJoin(organizations, eq(organizationConnections.targetOrganizationId, organizations.id))
        .where(
          and(
            eq(organizationConnections.sourceOrganizationId, userData.organizationId!),
            eq(organizationConnections.status, 'active')
          )
        );

      console.log(`🔍 Found ${connections.length} active connections for ${userData.organizationCode}:`, connections);

      // Process each connection to determine file access
      for (const connection of connections) {
        const permissions = connection.permissions as any;
        
        // Check for file access permissions
        const hasFileAccess = permissions?.canViewFiles === true || 
                             permissions?.canDownloadFiles === true ||
                             permissions?.canShareFiles === true;
        
        // Check for advanced reporting (can see all files)
        const hasReportingAccess = permissions?.advancedReporting === true ||
                                  permissions?.reporting === true ||
                                  permissions?.canViewReports === true;
        
        if (hasFileAccess || hasReportingAccess) {
          connectedOrganizationIds.push(connection.targetOrganizationId);
          console.log(`📁 File access granted to ${connection.targetOrgCode} (${connection.targetOrgName})`);
          
          if (hasReportingAccess) {
            hasAdvancedReporting = true;
            console.log(`📊 Advanced Reporting access granted via connection to ${connection.targetOrgCode}`);
          }
        }
      }
    }
    
    console.log(`🔐 File access level: ${userData.organizationCode === 'BDI' ? 'BDI (all files)' : hasAdvancedReporting ? 'Advanced Reporting (all files)' : 'Organization only'}`);
    

    // Fetch production files based on organization access
    let files;
    
    if (userData.organizationCode === 'BDI' || userData.userRole === 'super_admin' || hasAdvancedReporting) {
      // BDI users or users with Advanced Reporting can see all files
      files = await db
        .select({
          id: productionFiles.id,
          fileName: productionFiles.fileName,
          filePath: productionFiles.filePath,
          fileSize: productionFiles.fileSize,
          contentType: productionFiles.contentType,
          shipmentId: productionFiles.shipmentId,
          forecastId: productionFiles.forecastId,
          bdiShipmentNumber: productionFiles.bdiShipmentNumber,
          deviceMetadata: productionFiles.deviceMetadata,
          fileType: productionFiles.fileType,
          organizationId: productionFiles.organizationId,
          uploadedBy: productionFiles.uploadedBy,
          isPublicToBdi: productionFiles.isPublicToBdi,
          allowedOrganizations: productionFiles.allowedOrganizations,
          description: productionFiles.description,
          tags: productionFiles.tags,
          createdAt: productionFiles.createdAt,
          updatedAt: productionFiles.updatedAt,
          // Include organization info
          organizationCode: organizations.code,
          organizationName: organizations.name,
        })
        .from(productionFiles)
        .leftJoin(organizations, eq(productionFiles.organizationId, organizations.id))
        .orderBy(productionFiles.createdAt);
    } else if (connectedOrganizationIds.length > 0) {
      // Users with file access connections can see their own files + connected org files
      console.log(`📂 Fetching files for ${userData.organizationCode} + connected orgs: [${connectedOrganizationIds.join(', ')}]`);
      files = await db
        .select({
          id: productionFiles.id,
          fileName: productionFiles.fileName,
          filePath: productionFiles.filePath,
          fileSize: productionFiles.fileSize,
          contentType: productionFiles.contentType,
          shipmentId: productionFiles.shipmentId,
          forecastId: productionFiles.forecastId,
          bdiShipmentNumber: productionFiles.bdiShipmentNumber,
          deviceMetadata: productionFiles.deviceMetadata,
          fileType: productionFiles.fileType,
          organizationId: productionFiles.organizationId,
          uploadedBy: productionFiles.uploadedBy,
          isPublicToBdi: productionFiles.isPublicToBdi,
          allowedOrganizations: productionFiles.allowedOrganizations,
          description: productionFiles.description,
          tags: productionFiles.tags,
          createdAt: productionFiles.createdAt,
          updatedAt: productionFiles.updatedAt,
          // Include organization info
          organizationCode: organizations.code,
          organizationName: organizations.name,
        })
        .from(productionFiles)
        .leftJoin(organizations, eq(productionFiles.organizationId, organizations.id))
        .where(
          or(
            eq(productionFiles.organizationId, userData.organizationId!), // Own files
            inArray(productionFiles.organizationId, connectedOrganizationIds), // Connected org files
            eq(productionFiles.isPublicToBdi, true) // Public files
          )
        )
        .orderBy(productionFiles.createdAt);
    } else {
      // Users without connections can only see their own organization's files
      files = await db
        .select({
          id: productionFiles.id,
          fileName: productionFiles.fileName,
          filePath: productionFiles.filePath,
          fileSize: productionFiles.fileSize,
          contentType: productionFiles.contentType,
          shipmentId: productionFiles.shipmentId,
          forecastId: productionFiles.forecastId,
          bdiShipmentNumber: productionFiles.bdiShipmentNumber,
          deviceMetadata: productionFiles.deviceMetadata,
          fileType: productionFiles.fileType,
          organizationId: productionFiles.organizationId,
          uploadedBy: productionFiles.uploadedBy,
          isPublicToBdi: productionFiles.isPublicToBdi,
          allowedOrganizations: productionFiles.allowedOrganizations,
          description: productionFiles.description,
          tags: productionFiles.tags,
          createdAt: productionFiles.createdAt,
          updatedAt: productionFiles.updatedAt,
          // Include organization info
          organizationCode: organizations.code,
          organizationName: organizations.name,
        })
        .from(productionFiles)
        .leftJoin(organizations, eq(productionFiles.organizationId, organizations.id))
        .where(
          or(
            eq(productionFiles.organizationId, userData.organizationId!),
            eq(productionFiles.isPublicToBdi, true)
          )
        )
        .orderBy(productionFiles.createdAt);
    }

    return NextResponse.json(files);
  } catch (error) {
    console.error('Error fetching production files:', error);
    // Return empty array instead of error object to prevent frontend crashes
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user using the same pattern as other working APIs
    const dbUser = await getCurrentUser();
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const userWithOrg = await db
      .select({
        userId: users.id,
        userRole: users.role,
        organizationId: organizationMembers.organizationUuid,
        organizationCode: organizations.code,
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .leftJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(users.authId, dbUser.authId))
      .limit(1);

    if (!userWithOrg.length || !userWithOrg[0].organizationId) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
    }

    const userData = userWithOrg[0];

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;
    const description = formData.get('description') as string;
    const forecastId = formData.get('forecastId') as string;
    const bdiShipmentNumber = formData.get('bdiShipmentNumber') as string;
    const tags = formData.get('tags') as string;
    const deviceMetadataStr = formData.get('deviceMetadata') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `production-files/${userData.organizationCode}/${timestamp}_${sanitizedFileName}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('organization-documents')
      .upload(filePath, file, {
        contentType: file.type,
        duplex: 'half'
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }

    // Parse device metadata
    let deviceMetadata = {
      cmMacAddresses: [],
      macAddresses: [],
      serialNumbers: [],
      deviceCount: 0,
      productionBatch: null,
      manufacturingDate: null
    };

    if (deviceMetadataStr) {
      try {
        deviceMetadata = JSON.parse(deviceMetadataStr);
      } catch (e) {
        console.error('Error parsing device metadata:', e);
      }
    }

    // Parse tags
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];

    // Insert file record into database
    const insertData: any = {
      fileName: file.name,
      filePath: filePath,
      fileSize: file.size,
      contentType: file.type,
      deviceMetadata: deviceMetadata,
      fileType: fileType,
      organizationId: userData.organizationId!,
              uploadedBy: dbUser.authId,
      isPublicToBdi: false,
      allowedOrganizations: [],
      tags: tagsArray,
    };

    // Add optional fields only if they have values
    if (forecastId) insertData.forecastId = forecastId;
    if (bdiShipmentNumber) insertData.bdiShipmentNumber = bdiShipmentNumber;
    if (description) insertData.description = description;

    const [newFile] = await db
      .insert(productionFiles)
      .values(insertData)
      .returning();

    console.log('✅ Production file uploaded successfully:', newFile.fileName);

    // 📧 CPFR Notification: Send email to GPN organization if this is for them
    try {
      await sendProductionFileNotification(newFile, userData.organizationCode || 'UNKNOWN');
    } catch (emailError) {
      console.error('⚠️ Failed to send CPFR notification (file upload still successful):', emailError);
      // Don't fail the upload if email fails
    }

    return NextResponse.json({
      message: 'File uploaded successfully',
      file: newFile
    });
  } catch (error) {
    console.error('Error uploading production file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
