import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { schemaPromptBuilder } from '@/lib/ai/schema-aware-prompt';
import { supabaseFileRAG } from '@/lib/ai/supabase-file-rag';

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

    const { question, queryScope = 'all', context, chatHistory } = await request.json();

    console.log('🤖 Ask BDI Request:', { question, queryScope, context });
    
    // For long-running queries, we should implement streaming or progress updates
    // TODO: Add Server-Sent Events (SSE) for real-time progress updates

    // Gather business data context with scope-aware limits
    const businessData = await gatherBusinessContext(supabase, context, queryScope);

    console.log(`🧠 Using ${queryScope.toUpperCase()} analysis - optimized for ${queryScope} sources`);
    
    // Build schema-aware prompt with CPFR expertise
    const schemaAwarePrompt = await schemaPromptBuilder.buildUltimatePrompt();
    
    // Enhanced system prompt for financial analyst + CPFR expert (scope-aware)
    const baseSystemPrompt = schemaAwarePrompt + `

🎯 YOU ARE A SENIOR FINANCIAL ANALYST & CPFR EXPERT WITH COMPREHENSIVE BUSINESS INTELLIGENCE:

📊 STRUCTURED FINANCIAL DATA ACCESS:
Below is clean, legible JSON formatted for expert financial analysis:

${JSON.stringify(businessData, null, 2)}

📄 DOCUMENT INTELLIGENCE: You have access to all business documents including:
- Proforma Invoices (PIs) with pricing, quantities, technical specs
- Purchase Orders with supplier details and delivery terms  
- Production Files with manufacturing specifications
- Shipment Reports with logistics and delivery data
- Warehouse Documents with inventory levels

🔗 CRITICAL INTEGRATION MANDATE:
- ALWAYS cross-reference document data with database records
- Look for SKU/model overlaps between files and CPFR signals
- Connect PI amounts with forecast values and shipment data
- Identify discrepancies between documents and database entries
- Provide unified analysis that combines both data sources

📈 CPFR ANALYSIS EXPERTISE:
- Sales signals: Demand forecasts and customer orders
- Factory signals: Production capacity and manufacturing schedules  
- Shipping signals: Logistics coordination and delivery timing
- Transit signals: In-transit inventory and warehouse signals
- Warehouse signals: Stock levels, allocation, and distribution

💼 EXPERT FINANCIAL ANALYSIS MANDATE:
- Perform deep financial analysis using the 3-layer structured data provided
- Calculate total values, margins, cost breakdowns with precision
- Analyze purchase order line items with SKU-level detail
- Cross-reference quantities, unit costs, and total costs for accuracy
- Provide executive-level financial insights with specific numbers
- Use actual data values from the structured JSON, not generic estimates
- Cash flow implications of payment terms
- Inventory valuation and turnover analysis
- Supplier relationship and pricing trends
- Risk assessment across supply chain

🎯 SESSION CONTEXT:
- User: ${dbUser.name} (${dbUser.role})
- Organization: ${dbUser.organization?.name} (${dbUser.organization?.code})
- Current Page: ${context.currentPage}
- Timestamp: ${context.timestamp}

MANDATORY: When analyzing queries, use the specified data sources based on user optimization choice.`;

    // CONDITIONAL ANALYSIS based on user's queryScope selection (Fast vs UNLIMITED)
    let answer: string;
    
    if (queryScope === 'database_fast' || queryScope === 'database_full') {
      // DATABASE ONLY - Fast response using just business data
      console.log('📊 Using DATABASE-ONLY analysis - fast response');
      const dbOnlyPrompt = baseSystemPrompt + `
      
🎯 DATABASE-ONLY ANALYSIS MODE:
Focus exclusively on the provided database records. Provide fast, accurate responses based on:
- Invoices, Purchase Orders, SKUs, Shipments data
- CPFR signals and business relationships
- No document analysis required for speed optimization`;

      // DEBUG: Show FULL prompt and response for debugging
      console.log('🔍 DEBUG: FULL SYSTEM PROMPT BEING SENT TO AI:');
      console.log('=' .repeat(100));
      console.log(dbOnlyPrompt);
      console.log('=' .repeat(100));
      console.log('🔍 DEBUG: USER QUESTION:', question);
      console.log('=' .repeat(100));
      
      // Direct OpenAI call for database-only analysis (fast)
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: dbOnlyPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 4000,
        temperature: 0.1
      });
      answer = response.choices[0]?.message?.content || 'No response generated';
      
      // DEBUG: Show RAW AI response
      console.log('🤖 DEBUG: RAW AI RESPONSE:');
      console.log('=' .repeat(100));
      console.log(answer);
      console.log('=' .repeat(100));
      
    } else if (queryScope === 'rag_fast' || queryScope === 'rag_full') {
      // RAG DOCUMENTS ONLY - May take time for comprehensive document analysis
      console.log('📁 Using RAG-ONLY analysis - comprehensive document intelligence');
      const ragOnlyPrompt = baseSystemPrompt + `
      
🎯 RAG DOCUMENTS-ONLY ANALYSIS MODE:
Focus exclusively on document content and file analysis. Provide comprehensive insights from:
- Financial models, reports, and business documents
- Technical specifications and production files
- Contract terms and supplier agreements
- No database records analysis for focused document intelligence`;

      // Pass unlimited flag to file analysis
      const isRagUnlimited = queryScope === 'rag_full';
      answer = await supabaseFileRAG.analyzeWithFiles(question, {}, ragOnlyPrompt, isRagUnlimited); // Pass unlimited flag
      
    } else {
      // ALL SOURCES - Comprehensive but may take time
      console.log('🔄 Using COMPREHENSIVE analysis - database + files for complete intelligence');
      const comprehensivePrompt = baseSystemPrompt + `
      
🎯 COMPREHENSIVE ANALYSIS MODE:
Analyze BOTH database records AND document content. Provide unified business intelligence that bridges both data sources.
Look for connections, correlations, and discrepancies between database and documents.`;

      answer = await supabaseFileRAG.analyzeWithFiles(question, businessData, comprehensivePrompt);
    }

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
async function gatherBusinessContext(supabase: any, requestContext: any, queryScope: string = 'all_unlimited') {
  try {
    console.log(`📊 Gathering ${queryScope.includes('full') || queryScope.includes('unlimited') ? 'UNLIMITED' : 'LIMITED'} business context...`);

    // Determine if this is an unlimited query (NO LIMITS)
    const isUnlimited = queryScope.includes('full') || queryScope.includes('unlimited');
    
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
      emgInventoryHistoryResult,
      // ENHANCED: Additional tables for comprehensive business intelligence
      activityLogsResult,
      apiKeysResult,
      catvInventoryResult,
      jjolmTrackingResult,
      productionFilesResult,
      organizationConnectionsResult,
      organizationDocumentsResult,
      ragDocumentsResult,
      shipmentDocumentsResult,
      shipmentTrackingResult,
      purchaseOrderDocumentsResult,
      invoiceDocumentsResult
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
      
      // Purchase Orders - FIXED FIELD NAMES
      serviceSupabase.from('purchase_orders').select(`
        id, purchase_order_number, supplier_name, total_value, status,
        purchase_order_date, requested_delivery_date, organization_id, created_at
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
      isUnlimited 
        ? serviceSupabase.from('emg_inventory_history').select(`
            id, upc, model, location, qty_on_hand, qty_change, change_type,
            snapshot_date, source_file_name
          `).order('snapshot_date', { ascending: false }) // NO LIMIT for unlimited mode
        : serviceSupabase.from('emg_inventory_history').select(`
            id, upc, model, location, qty_on_hand, qty_change, change_type,
            snapshot_date, source_file_name
          `).order('snapshot_date', { ascending: false }).limit(100),
      
      // ENHANCED: Additional tables for comprehensive business intelligence
      
      // Activity Logs - User activity tracking
      isUnlimited
        ? serviceSupabase.from('activity_logs').select(`
            id, team_id, user_id, action, timestamp, ip_address, organization_id
          `).order('timestamp', { ascending: false }) // NO LIMIT
        : serviceSupabase.from('activity_logs').select(`
            id, team_id, user_id, action, timestamp, ip_address, organization_id
          `).order('timestamp', { ascending: false }).limit(50),
      
      // API Keys - Access management
      serviceSupabase.from('api_keys').select(`
        id, user_auth_id, organization_uuid, key_name, permissions,
        rate_limit_per_hour, last_used_at, is_active, created_at
      `),
      
      // CATV Inventory Tracking - CATV warehouse data
      isUnlimited
        ? serviceSupabase.from('catv_inventory_tracking').select(`
            id, sku, week_data, raw_data, metrics, created_at, updated_at
          `).order('created_at', { ascending: false }) // NO LIMIT
        : serviceSupabase.from('catv_inventory_tracking').select(`
            id, sku, week_data, raw_data, metrics, created_at, updated_at
          `).order('created_at', { ascending: false }).limit(10),
      
      // JJOLM Tracking - Shipment tracking numbers
      serviceSupabase.from('jjolm_tracking').select(`
        id, jjolm_number, container_number, vessel_name, departure_port,
        arrival_port, estimated_departure, estimated_arrival, status, created_at
      `),
      
      // Production Files - Manufacturing data
      serviceSupabase.from('production_files').select(`
        id, organization_id, file_name, file_type, file_size, upload_date,
        processed_data, status, created_by, created_at
      `).order('created_at', { ascending: false }).limit(20),
      
      // Organization Connections - Business relationships
      serviceSupabase.from('organization_connections').select(`
        id, organization_a_id, organization_b_id, connection_type,
        status, established_date, notes, created_at
      `),
      
      // Organization Documents - Document tracking
      serviceSupabase.from('organization_documents').select(`
        id, organization_id, document_name, document_type, file_path,
        file_size, upload_date, created_by, created_at
      `).order('created_at', { ascending: false }).limit(30),
      
      // RAG Documents - Document intelligence
      serviceSupabase.from('rag_documents').select(`
        id, company, file_name, file_path, file_size, tags,
        upload_date, created_by, created_at
      `).order('created_at', { ascending: false }).limit(20),
      
      // Shipment Documents - Logistics documentation
      serviceSupabase.from('shipment_documents').select(`
        id, shipment_id, document_name, document_type, file_path,
        file_size, upload_date, created_by, created_at
      `).order('created_at', { ascending: false }).limit(20),
      
      // Shipment Tracking - Logistics intelligence
      serviceSupabase.from('shipment_tracking').select(`
        id, shipment_id, tracking_number, carrier, status,
        location, timestamp, notes, created_at
      `).order('timestamp', { ascending: false }).limit(50),
      
      // Purchase Order Documents - PO documentation
      serviceSupabase.from('purchase_order_documents').select(`
        id, purchase_order_id, document_name, document_type, file_path,
        file_size, upload_date, created_by, created_at
      `).order('created_at', { ascending: false }).limit(20),
      
      // Invoice Documents - Invoice documentation
      serviceSupabase.from('invoice_documents').select(`
        id, invoice_id, document_name, document_type, file_path,
        file_size, upload_date, created_by, created_at
      `).order('created_at', { ascending: false }).limit(20)
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
        totalValue: (purchaseOrdersResult.data || []).reduce((sum: number, po: any) => sum + (parseFloat(po.total_value) || 0), 0),
        // DEEP 3-LAYER ANALYSIS: Include detailed PO records for financial analysis
        detailedRecords: await Promise.all((purchaseOrdersResult.data || []).map(async (po: any) => {
          // Layer 1: PO Details
          const poDetails = {
            id: po.id,
            poNumber: po.purchase_order_number,
            supplier: po.supplier_name,
            totalValue: parseFloat(po.total_value) || 0,
            status: po.status,
            orderDate: po.purchase_order_date,
            deliveryDate: po.requested_delivery_date,
            terms: po.terms,
            incoterms: po.incoterms
          };
          
          // Layer 2: PO Line Items with SKU breakdown
          const lineItemsResult = await serviceSupabase
            .from('purchase_order_line_items')
            .select('sku_id, sku_code, sku_name, quantity, unit_cost, total_cost')
            .eq('purchase_order_id', po.id);
          
          // Layer 3: SKU specifications for each line item
          const lineItemsWithSKUDetails = await Promise.all((lineItemsResult.data || []).map(async (item: any) => {
            const skuDetails = await serviceSupabase
              .from('product_skus')
              .select('sku, name, category, subcategory, mfg, moq, lead_time_days, box_weight_kg, carton_weight_kg')
              .eq('id', item.sku_id)
              .single();
            
            return {
              skuId: item.sku_id,
              skuCode: item.sku_code,
              skuName: item.sku_name,
              quantity: item.quantity,
              unitCost: parseFloat(item.unit_cost) || 0,
              totalCost: parseFloat(item.total_cost) || 0,
              skuDetails: skuDetails.data || null
            };
          }));
          
          return {
            ...poDetails,
            lineItems: lineItemsWithSKUDetails,
            lineItemsCount: lineItemsWithSKUDetails.length,
            totalLineValue: lineItemsWithSKUDetails.reduce((sum, item) => sum + item.totalCost, 0)
          };
        }))
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
      
      // ENHANCED: Additional business intelligence data
      activityLogs: {
        total: activityLogsResult.data?.length || 0,
        recentActivity: activityLogsResult.data?.slice(0, 20) || [],
        byAction: groupBy(activityLogsResult.data || [], 'action'),
        byOrganization: groupBy(activityLogsResult.data || [], 'organization_id')
      },
      
      apiKeys: {
        total: apiKeysResult.data?.length || 0,
        active: (apiKeysResult.data || []).filter((key: any) => key.is_active).length,
        byOrganization: groupBy(apiKeysResult.data || [], 'organization_uuid'),
        recentUsage: (apiKeysResult.data || []).filter((key: any) => key.last_used_at).slice(0, 10)
      },
      
      catvInventory: {
        total: catvInventoryResult.data?.length || 0,
        latestData: catvInventoryResult.data?.slice(0, 5) || [],
        byWeek: groupBy(catvInventoryResult.data || [], 'week_data')
      },
      
      jjolmTracking: {
        total: jjolmTrackingResult.data?.length || 0,
        activeShipments: (jjolmTrackingResult.data || []).filter((jjolm: any) => jjolm.status !== 'delivered'),
        byStatus: groupBy(jjolmTrackingResult.data || [], 'status'),
        recentShipments: jjolmTrackingResult.data?.slice(0, 10) || []
      },
      
      productionFiles: {
        total: productionFilesResult.data?.length || 0,
        byOrganization: groupBy(productionFilesResult.data || [], 'organization_id'),
        byFileType: groupBy(productionFilesResult.data || [], 'file_type'),
        byStatus: groupBy(productionFilesResult.data || [], 'status'),
        recentFiles: productionFilesResult.data?.slice(0, 10) || []
      },
      
      organizationConnections: {
        total: organizationConnectionsResult.data?.length || 0,
        byType: groupBy(organizationConnectionsResult.data || [], 'connection_type'),
        byStatus: groupBy(organizationConnectionsResult.data || [], 'status'),
        activeConnections: (organizationConnectionsResult.data || []).filter((conn: any) => conn.status === 'active')
      },
      
      documentIntelligence: {
        organizationDocs: {
          total: organizationDocumentsResult.data?.length || 0,
          byType: groupBy(organizationDocumentsResult.data || [], 'document_type'),
          byOrganization: groupBy(organizationDocumentsResult.data || [], 'organization_id'),
          recent: organizationDocumentsResult.data?.slice(0, 15) || []
        },
        ragDocs: {
          total: ragDocumentsResult.data?.length || 0,
          byCompany: groupBy(ragDocumentsResult.data || [], 'company'),
          withTags: (ragDocumentsResult.data || []).filter((doc: any) => doc.tags && doc.tags.length > 0),
          recent: ragDocumentsResult.data?.slice(0, 10) || []
        },
        shipmentDocs: {
          total: shipmentDocumentsResult.data?.length || 0,
          byType: groupBy(shipmentDocumentsResult.data || [], 'document_type'),
          recent: shipmentDocumentsResult.data?.slice(0, 10) || []
        },
        purchaseOrderDocs: {
          total: purchaseOrderDocumentsResult.data?.length || 0,
          byType: groupBy(purchaseOrderDocumentsResult.data || [], 'document_type'),
          recent: purchaseOrderDocumentsResult.data?.slice(0, 10) || []
        },
        invoiceDocs: {
          total: invoiceDocumentsResult.data?.length || 0,
          byType: groupBy(invoiceDocumentsResult.data || [], 'document_type'),
          recent: invoiceDocumentsResult.data?.slice(0, 10) || []
        }
      },
      
      shipmentTracking: {
        total: shipmentTrackingResult.data?.length || 0,
        byCarrier: groupBy(shipmentTrackingResult.data || [], 'carrier'),
        byStatus: groupBy(shipmentTrackingResult.data || [], 'status'),
        recentTracking: shipmentTrackingResult.data?.slice(0, 20) || []
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

// Helper function to determine if query needs file analysis
function requiresFileAnalysis(question: string): boolean {
  const fileKeywords = [
    'document', 'file', 'pdf', 'excel', 'csv', 'report', 'upload', 'attachment',
    'invoice document', 'production file', 'shipment document', 'warehouse document',
    'jjolm', 'manifest', 'certificate', 'specification', 'datasheet', 'inventory report',
    // Add folder-specific keywords
    'folder', 'purchase-orders', 'invoices', 'shipments', 'warehouses', 'production-files',
    'supabase', 'storage', 'bucket', 'files in', 'documents in', 'what files',
    // RAG-specific keywords
    'rag', 'rag-documents', 'rag directory', 'directory', 'contents', 'uploaded files',
    'financial model', 'boundless financial'
  ];
  
  const questionLower = question.toLowerCase();
  return fileKeywords.some(keyword => questionLower.includes(keyword));
}

