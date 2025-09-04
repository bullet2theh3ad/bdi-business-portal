import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { productionFiles, users, organizations, organizationMembers, organizationConnections } from '@/lib/db/schema';
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

    // Check permissions - user must have access to the file via organization ownership or connections
    let canAccess = file.organizationId === userData.organizationId || // Own file
                   userData.organizationCode === 'BDI' || // BDI access
                   userData.userRole === 'super_admin' || // Super admin access
                   file.isPublicToBdi; // Public file

    // If not already granted access, check organization connections
    if (!canAccess && userData.organizationCode !== 'BDI') {
      const connections = await db
        .select({
          targetOrganizationId: organizationConnections.targetOrganizationId,
          permissions: organizationConnections.permissions,
        })
        .from(organizationConnections)
        .where(
          and(
            eq(organizationConnections.sourceOrganizationId, userData.organizationId!),
            eq(organizationConnections.status, 'active')
          )
        );

      // Check if user has connection-based access to the file's organization
      for (const connection of connections) {
        if (connection.targetOrganizationId === file.organizationId) {
          const permissions = connection.permissions as any;
          const hasFileAccess = permissions?.canViewFiles === true || 
                               permissions?.canDownloadFiles === true ||
                               permissions?.advancedReporting === true;
          
          if (hasFileAccess) {
            canAccess = true;
            console.log(`📁 Download access granted via connection permissions`);
            break;
          }
        }
      }
    }

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
