import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, purchaseOrders, purchaseOrderLineItems, productSkus, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
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

    // Fetch line items from database with SKU details
    const { data: lineItemsData, error: lineItemsError } = await supabase
      .from('purchase_order_line_items')
      .select(`
        id,
        sku_id,
        sku_code,
        sku_name,
        description,
        quantity,
        unit_cost,
        total_cost,
        product_skus (
          id,
          sku,
          name
        )
      `)
      .eq('purchase_order_id', purchaseOrderId);

    if (lineItemsError) {
      console.error('Database error:', lineItemsError);
      return NextResponse.json([]);
    }

    // Transform data to match frontend interface
    const transformedLineItems = (lineItemsData || []).map((row: any) => ({
      id: row.id,
      skuId: row.sku_id,
      skuCode: row.sku_code || row.product_skus?.sku || 'UNKNOWN',
      skuName: row.sku_name || row.product_skus?.name || 'SKU data not found',
      description: row.description,
      quantity: row.quantity,
      unitCost: parseFloat(row.unit_cost || '0'),
      totalCost: parseFloat(row.total_cost || '0'),
    }));

    return NextResponse.json(transformedLineItems);

  } catch (error) {
    console.error('Error fetching purchase order line items:', error);
    return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 });
  }
}

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

    console.log('🔄 Updating purchase order line items:', purchaseOrderId, body);

    // Delete existing line items
    const { error: deleteError } = await supabase
      .from('purchase_order_line_items')
      .delete()
      .eq('purchase_order_id', purchaseOrderId);

    if (deleteError) {
      console.error('Error deleting existing line items:', deleteError);
      throw deleteError;
    }

    // Insert new line items
    if (body.lineItems && body.lineItems.length > 0) {
      const lineItems = body.lineItems.map((item: any) => ({
        purchase_order_id: purchaseOrderId,
        sku_id: item.skuId || null,
        sku_code: item.sku || item.skuCode || null,
        sku_name: item.skuName || null,
        quantity: parseInt(item.quantity) || 0,
        unit_cost: parseFloat(item.unitCost) || 0,
        total_cost: parseFloat(item.lineTotal) || 0,
      }));

      const { error: insertError } = await supabase
        .from('purchase_order_line_items')
        .insert(lineItems);

      if (insertError) {
        console.error('Error inserting line items:', insertError);
        throw insertError;
      }

      console.log(`✅ ${lineItems.length} line items updated`);
    }

    return NextResponse.json({
      success: true,
      message: 'Line items updated successfully'
    });

  } catch (error) {
    console.error('Error updating purchase order line items:', error);
    return NextResponse.json({ error: 'Failed to update line items' }, { status: 500 });
  }
}
