import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    console.log('📄 Direct PDF download request for:', filePath);

    // Use service role key to access storage - try direct client instead of SSR client
    console.log('🔧 Creating Supabase client with service role key...');
    console.log('🔧 URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🔧 Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First check if file exists
    const directoryPath = filePath.split('/').slice(0, -1).join('/');
    console.log('🔍 Checking directory:', directoryPath);
    
    const { data: listData, error: listError } = await supabase.storage
      .from('organization-documents')
      .list(directoryPath);

    if (listError) {
      console.error('❌ Error checking file existence:', listError);
      console.error('❌ List error details:', JSON.stringify(listError, null, 2));
    } else {
      console.log('📁 Files in directory:', listData?.map(f => f.name));
      console.log('📁 Looking for file:', filePath.split('/').pop());
      console.log('📁 Directory contents:', listData);
    }

    // Also try to check if the full path exists
    const { data: fileInfo, error: fileError } = await supabase.storage
      .from('organization-documents')
      .list('', {
        search: filePath
      });
    
    if (fileError) {
      console.error('❌ File search error:', fileError);
    } else {
      console.log('🔍 File search results:', fileInfo);
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
