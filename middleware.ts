import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers, organizations } from '@/lib/db/schema';
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

      // Check if user has organization membership and get organization details
      const [membershipWithOrg] = await db
        .select({
          membership: {
            role: organizationMembers.role,
            organizationUuid: organizationMembers.organizationUuid,
          },
          organization: {
            id: organizations.id,
            code: organizations.code,
            name: organizations.name,
            type: organizations.type,
            enabledPages: organizations.enabledPages,
          }
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
        .where(eq(organizationMembers.userAuthId, dbUser.authId))
        .limit(1);

      if (!membershipWithOrg) {
        console.log('User has no organization membership');
        // Force logout and redirect to sign-in
        const response = NextResponse.redirect(new URL('/sign-in', request.url));
        response.cookies.delete('sb-access-token');
        response.cookies.delete('sb-refresh-token');
        return response;
      }

      // Page access control for non-BDI organizations
      const userOrg = membershipWithOrg.organization;
      const isBDIUser = userOrg.code === 'BDI' && userOrg.type === 'internal';
      const isSuperAdmin = dbUser.role === 'super_admin';

      console.log(`🔍 MIDDLEWARE DEBUG - User: ${dbUser.email}`);
      console.log(`🔍 MIDDLEWARE DEBUG - Organization: ${userOrg.code} (${userOrg.type})`);
      console.log(`🔍 MIDDLEWARE DEBUG - isBDIUser: ${isBDIUser}, isSuperAdmin: ${isSuperAdmin}`);
      console.log(`🔍 MIDDLEWARE DEBUG - User role: ${dbUser.role}, Supplier code: ${dbUser.supplierCode}`);

      // BDI Super Admins have access to everything
      if (!isBDIUser && !isSuperAdmin) {
        const enabledPages = userOrg.enabledPages as any || {};
        
        // Map routes to page permissions
        const pagePermissions: Record<string, string> = {
          '/cpfr/forecasts': 'cpfr_forecasts',
          '/cpfr/shipments': 'cpfr_shipments',
          '/cpfr/invoices': 'cpfr_invoices', 
          '/cpfr/purchase-orders': 'cpfr_purchase_orders',
          '/inventory/production-files': 'inventory_production_files',
          '/inventory/warehouses': 'inventory_warehouses',
          '/organization/users': 'organization_users',
          '/organization/analytics': 'organization_analytics',
        };

        // Check if current page is restricted
        for (const [route, permission] of Object.entries(pagePermissions)) {
          if (pathname.startsWith(route) && !enabledPages[permission]) {
            console.log(`Page access denied for ${userOrg.code}: ${route} (${permission} not enabled)`);
            return NextResponse.redirect(new URL('/dashboard?error=page_access_denied', request.url));
          }
        }
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