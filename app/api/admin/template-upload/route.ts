import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Template upload request received');
    
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

    // Verify user is super_admin
    const dbUser = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    // Allow super_admin OR organization admins for template uploads
    const isAuthorized = dbUser[0].role === 'super_admin' || dbUser[0].role === 'admin';
    
    if (!dbUser.length || !isAuthorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const templateType = formData.get('templateType') as string || 'production-file';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an Excel file.' }, { status: 400 });
    }

    console.log(`📤 Uploading template: ${file.name} (${file.size} bytes)`);

    // Use service role to upload to templates directory (bypasses RLS)
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
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Template upload error:', uploadError);
      return NextResponse.json({ 
        error: 'Template upload failed',
        details: uploadError.message 
      }, { status: 500 });
    }

    console.log(`✅ Template uploaded successfully: ${filePath}`);

    // Make the file publicly accessible by updating its metadata
    try {
      const { error: updateError } = await serviceSupabase.storage
        .from('organization-documents')
        .update(filePath, file, {
          cacheControl: '3600'
        });
      
      if (updateError) {
        console.warn('Could not update file metadata:', updateError);
      }
    } catch (metadataError) {
      console.warn('Metadata update failed:', metadataError);
    }

    return NextResponse.json({
      success: true,
      message: 'Template uploaded successfully',
      filePath: uploadData.path,
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error uploading template:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
