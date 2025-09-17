import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // Get the latest production template from Supabase storage
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // List files in the templates folder
    const { data: files, error } = await serviceSupabase.storage
      .from('organization-documents')
      .list('templates/production-files', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('Error listing template files:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    // Find the latest production template
    const latestTemplate = files?.find(file => 
      file.name.toLowerCase().includes('production') && 
      file.name.toLowerCase().includes('template')
    );

    if (!latestTemplate) {
      return NextResponse.json({ error: 'No production template found' }, { status: 404 });
    }

    // Get signed download URL
    const { data: urlData, error: urlError } = await serviceSupabase.storage
      .from('organization-documents')
      .createSignedUrl(`templates/production-files/${latestTemplate.name}`, 300); // 5 minute expiry

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      return NextResponse.json({ error: 'Failed to create download URL' }, { status: 500 });
    }

    return NextResponse.json({
      downloadUrl: urlData.signedUrl,
      fileName: latestTemplate.name,
      fileSize: latestTemplate.metadata?.size,
      lastModified: latestTemplate.updated_at
    });

  } catch (error) {
    console.error('Error in templates API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Only allow super_admin to upload templates
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', authUser.id)
      .single();

    // Allow super_admin OR organization admins for template uploads
    const isAuthorized = userData && (userData.role === 'super_admin' || userData.role === 'admin');
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const templateType = formData.get('templateType') as string || 'production-file';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📤 Uploading template: ${file.name} (${file.size} bytes)`);

    // Use service role for template uploads
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const timestamp = Date.now();
    const filePath = `templates/production-files/${timestamp}_${file.name}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await serviceSupabase.storage
      .from('organization-documents')
      .upload(filePath, file, {
        contentType: file.type,
        duplex: 'half'
      });

    if (uploadError) {
      console.error('Template upload error:', uploadError);
      return NextResponse.json({ error: 'Template upload failed' }, { status: 500 });
    }

    console.log(`✅ Template uploaded successfully: ${filePath}`);

    return NextResponse.json({
      success: true,
      message: 'Template uploaded successfully',
      filePath: uploadData.path,
      fileName: file.name
    });

  } catch (error) {
    console.error('Error uploading template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
