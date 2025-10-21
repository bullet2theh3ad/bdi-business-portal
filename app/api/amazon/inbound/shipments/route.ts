import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';

/**
 * GET /api/amazon/inbound/shipments
 * Get inbound shipments (inventory in transit to Amazon FBA)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const statusList = searchParams.get('status')?.split(',') || ['WORKING', 'SHIPPED', 'IN_TRANSIT', 'RECEIVING'];
    const lastUpdatedAfter = searchParams.get('lastUpdatedAfter') || undefined;
    const lastUpdatedBefore = searchParams.get('lastUpdatedBefore') || undefined;

    console.log('[Inbound API] Fetching inbound shipments...');
    console.log('[Inbound API] Status filter:', statusList);

    // Initialize Amazon SP-API client
    const credentials = getAmazonCredentials();
    const amazonService = new AmazonSPAPIService(credentials);

    // Fetch inbound shipments
    const result = await amazonService.getInboundShipments(
      statusList,
      lastUpdatedAfter,
      lastUpdatedBefore
    );

    const shipments = result.payload?.ShipmentData || [];
    console.log('[Inbound API] Inbound shipments fetched successfully');
    console.log(`[Inbound API] Found ${shipments.length} shipments`);

    // Fetch ALL inbound items using date range (simpler and more reliable)
    let allItems: any[] = [];
    try {
      // Use 90-day date range to catch all active inbound items
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      const itemsResult = await amazonService.getInboundShipmentItems(
        undefined, // No shipmentId - use date range instead
        ninetyDaysAgo.toISOString(),
        now.toISOString()
      );
      allItems = itemsResult.payload?.ItemData || [];
      console.log(`[Inbound API] Fetched ${allItems.length} total inbound items via date range`);
    } catch (error) {
      console.error('[Inbound API] Error fetching inbound items via date range:', error);
    }

    // Match items to shipments
    const shipmentsWithItems = shipments.map((shipment: any) => {
      const shipmentItems = allItems.filter((item: any) => item.ShipmentId === shipment.ShipmentId);
      
      // Calculate total quantity
      const totalQuantity = shipmentItems.reduce((sum: number, item: any) => {
        return sum + (parseInt(item.QuantityShipped || 0) || parseInt(item.QuantityReceived || 0) || 0);
      }, 0);

      return {
        ...shipment,
        items: shipmentItems,
        totalQuantity,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        shipments: shipmentsWithItems,
        totalShipments: shipmentsWithItems.length,
        totalInboundUnits: shipmentsWithItems.reduce((sum: number, s: any) => sum + (s.totalQuantity || 0), 0),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Inbound API] Error fetching inbound shipments:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch inbound shipments',
      },
      { status: 500 }
    );
  }
}

