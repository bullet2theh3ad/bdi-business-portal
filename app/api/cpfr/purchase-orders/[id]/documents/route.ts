import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, purchaseOrderDocuments, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    const purchaseOrderId = params.id;

    // Fetch documents from database
    const { data: documentsData, error: documentsError } = await supabase
      .from('purchase_order_documents')
      .select(`
        id,
        file_name,
        file_path,
        file_size,
        content_type,
        uploaded_at
      `)
      .eq('purchase_order_id', purchaseOrderId);

    if (documentsError) {
      console.error('Database error:', documentsError);
      return NextResponse.json([]);
    }

    // Transform data to match frontend interface
    const transformedDocuments = (documentsData || []).map((row: any) => ({
      id: row.id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      contentType: row.content_type,
      uploadedAt: row.uploaded_at,
    }));

    return NextResponse.json(transformedDocuments);

  } catch (error) {
    console.error('Error fetching purchase order documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    // Get the requesting user and their organization
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userOrgMembership = await db
      .select({
        organization: {
          id: organizations.id,
          code: organizations.code,
        }
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (userOrgMembership.length === 0) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership[0].organization;
    const purchaseOrderId = params.id;

    // Parse form data
    const formData = await request.formData();
    
    // Handle file uploads
    const uploadedFiles = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file-') && value && typeof value === 'object' && 'name' in value) {
        try {
          const timestamp = Date.now();
          const fileName = `${timestamp}_${(value as any).name}`;
          const filePath = `${userOrganization.id}/purchase-orders/${purchaseOrderId}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('organization-documents')
            .upload(filePath, value as any);

          if (uploadError) {
            console.error('File upload error:', uploadError);
            continue;
          }

          // Save document record
          const { error: docError } = await supabase
            .from('purchase_order_documents')
            .insert({
              purchase_order_id: purchaseOrderId,
              file_name: (value as any).name,
              file_path: filePath,
              file_size: (value as any).size,
              content_type: (value as any).type,
              uploaded_by: requestingUser.authId,
            });

          if (docError) {
            console.error('Document record error:', docError);
          } else {
            uploadedFiles.push((value as any).name);
          }
        } catch (fileError) {
          console.error('File processing error:', fileError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${uploadedFiles.length} documents uploaded successfully!`,
      uploadedFiles: uploadedFiles.length
    });

  } catch (error) {
    console.error('Error uploading documents:', error);
    return NextResponse.json({ error: 'Failed to upload documents' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    const purchaseOrderId = params.id;
    const url = new URL(request.url);
    const docId = url.searchParams.get('docId');

    if (!docId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    // Get document info before deleting
    const { data: docData, error: docFetchError } = await supabase
      .from('purchase_order_documents')
      .select('file_path')
      .eq('id', docId)
      .eq('purchase_order_id', purchaseOrderId)
      .single();

    if (docFetchError || !docData) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('organization-documents')
      .remove([docData.file_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('purchase_order_documents')
      .delete()
      .eq('id', docId)
      .eq('purchase_order_id', purchaseOrderId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully!'
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
