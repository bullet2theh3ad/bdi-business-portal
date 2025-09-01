import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, productSkus } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// For now, we'll store forecasts in a simple structure
// TODO: Create proper sales_forecasts table in future migration
interface ForecastData {
  id: string;
  skuId: string;
  deliveryWeek: string;
  quantity: number;
  confidence: string;
  shippingPreference: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

// Temporary in-memory storage for forecasts (replace with database table later)
const tempForecasts: ForecastData[] = [];

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

    // For now, return empty array since we're using temp storage
    // TODO: Query from actual database table
    console.log('📊 Fetching forecasts - currently using temporary storage');
    
    return NextResponse.json([]);

  } catch (error) {
    console.error('Error fetching forecasts:', error);
    return NextResponse.json({ error: 'Failed to fetch forecasts' }, { status: 500 });
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

    // Verify user has access
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin', 'sales', 'member'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    console.log('🔄 Creating forecast:', body);

    // Validate required fields
    if (!body.skuId || !body.deliveryWeek || !body.quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify SKU exists
    const [sku] = await db
      .select()
      .from(productSkus)
      .where(eq(productSkus.id, body.skuId))
      .limit(1);

    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }

    // Create forecast (temporary - store in memory for now)
    const newForecast: ForecastData = {
      id: `forecast_${Date.now()}`,
      skuId: body.skuId,
      deliveryWeek: body.deliveryWeek,
      quantity: parseInt(body.quantity),
      confidence: body.confidence || 'medium',
      shippingPreference: body.shippingPreference || '',
      notes: body.notes || '',
      createdBy: requestingUser.authId,
      createdAt: new Date().toISOString()
    };

    tempForecasts.push(newForecast);
    
    console.log('✅ Forecast created (temporary storage):', newForecast);
    console.log(`📊 Total forecasts: ${tempForecasts.length}`);
    
    return NextResponse.json({
      success: true,
      message: 'Forecast created successfully!',
      forecast: newForecast
    });

  } catch (error) {
    console.error('Error creating forecast:', error);
    return NextResponse.json({ error: 'Failed to create forecast' }, { status: 500 });
  }
}
