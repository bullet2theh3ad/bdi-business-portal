import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, productSkus, invoices, invoiceLineItems, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
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
          purchase_order_id,
          delivery_week,
          quantity,
          confidence,
          shipping_preference,
          forecast_type,
          status,
          sales_signal,
          factory_signal,
          shipping_signal,
          transit_signal,
          warehouse_signal,
          notes,
          created_by,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (forecastsError) {
        console.error('Database error:', forecastsError);
        console.log('📊 Database table access error, returning empty array');
        return NextResponse.json([]);
      }

      console.log(`📊 Raw forecast data from Supabase (first 2):`, forecastsData?.slice(0, 2));

      // Get unique SKU IDs from forecasts
      const skuIds = [...new Set((forecastsData || []).map((row: any) => row.sku_id))];
      
      // Fetch SKU details for all forecasts (including dimensional data for shipment calculations)
      const skuData = skuIds.length > 0 ? await db
        .select({
          id: productSkus.id,
          sku: productSkus.sku,
          name: productSkus.name,
          htsCode: productSkus.htsCode,
          boxLengthCm: productSkus.boxLengthCm,
          boxWidthCm: productSkus.boxWidthCm,
          boxHeightCm: productSkus.boxHeightCm,
          boxWeightKg: productSkus.boxWeightKg,
          cartonLengthCm: productSkus.cartonLengthCm,
          cartonWidthCm: productSkus.cartonWidthCm,
          cartonHeightCm: productSkus.cartonHeightCm,
          cartonWeightKg: productSkus.cartonWeightKg,
          boxesPerCarton: productSkus.boxesPerCarton,
          palletLengthCm: productSkus.palletLengthCm,
          palletWidthCm: productSkus.palletWidthCm,
          palletHeightCm: productSkus.palletHeightCm,
          palletWeightKg: productSkus.palletWeightKg
        })
        .from(productSkus)
        .where(inArray(productSkus.id, skuIds)) : [];
      
      // Create SKU lookup map
      const skuMap = new Map(skuData.map(sku => [sku.id, sku]));

      // Transform forecasts with proper SKU lookup
      const allForecasts = (forecastsData || []).map((row: any) => ({
        id: row.id,
        skuId: row.sku_id,
        purchaseOrderId: row.purchase_order_id,
        deliveryWeek: row.delivery_week,
        quantity: row.quantity,
        confidence: row.confidence,
        shippingPreference: row.shipping_preference,
        forecastType: row.forecast_type,
        status: row.status,
        salesSignal: row.sales_signal,
        factorySignal: row.factory_signal,
        shippingSignal: row.shipping_signal, // Legacy field
        transitSignal: row.transit_signal || row.shipping_signal, // Fallback to shipping_signal for existing data
        warehouseSignal: row.warehouse_signal || row.shipping_signal, // Fallback to shipping_signal for existing data
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        sku: skuMap.get(row.sku_id) || {
          id: row.sku_id,
          sku: 'UNKNOWN-SKU',
          name: 'Unknown SKU'
        }
      }));

      console.log(`📊 Transformed forecasts (first 2):`, allForecasts.slice(0, 2));

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
          purchase_order_id: body.purchaseOrderId || null,
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
      // ⚠️ ONLY trigger emails when status is "Submitted" (not "Draft")
      if (body.status === 'submitted') {
        console.log('📧 Triggering CPFR email notification for SUBMITTED forecast (Draft forecasts do not trigger emails)');
        
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
          status: body.salesSignal === 'submitted' ? 'submitted' : 'draft', // 🔧 FIX: Update status based on sales signal
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
      
      // 🔄 BI-DIRECTIONAL SYNC: Update linked shipment signals
      console.log('🔄 Syncing shipment signals with forecast...');
      
      const { data: linkedShipments, error: shipmentQueryError } = await supabase
        .from('shipments')
        .select('id')
        .eq('forecast_id', forecastId);
      
      if (linkedShipments && linkedShipments.length > 0) {
        const shipmentUpdateData: any = {
          sales_signal: body.salesSignal,
          factory_signal: body.factorySignal,
          shipping_signal: body.shippingSignal,
          updated_at: new Date().toISOString()
        };
        
        // Update all linked shipments with the forecast signals
        const { error: shipmentUpdateError } = await supabase
          .from('shipments')
          .update(shipmentUpdateData)
          .in('id', linkedShipments.map(s => s.id));
        
        if (shipmentUpdateError) {
          console.error('⚠️ Failed to sync shipment signals:', shipmentUpdateError);
        } else {
          console.log(`✅ Synced ${linkedShipments.length} shipment(s) with forecast signals`);
        }
      } else {
        console.log('ℹ️ No linked shipments found for forecast:', forecastId);
      }
      
      // 🚀 TRIGGER CPFR EMAIL ON ANY SIGNAL CHANGE
      let emailTriggered = false;
      
      // Sales signal change (BDI → Factory)
      // ⚠️ ONLY trigger emails when sales signal changes to "submitted" (not for Draft status)
      if (body.salesSignal === 'submitted') {
        console.log('📧 Sales signal changed to SUBMITTED - triggering CPFR email notification (Draft signals do not trigger emails)');
        
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
              emailTriggered = true;
            } else {
              console.log('⚠️ No invoice data found for SKU - skipping email notification');
            }
          }
        } catch (emailError) {
          console.error('❌ CPFR email notification failed on edit:', emailError);
          // Don't fail the forecast update if email fails
        }
      }
      
      // Factory signal change (TC1 → BDI)
      if (!emailTriggered && (body.factorySignal === 'awaiting' || body.factorySignal === 'accepted' || body.factorySignal === 'rejected')) {
        console.log(`📧 Factory signal changed to ${body.factorySignal} - notifying BDI team`);
        
        try {
          // Get SKU data for email
          const [sku] = await db
            .select()
            .from(productSkus)
            .where(eq(productSkus.id, updatedForecast.sku_id))
            .limit(1);
            
          if (sku) {
            // Get invoice data for context
            const invoiceData = await getInvoiceDataFromSku(updatedForecast.sku_id);
            
            if (invoiceData) {
              // Send notification to BDI team about factory response
              const bdiEmailData = {
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
                portalLink: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cpfr/forecasts`,
                invoiceNumber: invoiceData.invoiceNumber,
                factoryResponse: body.factorySignal
              };
              
              // Send to BDI team (you and Dariush)
              const bdiRecipients = [
                'scistulli@boundlessdevices.com', // Personal
                'dzand@boundlessdevices.com'      // Primary business
              ];
              
              // Simple email notification for now
              if (process.env.RESEND_API_KEY) {
                const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY);
                
                const emailResult = await resend.emails.send({
                  from: 'CPFR System <cpfr@bdibusinessportal.com>',
                  to: bdiRecipients,
                  subject: `🏭 CPFR Update: ${invoiceData.mfgCode} Factory Response - ${body.factorySignal.toUpperCase()}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 20px; text-align: center;">
                        <h1>🏭 CPFR Factory Response Received</h1>
                        <p>${invoiceData.mfgCode} has responded to your forecast</p>
                      </div>
                      
                      <div style="padding: 30px;">
                        <div style="background: #F0FDF4; border: 1px solid #10B981; border-radius: 6px; padding: 20px; margin: 20px 0;">
                          <h2 style="color: #059669; margin-top: 0;">📋 Factory Response Details</h2>
                          <p><strong>SKU:</strong> ${sku.sku} - ${sku.name}</p>
                          <p><strong>Quantity:</strong> ${updatedForecast.quantity.toLocaleString()} units</p>
                          <p><strong>Factory Status:</strong> <strong style="color: #059669;">${body.factorySignal.toUpperCase()}</strong></p>
                          <p><strong>Delivery Week:</strong> ${updatedForecast.delivery_week}</p>
                          <p><strong>Invoice Reference:</strong> ${invoiceData.invoiceNumber}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="${bdiEmailData.portalLink}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            🔗 View in CPFR Portal
                          </a>
                        </div>
                      </div>
                    </div>
                  `
                });
                
                console.log(`📧 BDI notification sent for ${invoiceData.mfgCode} factory response:`, emailResult);
              }
            }
          }
        } catch (emailError) {
          console.error('❌ BDI notification failed:', emailError);
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

    // Get forecast details for logging
    const { data: forecastDetails } = await supabase
      .from('sales_forecasts')
      .select('sku_id, delivery_week, quantity, status')
      .eq('id', forecastId)
      .single();
    
    console.log('📋 Forecast to delete:', forecastDetails);

    // Check for related records that need to be deleted first
    // 1. Check for shipments that reference this forecast
    const { data: relatedShipments, error: shipmentCheckError } = await supabase
      .from('shipments')
      .select('id, shipment_number, tracking_number, status')
      .eq('forecast_id', forecastId);

    if (shipmentCheckError) {
      console.error('Error checking related shipments:', shipmentCheckError);
    }

    // 2. Check for production files that reference this forecast
    const { data: relatedProductionFiles, error: productionFilesCheckError } = await supabase
      .from('production_files')
      .select('id, file_name, file_path')
      .eq('forecast_id', forecastId);

    if (productionFilesCheckError) {
      console.error('Error checking related production files:', productionFilesCheckError);
    }

    const hasRelatedShipments = relatedShipments && relatedShipments.length > 0;
    const hasRelatedProductionFiles = relatedProductionFiles && relatedProductionFiles.length > 0;
    
    console.log(`📦 Found ${relatedShipments?.length || 0} related shipments for forecast ${forecastId}`);
    console.log(`📁 Found ${relatedProductionFiles?.length || 0} related production files for forecast ${forecastId}`);

    // Delete forecast from database (and all related records)
    try {
      let deletionMessage = 'Forecast deleted successfully!';
      let deletedItems = [];
      
      // If there are related production files, delete them first
      if (hasRelatedProductionFiles) {
        console.log('📁 Deleting related production files first...');
        
        for (const productionFile of relatedProductionFiles) {
          // Delete the file from Supabase Storage first
          const { error: storageDeleteError } = await supabase.storage
            .from('organization-documents')
            .remove([productionFile.file_path]);
            
          if (storageDeleteError) {
            console.error('Error deleting file from storage:', storageDeleteError);
          }
          
          // Delete the production file record
          const { error: fileDeleteError } = await supabase
            .from('production_files')
            .delete()
            .eq('id', productionFile.id);
            
          if (fileDeleteError) {
            console.error('Error deleting production file:', fileDeleteError);
            throw fileDeleteError;
          }
          
          console.log(`✅ Deleted production file: ${productionFile.file_name}`);
        }
        
        deletedItems.push(`${relatedProductionFiles.length} production file${relatedProductionFiles.length === 1 ? '' : 's'}`);
      }
      
      // If there are related shipments, delete them first
      if (hasRelatedShipments) {
        console.log('🚛 Deleting related shipments first...');
        
        for (const shipment of relatedShipments) {
          // Delete shipment documents first
          const { error: docsDeleteError } = await supabase
            .from('shipment_documents')
            .delete()
            .eq('shipment_id', shipment.id);
            
          if (docsDeleteError) {
            console.error('Error deleting shipment documents:', docsDeleteError);
          }
          
          // Delete the shipment
          const { error: shipmentDeleteError } = await supabase
            .from('shipments')
            .delete()
            .eq('id', shipment.id);
            
          if (shipmentDeleteError) {
            console.error('Error deleting shipment:', shipmentDeleteError);
            throw shipmentDeleteError;
          }
          
          console.log(`✅ Deleted shipment: ${shipment.shipment_number || shipment.tracking_number || shipment.id}`);
        }
        
        deletedItems.push(`${relatedShipments.length} shipment${relatedShipments.length === 1 ? '' : 's'}`);
      }
      
      // Update deletion message
      if (deletedItems.length > 0) {
        deletionMessage = `Forecast and ${deletedItems.join(' and ')} deleted successfully!`;
      }

      // Now delete the forecast
      const { data: deletedForecast, error: deleteError } = await supabase
        .from('sales_forecasts')
        .delete()
        .eq('id', forecastId)
        .select()
        .single();

      if (deleteError) {
        console.error('Database delete error:', deleteError);
        console.error('Full error details:', JSON.stringify(deleteError, null, 2));
        
        // Handle foreign key constraint violations
        if (deleteError.code === '23503') {
          console.error('Foreign key constraint violation:', deleteError.details || deleteError.message);
          
          // Extract table name from error for better messaging
          let referencingTable = 'other records';
          const errorDetail = deleteError.details || deleteError.message || '';
          
          if (errorDetail.includes('production_files')) {
            referencingTable = 'production files';
          } else if (errorDetail.includes('shipment')) {
            referencingTable = 'shipments';
          }

          return NextResponse.json({
            error: `Cannot delete forecast because it is currently being used in ${referencingTable}. Please remove all references to this forecast before deleting it.`,
            code: 'FOREIGN_KEY_CONSTRAINT',
            referencingTable: referencingTable,
            debugInfo: errorDetail
          }, { status: 409 }); // 409 Conflict
        }
        
        throw deleteError;
      }

      console.log('✅ Forecast deleted:', deletedForecast);
      
      return NextResponse.json({
        success: true,
        message: deletionMessage,
        forecast: deletedForecast,
        deletedShipments: relatedShipments?.length || 0
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
