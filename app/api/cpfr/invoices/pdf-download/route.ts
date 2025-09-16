import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    console.log('📄 Direct PDF download request for:', filePath);

    // Use service role key to access storage
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // First check if file exists
    const { data: listData, error: listError } = await supabase.storage
      .from('organization-documents')
      .list(filePath.split('/').slice(0, -1).join('/'));

    if (listError) {
      console.error('❌ Error checking file existence:', listError);
    } else {
      console.log('📁 Files in directory:', listData?.map(f => f.name));
    }

    // Download the PDF file directly
    const { data, error } = await supabase.storage
      .from('organization-documents')
      .download(filePath);

    if (error) {
      console.error('❌ Error downloading PDF:', error);
      console.error('❌ Full error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: 'Failed to download PDF' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    console.log('✅ PDF downloaded successfully, size:', data.size);

    // Return the PDF file directly
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('❌ Error in PDF download:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
