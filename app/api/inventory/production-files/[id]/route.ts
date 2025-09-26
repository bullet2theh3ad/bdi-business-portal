import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    if (!userWithOrg.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userWithOrg[0];

    // Get the file to update
    const [file] = await db
      .select()
      .from(productionFiles)
      .where(eq(productionFiles.id, params.id))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check permissions - user must own the file or be BDI admin
    const canUpdate = file.organizationId === userData.organizationId || 
                     userData.organizationCode === 'BDI' || 
                     userData.userRole === 'super_admin';

    if (!canUpdate) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { fileType } = body;

    if (!fileType) {
      return NextResponse.json({ error: 'File type is required' }, { status: 400 });
    }

    // Update file record in database
    const [updatedFile] = await db
      .update(productionFiles)
      .set({
        fileType: fileType,
        updatedAt: new Date()
      })
      .where(eq(productionFiles.id, params.id))
      .returning();

    console.log('✅ Production file category updated:', updatedFile.fileName, 'to', fileType);

    return NextResponse.json({ 
      message: 'File category updated successfully',
      file: updatedFile 
    });
  } catch (error) {
    console.error('Error updating production file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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
