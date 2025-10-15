import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers, organizations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    
    if (error || !authUser) {
      return Response.json(null);
    }

    console.log('Looking up user by email:', authUser.email);
    console.log('Supabase auth user ID:', authUser.id);

    // Try to find user by auth_id first, then by email as fallback
    let [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      console.log('User not found by auth_id, trying by email...');
      [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, authUser.email!))
        .limit(1);
    }

    if (!dbUser) {
      // Create new user with proper auth_id
      // Security: Only allow super_admin for BDI users, default to 'member'
      const requestedRole = authUser.user_metadata?.role;
      const isBDIEmail = authUser.email?.endsWith('@bdibusinessportal.com') || 
                        authUser.email?.endsWith('@boundlessdevices.com') ||
                        authUser.email === 'steve.cistulli@gmail.com'; // Your admin email
      
      let userRole = 'member'; // Safe default
      
      // Only allow super_admin for BDI emails
      if (requestedRole === 'super_admin' && isBDIEmail) {
        userRole = 'super_admin';
      } else if (requestedRole && ['admin', 'member', 'operations'].includes(requestedRole)) {
        userRole = requestedRole;
      }
      
      console.log(`🔒 User creation security check: email=${authUser.email}, requestedRole=${requestedRole}, isBDI=${isBDIEmail}, finalRole=${userRole}`);

      [dbUser] = await db
        .insert(users)
        .values({
          authId: authUser.id,
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.email!.split('@')[0],
          role: userRole,
          passwordHash: 'supabase_managed', // Placeholder since Supabase manages auth
        })
        .returning();
    } else {
      console.log('Found user by email:', dbUser.email);
      
      // Security check: Downgrade non-BDI super_admins to admin
      const isBDIEmail = dbUser.email?.endsWith('@bdibusinessportal.com') || 
                        dbUser.email?.endsWith('@boundlessdevices.com') ||
                        dbUser.email === 'steve.cistulli@gmail.com'; // Your admin email
      
      if (dbUser.role === 'super_admin' && !isBDIEmail) {
        console.log(`🔒 SECURITY: Downgrading non-BDI super_admin ${dbUser.email} to admin`);
        await db
          .update(users)
          .set({ 
            role: 'admin',
            updatedAt: new Date()
          })
          .where(eq(users.authId, authUser.id));
        dbUser.role = 'admin'; // Update local object
      }
      
      // Update last login time from Supabase Auth
      if (authUser.last_sign_in_at) {
        await db
          .update(users)
          .set({ 
            lastLoginAt: new Date(authUser.last_sign_in_at),
            updatedAt: new Date()
          })
          .where(eq(users.authId, authUser.id));
      }
    }

    // Check if user is a member of any organizations (based on invitations/assignments)
    const userOrganizations = await db
      .select({
        organization: {
          id: organizations.id,
          name: organizations.name,
          legalName: organizations.legalName,
          code: organizations.code,
          type: organizations.type,
          dunsNumber: organizations.dunsNumber,
          taxId: organizations.taxId,
          industryCode: organizations.industryCode,
          companySize: organizations.companySize,
          businessAddress: organizations.businessAddress,
          billingAddress: organizations.billingAddress,
        },
        membershipRole: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, dbUser.authId));

    // For Super Admin, provide BDI organization if they don't have memberships
    // SECURITY: Only BDI super_admins get automatic BDI access
    const isBDIEmail = dbUser.email?.endsWith('@bdibusinessportal.com') || 
                      dbUser.email?.endsWith('@boundlessdevices.com') ||
                      dbUser.email === 'steve.cistulli@gmail.com'; // Your admin email
                      
    if (dbUser.role === 'super_admin' && userOrganizations.length === 0 && isBDIEmail) {
      // Get the actual BDI organization from database
      const [bdiOrg] = await db
        .select()
        .from(organizations)
        .where(and(
          eq(organizations.code, 'BDI'),
          eq(organizations.type, 'internal')
        ))
        .limit(1);

      if (bdiOrg) {
        userOrganizations.push({
          organization: bdiOrg,
          membershipRole: 'owner',
        });
      }
    }

    // Debug logging
    console.log('DB User:', dbUser);
    console.log('User Organizations:', userOrganizations);

    // Return user with their organization memberships
    return Response.json({
      ...dbUser,
      organizations: userOrganizations,
      // For backwards compatibility, use the first organization as primary
      organization: userOrganizations.length > 0 ? userOrganizations[0].organization : null
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return Response.json(null);
  }
}
