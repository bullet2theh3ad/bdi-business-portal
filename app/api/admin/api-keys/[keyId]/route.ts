import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { apiKeys, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

// DELETE - Remove API key (Super Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin required' }, { status: 401 });
    }

    const { keyId } = await params;
    
    // Get the API key to delete
    const [apiKeyToDelete] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!apiKeyToDelete) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Delete the API key
    await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, keyId));

    console.log(`Super Admin deleted API key: ${apiKeyToDelete.keyName} (${apiKeyToDelete.keyPrefix})`);

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
      deletedKey: {
        id: apiKeyToDelete.id,
        keyName: apiKeyToDelete.keyName,
        keyPrefix: apiKeyToDelete.keyPrefix,
      }
    });
    
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
