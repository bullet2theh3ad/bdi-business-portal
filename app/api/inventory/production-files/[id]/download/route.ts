import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';

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

export async function GET(
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

    // Get the file
    const [file] = await db
      .select()
      .from(productionFiles)
      .where(eq(productionFiles.id, params.id))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check permissions - user must have access to the file
    const canAccess = file.organizationId === userData.organizationId || 
                     userData.organizationCode === 'BDI' || 
                     userData.userRole === 'super_admin' ||
                     file.isPublicToBdi ||
                     (file.allowedOrganizations && file.allowedOrganizations.includes(userData.organizationId!));

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Generate signed URL for download
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('organization-documents')
      .createSignedUrl(file.filePath, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData) {
      console.error('Error generating signed URL:', signedUrlError);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    // Return the signed URL for client-side download
    return NextResponse.json({ 
      downloadUrl: signedUrlData.signedUrl,
      fileName: file.fileName,
      contentType: file.contentType
    });
  } catch (error) {
    console.error('Error generating download link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
