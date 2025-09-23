import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for file operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const purchaseOrderId = formData.get('purchaseOrderId') as string;
    
    if (!file || !purchaseOrderId) {
      return NextResponse.json({ error: 'File and purchase order ID are required' }, { status: 400 });
    }

    console.log('📄 Uploading PDF for purchase order:', purchaseOrderId);
    console.log('📁 File name:', file.name);
    console.log('📊 File size:', file.size);

    // Upload to Supabase storage in organization-documents bucket
    const filePath = `purchase-orders/${purchaseOrderId}/${file.name}`;
    
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

    // Generate signed URL for immediate access (180 days)
    const { data: signedUrlData } = await supabase.storage
      .from('organization-documents')
      .createSignedUrl(filePath, 15552000); // 180 days = 180 * 24 * 60 * 60
    
    console.log('✅ Purchase Order PDF uploaded successfully to:', filePath);
    
    // Update purchase order with PDF path
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ 
        pdf_url: filePath,
        updated_at: new Date().toISOString()
      })
      .eq('id', purchaseOrderId);

    if (updateError) {
      console.warn('⚠️ Could not update purchase order with PDF path:', updateError);
    }

    return NextResponse.json({
      success: true,
      filePath: filePath,
      signedUrl: signedUrlData?.signedUrl,
      message: 'Purchase Order PDF uploaded successfully'
    });

  } catch (error) {
    console.error('❌ PDF upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
