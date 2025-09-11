import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Check authentication using SSR client
    const cookieStore = await cookies();
    const userSupabase = createServerClient(
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

    const { data: { user: authUser } } = await userSupabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super_admin by querying the database directly
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('auth_id', authUser.id)
      .single();

    if (userError || !userData || userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyCode = formData.get('companyCode') as string;

    if (!file || !companyCode) {
      return NextResponse.json({ error: 'File and company code required' }, { status: 400 });
    }

    console.log(`🚀 RAG Upload API: ${file.name} to ${companyCode}`);

    // serviceSupabase already created above for user verification

    // Upload file with service role (bypasses RLS)
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `rag-documents/${companyCode}/${fileName}`;

    const { data, error } = await serviceSupabase.storage
      .from('organization-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ RAG Upload failed:', error);
      return NextResponse.json({ 
        error: 'Upload failed', 
        details: error.message 
      }, { status: 500 });
    }

    console.log(`✅ RAG Upload successful: ${filePath}`);

    return NextResponse.json({ 
      success: true, 
      filePath,
      fileName: file.name,
      companyCode
    });

  } catch (error) {
    console.error('RAG Upload API error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
