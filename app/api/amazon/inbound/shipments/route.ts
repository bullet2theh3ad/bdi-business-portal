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

    // Fetch items for each shipment
    const shipmentsWithItems = await Promise.all(
      shipments.map(async (shipment: any) => {
        try {
          const itemsResult = await amazonService.getInboundShipmentItems(shipment.ShipmentId);
          const items = itemsResult.payload?.ItemData || [];
          
          // Calculate total quantity
          const totalQuantity = items.reduce((sum: number, item: any) => {
            return sum + (parseInt(item.QuantityShipped || 0) || parseInt(item.QuantityReceived || 0) || 0);
          }, 0);

          return {
            ...shipment,
            items,
            totalQuantity,
          };
        } catch (error) {
          console.error(`[Inbound API] Error fetching items for shipment ${shipment.ShipmentId}:`, error);
          return {
            ...shipment,
            items: [],
            totalQuantity: 0,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        shipments: shipmentsWithItems,
        totalShipments: shipmentsWithItems.length,
        totalInboundUnits: shipmentsWithItems.reduce((sum, s) => sum + (s.totalQuantity || 0), 0),
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

