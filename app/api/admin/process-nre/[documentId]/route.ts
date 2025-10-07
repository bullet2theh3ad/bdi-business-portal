import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseCLient';
import { processDocument, formatForDatabase } from '@/lib/services/document-processor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const serviceSupabase = supabaseAdmin;

    // Get the document metadata
    const { data: ragDoc, error: docError } = await serviceSupabase
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !ragDoc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    console.log(`🔍 Processing existing NRE document: ${ragDoc.file_name}`);

    // Download the file from Supabase storage
    const { data: fileData, error: downloadError } = await serviceSupabase
      .storage
      .from('rag-documents')
      .download(ragDoc.file_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return NextResponse.json(
        { success: false, error: 'Failed to download file from storage' },
        { status: 500 }
      );
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text and line items
    const extracted = await processDocument(buffer, ragDoc.file_type || 'application/pdf');
    console.log(`✅ Extracted ${extracted.lineItems.length} line items`);

    // Check if line items already exist
    const { data: existingItems } = await serviceSupabase
      .from('nre_line_items')
      .select('*')
      .eq('document_id', documentId);

    let lineItems = existingItems || [];

    // If no existing items, insert new ones
    if (!existingItems || existingItems.length === 0) {
      const lineItemsData = formatForDatabase(extracted, documentId, ragDoc.created_by);

      if (lineItemsData.length > 0) {
        const { data: insertedItems, error: insertError } = await serviceSupabase
          .from('nre_line_items')
          .insert(lineItemsData)
          .select();

        if (insertError) {
          console.error('Insert error:', insertError);
        } else {
          lineItems = insertedItems;
          console.log(`✅ Inserted ${insertedItems.length} new line items`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      lineItems,
      documentInfo: {
        id: ragDoc.id,
        fileName: ragDoc.file_name,
        filePath: ragDoc.file_path,
      }
    });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
