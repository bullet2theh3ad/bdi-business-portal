import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, purchaseOrderDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
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

    const { id: purchaseOrderId, docId } = params;

    // Get document info
    const { data: docData, error: docError } = await supabase
      .from('purchase_order_documents')
      .select('file_name, file_path')
      .eq('id', docId)
      .eq('purchase_order_id', purchaseOrderId)
      .single();

    if (docError || !docData) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Create signed URL for download
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('organization-documents')
      .createSignedUrl(docData.file_path, 3600); // 1 hour expiry

    if (urlError || !signedUrlData?.signedUrl) {
      console.error('Failed to create signed URL:', urlError);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    return NextResponse.json({
      downloadUrl: signedUrlData.signedUrl,
      fileName: docData.file_name
    });

  } catch (error) {
    console.error('Error generating download link:', error);
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
  }
}
