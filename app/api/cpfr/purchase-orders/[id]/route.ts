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

    // Update purchase order in database
    const { data: updatedPurchaseOrder, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        supplier_name: body.editSupplierName,
        status: body.editStatus,
        terms: body.editTerms,
        incoterms: body.editIncoterms,
        incoterms_location: body.editIncotermsLocation,
        total_value: body.editTotalValue,
        notes: body.editNotes,
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
