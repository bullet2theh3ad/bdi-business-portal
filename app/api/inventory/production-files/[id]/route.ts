import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // Get user from cookies (session-based auth)
    const cookieStore = request.headers.get('cookie');
    if (!cookieStore) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase client with cookies
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Cookie: cookieStore,
          },
        },
      }
    );

    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
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
      .where(eq(users.authId, user.id))
      .limit(1);

    if (!userWithOrg.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userWithOrg[0];

    // Get the file to delete
    const [file] = await db
      .select()
      .from(productionFiles)
      .where(eq(productionFiles.id, params.id))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check permissions - user must own the file or be BDI admin
    const canDelete = file.organizationId === userData.organizationId || 
                     userData.organizationCode === 'BDI' || 
                     userData.userRole === 'super_admin';

    if (!canDelete) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete file from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('organization-documents')
      .remove([file.filePath]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete file record from database
    await db
      .delete(productionFiles)
      .where(eq(productionFiles.id, params.id));

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting production file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
