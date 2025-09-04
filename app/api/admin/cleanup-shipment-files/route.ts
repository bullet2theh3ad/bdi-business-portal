import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(request: NextRequest) {
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const dbUser = await db
      .select({
        id: users.id,
        role: users.role,
        organizationId: organizationMembers.organizationUuid,
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser.length || !['super_admin', 'admin'].includes(dbUser[0].role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // List all files in the organization-documents bucket under */shipments/* pattern
    const { data: files, error: listError } = await supabase.storage
      .from('organization-documents')
      .list('', {
        limit: 1000,
        search: 'shipments'
      });

    if (listError) {
      console.error('Error listing files:', listError);
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }

    console.log('📁 Found files to clean up:', files?.length || 0);

    // Get all organization folders and look for shipments subfolders
    const { data: orgFolders, error: orgError } = await supabase.storage
      .from('organization-documents')
      .list('');

    if (orgError) {
      console.error('Error listing org folders:', orgError);
      return NextResponse.json({ error: 'Failed to list organization folders' }, { status: 500 });
    }

    let deletedCount = 0;
    const deletedPaths = [];

    // For each organization folder, check for shipments subfolder
    for (const folder of orgFolders || []) {
      if (folder.name && folder.name !== '.emptyFolderPlaceholder') {
        const shipmentPath = `${folder.name}/shipments`;
        
        // List files in this organization's shipments folder
        const { data: shipmentFiles, error: shipmentError } = await supabase.storage
          .from('organization-documents')
          .list(shipmentPath, {
            limit: 1000
          });

        if (!shipmentError && shipmentFiles?.length > 0) {
          // Delete each shipment subfolder
          for (const shipmentFolder of shipmentFiles) {
            if (shipmentFolder.name && shipmentFolder.name !== '.emptyFolderPlaceholder') {
              const fullShipmentPath = `${shipmentPath}/${shipmentFolder.name}`;
              
              // List files in this specific shipment folder
              const { data: documentFiles, error: docError } = await supabase.storage
                .from('organization-documents')
                .list(fullShipmentPath);

              if (!docError && documentFiles?.length > 0) {
                // Delete all files in this shipment folder
                const filesToDelete = documentFiles
                  .filter(file => file.name !== '.emptyFolderPlaceholder')
                  .map(file => `${fullShipmentPath}/${file.name}`);

                if (filesToDelete.length > 0) {
                  const { data: deleteResult, error: deleteError } = await supabase.storage
                    .from('organization-documents')
                    .remove(filesToDelete);

                  if (!deleteError) {
                    deletedCount += filesToDelete.length;
                    deletedPaths.push(...filesToDelete);
                    console.log(`🗑️ Deleted ${filesToDelete.length} files from ${fullShipmentPath}`);
                  } else {
                    console.error(`❌ Error deleting files from ${fullShipmentPath}:`, deleteError);
                  }
                }
              }
            }
          }
        }
      }
    }

    console.log(`🧹 Cleanup complete: Deleted ${deletedCount} files from storage`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} shipment files from storage`,
      deletedPaths: deletedPaths
    });

  } catch (error) {
    console.error('Error during shipment file cleanup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
