import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, purchaseOrders, purchaseOrderLineItems, purchaseOrderDocuments, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
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

    // Get the requesting user and their organization membership
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
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type,
        },
        role: organizationMembers.role
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (userOrgMembership.length === 0) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership[0].organization;

    // Fetch purchase orders from database using Supabase client
    // Users can see POs where they are either:
    // 1. The buyer (their organization created the PO)
    // 2. The supplier (their organization code matches supplier_name)
    const { data: purchaseOrdersData, error: purchaseOrdersError } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        purchase_order_number,
        supplier_name,
        custom_supplier_name,
        purchase_order_date,
        requested_delivery_date,
        status,
        terms,
        incoterms,
        incoterms_location,
        total_value,
        notes,
        organization_id,
        created_by,
        created_at,
        updated_at
      `)
      .or(`organization_id.eq.${userOrganization.id},supplier_name.eq.${userOrganization.code}`)
      .order('created_at', { ascending: false });

    if (purchaseOrdersError) {
      console.error('Database error:', purchaseOrdersError);
      return NextResponse.json([]);
    }

    // Transform data to match frontend interface
    const transformedPurchaseOrders = (purchaseOrdersData || []).map((row: any) => ({
      id: row.id,
      purchaseOrderNumber: row.purchase_order_number,
      supplierName: row.supplier_name,
      customSupplierName: row.custom_supplier_name,
      purchaseOrderDate: row.purchase_order_date,
      requestedDeliveryDate: row.requested_delivery_date,
      status: row.status,
      terms: row.terms,
      incoterms: row.incoterms,
      incotermsLocation: row.incoterms_location,
      totalValue: parseFloat(row.total_value || '0'),
      notes: row.notes,
      organizationId: row.organization_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    console.log(`📋 Fetching purchase orders - returning ${transformedPurchaseOrders.length} purchase orders`);
    console.log(`🔍 User org: ${userOrganization.code} (ID: ${userOrganization.id}) - looking for POs where:`);
    console.log(`   - organization_id = ${userOrganization.id} (buyer) OR`);
    console.log(`   - supplier_name = '${userOrganization.code}' (supplier)`);
    console.log(`🔍 Query: organization_id.eq.${userOrganization.id},supplier_name.eq.${userOrganization.code}`);
    console.log(`🔍 User org ID type:`, typeof userOrganization.id, userOrganization.id);
    console.log(`🔍 User org code type:`, typeof userOrganization.code, userOrganization.code);
    
    if (transformedPurchaseOrders.length > 0) {
      console.log('📦 Found POs:', transformedPurchaseOrders.map(po => `${po.purchaseOrderNumber} (supplier: ${po.supplierName}, org_id: ${po.organizationId || 'N/A'})`));
    } else {
      console.log('❌ No POs found - check if POs exist with correct supplier_name or organization_id');
      console.log('🔍 Raw query result:', purchaseOrdersData);
      console.log('🔍 Expected: supplier_name = "MTN" OR organization_id = "54aa0aeb-eda2-41f6-958d-c37fa89ae86d"');
    }
    return NextResponse.json(transformedPurchaseOrders);

  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Get the requesting user and their organization
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userOrgMembership = await db
      .select({
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type,
        }
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (userOrgMembership.length === 0) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership[0].organization;

    // Parse form data
    const formData = await request.formData();
    
    const purchaseOrderData = {
      purchaseOrderNumber: formData.get('purchaseOrderNumber') as string,
      supplierName: formData.get('supplierName') as string,
      customSupplierName: formData.get('customSupplierName') as string || null,
      purchaseOrderDate: formData.get('purchaseOrderDate') as string,
      requestedDeliveryDate: formData.get('requestedDeliveryDate') as string,
      status: formData.get('status') as string,
      terms: formData.get('terms') as string,
      incoterms: formData.get('incoterms') as string,
      incotermsLocation: formData.get('incotermsLocation') as string || null,
      totalValue: parseFloat(formData.get('totalValue') as string || '0'),
      notes: formData.get('notes') as string || null,
    };

    const lineItemsData = JSON.parse(formData.get('lineItems') as string || '[]');

    console.log('🔄 Creating purchase order:', purchaseOrderData);

    // Validate required fields
    if (!purchaseOrderData.purchaseOrderNumber || !purchaseOrderData.supplierName || !purchaseOrderData.purchaseOrderDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create purchase order in database
    const { data: newPurchaseOrder, error: insertError } = await supabase
      .from('purchase_orders')
      .insert({
        purchase_order_number: purchaseOrderData.purchaseOrderNumber,
        supplier_name: purchaseOrderData.supplierName,
        custom_supplier_name: purchaseOrderData.customSupplierName,
        purchase_order_date: purchaseOrderData.purchaseOrderDate,
        requested_delivery_date: purchaseOrderData.requestedDeliveryDate,
        status: purchaseOrderData.status,
        terms: purchaseOrderData.terms,
        incoterms: purchaseOrderData.incoterms,
        incoterms_location: purchaseOrderData.incotermsLocation,
        total_value: purchaseOrderData.totalValue,
        notes: purchaseOrderData.notes,
        created_by: requestingUser.authId,
        organization_id: userOrganization.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log('✅ Purchase order created in database:', newPurchaseOrder);

    // Insert line items if provided
    if (lineItemsData.length > 0) {
      const lineItems = lineItemsData.map((item: any) => ({
        purchase_order_id: newPurchaseOrder.id,
        sku_id: item.skuId || null,
        sku_code: item.sku || null,
        sku_name: item.skuName || null,
        quantity: parseInt(item.quantity) || 0,
        unit_cost: parseFloat(item.unitCost) || 0,
        total_cost: parseFloat(item.lineTotal) || 0,
      }));

      const { error: lineItemsError } = await supabase
        .from('purchase_order_line_items')
        .insert(lineItems);

      if (lineItemsError) {
        console.error('Line items insert error:', lineItemsError);
        // Don't fail the whole request, just log the error
      } else {
        console.log(`✅ ${lineItems.length} line items created`);
      }
    }

    // Handle file uploads
    const uploadedFiles = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file-') && value && typeof value === 'object' && 'name' in value) {
        try {
          const timestamp = Date.now();
          const fileName = `${timestamp}_${value.name}`;
          const filePath = `${userOrganization.id}/purchase-orders/${newPurchaseOrder.id}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('organization-documents')
            .upload(filePath, value);

          if (uploadError) {
            console.error('File upload error:', uploadError);
            continue;
          }

          // Save document record
          const { error: docError } = await supabase
            .from('purchase_order_documents')
            .insert({
              purchase_order_id: newPurchaseOrder.id,
              file_name: value.name,
              file_path: filePath,
              file_size: value.size,
              content_type: value.type,
              uploaded_by: requestingUser.authId,
            });

          if (docError) {
            console.error('Document record error:', docError);
          } else {
            uploadedFiles.push(value.name);
          }
        } catch (fileError) {
          console.error('File processing error:', fileError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Purchase order created successfully! ${uploadedFiles.length} documents uploaded.`,
      purchaseOrder: newPurchaseOrder,
      uploadedFiles: uploadedFiles.length
    });

  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
  }
}
