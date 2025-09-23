import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const purchaseOrderId = formData.get('purchaseOrderId') as string;
    const filePath = formData.get('filePath') as string;

    if (!purchaseOrderId && !filePath) {
      return NextResponse.json({ error: 'Purchase Order ID or file path is required' }, { status: 400 });
    }

    console.log('🔗 Getting signed PDF URL for:', { purchaseOrderId, filePath });

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

    // Generate signed URL for the PDF using provided file path or construct from purchaseOrderId
    const targetFilePath = filePath || `purchase-orders/${purchaseOrderId}/purchase-order-${purchaseOrderId}.pdf`;
    console.log('🔗 Using file path:', targetFilePath);

    const { data, error } = await supabase.storage
      .from('organization-documents')
      .createSignedUrl(targetFilePath, 3600); // 1 hour expiry

    if (error) {
      console.error('❌ Error creating signed URL:', error);
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
    }

    console.log('✅ Generated signed PDF URL:', data.signedUrl);

    return NextResponse.json({ 
      url: data.signedUrl,
      expiresIn: 3600 
    });

  } catch (error) {
    console.error('❌ Error generating PDF URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
