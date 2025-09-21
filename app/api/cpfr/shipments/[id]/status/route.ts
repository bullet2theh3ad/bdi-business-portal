import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    if (!['sales', 'factory', 'shipping', 'transit', 'warehouse'].includes(milestone)) {
      return NextResponse.json(
        { error: 'Invalid milestone type' },
        { status: 400 }
      );
    }

    // Map milestone to database column
    const signalColumn = milestone === 'sales' ? 'sales_signal' :
                        milestone === 'factory' ? 'factory_signal' :
                        milestone === 'shipping' ? 'shipping_signal' :
                        milestone === 'transit' ? 'transit_signal' :
                        'warehouse_signal';

    // Prepare update data
    const updateData: any = {
      [signalColumn]: status,
      updated_at: new Date().toISOString()
    };

    // Add notes if provided
    if (notes) {
      const { data: currentShipment } = await supabase
        .from('shipments')
        .select('notes')
        .eq('id', id)
        .single();

      const existingNotes = currentShipment?.notes || '';
      const timestamp = new Date().toISOString().split('T')[0];
      const newNote = `[${timestamp}] ${milestone.toUpperCase()} → ${status}: ${notes}`;
      
      updateData.notes = existingNotes ? 
        `${existingNotes}\n${newNote}` : 
        newNote;
    }

    console.log('🔄 Updating shipment status:', {
      shipmentId: id,
      milestone,
      status,
      updateData
    });

    // Update the shipment
    const { data: updatedShipment, error } = await supabase
      .from('shipments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update shipment status' },
        { status: 500 }
      );
    }

    console.log('✅ Shipment status updated successfully:', updatedShipment);

    // 🔄 BI-DIRECTIONAL SYNC: Update linked forecast signals AND date changes
    console.log('🔄 Syncing forecast signals with shipment...');
    
    if (updatedShipment.forecast_id) {
      const forecastUpdateData: any = {
        [signalColumn]: status,
        updated_at: new Date().toISOString()
      };

      // If there are date changes, sync them to the forecast as well
      if (dateChanges && Object.keys(dateChanges).length > 0) {
        console.log('📅 Syncing date changes to linked forecast...');
        
        // Map shipment date changes to forecast fields
        for (const [field, value] of Object.entries(dateChanges)) {
          if (value !== null && value !== undefined && value !== '') {
            forecastUpdateData[field] = value;
          }
        }

        // Add change tracking to forecast
        if (dateChangeReason) {
          forecastUpdateData.date_change_reason = dateChangeReason;
          forecastUpdateData.last_date_change_at = new Date().toISOString();
        }

        // Call the forecast status endpoint to handle full date cascade logic
        try {
          const forecastResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cpfr/forecasts/${updatedShipment.forecast_id}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              milestone,
              status,
              notes,
              dateChanges,
              dateChangeReason
            }),
          });

          if (forecastResponse.ok) {
            console.log('✅ Successfully synced date changes to forecast via API');
          } else {
            console.error('⚠️ Failed to sync date changes to forecast via API');
            // Fallback to direct database update
            const { error: forecastUpdateError } = await supabase
              .from('sales_forecasts')
              .update(forecastUpdateData)
              .eq('id', updatedShipment.forecast_id);
            
            if (forecastUpdateError) {
              console.error('⚠️ Failed to sync forecast signals:', forecastUpdateError);
            } else {
              console.log(`✅ Synced forecast with shipment signal: ${milestone} → ${status}`);
            }
          }
        } catch (error) {
          console.error('⚠️ Error calling forecast API, falling back to direct update:', error);
          // Fallback to direct database update
          const { error: forecastUpdateError } = await supabase
            .from('sales_forecasts')
            .update(forecastUpdateData)
            .eq('id', updatedShipment.forecast_id);
          
          if (forecastUpdateError) {
            console.error('⚠️ Failed to sync forecast signals:', forecastUpdateError);
          } else {
            console.log(`✅ Synced forecast with shipment signal: ${milestone} → ${status}`);
          }
        }
      } else {
        // No date changes, just sync the status
        const { error: forecastUpdateError } = await supabase
          .from('sales_forecasts')
          .update(forecastUpdateData)
          .eq('id', updatedShipment.forecast_id);
        
        if (forecastUpdateError) {
          console.error('⚠️ Failed to sync forecast signals:', forecastUpdateError);
        } else {
          console.log(`✅ Synced forecast with shipment signal: ${milestone} → ${status}`);
        }
      }
    } else {
      console.log('ℹ️ No linked forecast found for shipment:', id);
    }

    return NextResponse.json({
      success: true,
      shipment: updatedShipment,
      message: `${milestone} status updated to ${status}`,
      syncedForecast: !!updatedShipment.forecast_id
    });

  } catch (error) {
    console.error('❌ Status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
