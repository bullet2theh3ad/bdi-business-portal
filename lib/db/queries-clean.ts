import { desc, and, eq, isNull, sql, ne } from 'drizzle-orm';
import { db } from './drizzle';
import { 
  users, 
  organizations,
  organizationMembers
} from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'string' // UUID from Supabase auth.users
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  // For BDI Portal, we'll look up by authId from session
  const userAuthId = sessionData.user.id;
  
  if (!userAuthId) {
    return null;
  }
  
  // Query the actual users table to get real user data
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.authId, userAuthId), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    console.log(`❌ No user found with authId "${userAuthId}"`);
    return null;
  }

  const foundUser = user[0];
  console.log(`✅ Found user: ${foundUser.email}`);
  
  return foundUser;
}

// All legacy team/group/activity functions removed - B2B portal uses organizations only
