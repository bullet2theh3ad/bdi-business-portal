import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

export async function PUT(request: NextRequest) {
  try {
    console.log('🔐 PASSWORD CHANGE - Starting password change process');
    
    const supabase = await createSupabaseServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      console.log('🔐 PASSWORD CHANGE - Authentication failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔐 PASSWORD CHANGE - User authenticated:', authUser.email);

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: 'Current password and new password are required' 
      }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ 
        error: 'New password must be at least 8 characters long' 
      }, { status: 400 });
    }

    console.log('🔐 PASSWORD CHANGE - Validation passed');

    // First verify the current password by attempting to sign in
    console.log('🔐 PASSWORD CHANGE - Verifying current password');
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: authUser.email!,
      password: currentPassword
    });

    if (signInError) {
      console.log('🔐 PASSWORD CHANGE - Current password verification failed:', signInError.message);
      return NextResponse.json({ 
        error: 'Current password is incorrect' 
      }, { status: 400 });
    }

    console.log('🔐 PASSWORD CHANGE - Current password verified successfully');

    // Now update the password using the authenticated session
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('🔐 PASSWORD CHANGE - Failed to update password:', updateError);
      return NextResponse.json({ 
        error: `Failed to update password: ${updateError.message}` 
      }, { status: 500 });
    }

    console.log('✅ PASSWORD CHANGE - Password updated successfully for:', authUser.email);

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ PASSWORD CHANGE - Error in password change process:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
