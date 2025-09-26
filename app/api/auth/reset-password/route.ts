import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    console.log('🔐 Processing password reset with custom token...');

    // Verify token and get user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, auth_id, email, name, reset_token, reset_token_expiry')
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

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update password in database and clear reset token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
        updated_at: new Date().toISOString()
      })
      .eq('auth_id', userData.auth_id);

    if (updateError) {
      console.error('Error updating password in database:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Update password in Supabase Auth using admin API
    try {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userData.auth_id,
        { password: password }
      );

      if (authError) {
        console.error('Error updating Supabase Auth password:', authError);
        return NextResponse.json({ error: 'Failed to update authentication password' }, { status: 500 });
      }

      console.log('✅ Password updated successfully in both database and Supabase Auth');
    } catch (authError) {
      console.error('Error with Supabase Auth update:', authError);
      return NextResponse.json({ error: 'Failed to update authentication password' }, { status: 500 });
    }

    console.log('✅ Password reset completed for:', userData.email);

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });

  } catch (error) {
    console.error('Password reset API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}