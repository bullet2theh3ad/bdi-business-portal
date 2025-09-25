import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
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

    // Fetch policy documents from Supabase storage
    const { data: files, error } = await supabase.storage
      .from('organization-documents')
      .list('policies', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('Error fetching policy documents:', error);
      return NextResponse.json({ error: 'Failed to fetch policy documents' }, { status: 500 });
    }

    // Transform file data to match PolicyDocument interface
    const policyDocuments = (files || []).map(file => ({
      id: file.id || file.name,
      fileName: file.name,
      filePath: `policies/${file.name}`,
      fileSize: file.metadata?.size || 0,
      contentType: file.metadata?.mimetype || 'application/octet-stream',
      uploadedBy: file.metadata?.uploaderName || dbUser?.name || 'Unknown User',
      uploadedAt: file.created_at || new Date().toISOString(),
      description: file.metadata?.description || '',
      category: file.metadata?.category || 'other'
    }));

    return NextResponse.json(policyDocuments);

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
    const fileCount = parseInt(formData.get('fileCount') as string) || 0;
    const category = formData.get('category') as string || 'other';
    const description = formData.get('description') as string || '';

    if (fileCount === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadResults = [];

    // Upload each file
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File;
      if (!file) continue;

      // Generate file path with timestamp to avoid conflicts
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `policies/${timestamp}_${sanitizedFileName}`;

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organization-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            category: category || 'other',
            description: description || '',
            uploadedBy: dbUser.authId,
            uploaderName: dbUser.name || 'Unknown User',
            uploaderEmail: dbUser.email || '',
            originalName: file.name,
            uploadedAt: new Date().toISOString()
          }
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        uploadResults.push({
          fileName: file.name,
          success: false,
          error: uploadError.message
        });
      } else {
        uploadResults.push({
          fileName: file.name,
          success: true,
          filePath: filePath
        });
      }
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
