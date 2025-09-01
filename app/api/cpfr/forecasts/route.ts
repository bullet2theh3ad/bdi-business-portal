import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, productSkus } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

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

// Note: Using direct SQL queries until sales_forecasts table is added to schema
// Run create-sales-forecasts-table.sql in Supabase to create the table

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

    // Query forecasts from database table using Supabase client
    try {
      const { data: forecastsData, error: forecastsError } = await supabase
        .from('sales_forecasts')
        .select(`
          id,
          sku_id,
          delivery_week,
          quantity,
          confidence,
          shipping_preference,
          forecast_type,
          notes,
          created_by,
          created_at,
          product_skus (
            id,
            sku,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (forecastsError) {
        console.error('Database error:', forecastsError);
        console.log('📊 Database table access error, returning empty array');
        return NextResponse.json([]);
      }

      // Transform data to match frontend interface
      const forecasts = (forecastsData || []).map((row: any) => ({
        id: row.id,
        skuId: row.sku_id,
        deliveryWeek: row.delivery_week,
        quantity: row.quantity,
        confidence: row.confidence,
        shippingPreference: row.shipping_preference,
        forecastType: row.forecast_type,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        sku: row.product_skus
      }));
      
      console.log(`📊 Fetching forecasts - found ${forecasts.length} from database`);
      return NextResponse.json(forecasts);
      
    } catch (dbError) {
      console.log('📊 Database table not found, returning empty array. Error:', dbError);
      return NextResponse.json([]);
    }

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

    // Create forecast in database using Supabase client
    try {
      const { data: newForecast, error: insertError } = await supabase
        .from('sales_forecasts')
        .insert({
          sku_id: body.skuId,
          delivery_week: body.deliveryWeek,
          quantity: parseInt(body.quantity),
          confidence: body.confidence || 'medium',
          shipping_preference: body.shippingPreference || '',
          forecast_type: body.confidenceLevel || 'planning',
          notes: body.notes || '',
          moq_override: body.moqOverride || false,
          created_by: requestingUser.authId
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw insertError;
      }

      console.log('✅ Forecast created in database:', newForecast);
      
      return NextResponse.json({
        success: true,
        message: 'Forecast created successfully!',
        forecast: newForecast
      });
      
    } catch (dbError) {
      console.error('Database error - table may not exist:', dbError);
      console.log('💡 Please verify sales_forecasts table exists in Supabase');
      
      return NextResponse.json({
        success: false,
        error: 'Database error - please check table exists',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error creating forecast:', error);
    return NextResponse.json({ error: 'Failed to create forecast' }, { status: 500 });
  }
}
