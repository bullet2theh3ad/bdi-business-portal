import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';

/**
 * GET /api/amazon/inventory/summaries
 * Get real-time FBA inventory summaries from Amazon
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
    const details = searchParams.get('details') === 'true';
    const startDateTime = searchParams.get('startDateTime') || undefined;

    console.log('[Inventory API] Fetching FBA inventory summaries...');

    // Initialize Amazon SP-API client
    const credentials = getAmazonCredentials();
    const amazonService = new AmazonSPAPIService(credentials);

    // Fetch inventory summaries
    const result = await amazonService.getInventorySummaries(
      undefined, // Use default marketplace (US)
      details,
      startDateTime
    );

    console.log('[Inventory API] Inventory summaries fetched successfully');
    console.log(`[Inventory API] Found ${result.payload?.inventorySummaries?.length || 0} items`);

    return NextResponse.json({
      success: true,
      data: result.payload || result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Inventory API] Error fetching inventory summaries:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch inventory summaries',
      },
      { status: 500 }
    );
  }
}

