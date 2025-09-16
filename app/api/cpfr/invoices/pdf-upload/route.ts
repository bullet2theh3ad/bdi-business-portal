import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for file uploads (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const invoiceId = formData.get('invoiceId') as string;
    
    if (!file || !invoiceId) {
      return NextResponse.json({ error: 'File and invoice ID are required' }, { status: 400 });
    }

    console.log('📄 Uploading PDF for invoice:', invoiceId);
    console.log('📁 File name:', file.name);
    console.log('📊 File size:', file.size);

    // Upload to Supabase storage in invoice-documents bucket
    const filePath = `invoices/${invoiceId}/${file.name}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('organization-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Return file path instead of signed URL (no expiration)
    console.log('✅ PDF uploaded successfully to:', filePath);
    console.log('🔑 OPTION 3: Returning file path instead of signed URL to prevent token expiration');
    
    return NextResponse.json({
      success: true,
      filePath: filePath, // Store this in database instead of signed URL
      path: filePath,
      fileName: file.name
    });

  } catch (error) {
    console.error('❌ Error in PDF upload:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
