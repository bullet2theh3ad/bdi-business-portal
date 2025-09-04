import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileName: string }> }
) {
  try {
    const { id: warehouseId, fileName } = await params;
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

    // Get user organization ID for file path
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        organization_members!inner(
          organization_uuid
        )
      `)
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const orgId = userData.organization_members[0]?.organization_uuid;
    const filePath = `${orgId}/warehouses/${warehouseId}/${fileName}`;

    console.log('📁 Generating download for:', filePath);

    // Generate signed URL for download
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('organization-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (urlError || !signedUrlData) {
      console.error('Error generating signed URL:', urlError);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    console.log('✅ Download URL generated successfully');

    return NextResponse.json({
      downloadUrl: signedUrlData.signedUrl,
      fileName: fileName
    });

  } catch (error) {
    console.error('Error generating warehouse document download:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
