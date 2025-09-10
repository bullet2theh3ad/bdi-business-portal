import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Authentication
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

    // Get user info
    const [dbUser] = await db
      .select({
        id: users.id,
        authId: users.authId,
        role: users.role,
        name: users.name,
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type,
          name: organizations.name
        }
      })
      .from(users)
      .leftJoin(organizationMembers, eq(organizationMembers.userAuthId, users.authId))
      .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only allow super_admin access for now
    if (dbUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { question, context, chatHistory } = await request.json();

    console.log('🤖 Ask BDI Request:', { question, context });

    // Gather business data context
    const businessData = await gatherBusinessContext(supabase, context);

    // Create comprehensive business analyst prompt
    const systemPrompt = `You are BDI's Senior Business Intelligence Assistant and Supply Chain Expert. You have complete access to BDI's business data and provide world-class analysis.

🏢 ABOUT BDI (Boundless Devices Inc):
- B2B technology company specializing in CPFR (Collaborative Planning, Forecasting, and Replenishment)
- Supply chain management platform for telecom/networking equipment
- Partners: Manufacturers (MTN=Vietnam Factory, CBN=Compal), Shipping (OLM=Logistics), Distributors
- Products: Motorola networking equipment (routers, modems, hotspots)

📊 YOUR EXPERTISE & CAPABILITIES:
- Supply Chain Analytics: Forecast accuracy, lead time optimization, capacity planning
- Financial Analysis: Invoice trends, cost optimization, margin analysis, payment terms
- Operational Excellence: Shipment performance, warehouse utilization, inventory turnover
- CPFR Optimization: Signal analysis, collaboration effectiveness, demand planning
- Risk Management: Supply chain resilience, bottleneck identification, contingency planning
- Performance KPIs: OTD (On-Time Delivery), forecast accuracy, inventory turns, cost per unit
- Manufacturer Analysis: SKU breakdown by manufacturer (MTN, CBN, etc.), performance by supplier
- Product Portfolio: Category analysis, lifecycle management, discontinuation planning
- Inventory Management: Real-time warehouse inventory levels (EMG), stock allocation, backorder analysis
- Warehouse Analytics: Inventory trends, stock movement, location analysis, upload tracking

🎯 YOUR ANALYSIS APPROACH:
1. **Data-Driven**: Always cite specific numbers and trends from the provided data
2. **Actionable Insights**: Provide concrete recommendations, not just observations
3. **Context Aware**: Consider seasonality, market conditions, and business cycles
4. **Comparative Analysis**: Benchmark against industry standards when relevant
5. **Risk Assessment**: Identify potential issues and mitigation strategies

💼 COMMUNICATION STYLE:
- Lead with the key insight or answer
- Support with specific data points and percentages
- Include trend analysis (improving/declining/stable)
- Provide 2-3 actionable recommendations
- Use business terminology appropriately
- Format numbers clearly (e.g., "$2.6M", "24,544 units", "87% accuracy")

📈 COMPREHENSIVE BUSINESS DATA AVAILABLE:
${JSON.stringify(businessData, null, 2)}

🔍 ANALYSIS GUIDELINES:
- Reference specific SKUs, organizations, and timeframes
- Calculate ratios and percentages for meaningful insights
- Identify patterns, outliers, and opportunities
- Consider supply chain interdependencies
- Suggest process improvements based on data patterns

Answer questions with the depth and insight of a senior McKinsey consultant specializing in supply chain and technology businesses.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      // Include recent chat history for context
      ...chatHistory.slice(-6).map((msg: any) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: question }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const answer = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    console.log('🤖 Ask BDI Response generated successfully');

    return NextResponse.json({ 
      answer,
      context: businessData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ask BDI error:', error);
    return NextResponse.json({ 
      error: 'Failed to process question',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Enhanced business context gathering with comprehensive database access
async function gatherBusinessContext(supabase: any, requestContext: any) {
  try {
    console.log('📊 Gathering comprehensive business context...');

    // Create service client for full database access
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Comprehensive data gathering including inventory tracking
    const [
      forecastsResult,
      shipmentsResult, 
      invoicesResult,
      skusResult,
      organizationsResult,
      warehousesResult,
      purchaseOrdersResult,
      invoiceLineItemsResult,
      emgInventoryResult,
      emgInventoryHistoryResult
    ] = await Promise.all([
      // Forecasts with full details
      serviceSupabase.from('sales_forecasts').select(`
        id, sku_id, quantity, status, delivery_week, confidence, 
        sales_signal, factory_signal, shipping_signal, 
        created_at, created_by
      `),
      
      // Shipments with organization details
      serviceSupabase.from('shipments').select(`
        id, status, organization_id, shipper_organization_id, 
        destination_warehouse_id, priority, shipping_method,
        estimated_departure, estimated_arrival, created_at
      `),
      
      // Invoices with line items
      serviceSupabase.from('invoices').select(`
        id, customer_name, total_value, status, invoice_date,
        requested_delivery_week, terms, created_at
      `),
      
      // All SKUs with manufacturer details
      serviceSupabase.from('product_skus').select(`
        id, sku, name, description, category, subcategory,
        mfg, moq, lead_time_days, unit_cost, box_weight_kg, 
        is_active, is_discontinued, hts_code, created_at
      `),
      
      // Organizations
      serviceSupabase.from('organizations').select(`
        id, name, code, type, contact_email, contact_phone,
        address, is_active, created_at
      `),
      
      // Warehouses
      serviceSupabase.from('warehouses').select(`
        id, name, warehouse_code, type, city, country,
        capabilities, storage_capacity_sqm, organization_id, is_active
      `),
      
      // Purchase Orders
      serviceSupabase.from('purchase_orders').select(`
        id, po_number, supplier_name, total_value, status,
        delivery_date, created_at
      `),
      
      // Invoice Line Items for SKU analysis
      serviceSupabase.from('invoice_line_items').select(`
        id, invoice_id, sku_id, quantity, unit_price, total_price
      `),
      
      // EMG Inventory Tracking - Current levels
      serviceSupabase.from('emg_inventory_tracking').select(`
        id, location, upc, model, description,
        qty_on_hand, qty_allocated, qty_backorder, net_stock,
        source_file_name, upload_date, last_updated
      `),
      
      // EMG Inventory History - Changes over time
      serviceSupabase.from('emg_inventory_history').select(`
        id, upc, model, location, qty_on_hand, qty_change, change_type,
        snapshot_date, source_file_name
      `).order('snapshot_date', { ascending: false }).limit(100)
    ]);

    // Calculate comprehensive business metrics
    const businessData = {
      summary: {
        totalForecasts: forecastsResult.data?.length || 0,
        totalShipments: shipmentsResult.data?.length || 0,
        totalInvoices: invoicesResult.data?.length || 0,
        totalSKUs: skusResult.data?.length || 0,
        totalOrganizations: organizationsResult.data?.length || 0,
        totalWarehouses: warehousesResult.data?.length || 0,
        totalPurchaseOrders: purchaseOrdersResult.data?.length || 0,
        dateRange: requestContext.dateRange,
        currentPage: requestContext.currentPage
      },
      
      forecasts: {
        total: forecastsResult.data?.length || 0,
        byStatus: groupBy(forecastsResult.data || [], 'status'),
        byWeek: groupBy(forecastsResult.data || [], 'delivery_week'),
        bySignal: {
          sales: groupBy(forecastsResult.data || [], 'sales_signal'),
          factory: groupBy(forecastsResult.data || [], 'factory_signal'),
          shipping: groupBy(forecastsResult.data || [], 'shipping_signal')
        },
        totalQuantity: (forecastsResult.data || []).reduce((sum: number, f: any) => sum + (f.quantity || 0), 0),
        avgQuantity: forecastsResult.data?.length ? 
          (forecastsResult.data.reduce((sum: number, f: any) => sum + (f.quantity || 0), 0) / forecastsResult.data.length).toFixed(0) : 0
      },
      
      shipments: {
        total: shipmentsResult.data?.length || 0,
        byStatus: groupBy(shipmentsResult.data || [], 'status'),
        byOrganization: groupBy(shipmentsResult.data || [], 'organization_id'),
        byShipper: groupBy(shipmentsResult.data || [], 'shipper_organization_id'),
        byMethod: groupBy(shipmentsResult.data || [], 'shipping_method'),
        byPriority: groupBy(shipmentsResult.data || [], 'priority')
      },
      
      invoices: {
        total: invoicesResult.data?.length || 0,
        byCustomer: groupBy(invoicesResult.data || [], 'customer_name'),
        byStatus: groupBy(invoicesResult.data || [], 'status'),
        totalValue: (invoicesResult.data || []).reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_value) || 0), 0),
        avgValue: invoicesResult.data?.length ? 
          ((invoicesResult.data.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_value) || 0), 0)) / invoicesResult.data.length).toFixed(2) : 0
      },
      
      skus: {
        total: skusResult.data?.length || 0,
        byCategory: groupBy(skusResult.data || [], 'category'),
        bySubcategory: groupBy(skusResult.data || [], 'subcategory'),
        byManufacturer: groupBy(skusResult.data || [], 'mfg'), // KEY: Breakdown by manufacturer
        active: (skusResult.data || []).filter((sku: any) => sku.is_active).length,
        discontinued: (skusResult.data || []).filter((sku: any) => sku.is_discontinued).length,
        withMOQ: (skusResult.data || []).filter((sku: any) => sku.moq && sku.moq > 0).length,
        avgLeadTime: skusResult.data?.length ?
          (skusResult.data.reduce((sum: number, sku: any) => sum + (sku.lead_time_days || 0), 0) / skusResult.data.length).toFixed(1) : 0,
        // Detailed manufacturer analysis
        manufacturerDetails: (skusResult.data || []).reduce((mfgData: any, sku: any) => {
          const mfg = sku.mfg || 'unknown';
          if (!mfgData[mfg]) {
            mfgData[mfg] = { count: 0, active: 0, discontinued: 0, categories: {} };
          }
          mfgData[mfg].count++;
          if (sku.is_active) mfgData[mfg].active++;
          if (sku.is_discontinued) mfgData[mfg].discontinued++;
          const category = sku.category || 'uncategorized';
          mfgData[mfg].categories[category] = (mfgData[mfg].categories[category] || 0) + 1;
          return mfgData;
        }, {})
      },
      
      organizations: {
        total: organizationsResult.data?.length || 0,
        byType: groupBy(organizationsResult.data || [], 'type'),
        active: (organizationsResult.data || []).filter((org: any) => org.is_active).length
      },
      
      warehouses: {
        total: warehousesResult.data?.length || 0,
        byType: groupBy(warehousesResult.data || [], 'type'),
        byCountry: groupBy(warehousesResult.data || [], 'country'),
        totalCapacity: (warehousesResult.data || []).reduce((sum: number, w: any) => sum + (w.storage_capacity_sqm || 0), 0)
      },
      
      purchaseOrders: {
        total: purchaseOrdersResult.data?.length || 0,
        bySupplier: groupBy(purchaseOrdersResult.data || [], 'supplier_name'),
        byStatus: groupBy(purchaseOrdersResult.data || [], 'status'),
        totalValue: (purchaseOrdersResult.data || []).reduce((sum: number, po: any) => sum + (parseFloat(po.total_value) || 0), 0)
      },
      
      // EMG Inventory Analysis
      emgInventory: {
        totalItems: emgInventoryResult.data?.length || 0,
        totalUnitsOnHand: (emgInventoryResult.data || []).reduce((sum: number, item: any) => sum + (item.qty_on_hand || 0), 0),
        totalUnitsAllocated: (emgInventoryResult.data || []).reduce((sum: number, item: any) => sum + (item.qty_allocated || 0), 0),
        totalUnitsBackorder: (emgInventoryResult.data || []).reduce((sum: number, item: any) => sum + (item.qty_backorder || 0), 0),
        totalNetStock: (emgInventoryResult.data || []).reduce((sum: number, item: any) => sum + (item.net_stock || 0), 0),
        byLocation: groupBy(emgInventoryResult.data || [], 'location'),
        lastUploadDate: emgInventoryResult.data?.length ? 
          Math.max(...(emgInventoryResult.data.map((item: any) => new Date(item.upload_date || item.last_updated).getTime()))) : null,
        topItems: (emgInventoryResult.data || [])
          .sort((a: any, b: any) => (b.qty_on_hand || 0) - (a.qty_on_hand || 0))
          .slice(0, 10)
          .map((item: any) => ({
            model: item.model,
            description: item.description,
            location: item.location,
            qtyOnHand: item.qty_on_hand,
            netStock: item.net_stock
          })),
        inventoryTrends: {
          totalSnapshots: emgInventoryHistoryResult.data?.length || 0,
          recentChanges: (emgInventoryHistoryResult.data || []).slice(0, 20),
          lastSnapshotDate: emgInventoryHistoryResult.data?.length ? 
            emgInventoryHistoryResult.data[0]?.snapshot_date : null
        }
      },
      
      // Raw data for complex analysis (limited for performance)
      rawData: {
        recentForecasts: forecastsResult.data?.slice(0, 10) || [],
        recentShipments: shipmentsResult.data?.slice(0, 10) || [],
        recentInvoices: invoicesResult.data?.slice(0, 10) || [],
        topSKUs: skusResult.data?.slice(0, 20) || [],
        organizations: organizationsResult.data || [],
        warehouses: warehousesResult.data || []
      }
    };

    console.log('📊 Comprehensive business context gathered:', {
      forecasts: businessData.forecasts.total,
      shipments: businessData.shipments.total,
      invoices: businessData.invoices.total,
      skus: businessData.skus.total,
      organizations: businessData.organizations.total,
      emgInventoryItems: businessData.emgInventory.totalItems,
      emgUnitsOnHand: businessData.emgInventory.totalUnitsOnHand
    });

    return businessData;

  } catch (error) {
    console.error('Error gathering business context:', error);
    return {
      summary: { error: 'Unable to gather complete business context' },
      note: 'Some data may be unavailable'
    };
  }
}

// Helper function to group data by a field
function groupBy(array: any[], key: string) {
  return array.reduce((groups: any, item: any) => {
    const value = item[key] || 'unknown';
    groups[value] = (groups[value] || 0) + 1;
    return groups;
  }, {});
}

