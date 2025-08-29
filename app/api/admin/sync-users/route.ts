import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { isNull, and, eq } from 'drizzle-orm';
import { createSupabaseAuthUser } from '@/lib/auth/supabase-sync';

export async function POST(request: NextRequest) {
  try {
    // Get all users that exist in our custom users table
    const allUsers = await db
      .select()
      .from(users)
      .where(and(isNull(users.deletedAt)));

    console.log(`🔄 SYNC: Found ${allUsers.length} users to sync`);

    const results = [];

    for (const user of allUsers) {
      if (!user.riderId) {
        console.log(`⚠️ SYNC: Skipping user ${user.email} - no rider_id`);
        results.push({
          email: user.email,
          status: 'skipped',
          reason: 'no_rider_id'
        });
        continue;
      }

      try {
        // For existing users, we need to generate a temporary password
        // In production, you might want to send a password reset email instead
        const tempPassword = `temp_${user.email.split('@')[0]}_${Date.now()}`;
        
        await createSupabaseAuthUser({
          email: user.email,
          password: tempPassword,
          riderId: user.riderId,
          name: user.name || undefined
        });

        console.log(`✅ SYNC: Successfully synced user ${user.email}`);
        results.push({
          email: user.email,
          status: 'synced',
          tempPassword: tempPassword, // Only for existing users
          note: 'User will need to reset password on mobile'
        });

      } catch (syncError: any) {
        console.error(`❌ SYNC: Failed to sync user ${user.email}:`, syncError);
        results.push({
          email: user.email,
          status: 'failed',
          error: syncError.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed for ${allUsers.length} users`,
      results: results
    });

  } catch (error) {
    console.error('Error syncing users:', error);
    return NextResponse.json(
      { error: 'Failed to sync users' },
      { status: 500 }
    );
  }
}

// Alternative: Sync specific user by email
export async function PUT(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user in our custom users table
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.riderId) {
      return NextResponse.json(
        { error: 'User has no rider_id' },
        { status: 400 }
      );
    }

    // Create Supabase Auth user
    await createSupabaseAuthUser({
      email: user.email,
      password: password,
      riderId: user.riderId,
      name: user.name || undefined
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced user ${email} to Supabase Auth`,
      riderId: user.riderId
    });

  } catch (error: any) {
    console.error('Error syncing specific user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync user' },
      { status: 500 }
    );
  }
}
