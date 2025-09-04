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
    const { milestone, status, notes } = body;

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

    // Prepare update data
    const updateData: any = {
      [signalColumn]: status,
      updated_at: new Date().toISOString()
    };

    // If updating sales status, also update the main status field
    if (milestone === 'sales') {
      updateData.status = status === 'accepted' ? 'submitted' : 
                         status === 'submitted' ? 'submitted' :
                         'draft';
    }

    // Add notes if provided (we'll need to add a notes field to track status change history)
    if (notes) {
      // For now, we'll store notes in the existing notes field
      // Later we might want a separate status_change_history table
      const { data: currentForecast } = await supabase
        .from('sales_forecasts')
        .select('notes')
        .eq('id', id)
        .single();

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

    // TODO: Add email notification logic here
    // await sendStatusChangeEmail(data, milestone, status, notes);

    return NextResponse.json({
      success: true,
      forecast: data,
      message: `${milestone} status updated to ${status}`
    });

  } catch (error) {
    console.error('❌ Status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
