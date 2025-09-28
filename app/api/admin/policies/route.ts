import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers, policyDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check if they're BDI
    const [dbUser] = await db
      .select({
        id: users.id,
        authId: users.authId,
        name: users.name,
        email: users.email,
        role: users.role,
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type
        }
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .leftJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser || !dbUser.organization || dbUser.organization.code !== 'BDI') {
      return NextResponse.json({ error: 'Access denied - BDI users only' }, { status: 403 });
    }

    // Fetch policy documents from database (like production files do)
    const policies = await db
      .select()
      .from(policyDocuments)
      .orderBy(policyDocuments.createdAt);

    console.log('🔍 GET STEP 1: Policy documents from database:', policies.length);

    // Transform to match PolicyDocument interface
    const policyDocumentsList = policies.map(policy => ({
      id: policy.id,
      fileName: policy.fileName,
      filePath: policy.filePath,
      fileSize: Number(policy.fileSize),
      contentType: policy.contentType,
      uploadedBy: policy.uploaderName,
      uploadedAt: policy.createdAt.toISOString(),
      description: policy.description || '',
      category: policy.category || 'other'
    }));

    console.log('🔍 GET STEP 2: Transformed policies:', policyDocumentsList.map(p => ({
      fileName: p.fileName,
      category: p.category,
      description: p.description
    })));

    return NextResponse.json(policyDocumentsList);

  } catch (error) {
    console.error('Error in policies API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check if they're BDI
    const [dbUser] = await db
      .select({
        id: users.id,
        authId: users.authId,
        name: users.name,
        email: users.email,
        role: users.role,
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type
        }
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .leftJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser || !dbUser.organization || dbUser.organization.code !== 'BDI') {
      return NextResponse.json({ error: 'Access denied - BDI users only' }, { status: 403 });
    }

    const formData = await request.formData();
    
    // 🔍 STEP 1: Log all received form data
    console.log('🔍 API STEP 1: Received form data entries:');
    for (const [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && 'name' in value && 'type' in value) {
        console.log(`  ${key}: [File] ${value.name} (${value.type}, ${value.size} bytes)`);
      } else {
        console.log(`  ${key}: "${value}"`);
      }
    }
    
    const fileCount = parseInt(formData.get('fileCount') as string) || 0;
    const category = formData.get('category') as string || 'other';
    const description = formData.get('description') as string || '';
    
    // 🔍 STEP 2: Log parsed values
    console.log('🔍 API STEP 2: Parsed form values:');
    console.log(`  fileCount: ${fileCount}`);
    console.log(`  category: "${category}"`);
    console.log(`  description: "${description}"`);

    if (fileCount === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadResults = [];

    // Upload each file (following production files pattern exactly)
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File;
      if (!file) continue;

      // Generate file path with timestamp to avoid conflicts
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `policies/${timestamp}_${sanitizedFileName}`;

      console.log(`🔍 Uploading file: ${file.name} with category: ${category}, description: ${description}`);

      // Upload file to Supabase Storage (simple, no metadata like production files)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organization-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        uploadResults.push({
          fileName: file.name,
          success: false,
          error: uploadError.message
        });
        continue;
      }

      // Store metadata in database (like production files do)
      const [newPolicy] = await db
        .insert(policyDocuments)
        .values({
          fileName: sanitizedFileName,
          filePath: filePath,
          fileSize: file.size,
          contentType: file.type,
          category: category || 'other',
          description: description || '',
          uploadedBy: dbUser.authId,
          uploaderName: dbUser.name || 'Unknown User',
          uploaderEmail: dbUser.email || '',
          originalName: file.name
        })
        .returning();

      console.log('✅ Policy document uploaded successfully:', newPolicy.fileName);

      uploadResults.push({
        fileName: file.name,
        success: true,
        filePath: filePath
      });
    }

    const successCount = uploadResults.filter(r => r.success).length;
    const failCount = uploadResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `${successCount} file(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results: uploadResults
    });

  } catch (error) {
    console.error('Error uploading policy documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
