import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

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

    // Get the file from Supabase storage for preview
    const { data, error } = await supabase.storage
      .from('organization-documents')
      .download(filePath);

    if (error) {
      console.error('Preview error:', error);
      return NextResponse.json({ error: 'Failed to preview file' }, { status: 500 });
    }

    // Determine content type for proper preview
    const fileName = filePath.split('/').pop() || '';
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (extension === 'pdf') {
      contentType = 'application/pdf';
    } else if (extension === 'doc' || extension === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (extension === 'txt') {
      contentType = 'text/plain';
    } else if (extension === 'md') {
      contentType = 'text/markdown';
    }

    // Return the file for preview (will open in browser)
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error previewing policy document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
