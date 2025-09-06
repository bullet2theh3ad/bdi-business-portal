import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoiceDocuments, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Verify user has sales/admin access
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin', 'sales', 'member'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - Sales access required' }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`Uploading ${files.length} files for invoice ${invoiceId}`);

    // Get user's organization for proper storage path
    const [userOrg] = await db
      .select({ organizationId: organizationMembers.organizationUuid })
      .from(organizationMembers)
      .where(eq(organizationMembers.userAuthId, authUser.id))
      .limit(1);

    if (!userOrg) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
    }

    const uploadResults = [];
    
    // Upload each file manually to have better control
    for (const file of files) {
      try {
        // Generate file path: organizationId/invoices/invoiceId/filename
        const timestamp = Date.now();
        // Sanitize filename - remove invalid characters for Supabase Storage
        const sanitizedFileName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
          .replace(/_+/g, '_') // Replace multiple underscores with single
          .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
        const fileName = `${timestamp}_${sanitizedFileName}`;
        const filePath = `${userOrg.organizationId}/invoices/${invoiceId}/${fileName}`;

        console.log(`Uploading file to path: ${filePath}`);

        // Ensure directory structure exists by creating a placeholder if needed
        const directoryPath = `${userOrg.organizationId}/invoices/${invoiceId}/.keep`;
        try {
          await supabase.storage
            .from('organization-documents')
            .upload(directoryPath, new Blob([''], { type: 'text/plain' }), {
              upsert: true
            });
        } catch (dirError) {
          // Directory creation failed or already exists - continue anyway
          console.log('Directory setup result:', dirError);
        }

        // Upload to Supabase Storage with correct bucket name
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('organization-documents') // Use the correct bucket name
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error(`Upload failed for ${file.name}:`, uploadError);
          uploadResults.push({ 
            success: false, 
            error: uploadError.message,
            fileName: file.name 
          });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('organization-documents')
          .getPublicUrl(filePath);

        uploadResults.push({
          success: true,
          filePath: uploadData.path,
          publicUrl: urlData.publicUrl,
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            uploadedAt: new Date().toISOString()
          }
        });

      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        uploadResults.push({ 
          success: false, 
          error: 'Upload failed',
          fileName: file.name 
        });
      }
    }

    // Filter successful uploads
    const successfulUploads = uploadResults.filter(result => result.success);
    const failedUploads = uploadResults.filter(result => !result.success);

    if (failedUploads.length > 0) {
      console.error('Some uploads failed:', failedUploads);
    }

    // Save file metadata to invoice_documents table
    if (successfulUploads.length > 0) {
      const documentsToInsert = successfulUploads.map(result => ({
        invoiceId: invoiceId,
        fileName: result.metadata!.fileName,
        filePath: result.filePath!,
        fileType: result.metadata!.fileType,
        fileSize: result.metadata!.fileSize,
        uploadedBy: requestingUser.authId,
      }));

      await db.insert(invoiceDocuments).values(documentsToInsert);
      console.log(`✅ Saved ${documentsToInsert.length} file records to database`);
    }
    
    return NextResponse.json({
      success: true,
      uploaded: successfulUploads.length,
      failed: failedUploads.length,
      errors: failedUploads.map(f => ({ fileName: f.fileName, error: f.error })),
      files: successfulUploads.map(result => ({
        fileName: result.metadata?.fileName,
        filePath: result.filePath,
        publicUrl: result.publicUrl,
        uploadedAt: result.metadata?.uploadedAt
      }))
    });

  } catch (error) {
    console.error('Error uploading documents:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// GET endpoint to fetch existing documents
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: invoiceId } = await params;

    // Fetch documents for this invoice
    const documents = await db
      .select()
      .from(invoiceDocuments)
      .where(eq(invoiceDocuments.invoiceId, invoiceId));

    console.log(`Found ${documents.length} documents for invoice ${invoiceId}`);

    return NextResponse.json(documents);

  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
