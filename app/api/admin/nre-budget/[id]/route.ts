import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, nreBudgets, nreBudgetLineItems, nreBudgetPaymentLineItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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

    // Get the requesting user
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check content type and parse accordingly
    const contentType = request.headers.get('content-type') || '';
    console.log('📋 PUT Request Content-Type:', contentType);
    
    let budgetData;
    let formData: FormData | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      // Parse FormData for file uploads (read body once)
      formData = await request.formData();
      const budgetDataString = formData.get('budgetData') as string;
      budgetData = JSON.parse(budgetDataString);
    } else {
      // Fallback to JSON for backwards compatibility
      budgetData = await request.json();
    }
    
    const {
      vendorName,
      quoteNumber,
      quoteDate,
      paymentTerms,
      paymentStatus,
      paymentDate,
      totalAmount,
      lineItems,
      paymentLineItems,
    } = budgetData;

    // Get current budget to preserve existing documents
    const [currentBudget] = await db
      .select()
      .from(nreBudgets)
      .where(eq(nreBudgets.id, id))
      .limit(1);

    if (!currentBudget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    // Handle file uploads (only if FormData was sent)
    const uploadedFiles: string[] = [];
    
    if (formData) {
      const allKeys = Array.from(formData.keys());
      console.log('📋 All FormData keys (PUT):', allKeys);
      const fileKeys = allKeys.filter(key => key.startsWith('file-'));
      console.log('📁 File keys found (PUT):', fileKeys);
      
      if (fileKeys.length > 0) {
        console.log(`📁 Uploading ${fileKeys.length} new files for NRE Budget ${id}`);
        
        for (const key of fileKeys) {
          const file = formData.get(key) as File;
          if (file) {
            // Use same pattern as PO: {org-id}/nre-budgets/{budget-id}/{filename}
            const filePath = `85a60a82-9d78-4cd9-85a1-e7e62cac552b/nre-budgets/${id}/${file.name}`;
            const fileBuffer = await file.arrayBuffer();
            
            const { error: uploadError } = await supabase.storage
              .from('organization-documents')
              .upload(filePath, fileBuffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: true,
              });

            if (uploadError) {
              console.error(`❌ Error uploading file ${file.name}:`, uploadError);
            } else {
              uploadedFiles.push(filePath);
              console.log(`✅ Uploaded: ${filePath}`);
            }
          }
        }
      }
    }

    // Merge existing documents with newly uploaded files
    const existingDocs = currentBudget.documents || [];
    const allDocuments = uploadedFiles.length > 0 ? [...existingDocs, ...uploadedFiles] : existingDocs;
    
    console.log(`📋 Existing documents:`, existingDocs);
    console.log(`📋 Newly uploaded:`, uploadedFiles);
    console.log(`📋 All documents to save:`, allDocuments);

    // Update NRE budget using Drizzle
    await db
      .update(nreBudgets)
      .set({
        vendorName,
        quoteNumber,
        quoteDate,
        paymentTerms,
        paymentStatus,
        paymentDate,
        totalAmount: totalAmount.toString(),
        documents: allDocuments,
        updatedAt: new Date(),
      })
      .where(eq(nreBudgets.id, id));
    
    console.log(`✅ Budget ${id} updated with ${allDocuments.length} documents`);

    // Delete existing line items and payment line items
    await Promise.all([
      db.delete(nreBudgetLineItems).where(eq(nreBudgetLineItems.nreBudgetId, id)),
      db.delete(nreBudgetPaymentLineItems).where(eq(nreBudgetPaymentLineItems.nreBudgetId, id))
    ]);

    // Insert updated line items
    if (lineItems && lineItems.length > 0) {
      const lineItemsData = lineItems.map((item: any) => ({
        nreBudgetId: id,
        lineItemNumber: item.lineItemNumber,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalAmount: item.totalAmount.toString(),
        notes: item.notes,
        createdBy: requestingUser.id,
      }));

      await db.insert(nreBudgetLineItems).values(lineItemsData);
    }

    // Insert updated payment line items
    if (paymentLineItems && paymentLineItems.length > 0) {
      const paymentItemsData = paymentLineItems.map((payment: any) => ({
        nreBudgetId: id,
        paymentNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate,
        amount: payment.amount.toString(),
        notes: payment.notes,
        createdBy: requestingUser.id,
      }));

      await db.insert(nreBudgetPaymentLineItems).values(paymentItemsData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/admin/nre-budget/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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

    // Get the requesting user
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete line items and payment line items first (if not using CASCADE)
    await Promise.all([
      db.delete(nreBudgetLineItems).where(eq(nreBudgetLineItems.nreBudgetId, id)),
      db.delete(nreBudgetPaymentLineItems).where(eq(nreBudgetPaymentLineItems.nreBudgetId, id))
    ]);

    // Delete NRE budget using Drizzle
    await db.delete(nreBudgets).where(eq(nreBudgets.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/nre-budget/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
