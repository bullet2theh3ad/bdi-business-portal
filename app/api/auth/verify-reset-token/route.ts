import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    console.log('🔐 Verifying reset token...');

    // Check if token exists and is not expired
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, auth_id, name, email, reset_token, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    // Check if token is expired
    const now = new Date();
    const expiry = new Date(userData.reset_token_expiry);
    
    if (now > expiry) {
      // Clean up expired token
      await supabase
        .from('users')
        .update({
          reset_token: null,
          reset_token_expiry: null,
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', userData.auth_id);

      return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 });
    }

    console.log('✅ Reset token verified successfully for:', userData.email);

    return NextResponse.json({ 
      success: true,
      user: {
        email: userData.email,
        name: userData.name
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
