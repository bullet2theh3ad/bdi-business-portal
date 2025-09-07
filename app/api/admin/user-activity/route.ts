import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers, organizationInvitations } from '@/lib/db/schema';
import { eq, and, gte, desc, isNotNull, sql } from 'drizzle-orm';

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

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  
  if (error || !authUser) {
    return null;
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, authUser.email!))
    .limit(1);

  return dbUser;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    // Only Super Admin can see all user activity
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7'); // Default last 7 days
    const limit = parseInt(searchParams.get('limit') || '50'); // Default 50 activities

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.log(`📊 User Activity Debug - Super Admin: ${currentUser.email}, Days: ${days}, Limit: ${limit}`);

    // Get comprehensive user activity across all organizations
    const activities = await db.execute(sql`
      WITH user_activities AS (
        -- User logins (last_login_at updates)
        SELECT 
          'user_login' as activity_type,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          o.code as organization_code,
          o.name as organization_name,
          u.last_login_at as activity_time,
          'Logged in' as activity_description,
          u.last_login_at as created_at
        FROM users u
        JOIN organization_members om ON u.auth_id = om.user_auth_id
        JOIN organizations o ON om.organization_uuid = o.id
        WHERE u.last_login_at IS NOT NULL
          AND u.last_login_at >= ${startDate.toISOString()}::timestamp
        
        UNION ALL
        
        -- User registrations/creations
        SELECT 
          'user_created' as activity_type,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          o.code as organization_code,
          o.name as organization_name,
          u.created_at as activity_time,
          CASE 
            WHEN u.password_hash = 'invitation_pending' THEN 'User invited (pending)'
            WHEN u.is_active = true THEN 'User account activated'
            ELSE 'User account created'
          END as activity_description,
          u.created_at
        FROM users u
        JOIN organization_members om ON u.auth_id = om.user_auth_id
        JOIN organizations o ON om.organization_uuid = o.id
        WHERE u.created_at >= ${startDate.toISOString()}::timestamp
        
        UNION ALL
        
        -- Organization invitations sent
        SELECT 
          'org_invitation_sent' as activity_type,
          NULL as user_id,
          oi.invited_name as user_name,
          oi.invited_email as user_email,
          oi.invited_role as user_role,
          oi.organization_code,
          oi.organization_code as organization_name,
          oi.created_at as activity_time,
          'Organization invitation sent' as activity_description,
          oi.created_at
        FROM organization_invitations oi
        WHERE oi.created_at >= ${startDate.toISOString()}::timestamp
        
        UNION ALL
        
        -- User updates (profile changes, role changes)
        SELECT 
          'user_updated' as activity_type,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          o.code as organization_code,
          o.name as organization_name,
          u.updated_at as activity_time,
          'Profile updated' as activity_description,
          u.updated_at as created_at
        FROM users u
        JOIN organization_members om ON u.auth_id = om.user_auth_id
        JOIN organizations o ON om.organization_uuid = o.id
        WHERE u.updated_at >= ${startDate.toISOString()}::timestamp
          AND u.updated_at != u.created_at -- Only actual updates, not initial creation
      )
      SELECT * FROM user_activities
      ORDER BY activity_time DESC
      LIMIT ${limit}
    `);

    const formattedActivities = (activities as any).map((activity: any) => ({
      id: `${activity.activity_type}-${activity.user_id || 'system'}-${new Date(activity.activity_time).getTime()}`,
      type: activity.activity_type,
      userId: activity.user_id,
      userName: activity.user_name,
      userEmail: activity.user_email,
      userRole: activity.user_role,
      organizationCode: activity.organization_code,
      organizationName: activity.organization_name,
      activityTime: activity.activity_time,
      description: activity.activity_description,
      createdAt: activity.created_at
    }));

    console.log(`📊 Found ${formattedActivities.length} user activities for Super Admin oversight`);

    return NextResponse.json({
      activities: formattedActivities,
      totalFound: formattedActivities.length,
      timeRange: `Last ${days} days`,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching user activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
