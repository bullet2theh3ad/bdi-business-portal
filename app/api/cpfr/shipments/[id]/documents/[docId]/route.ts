import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: shipmentId, docId } = await params;
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

    // Get document info from database
    const { data: document, error: docError } = await supabase
      .from('shipment_documents')
      .select('*')
      .eq('id', docId)
      .eq('shipment_id', shipmentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Generate signed URL for download
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('organization-documents')
      .createSignedUrl(document.file_path, 3600); // 1 hour expiry

    if (urlError || !signedUrlData) {
      console.error('Error generating signed URL:', urlError);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    // Redirect to the signed URL for download
    return NextResponse.redirect(signedUrlData.signedUrl);

  } catch (error) {
    console.error('Error downloading shipment document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
