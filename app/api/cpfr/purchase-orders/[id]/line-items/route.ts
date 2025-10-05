import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, purchaseOrders, purchaseOrderLineItems, productSkus, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';

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

    // Get requesting user and their organization (same pattern as other working APIs)
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's organization membership
    const userOrgMembership = await db
      .select({
        user: users,
        organization: organizations
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userAuthId, users.authId))
      .leftJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (userOrgMembership.length === 0) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership[0].organization;
    if (!userOrganization) {
      return NextResponse.json({ error: 'Organization data not found' }, { status: 403 });
    }

    const isBDIUser = userOrganization.code === 'BDI' && userOrganization.type === 'internal';

    console.log(`🔍 Line Items Access Check - User: ${userOrganization.code}, PO ID: ${purchaseOrderId}`);

    // First, verify the user has access to this purchase order
    let purchaseOrderAccess;
    
    if (isBDIUser) {
      // BDI users can access all purchase orders
      purchaseOrderAccess = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, purchaseOrderId))
        .limit(1);
    } else {
      // Partner users can only access POs where they are buyer OR supplier
      purchaseOrderAccess = await db
        .select()
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.id, purchaseOrderId),
            or(
              eq(purchaseOrders.organizationId, userOrganization.id), // User's org is buyer
              eq(purchaseOrders.supplierName, userOrganization.code || '')   // User's org is supplier
            )
          )
        )
        .limit(1);
    }

    if (purchaseOrderAccess.length === 0) {
      console.log(`❌ Access denied - User ${userOrganization.code} cannot access PO ${purchaseOrderId}`);
      return NextResponse.json({ error: 'Access denied to this purchase order' }, { status: 403 });
    }

    console.log(`✅ Access granted - Fetching line items for PO ${purchaseOrderId}`);

    // Use Drizzle ORM to fetch line items (bypasses RLS issues)
    const lineItemsData = await db
      .select({
        id: purchaseOrderLineItems.id,
        skuId: purchaseOrderLineItems.skuId,
        skuCode: purchaseOrderLineItems.skuCode,
        skuName: purchaseOrderLineItems.skuName,
        description: purchaseOrderLineItems.description,
        quantity: purchaseOrderLineItems.quantity,
        unitCost: purchaseOrderLineItems.unitCost,
        totalCost: purchaseOrderLineItems.totalCost,
        // Join with product SKUs for additional details
        productSku: {
          id: productSkus.id,
          sku: productSkus.sku,
          name: productSkus.name
        }
      })
      .from(purchaseOrderLineItems)
      .leftJoin(productSkus, eq(purchaseOrderLineItems.skuId, productSkus.id))
      .where(eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId))
      .orderBy(purchaseOrderLineItems.createdAt);

    console.log(`📦 Found ${lineItemsData.length} line items for PO ${purchaseOrderId}`);

    // Transform data to match frontend interface
    const transformedLineItems = lineItemsData.map((row: any) => ({
      id: row.id,
      skuId: row.skuId,
      skuCode: row.skuCode || row.productSku?.sku || 'UNKNOWN',
      skuName: row.skuName || row.productSku?.name || 'SKU data not found',
      description: row.description,
      quantity: row.quantity,
      unitCost: parseFloat(row.unitCost || '0'),
      totalCost: parseFloat(row.totalCost || '0'),
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
