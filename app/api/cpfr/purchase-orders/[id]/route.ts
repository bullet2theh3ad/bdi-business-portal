import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, purchaseOrders, purchaseOrderLineItems, purchaseOrderDocuments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    const purchaseOrderId = params.id;
    const body = await request.json();

    console.log('🔄 Updating purchase order:', purchaseOrderId, body);

    // First get current PO data to use as defaults
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', purchaseOrderId)
      .single();

    if (fetchError || !currentPO) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // Update purchase order in database with proper defaults
    const { data: updatedPurchaseOrder, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        supplier_name: body.editSupplierName || currentPO.supplier_name,
        status: body.editStatus || currentPO.status,
        terms: body.editTerms || currentPO.terms,
        incoterms: body.editIncoterms || currentPO.incoterms || 'FOB',
        incoterms_location: body.editIncotermsLocation || currentPO.incoterms_location || '',
        total_value: body.editTotalValue || currentPO.total_value,
        notes: body.editNotes || currentPO.notes || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', purchaseOrderId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Purchase order updated:', updatedPurchaseOrder);

    return NextResponse.json({
      success: true,
      message: 'Purchase order updated successfully!',
      purchaseOrder: updatedPurchaseOrder
    });

  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    const purchaseOrderId = params.id;

    console.log('🗑️ Deleting purchase order:', purchaseOrderId);

    // Delete purchase order (cascade will handle line items and documents)
    const { error: deleteError } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', purchaseOrderId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      throw deleteError;
    }

    console.log('✅ Purchase order deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Purchase order deleted successfully!'
    });

  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 });
  }
}
