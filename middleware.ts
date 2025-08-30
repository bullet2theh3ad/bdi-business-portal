import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const protectedRoutes = '/dashboard';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = pathname.startsWith(protectedRoutes);

  // Create Supabase client for middleware
  const response = NextResponse.next();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Check authentication for protected routes
  if (isProtectedRoute) {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Additional check: Verify user exists in our database and has organization membership
    try {
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      if (!dbUser || !dbUser.isActive) {
        console.log('User not found in database or inactive:', user.email);
        // Force logout and redirect to sign-in
        const response = NextResponse.redirect(new URL('/sign-in', request.url));
        response.cookies.delete('sb-access-token');
        response.cookies.delete('sb-refresh-token');
        return response;
      }

      // Check if user has at least one organization membership
      const [membership] = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userAuthId, dbUser.authId))
        .limit(1);

      if (!membership) {
        console.log('User has no organization membership:', user.email);
        // Force logout and redirect to sign-in
        const response = NextResponse.redirect(new URL('/sign-in', request.url));
        response.cookies.delete('sb-access-token');
        response.cookies.delete('sb-refresh-token');
        return response;
      }

    } catch (dbError) {
      console.error('Database check failed in middleware:', dbError);
      // On database error, allow through but log the issue
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs'
};