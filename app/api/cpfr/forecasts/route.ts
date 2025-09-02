import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, productSkus, invoices, invoiceLineItems, organizations } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { sendCPFRNotification, generateCPFRPortalLink, logCPFRNotification, CPFRNotificationData } from '@/lib/email/cpfr-notifications';

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
          status,
          sales_signal,
          factory_signal,
          shipping_signal,
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
        salesSignal: row.sales_signal,
        factorySignal: row.factory_signal,
        shippingSignal: row.shipping_signal,
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
          status: body.status || 'draft',
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
      
      // 🚀 TRIGGER CPFR EMAIL NOTIFICATIONS
      if (body.status === 'submitted') {
        console.log('📧 Triggering CPFR email notification for submitted forecast');
        
        try {
          // Get MFG code from related invoice
          const mfgCode = await getMfgCodeFromSku(body.skuId);
          
          if (mfgCode) {
            // Generate portal link for factory response
            const portalLink = generateCPFRPortalLink(
              newForecast.id, 
              mfgCode, 
              'factory_response'
            );
            
            // Get forecast email data
            const emailData: CPFRNotificationData = {
              forecastId: newForecast.id,
              mfgCode: mfgCode,
              sku: sku.sku,
              skuName: sku.name,
              quantity: parseInt(body.quantity),
              unitCost: 0, // We'll get this from invoice
              totalValue: 0, // We'll calculate this
              deliveryWeek: body.deliveryWeek,
              deliveryDateRange: getWeekDateRange(body.deliveryWeek),
              shippingMethod: body.shippingPreference || 'TBD',
              notes: body.notes,
              portalLink: portalLink
            };
            
            // Send CPFR notification
            const emailSent = await sendCPFRNotification('FACTORY_RESPONSE_NEEDED', emailData);
            
            // Log the notification
            await logCPFRNotification(
              'FACTORY_RESPONSE_NEEDED',
              newForecast.id,
              mfgCode,
              ['TC1 CPFR Contacts'], // Will be detailed in sendCPFRNotification
              emailSent
            );
            
            console.log(`📧 CPFR email notification ${emailSent ? 'sent' : 'failed'} for ${mfgCode}`);
          } else {
            console.log('⚠️ No MFG code found for SKU - skipping email notification');
          }
        } catch (emailError) {
          console.error('❌ CPFR email notification failed:', emailError);
          // Don't fail the forecast creation if email fails
        }
      }
      
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

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const forecastId = body.forecastId;

    console.log('🔄 Updating forecast:', forecastId, body);

    // Update forecast in database
    try {
      const { data: updatedForecast, error: updateError } = await supabase
        .from('sales_forecasts')
        .update({
          quantity: body.quantity,
          sales_signal: body.salesSignal,
          factory_signal: body.factorySignal,
          shipping_signal: body.shippingSignal,
          notes: body.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', forecastId)
        .select()
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('✅ Forecast updated:', updatedForecast);
      
      return NextResponse.json({
        success: true,
        message: 'Forecast updated successfully!',
        forecast: updatedForecast
      });
      
    } catch (dbError) {
      console.error('Database error updating forecast:', dbError);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to update forecast',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error updating forecast:', error);
    return NextResponse.json({ error: 'Failed to update forecast' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const forecastId = body.forecastId;

    console.log('🗑️ Deleting forecast:', forecastId);

    // Delete forecast from database
    try {
      const { data: deletedForecast, error: deleteError } = await supabase
        .from('sales_forecasts')
        .delete()
        .eq('id', forecastId)
        .select()
        .single();

      if (deleteError) {
        console.error('Database delete error:', deleteError);
        throw deleteError;
      }

      console.log('✅ Forecast deleted:', deletedForecast);
      
      return NextResponse.json({
        success: true,
        message: 'Forecast deleted successfully!',
        forecast: deletedForecast
      });
      
    } catch (dbError) {
      console.error('Database error deleting forecast:', dbError);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to delete forecast',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error deleting forecast:', error);
    return NextResponse.json({ error: 'Failed to delete forecast' }, { status: 500 });
  }
}

// Helper function to get MFG code from SKU via invoices
async function getMfgCodeFromSku(skuId: string): Promise<string | null> {
  try {
    console.log(`🔍 Getting MFG code for SKU ID: ${skuId}`);
    
    // Find invoice with this SKU to get the MFG (customerName)
    const [invoiceWithSku] = await db
      .select({
        customerName: invoices.customerName,
        skuCode: productSkus.sku,
        skuName: productSkus.name
      })
      .from(invoiceLineItems)
      .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
      .innerJoin(productSkus, eq(productSkus.id, invoiceLineItems.skuId))
      .where(eq(invoiceLineItems.skuId, skuId))
      .limit(1);
    
    if (invoiceWithSku) {
      console.log(`✅ Found MFG code: ${invoiceWithSku.customerName} for SKU: ${invoiceWithSku.skuCode}`);
      return invoiceWithSku.customerName;
    }
    
    console.log(`⚠️ No invoice found for SKU ID: ${skuId}`);
    return null;
  } catch (error) {
    console.error('❌ Error getting MFG code from SKU:', error);
    return null;
  }
}

// Helper function to get week date range for display
function getWeekDateRange(isoWeek: string): string {
  try {
    if (!isoWeek.includes('W')) return isoWeek;
    
    const [year, week] = isoWeek.split('-W').map(Number);
    const jan1 = new Date(year, 0, 1);
    const daysToFirstThursday = 4 - jan1.getDay();
    const firstThursday = new Date(year, 0, 1 + daysToFirstThursday);
    const weekStart = new Date(firstThursday);
    weekStart.setDate(firstThursday.getDate() + (week - 1) * 7 - 3); // Monday
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
    
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  } catch (error) {
    console.error('Error parsing week date range:', error);
    return isoWeek;
  }
}
