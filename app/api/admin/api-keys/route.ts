import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { apiKeys, users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

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
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) return null;
  
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.authId, authUser.id))
    .limit(1);

  return dbUser;
}

// GET - Fetch API keys (Super Admin sees all, organization users see their own)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdmin = currentUser.role === 'super_admin';

    // Get user's organization for filtering (non-super admin users)
    let userOrganizationId = null;
    if (!isSuperAdmin) {
      const [userOrgMembership] = await db
        .select({
          organizationId: organizationMembers.organizationUuid,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.userAuthId, currentUser.authId))
        .limit(1);
      
      userOrganizationId = userOrgMembership?.organizationId;
    }

    // Get API keys with organization and user information
    const allApiKeys = await db
      .select({
        id: apiKeys.id,
        keyName: apiKeys.keyName,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        allowedFileTypes: apiKeys.allowedFileTypes,
        rateLimitPerHour: apiKeys.rateLimitPerHour,
        lastUsedAt: apiKeys.lastUsedAt,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        // Organization info
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationCode: organizations.code,
        organizationType: organizations.type,
        // User info
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(apiKeys)
      .leftJoin(organizations, eq(apiKeys.organizationUuid, organizations.id))
      .leftJoin(users, eq(apiKeys.userAuthId, users.authId))
      .where(
        isSuperAdmin 
          ? undefined // Super admin sees all keys
          : eq(apiKeys.organizationUuid, userOrganizationId!) // Organization users see only their keys
      )
      .orderBy(apiKeys.createdAt);

    console.log(`Found ${allApiKeys.length} API keys`);

    return NextResponse.json(allApiKeys);
    
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new API key for external partner
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin required' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, keyName, permissions, allowedFileTypes, rateLimitPerHour, expiresInDays } = body;
    
    // Validate required fields
    if (!organizationId || !keyName || !permissions) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, keyName, permissions' },
        { status: 400 }
      );
    }

    // Get the target organization
    const [targetOrganization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!targetOrganization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get the organization admin to associate the API key with
    const [orgAdmin] = await db
      .select({
        user: {
          id: users.id,
          authId: users.authId,
          name: users.name,
          email: users.email,
        }
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userAuthId, users.authId))
      .where(
        and(
          eq(organizationMembers.organizationUuid, organizationId),
          eq(organizationMembers.role, 'admin')
        )
      )
      .limit(1);

    if (!orgAdmin || !orgAdmin.user) {
      return NextResponse.json({ error: 'No admin user found for this organization' }, { status: 404 });
    }

    // Generate API key
    const orgCode = targetOrganization.code || 'org';
    const apiKey = `bdi_${orgCode.toLowerCase()}_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = apiKey.substring(0, 10); // Limit to 10 chars to fit database column
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Calculate expiration date
    const expiresAt = expiresInDays ? new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)) : null;

    // Create API key record
    const [newApiKey] = await db
      .insert(apiKeys)
      .values({
        userAuthId: orgAdmin.user.authId,
        organizationUuid: organizationId,
        keyName: keyName,
        keyHash: keyHash,
        keyPrefix: keyPrefix,
        permissions: permissions,
        allowedFileTypes: allowedFileTypes || ['PRODUCTION_FILE'], // Default to PRODUCTION_FILE
        rateLimitPerHour: rateLimitPerHour || 1000,
        isActive: true,
        expiresAt: expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log(`Created API key ${keyPrefix} for ${targetOrganization.code}`);

    return NextResponse.json({
      success: true,
      message: 'API key created successfully',
      apiKey: {
        id: newApiKey.id,
        keyName: newApiKey.keyName,
        keyPrefix: newApiKey.keyPrefix,
        fullKey: apiKey, // Only return the full key once during creation
        permissions: newApiKey.permissions,
        rateLimitPerHour: newApiKey.rateLimitPerHour,
        expiresAt: newApiKey.expiresAt,
        isActive: newApiKey.isActive,
      },
      organization: {
        id: targetOrganization.id,
        name: targetOrganization.name,
        code: targetOrganization.code,
      },
      user: {
        id: orgAdmin.user.id,
        name: orgAdmin.user.name,
        email: orgAdmin.user.email,
      }
    });
    
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
