import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, invoiceDocuments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { deleteFile } from '@/lib/storage/supabase-storage';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
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

    // Verify user has sales/admin access
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || !['super_admin', 'admin', 'sales', 'member'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Forbidden - Sales access required' }, { status: 403 });
    }

    const { id: invoiceId, docId } = await params;

    // Get document info before deleting
    const [document] = await db
      .select()
      .from(invoiceDocuments)
      .where(and(
        eq(invoiceDocuments.id, docId),
        eq(invoiceDocuments.invoiceId, invoiceId)
      ))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    console.log('Deleting document:', document);

    // Delete from Supabase Storage
    const storageResult = await deleteFile(document.filePath);
    if (!storageResult.success) {
      console.error('Failed to delete from storage:', storageResult.error);
      // Continue with database deletion even if storage delete fails
    }

    // Delete from database
    await db
      .delete(invoiceDocuments)
      .where(eq(invoiceDocuments.id, docId));

    console.log('✅ Document deleted successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Document deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
