import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseCLient';
import { getUser } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    // Get current authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (user.riderId === null || user.riderId === undefined) {
      return NextResponse.json({ error: 'User does not have a rider_id' }, { status: 400 });
    }

    const body = await request.json();
    const {
      latitude,
      longitude,
      status_code,
      accuracy,
      battery_level,
      app_version = '1.0.0'
    } = body;

    // Validate required fields
    if (status_code === undefined || status_code === null) {
      return NextResponse.json({ error: 'status_code is required' }, { status: 400 });
    }

    // Validate status_code range
    if (status_code < 0 || status_code > 4) {
      return NextResponse.json({ error: 'status_code must be between 0-4' }, { status: 400 });
    }

    // For status 0 (offline), we might not have GPS data
    if (status_code !== 0 && (!latitude || !longitude)) {
      return NextResponse.json({ error: 'latitude and longitude are required for online status' }, { status: 400 });
    }

    console.log(`📍 Storing status ping for user ${user.id} with rider_id ${user.riderId}`);

    // Insert status ping into database using the user's rider_id (not user_id)
    const { data, error } = await supabaseAdmin
      .from('user_status_pings')
      .insert({
        rider_id: user.riderId, // 🔄 MIGRATION: Now uses Supabase auth.users UUID
        latitude: latitude || null,
        longitude: longitude || null,
        status_code,
        timestamp: new Date().toISOString(),
        accuracy: accuracy || null,
        battery_level: battery_level || null,
        app_version
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting status ping:', error);
      return NextResponse.json({ error: 'Failed to save status ping' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Status ping saved successfully' 
    });

  } catch (error) {
    console.error('Error in status ping API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedRiderId = searchParams.get('rider_id');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // Determine which rider's data to fetch
    let targetRiderId = user.riderId; // Default to user's own data

    if (requestedRiderId) {
      // Check if user has permission to view this rider's data
      if (user.role === 'owner') {
        // Owners can view any team member's data
        targetRiderId = requestedRiderId;
      } else if (requestedRiderId !== user.riderId) {
        // Regular members can only view their own data
        return NextResponse.json({ error: 'Permission denied: cannot view other riders status' }, { status: 403 });
      }
    }

    if (!targetRiderId) {
      return NextResponse.json({ error: 'No rider_id found for user' }, { status: 400 });
    }

    // Get recent status pings for the rider
    const { data: statusPings, error } = await supabaseAdmin
      .from('user_status_pings')
      .select('*')
      .eq('rider_id', targetRiderId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching status pings:', error);
      return NextResponse.json({ error: 'Failed to fetch status pings' }, { status: 500 });
    }

    return NextResponse.json({ 
      statusPings: statusPings || [],
      riderId: targetRiderId
    });

  } catch (error) {
    console.error('Error in status ping GET API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}