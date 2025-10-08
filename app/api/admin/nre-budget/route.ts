import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, nreBudgets, nreBudgetLineItems, nreBudgetPaymentLineItems, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
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

    // Get the requesting user
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch all NRE budgets using Drizzle
    const budgetsList = await db
      .select()
      .from(nreBudgets)
      .orderBy(desc(nreBudgets.createdAt));

    // Fetch line items and payment line items for each budget
    const budgetsWithLineItems = await Promise.all(
      budgetsList.map(async (budget) => {
        const [lineItemsList, paymentLineItemsList] = await Promise.all([
          db.select()
            .from(nreBudgetLineItems)
            .where(eq(nreBudgetLineItems.nreBudgetId, budget.id))
            .orderBy(nreBudgetLineItems.lineItemNumber),
          db.select()
            .from(nreBudgetPaymentLineItems)
            .where(eq(nreBudgetPaymentLineItems.nreBudgetId, budget.id))
            .orderBy(nreBudgetPaymentLineItems.paymentNumber)
        ]);

        return {
          id: budget.id,
          nreReferenceNumber: budget.nreReferenceNumber,
          vendorName: budget.vendorName,
          projectName: budget.projectName,
          skuCode: budget.skuCode,
          skuName: budget.skuName,
          quoteNumber: budget.quoteNumber,
          quoteDate: budget.quoteDate,
          paymentTerms: budget.paymentTerms,
          paymentStatus: budget.paymentStatus,
          paymentDate: budget.paymentDate,
          totalAmount: parseFloat(budget.totalAmount) || 0,
          documents: budget.documents || [],
          lineItems: lineItemsList.map((item) => ({
            id: item.id,
            lineItemNumber: item.lineItemNumber,
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice) || 0,
            totalAmount: parseFloat(item.totalAmount) || 0,
            notes: item.notes,
          })),
          paymentLineItems: paymentLineItemsList.map((payment) => ({
            id: payment.id,
            paymentNumber: payment.paymentNumber,
            paymentDate: payment.paymentDate,
            amount: parseFloat(payment.amount) || 0,
            notes: payment.notes,
          })),
          createdAt: budget.createdAt,
          updatedAt: budget.updatedAt,
        };
      })
    );

    return NextResponse.json(budgetsWithLineItems);
  } catch (error) {
    console.error('Error in GET /api/admin/nre-budget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Get the requesting user
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse FormData for file uploads
    const formData = await request.formData();
    const budgetDataString = formData.get('budgetData') as string;
    const budgetData = JSON.parse(budgetDataString);
    
    const {
      nreReferenceNumber,
      vendorName,
      projectName,
      skuCode,
      skuName,
      quoteNumber,
      quoteDate,
      paymentTerms,
      paymentStatus,
      paymentDate,
      totalAmount,
      lineItems,
      paymentLineItems,
    } = budgetData;

    // Create NRE budget using Drizzle
    const [budget] = await db
      .insert(nreBudgets)
      .values({
        nreReferenceNumber,
        vendorName,
        projectName,
        skuCode,
        skuName,
        quoteNumber,
        quoteDate,
        paymentTerms,
        paymentStatus,
        paymentDate,
        totalAmount: totalAmount.toString(),
        createdBy: requestingUser.id,
      })
      .returning();

    if (!budget) {
      console.error('Error creating NRE budget');
      return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
    }

    // Create line items using Drizzle
    if (lineItems && lineItems.length > 0) {
      const lineItemsData = lineItems.map((item: any) => ({
        nreBudgetId: budget.id,
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

    // Create payment line items using Drizzle
    if (paymentLineItems && paymentLineItems.length > 0) {
      const paymentItemsData = paymentLineItems.map((payment: any) => ({
        nreBudgetId: budget.id,
        paymentNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate,
        amount: payment.amount.toString(),
        notes: payment.notes,
        createdBy: requestingUser.id,
      }));

      await db.insert(nreBudgetPaymentLineItems).values(paymentItemsData);
    }

    // Handle file uploads
    const uploadedFiles: string[] = [];
    const allKeys = Array.from(formData.keys());
    console.log('📋 All FormData keys:', allKeys);
    const fileKeys = allKeys.filter(key => key.startsWith('file-'));
    console.log('📁 File keys found:', fileKeys);
    
    if (fileKeys.length > 0) {
      console.log(`📁 Uploading ${fileKeys.length} files for NRE Budget ${budget.nreReferenceNumber}`);
      
      for (const key of fileKeys) {
        const file = formData.get(key) as File;
        if (file) {
          // Use same pattern as PO: {org-id}/nre-budgets/{budget-id}/{filename}
          const filePath = `85a60a82-9d78-4cd9-85a1-e7e62cac552b/nre-budgets/${budget.id}/${file.name}`;
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

      // Update budget with document paths
      if (uploadedFiles.length > 0) {
        console.log(`💾 Updating budget ${budget.id} with documents:`, uploadedFiles);
        await db
          .update(nreBudgets)
          .set({ documents: uploadedFiles })
          .where(eq(nreBudgets.id, budget.id));
        console.log(`✅ Budget documents updated successfully`);
      } else {
        console.log(`⚠️ No files were uploaded`);
      }
    } else {
      console.log(`⚠️ No file keys found in FormData`);
    }

    return NextResponse.json({ 
      success: true, 
      budgetId: budget.id,
      uploadedFiles: uploadedFiles.length,
      documents: uploadedFiles
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/nre-budget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
