import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shipmentId } = await params;
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

    const formData = await request.formData();
    const uploadedFiles = [];
    
    // Process each uploaded file (Node.js compatible check)
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value && typeof value === 'object' && 'name' in value) {
        try {
          // Upload to Supabase Storage
          const fileName = `${shipmentId}_${Date.now()}_${value.name}`;
          const filePath = `shipments/${shipmentId}/${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('shipment-documents')
            .upload(filePath, value);

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            continue;
          }

          // Save document record to shipment_documents table
          const { data: docData, error: docError } = await supabase
            .from('shipment_documents')
            .insert({
              shipment_id: shipmentId,
              file_name: value.name,
              file_path: filePath,
              file_size: value.size,
              content_type: value.type,
              uploaded_by: authUser.id
            })
            .select()
            .single();

          if (!docError) {
            uploadedFiles.push({
              id: docData.id,
              fileName: value.name,
              filePath: filePath,
              fileSize: value.size
            });
          }
        } catch (fileError) {
          console.error('Error processing file:', value.name, fileError);
        }
      }
    }

    console.log(`📎 Uploaded ${uploadedFiles.length} documents for shipment ${shipmentId}`);

    return NextResponse.json({
      success: true,
      message: `${uploadedFiles.length} documents uploaded successfully`,
      documents: uploadedFiles
    });

  } catch (error) {
    console.error('Error uploading shipment documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shipmentId } = await params;
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

    // Fetch documents for this shipment
    const { data: documents, error } = await supabase
      .from('shipment_documents')
      .select('*')
      .eq('shipment_id', shipmentId);

    if (error) {
      console.error('Error fetching shipment documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json(documents || []);

  } catch (error) {
    console.error('Error fetching shipment documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
