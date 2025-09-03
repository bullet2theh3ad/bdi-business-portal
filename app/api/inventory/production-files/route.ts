import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and, inArray, or } from 'drizzle-orm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Fetch production files based on organization access
    let files;
    
    if (userData.organizationCode === 'BDI' || userData.userRole === 'super_admin') {
      // BDI users can see all files
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
        })
        .from(productionFiles)
        .orderBy(productionFiles.createdAt);
    } else {
      // Non-BDI users can only see their own organization's files
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
        })
        .from(productionFiles)
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

    return NextResponse.json({
      message: 'File uploaded successfully',
      file: newFile
    });
  } catch (error) {
    console.error('Error uploading production file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
