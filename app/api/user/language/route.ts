import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { preferredLanguage } = body;

    // Validate language code
    const validLanguages = ['en', 'zh', 'vi', 'es'];
    if (!validLanguages.includes(preferredLanguage)) {
      return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
    }

    console.log(`🌍 Updating language preference for ${authUser.email}: ${preferredLanguage}`);

    // Update user's preferred language
    const [updatedUser] = await db
      .update(users)
      .set({ 
        preferredLanguage,
        updatedAt: new Date()
      })
      .where(eq(users.authId, authUser.id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`✅ Language preference updated: ${updatedUser.email} → ${preferredLanguage}`);

    return NextResponse.json({
      success: true,
      message: 'Language preference updated successfully',
      preferredLanguage: updatedUser.preferredLanguage
    });

  } catch (error) {
    console.error('Error updating language preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
