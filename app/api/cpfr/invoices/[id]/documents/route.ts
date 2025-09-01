import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { uploadMultipleFiles } from '@/lib/storage/supabase-storage';

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

    // Upload files to Supabase Storage
    const uploadResults = await uploadMultipleFiles(files, {
      category: 'invoices',
      entityId: invoiceId
    });

    // Filter successful uploads
    const successfulUploads = uploadResults.filter(result => result.success);
    const failedUploads = uploadResults.filter(result => !result.success);

    if (failedUploads.length > 0) {
      console.error('Some uploads failed:', failedUploads);
    }

    // TODO: Save file metadata to invoice_documents table
    // For now, return upload results
    
    return NextResponse.json({
      success: true,
      uploaded: successfulUploads.length,
      failed: failedUploads.length,
      files: successfulUploads.map(result => ({
        fileName: result.metadata?.fileName,
        filePath: result.filePath,
        publicUrl: result.publicUrl
      }))
    });

  } catch (error) {
    console.error('Error uploading documents:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
