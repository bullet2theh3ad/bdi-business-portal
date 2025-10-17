import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Resend for email notifications
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Comprehensive CPFR Change Notifications
async function sendCPFRChangeNotifications(milestone: string, changeEntry: any, currentForecast: any, newStatus: string) {
  if (!resend) {
    console.log('📧 Resend not configured - skipping CPFR change emails');
    return false;
  }

  try {
    console.log(`📧 Sending CPFR change notifications for ${milestone} changes`);

    // Get SKU details for email
    const { data: skuData } = await supabase
      .from('product_skus')
      .select('sku, name')
      .eq('id', currentForecast.sku_id)
      .single();

    const forecastEmailData = {
      ...currentForecast,
      sku: skuData
    };

    // Get BDI CPFR contacts (from cpfr_contacts field)
    let bdiCpfrEmails: string[] = [];
    const { data: bdiOrg } = await supabase
      .from('organizations')
      .select('cpfr_contacts')
      .eq('code', 'BDI')
      .single();

    if (bdiOrg?.cpfr_contacts) {
      const cpfrData = bdiOrg.cpfr_contacts as any;
      const primaryContacts = cpfrData.primary_contacts || [];
      const escalationContacts = cpfrData.escalation_contacts || [];
      
      bdiCpfrEmails = [...primaryContacts, ...escalationContacts]
        .filter((contact: any) => contact.active !== false && contact.email)
        .map((contact: any) => contact.email);
      
      console.log(`📧 Added ${bdiCpfrEmails.length} BDI CPFR contacts`);
    }

    // Get SKU owner organization CPFR contacts
    let skuOwnerEmails: string[] = [];
    if (skuData) {
      const { data: skuDetails } = await supabase
        .from('product_skus')
        .select('mfg')
        .eq('id', currentForecast.sku_id)
        .single();

      if (skuDetails?.mfg) {
        // Get organization CPFR contacts by code
        const { data: ownerOrg } = await supabase
          .from('organizations')
          .select('code, cpfr_contacts')
          .eq('code', skuDetails.mfg)
          .single();

        if (ownerOrg?.cpfr_contacts) {
          const cpfrData = ownerOrg.cpfr_contacts as any;
          const primaryContacts = cpfrData.primary_contacts || [];
          const escalationContacts = cpfrData.escalation_contacts || [];
          
          skuOwnerEmails = [...primaryContacts, ...escalationContacts]
            .filter((contact: any) => contact.active !== false && contact.email)
            .map((contact: any) => contact.email);
          
          console.log(`📧 Added ${skuOwnerEmails.length} ${ownerOrg.code} CPFR contacts`);
        }
      }
    }

    // Determine recipients based on who changed what
    let recipients: string[] = [];
    let emailSubject = '';
    let changeDescription = '';

    // BDI CPFR always gets notified
    recipients.push(...bdiCpfrEmails);

    // SKU owner organization always gets notified
    recipients.push(...skuOwnerEmails);

    if (milestone === 'sales') {
      emailSubject = `📊 Sales Updated Delivery Commitments`;
      changeDescription = 'Sales team has updated delivery dates and customer commitments';
    } else if (milestone === 'factory') {
      emailSubject = `🏭 Factory Updated Production Timeline`;
      changeDescription = 'Factory has updated EXW (Ex-Works) production dates';
    } else if (milestone === 'transit') {
      emailSubject = `🚛 Transit Updated Shipping Timeline`;
      changeDescription = 'Transit/Logistics team has updated shipping timeline';
    } else if (milestone === 'warehouse') {
      emailSubject = `📦 Warehouse Updated Final Delivery`;
      changeDescription = 'Warehouse has updated final customer delivery commitment';
    }

    // Use the NEW status that was just set (not the old one from database)
    const currentStatus = newStatus;

    // Map status to display-friendly names
    const statusDisplayName = currentStatus === 'confirmed' ? 'Confirmed' :
                              currentStatus === 'in_transit' ? 'In Transit' :
                              currentStatus === 'submitted' ? 'Submitted' :
                              currentStatus === 'delayed' ? 'Delayed' :
                              currentStatus === 'at_warehouse' ? 'At Warehouse' :
                              currentStatus === 'delivered' ? 'Delivered' :
                              currentStatus;

    // Map milestone to icon and color
    const milestoneIcon = milestone === 'sales' ? '👤' :
                         milestone === 'factory' ? '🏭' :
                         milestone === 'transit' ? '✈️' :
                         milestone === 'warehouse' ? '📦' :
                         '📅';

    const milestoneColor = milestone === 'sales' ? '#3b82f6' :
                          milestone === 'factory' ? '#f59e0b' :
                          milestone === 'transit' ? '#10b981' :
                          milestone === 'warehouse' ? '#8b5cf6' :
                          '#2563eb';

    // Build change details
    const changeDetails = Object.entries(changeEntry.changes)
      .map(([field, change]: [string, any]) => {
        const fieldName = field === 'customExwDate' ? 'EXW Date' :
                         field === 'deliveryWeek' ? 'Delivery Week' :
                         field === 'confirmedDeliveryDate' ? 'Final Delivery Date' :
                         field === 'manualTransitTime' ? 'Transit Time' :
                         field === 'estimatedTransitStart' ? 'Transit Start' :
                         field === 'estimatedWarehouseArrival' ? 'Warehouse Arrival' :
                         field;
        
        return `<li><strong>${fieldName}:</strong> ${change.was || 'Not set'} → <span style="color: #dc2626; font-weight: bold;">${change.is}</span></li>`;
      }).join('');

    // Send comprehensive notification
    const emailResult = await resend.emails.send({
      from: 'CPFR System <cpfr@bdibusinessportal.com>',
      to: [...new Set(recipients)], // Remove duplicates
      subject: `${emailSubject} - ${forecastEmailData.sku?.sku || 'SKU'} - ${forecastEmailData.delivery_week}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">${milestoneIcon} CPFR Timeline Update</h2>
          
          <p>Hello CPFR Team,</p>
          
          <p>${changeDescription}:</p>

          <!-- STATUS UPDATE - PROMINENT -->
          <div style="background-color: ${milestoneColor}15; border: 3px solid ${milestoneColor}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
            <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px;">Current Shipment Status:</h2>
            <div style="font-size: 32px; font-weight: bold; color: ${milestoneColor}; margin: 12px 0;">
              ${milestoneIcon} ${statusDisplayName}
            </div>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
              Updated by ${milestone.charAt(0).toUpperCase() + milestone.slice(1)} Team
            </p>
          </div>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Forecast Details:</h3>
            <p><strong>SKU:</strong> ${forecastEmailData.sku?.sku || 'Unknown'} - ${forecastEmailData.sku?.name || 'Unknown Product'}</p>
            <p><strong>Quantity:</strong> ${forecastEmailData.quantity?.toLocaleString() || 'Unknown'} units</p>
            <p><strong>Delivery Week:</strong> ${forecastEmailData.delivery_week}</p>
            <p><strong>Shipping Method:</strong> ${forecastEmailData.shipping_preference}</p>
          </div>

          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">📋 Changes Made:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              ${changeDetails}
            </ul>
            <p style="margin-top: 10px;"><strong>Reason:</strong> ${changeEntry.reason}</p>
            <p><strong>Changed by:</strong> ${milestone.charAt(0).toUpperCase() + milestone.slice(1)} Team</p>
          </div>
          
          <p><strong>Next Steps:</strong> Please review the timeline changes and update your planning accordingly.</p>
          
          <p><a href="https://bdibusinessportal.com/cpfr/shipments" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review in CPFR Portal</a></p>
          
          <p>Best regards,<br>BDI CPFR System</p>
        </div>
      `,
      tags: [
        { name: 'type', value: 'cpfr-change-notification' },
        { name: 'forecast-id', value: forecastEmailData.id },
        { name: 'milestone', value: milestone }
      ]
    });

    console.log(`✅ CPFR change email sent to ${recipients.length} recipients:`, recipients);
    return true;

  } catch (error) {
    console.error('❌ Error sending CPFR change notifications:', error);
    return false;
  }
}

// Legacy function - now replaced by comprehensive system above
async function sendEXWChangeNotification(forecastData: any, oldExwDate: string, newExwDate: string) {
  if (!resend) {
    console.log('📧 Resend not configured - skipping EXW change email');
    return false;
  }

  try {
    console.log(`📧 Sending EXW change notification: ${oldExwDate} → ${newExwDate}`);

    // Send to Sales team (BDI internal)
    const salesEmails = [
      'scistulli@boundlessdevices.com', // CEO
      'dzand@boundlessdevices.com'      // Primary business contact
    ];

    const emailResult = await resend.emails.send({
      from: 'CPFR System <cpfr@bdibusinessportal.com>',
      to: salesEmails,
      subject: `🏭 Factory EXW Date Changed - ${forecastData.sku?.sku || 'SKU'} - ${forecastData.delivery_week}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🏭 Factory EXW Date Change Alert</h2>
          
          <p>Hello Sales Team,</p>
          
          <p>The factory has changed the EXW (Ex-Works) date for one of your forecasts:</p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Forecast Details:</h3>
            <p><strong>SKU:</strong> ${forecastData.sku?.sku || 'Unknown'} - ${forecastData.sku?.name || 'Unknown Product'}</p>
            <p><strong>Quantity:</strong> ${forecastData.quantity?.toLocaleString() || 'Unknown'} units</p>
            <p><strong>Delivery Week:</strong> ${forecastData.delivery_week}</p>
          </div>

          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">📅 Date Change:</h3>
            <p><strong>Original EXW Date:</strong> ${oldExwDate}</p>
            <p><strong>New EXW Date:</strong> <span style="color: #dc2626; font-weight: bold;">${newExwDate}</span></p>
            <p><strong>Change Impact:</strong> ${new Date(newExwDate) > new Date(oldExwDate) ? 'DELAY' : 'EXPEDITE'}</p>
          </div>
          
          <p><strong>Action Required:</strong> Please review the impact on customer delivery commitments and update stakeholders as needed.</p>
          
          <p><a href="https://bdibusinessportal.com/cpfr/shipments" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review in CPFR Portal</a></p>
          
          <p>Best regards,<br>BDI CPFR System</p>
        </div>
      `,
      tags: [
        { name: 'type', value: 'exw-date-change' },
        { name: 'forecast-id', value: forecastData.id },
        { name: 'milestone', value: 'factory' }
      ]
    });

    console.log('✅ EXW change email sent successfully:', emailResult);
    return true;

  } catch (error) {
    console.error('❌ Error sending EXW change notification:', error);
    return false;
  }
}

// Smart Date Cascade Logic Engine
async function implementDateCascadeLogic(updateData: any, dateChanges: any, currentForecast: any) {
  console.log('🔄 Implementing date cascade logic...');
  
  // Default lead times (can be overridden by manual settings)
  const DEFAULT_FACTORY_LEAD_TIME = 30; // days
  const DEFAULT_TRANSIT_TIME = 21; // days  
  const DEFAULT_WAREHOUSE_PROCESSING = 3; // days
  const DEFAULT_BUFFER_DAYS = 5; // days

  // Get manual overrides or use defaults
  const factoryLeadTime = dateChanges.manualFactoryLeadTime || currentForecast.manual_factory_lead_time || DEFAULT_FACTORY_LEAD_TIME;
  const transitTime = dateChanges.manualTransitTime || currentForecast.manual_transit_time || DEFAULT_TRANSIT_TIME;
  const warehouseProcessing = dateChanges.manualWarehouseProcessing || currentForecast.manual_warehouse_processing || DEFAULT_WAREHOUSE_PROCESSING;
  const bufferDays = dateChanges.manualBufferDays || currentForecast.manual_buffer_days || DEFAULT_BUFFER_DAYS;

  // Helper function to add days to a date
  const addDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  // Helper function to subtract days from a date
  const subtractDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  // Check if multiple dates are being hard-coded simultaneously
  const isMultipleDateOverride = Object.keys(dateChanges).filter(key => 
    ['customExwDate', 'estimatedTransitStart', 'estimatedWarehouseArrival', 'confirmedDeliveryDate'].includes(key)
  ).length > 1;

  if (isMultipleDateOverride) {
    console.log('📅 Multiple dates being hard-coded - no cascade logic applied');
    // When multiple dates are set, don't cascade - just set them as specified
    // This allows users to hard-code the entire timeline
  } else {
    // FORWARD CASCADE: When upstream dates change, calculate downstream dates
    if (dateChanges.customExwDate) {
      console.log('📅 Factory EXW date changed - cascading forward...');
      const exwDate = dateChanges.customExwDate;
      
      // Only cascade if downstream dates aren't also being manually set
      if (!dateChanges.estimatedTransitStart) {
        updateData.estimated_transit_start = exwDate;
      }
      if (!dateChanges.estimatedWarehouseArrival) {
        updateData.estimated_warehouse_arrival = addDays(dateChanges.estimatedTransitStart || exwDate, transitTime);
      }
      if (!dateChanges.confirmedDeliveryDate) {
        updateData.confirmed_delivery_date = addDays(updateData.estimated_warehouse_arrival, warehouseProcessing + bufferDays);
      }
      
      console.log(`✅ Cascaded from EXW ${exwDate}: Transit=${updateData.estimated_transit_start}, Warehouse=${updateData.estimated_warehouse_arrival}, Delivery=${updateData.confirmed_delivery_date}`);
    }

    // TRANSIT TIME CASCADE: When transit time (duration) changes
    if (dateChanges.manualTransitTime && !dateChanges.customExwDate) {
      console.log('📅 Transit time changed - recalculating based on EXW date...');
      const newTransitTime = dateChanges.manualTransitTime;
      const exwDate = currentForecast.custom_exw_date;
      
      if (exwDate) {
        // Transit starts from EXW date (pickup date)
        updateData.estimated_transit_start = exwDate;
        
        // Warehouse arrival = EXW + New Transit Time
        updateData.estimated_warehouse_arrival = addDays(exwDate, newTransitTime);
        
        // Final delivery = Warehouse Arrival + Processing Time + Buffer
        updateData.confirmed_delivery_date = addDays(updateData.estimated_warehouse_arrival, warehouseProcessing + bufferDays);
        
        console.log(`✅ Transit time cascade from EXW ${exwDate} + ${newTransitTime} days: Transit=${updateData.estimated_transit_start}, Warehouse=${updateData.estimated_warehouse_arrival}, Delivery=${updateData.confirmed_delivery_date}`);
      } else {
        console.log('⚠️ No EXW date set - cannot calculate transit timeline');
      }
    }

    // WAREHOUSE FINAL DELIVERY OVERRIDE: When warehouse sets final delivery date
    if (dateChanges.confirmedDeliveryDate && !dateChanges.estimatedWarehouseArrival && !dateChanges.estimatedTransitStart && !dateChanges.customExwDate) {
      console.log('📅 Warehouse set final delivery date - no cascade, pure override');
      // Warehouse controls the final customer delivery commitment
      // No cascade needed - just set the final delivery date as specified
      // This allows warehouse to adjust for customs delays, processing issues, expedited delivery, etc.
    }
  }

  // Store manual overrides if provided
  if (dateChanges.manualFactoryLeadTime) updateData.manual_factory_lead_time = dateChanges.manualFactoryLeadTime;
  if (dateChanges.manualTransitTime) updateData.manual_transit_time = dateChanges.manualTransitTime;
  if (dateChanges.manualWarehouseProcessing) updateData.manual_warehouse_processing = dateChanges.manualWarehouseProcessing;
  if (dateChanges.manualBufferDays) updateData.manual_buffer_days = dateChanges.manualBufferDays;

  console.log('✅ Date cascade logic completed');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { milestone, status, notes, dateChanges, dateChangeReason } = body;

    if (!milestone || !status) {
      return NextResponse.json(
        { error: 'Milestone and status are required' },
        { status: 400 }
      );
    }

    // Validate milestone type
    if (!['sales', 'factory', 'transit', 'warehouse'].includes(milestone)) {
      return NextResponse.json(
        { error: 'Invalid milestone type' },
        { status: 400 }
      );
    }

    // Map milestone to database column
    const signalColumn = milestone === 'sales' ? 'sales_signal' :
                        milestone === 'factory' ? 'factory_signal' :
                        milestone === 'transit' ? 'transit_signal' :
                        milestone === 'warehouse' ? 'warehouse_signal' :
                        'shipping_signal'; // fallback

    // Get current forecast data for change tracking
    const { data: currentForecast, error: fetchError } = await supabase
      .from('sales_forecasts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentForecast) {
      return NextResponse.json(
        { error: 'Forecast not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      [signalColumn]: status,
      updated_at: new Date().toISOString()
    };

    // Process date changes and implement cascade logic
    if (dateChanges && Object.keys(dateChanges).length > 0) {
      console.log('📅 Processing date changes:', dateChanges);
      
      // Track what changed for history
      const changeHistory = currentForecast.date_change_history || [];
      const changeEntry: any = {
        timestamp: new Date().toISOString(),
        milestone,
        changes: {},
        reason: dateChangeReason || 'No reason provided'
      };

      // Process each date change
      for (const [field, newValue] of Object.entries(dateChanges)) {
        if (newValue !== null && newValue !== undefined && newValue !== '') {
          const currentValue = currentForecast[field];
          
          // Only record changes if value actually changed
          if (currentValue !== newValue) {
            changeEntry.changes[field] = {
              was: currentValue,
              is: newValue
            };
            
            // Map camelCase to snake_case for database
            const dbField = field === 'deliveryWeek' ? 'delivery_week' :
                           field === 'customExwDate' ? 'custom_exw_date' :
                           field === 'estimatedTransitStart' ? 'estimated_transit_start' :
                           field === 'estimatedWarehouseArrival' ? 'estimated_warehouse_arrival' :
                           field === 'confirmedDeliveryDate' ? 'confirmed_delivery_date' :
                           field === 'manualFactoryLeadTime' ? 'manual_factory_lead_time' :
                           field === 'manualTransitTime' ? 'manual_transit_time' :
                           field === 'manualWarehouseProcessing' ? 'manual_warehouse_processing' :
                           field === 'manualBufferDays' ? 'manual_buffer_days' :
                           field;
            
            // Update the field
            updateData[dbField] = newValue;
            
            // Set original values if this is the first time they're being changed
            const originalField = `original_${field.replace('custom_', '').replace('estimated_', '').replace('confirmed_', '')}`;
            if (field === 'deliveryWeek' && !currentForecast.original_delivery_date) {
              updateData.original_delivery_date = currentValue;
            } else if (field === 'customExwDate' && !currentForecast.original_exw_date) {
              updateData.original_exw_date = currentValue;
            } else if (field === 'estimatedTransitStart' && !currentForecast.original_transit_start) {
              updateData.original_transit_start = currentValue;
            } else if (field === 'estimatedWarehouseArrival' && !currentForecast.original_warehouse_arrival) {
              updateData.original_warehouse_arrival = currentValue;
            }
          }
        }
      }

      // Implement Smart Date Cascade Logic
      await implementDateCascadeLogic(updateData, dateChanges, currentForecast);

      // Add change entry to history if there were actual changes
      if (Object.keys(changeEntry.changes).length > 0) {
        changeHistory.push(changeEntry);
        updateData.date_change_history = changeHistory;
        updateData.last_date_change_at = new Date().toISOString();
        updateData.date_change_reason = dateChangeReason;
        // TODO: Add user ID when auth context is available
        // updateData.last_date_change_by = userId;

        // 📧 COMPREHENSIVE EMAIL NOTIFICATIONS: Send to all affected stakeholders
        await sendCPFRChangeNotifications(milestone, changeEntry, currentForecast, status);
      }
    }

    // If updating sales status, also update the main status field
    if (milestone === 'sales') {
      updateData.status = status === 'confirmed' ? 'submitted' : 
                          status === 'submitted' ? 'submitted' :
                         'draft';
    }

    // Add notes if provided - using the already fetched currentForecast data
    if (notes) {
      const existingNotes = currentForecast?.notes || '';
      const timestamp = new Date().toISOString().split('T')[0];
      const newNote = `[${timestamp}] ${milestone.toUpperCase()} → ${status}: ${notes}`;
      
      updateData.notes = existingNotes ? 
        `${existingNotes}\n${newNote}` : 
        newNote;
    }

    console.log('🔄 Updating forecast status:', {
      forecastId: id,
      milestone,
      status,
      updateData
    });

    // Update the forecast
    const { data, error } = await supabase
      .from('sales_forecasts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update forecast status' },
        { status: 500 }
      );
    }

    console.log('✅ Forecast status updated successfully:', data);

    // 🔄 BI-DIRECTIONAL SYNC: Update linked shipment signals
    console.log('🔄 Syncing shipment signals with forecast...');
    
    const { data: linkedShipments, error: shipmentQueryError } = await supabase
      .from('shipments')
      .select('id')
      .eq('forecast_id', id);
    
    if (linkedShipments && linkedShipments.length > 0) {
      const shipmentUpdateData: any = {
        [signalColumn]: status,
        updated_at: new Date().toISOString()
      };
      
      // Update all linked shipments with the same signal change
      const { error: shipmentUpdateError } = await supabase
        .from('shipments')
        .update(shipmentUpdateData)
        .in('id', linkedShipments.map(s => s.id));
      
      if (shipmentUpdateError) {
        console.error('⚠️ Failed to sync shipment signals:', shipmentUpdateError);
      } else {
        console.log(`✅ Synced ${linkedShipments.length} shipment(s) with forecast signal: ${milestone} → ${status}`);
      }
    } else {
      console.log('ℹ️ No linked shipments found for forecast:', id);
    }

    // TODO: Add email notification logic here
    // await sendStatusChangeEmail(data, milestone, status, notes);

    return NextResponse.json({
      success: true,
      forecast: data,
      message: `${milestone} status updated to ${status}`,
      syncedShipments: linkedShipments?.length || 0
    });

  } catch (error) {
    console.error('❌ Status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
