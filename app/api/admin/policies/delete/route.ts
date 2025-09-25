import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(request: NextRequest) {
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

    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    // Delete the file from Supabase storage
    const { error } = await supabase.storage
      .from('organization-documents')
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Policy document deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting policy document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
