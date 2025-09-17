import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Helper function to get user's organization ID
async function getUserOrgId(authUserId: string): Promise<string> {
  const dbUser = await db
    .select({
      organizationId: organizationMembers.organizationUuid,
    })
    .from(users)
    .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
    .where(eq(users.authId, authUserId))
    .limit(1);
  
  return dbUser[0]?.organizationId || 'unknown';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params;
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

    // Get user with organization info
    const dbUser = await db
      .select({
        id: users.id,
        authId: users.authId,
        email: users.email,
        organizationId: organizationMembers.organizationUuid,
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = dbUser[0];

    // Get the warehouse details to determine the correct organization path
    const { data: warehouseData, error: warehouseError } = await supabase
      .from('warehouses')
      .select('*, organizations!inner(id, code, name)')
      .eq('id', warehouseId)
      .single();

    if (warehouseError || !warehouseData) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    // Use the warehouse owner's organization for the file path, not the user's organization
    const warehouseOwnerOrgId = warehouseData.organizations.id;
    console.log(`📁 Uploading to warehouse ${warehouseId} owned by ${warehouseData.organizations.code}`);

    const formData = await request.formData();
    const uploadedFiles = [];
    
    // Process each uploaded file
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value && typeof value === 'object' && 'name' in value && 'size' in value) {
        try {
          // Upload to Supabase Storage - use warehouse owner's organization path
          const fileName = `${Date.now()}_${value.name}`;
          const filePath = `${warehouseOwnerOrgId}/warehouses/${warehouseId}/${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('organization-documents')
            .upload(filePath, value);

          if (uploadError) {
            console.error('❌ Storage upload error:', uploadError);
            continue;
          }

          console.log('✅ File uploaded to storage successfully:', filePath);

          uploadedFiles.push({
            fileName: value.name,
            filePath: filePath,
            fileSize: value.size
          });

        } catch (fileError) {
          console.error('Error processing file:', value.name, fileError);
        }
      }
    }

    console.log(`📎 Uploaded ${uploadedFiles.length} documents for warehouse ${warehouseId}`);

    return NextResponse.json({
      success: true,
      message: `${uploadedFiles.length} documents uploaded successfully`,
      documents: uploadedFiles
    });

  } catch (error) {
    console.error('Error uploading warehouse documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params;
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

    // Get warehouse details to determine the correct organization path
    const { data: warehouseData, error: warehouseError } = await supabase
      .from('warehouses')
      .select('*, organizations!inner(id, code, name)')
      .eq('id', warehouseId)
      .single();

    if (warehouseError || !warehouseData) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    // Use the warehouse owner's organization for the file path
    const warehouseOwnerOrgId = warehouseData.organizations.id;
    console.log(`📁 Listing files for warehouse ${warehouseId} owned by ${warehouseData.organizations.code}`);
    
    // List files in the warehouse directory from storage
    const { data: files, error } = await supabase.storage
      .from('organization-documents')
      .list(`${warehouseOwnerOrgId}/warehouses/${warehouseId}`);

    if (error) {
      console.error('Error fetching warehouse documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Transform storage files to match expected format
    const documents = (files || [])
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => ({
        fileName: file.name,
        fileSize: file.metadata?.size || 0,
        filePath: `${warehouseOwnerOrgId}/warehouses/${warehouseId}/${file.name}`
      }));

    return NextResponse.json(documents);

  } catch (error) {
    console.error('Error fetching warehouse documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
