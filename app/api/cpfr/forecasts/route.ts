import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, productSkus, invoices, invoiceLineItems, organizations, organizationMembers } from '@/lib/db/schema';
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

    // Allow access for:
    // 1. BDI users (super_admin, admin, sales, member) - see all forecasts
    // 2. Partner organization users (TC1, etc.) - see only their forecasts
    const isBDIUser = userOrgMembership.length > 0 && 
      userOrgMembership[0].organization.code === 'BDI' && 
      userOrgMembership[0].organization.type === 'internal';
      
    const isPartnerUser = userOrgMembership.length > 0 && 
      userOrgMembership[0].organization.type !== 'internal';

    if (!isBDIUser && !isPartnerUser) {
      return NextResponse.json({ error: 'Forbidden - Organization access required' }, { status: 403 });
    }

    const userOrgCode = userOrgMembership[0]?.organization.code;
    console.log(`🔐 CPFR Access: ${isBDIUser ? 'BDI (full access)' : `Partner ${userOrgCode} (filtered)`}`);

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
      const allForecasts = (forecastsData || []).map((row: any) => ({
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
        sku: row.product_skus || {
          id: row.sku_id,
          sku: 'UNKNOWN',
          name: 'SKU data not found'
        }
      })).filter(forecast => forecast.sku !== null); // Filter out any with null SKU data

      // Filter forecasts based on user organization
      let filteredForecasts = allForecasts;
      
      if (isPartnerUser && userOrgCode) {
        console.log(`🔍 Filtering forecasts for partner organization: ${userOrgCode}`);
        
        // For partner organizations (TC1, etc.), show forecasts where:
        // Invoice.customerName matches their Organization.code
        const partnerSkuIds = await db
          .select({
            skuId: invoiceLineItems.skuId
          })
          .from(invoiceLineItems)
          .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
          .where(eq(invoices.customerName, userOrgCode));
        
        const allowedSkuIds = partnerSkuIds.map(item => item.skuId);
        
        console.log(`🔍 Found ${allowedSkuIds.length} SKU IDs for ${userOrgCode}:`, allowedSkuIds);
        console.log(`📊 All forecasts count: ${allForecasts.length}`);
        console.log(`📊 All forecasts SKU IDs:`, allForecasts.map(f => f.skuId));
        
        // Filter forecasts to only show those for partner's SKUs
        filteredForecasts = allForecasts.filter(forecast => 
          allowedSkuIds.includes(forecast.skuId)
        );
        
        console.log(`🔒 Partner ${userOrgCode} can see ${filteredForecasts.length} of ${allForecasts.length} forecasts`);
        
        // Enhanced debug info
        if (filteredForecasts.length === 0) {
          console.log(`⚠️ DEBUG INFO for ${userOrgCode}:`);
          console.log(`   - Allowed SKU IDs: ${allowedSkuIds.join(', ')}`);
          console.log(`   - Forecast SKU IDs: ${allForecasts.map(f => f.skuId).join(', ')}`);
          console.log(`   - Invoices with customerName = '${userOrgCode}': ${allowedSkuIds.length > 0 ? 'YES' : 'NO'}`);
        }
      } else {
        console.log(`🔓 BDI user can see all ${allForecasts.length} forecasts`);
      }
      
      console.log(`📊 Fetching forecasts - returning ${filteredForecasts.length} forecasts`);
      return NextResponse.json(filteredForecasts);
      
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
          created_by: requestingUser.authId,
          // Set sales signal based on status
          sales_signal: body.status === 'submitted' ? 'submitted' : 'unknown',
          factory_signal: 'unknown',
          shipping_signal: 'unknown'
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
          // Get MFG code and invoice data from related invoice
          const invoiceData = await getInvoiceDataFromSku(body.skuId);
          
          if (invoiceData) {
            // Generate portal link for factory response
            const portalLink = generateCPFRPortalLink(
              newForecast.id, 
              invoiceData.mfgCode, 
              'factory_response'
            );
            
            // Get forecast email data with real invoice information
            const emailData: CPFRNotificationData = {
              forecastId: newForecast.id,
              mfgCode: invoiceData.mfgCode,
              sku: sku.sku,
              skuName: sku.name,
              quantity: parseInt(body.quantity),
              unitCost: invoiceData.unitCost,
              totalValue: invoiceData.unitCost * parseInt(body.quantity),
              deliveryWeek: body.deliveryWeek,
              deliveryDateRange: getWeekDateRange(body.deliveryWeek),
              shippingMethod: body.shippingPreference || 'TBD',
              notes: body.notes,
              portalLink: portalLink,
              invoiceNumber: invoiceData.invoiceNumber
            };
            
            // Send CPFR notification
            const emailSent = await sendCPFRNotification('FACTORY_RESPONSE_NEEDED', emailData);
            
            // Log the notification
            await logCPFRNotification(
              'FACTORY_RESPONSE_NEEDED',
              newForecast.id,
              invoiceData.mfgCode,
              ['TC1 CPFR Contacts'], // Will be detailed in sendCPFRNotification
              emailSent
            );
            
            console.log(`📧 CPFR email notification ${emailSent ? 'sent' : 'failed'} for ${invoiceData.mfgCode}`);
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
      
      // 🚀 TRIGGER CPFR EMAIL ON SALES SIGNAL CHANGE
      if (body.salesSignal === 'submitted') {
        console.log('📧 Sales signal changed to submitted - triggering CPFR email notification');
        
        try {
          // Get SKU data for email
          const [sku] = await db
            .select()
            .from(productSkus)
            .where(eq(productSkus.id, updatedForecast.sku_id))
            .limit(1);
            
          if (sku) {
            // Get MFG code and invoice data from related invoice
            const invoiceData = await getInvoiceDataFromSku(updatedForecast.sku_id);
            
            if (invoiceData) {
              // Generate portal link for factory response
              const portalLink = generateCPFRPortalLink(
                updatedForecast.id, 
                invoiceData.mfgCode, 
                'factory_response'
              );
              
              // Get forecast email data with real invoice information
              const emailData: CPFRNotificationData = {
                forecastId: updatedForecast.id,
                mfgCode: invoiceData.mfgCode,
                sku: sku.sku,
                skuName: sku.name,
                quantity: updatedForecast.quantity,
                unitCost: invoiceData.unitCost,
                totalValue: invoiceData.unitCost * updatedForecast.quantity,
                deliveryWeek: updatedForecast.delivery_week,
                deliveryDateRange: getWeekDateRange(updatedForecast.delivery_week),
                shippingMethod: updatedForecast.shipping_preference || 'TBD',
                notes: updatedForecast.notes,
                portalLink: portalLink,
                invoiceNumber: invoiceData.invoiceNumber
              };
              
              // Send CPFR notification
              const emailSent = await sendCPFRNotification('FACTORY_RESPONSE_NEEDED', emailData);
              
              // Log the notification
              await logCPFRNotification(
                'FACTORY_RESPONSE_NEEDED',
                updatedForecast.id,
                invoiceData.mfgCode,
                ['TC1 CPFR Contacts'],
                emailSent
              );
              
              console.log(`📧 CPFR email notification ${emailSent ? 'sent' : 'failed'} for ${invoiceData.mfgCode} (EDIT)`);
            } else {
              console.log('⚠️ No invoice data found for SKU - skipping email notification');
            }
          }
        } catch (emailError) {
          console.error('❌ CPFR email notification failed on edit:', emailError);
          // Don't fail the forecast update if email fails
        }
      }
      
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

// Helper function to get invoice data from SKU
async function getInvoiceDataFromSku(skuId: string): Promise<{
  mfgCode: string;
  unitCost: number;
  invoiceNumber: string;
} | null> {
  try {
    console.log(`🔍 Getting invoice data for SKU ID: ${skuId}`);
    
    // Find invoice with this SKU to get MFG, unit cost, and invoice number
    const [invoiceWithSku] = await db
      .select({
        customerName: invoices.customerName,
        invoiceNumber: invoices.invoiceNumber,
        unitCost: invoiceLineItems.unitCost,
        skuCode: productSkus.sku,
        skuName: productSkus.name
      })
      .from(invoiceLineItems)
      .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
      .innerJoin(productSkus, eq(productSkus.id, invoiceLineItems.skuId))
      .where(eq(invoiceLineItems.skuId, skuId))
      .limit(1);
    
    if (invoiceWithSku) {
      const unitCost = parseFloat(invoiceWithSku.unitCost) || 0;
      console.log(`✅ Found invoice data: ${invoiceWithSku.customerName}, $${unitCost}, ${invoiceWithSku.invoiceNumber}`);
      return {
        mfgCode: invoiceWithSku.customerName,
        unitCost: unitCost,
        invoiceNumber: invoiceWithSku.invoiceNumber
      };
    }
    
    console.log(`⚠️ No invoice found for SKU ID: ${skuId}`);
    return null;
  } catch (error) {
    console.error('❌ Error getting invoice data from SKU:', error);
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
