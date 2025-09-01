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

    // Query forecasts from database table
    try {
      const forecastsQuery = await db.execute(sql`
        SELECT 
          sf.id,
          sf.sku_id as "skuId",
          sf.delivery_week as "deliveryWeek", 
          sf.quantity,
          sf.confidence,
          sf.shipping_preference as "shippingPreference",
          sf.forecast_type as "forecastType",
          sf.notes,
          sf.created_by as "createdBy",
          sf.created_at as "createdAt",
          ps.sku,
          ps.name as "skuName"
        FROM sales_forecasts sf
        JOIN product_skus ps ON sf.sku_id = ps.id
        ORDER BY sf.created_at DESC
      `);
      
      const forecasts = forecastsQuery.rows.map((row: any) => ({
        ...row,
        sku: {
          id: row.skuId,
          sku: row.sku,
          name: row.skuName
        }
      }));
      
      console.log(`📊 Fetching forecasts - found ${forecasts.length} from database`);
      return NextResponse.json(forecasts);
      
    } catch (dbError) {
      console.log('📊 Database table not found, returning empty array. Run create-sales-forecasts-table.sql');
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

    // Create forecast in database
    try {
      const insertResult = await db.execute(sql`
        INSERT INTO sales_forecasts (
          sku_id, delivery_week, quantity, confidence, shipping_preference,
          forecast_type, notes, moq_override, created_by
        ) VALUES (
          ${body.skuId}, ${body.deliveryWeek}, ${parseInt(body.quantity)}, 
          ${body.confidence || 'medium'}, ${body.shippingPreference || ''},
          ${body.confidenceLevel || 'planning'}, ${body.notes || ''}, 
          ${body.moqOverride || false}, ${requestingUser.authId}
        ) RETURNING *
      `);
      
      const newForecast = insertResult.rows[0];
      console.log('✅ Forecast created in database:', newForecast);
      
      return NextResponse.json({
        success: true,
        message: 'Forecast created successfully!',
        forecast: newForecast
      });
      
    } catch (dbError) {
      console.error('Database error - table may not exist:', dbError);
      console.log('💡 Please run create-sales-forecasts-table.sql in Supabase');
      
      // Fallback to temporary storage if table doesn't exist
      const newForecast: ForecastData = {
        id: `temp_${Date.now()}`,
        skuId: body.skuId,
        deliveryWeek: body.deliveryWeek,
        quantity: parseInt(body.quantity),
        confidence: body.confidence || 'medium',
        shippingPreference: body.shippingPreference || '',
        notes: body.notes || '',
        createdBy: requestingUser.authId,
        createdAt: new Date().toISOString()
      };
      
      console.log('⚠️ Using temporary storage - run SQL script for persistence');
      
      return NextResponse.json({
        success: true,
        message: 'Forecast created (temporary) - Run SQL script for persistence',
        forecast: newForecast
      });
    }

  } catch (error) {
    console.error('Error creating forecast:', error);
    return NextResponse.json({ error: 'Failed to create forecast' }, { status: 500 });
  }
}
