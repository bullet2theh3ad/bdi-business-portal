import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Authentication
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

    // Get user info
    const [dbUser] = await db
      .select({
        id: users.id,
        authId: users.authId,
        role: users.role,
        name: users.name,
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type,
          name: organizations.name
        }
      })
      .from(users)
      .leftJoin(organizationMembers, eq(organizationMembers.userAuthId, users.authId))
      .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only allow super_admin access for now
    if (dbUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { question, context, chatHistory } = await request.json();

    console.log('🤖 Ask BDI Request:', { question, context });

    // Gather business data context
    const businessData = await gatherBusinessContext(supabase, context);

    // Create business analyst prompt
    const systemPrompt = `You are BDI's Senior Business Intelligence Assistant, a world-class supply chain and business analyst with expertise in:

🏢 ABOUT BDI (Boundless Devices Inc):
- B2B technology company specializing in CPFR (Collaborative Planning, Forecasting, and Replenishment)
- Supply chain management platform for telecom/networking equipment
- Partners with manufacturers (MTN, CBN), shipping logistics (OLM), and distributors
- Focus: Demand forecasting, inventory optimization, shipment coordination

📊 YOUR EXPERTISE:
- Supply Chain Analytics & CPFR best practices
- Financial analysis (invoices, purchase orders, cost optimization)
- Operational efficiency (shipment performance, lead times, capacity planning)
- Business intelligence (trends, patterns, predictive insights)
- Risk management and supply chain resilience

🎯 YOUR ROLE:
- Provide actionable business insights based on BDI's actual data
- Explain trends, patterns, and anomalies in supply chain performance
- Recommend optimizations for forecasting, inventory, and logistics
- Answer strategic questions about business performance and growth opportunities

💼 COMMUNICATION STYLE:
- Professional but conversational tone
- Start with key insights, then provide supporting details
- Use specific data points and metrics when available
- Offer actionable recommendations
- Think like a senior business consultant

📈 CURRENT BUSINESS CONTEXT:
${JSON.stringify(businessData, null, 2)}

Always ground your responses in the actual data provided. If you need more specific data to answer accurately, ask for clarification.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      // Include recent chat history for context
      ...chatHistory.slice(-6).map((msg: any) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: question }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const answer = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    console.log('🤖 Ask BDI Response generated successfully');

    return NextResponse.json({ 
      answer,
      context: businessData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ask BDI error:', error);
    return NextResponse.json({ 
      error: 'Failed to process question',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Gather relevant business context from Supabase
async function gatherBusinessContext(supabase: any, requestContext: any) {
  try {
    console.log('📊 Gathering business context...');

    // Get basic counts and summaries
    const [
      forecastsResult,
      shipmentsResult,
      invoicesResult,
      skusResult
    ] = await Promise.all([
      supabase.from('sales_forecasts').select('id, sku_id, quantity, status, delivery_week, created_at').limit(50),
      supabase.from('shipments').select('id, status, organization_id, shipper_organization_id, created_at').limit(50),
      supabase.from('invoices').select('id, customer_name, total_value, status, created_at').limit(50),
      supabase.from('product_skus').select('id, sku, name, category').limit(50)
    ]);

    const businessData = {
      summary: {
        totalForecasts: forecastsResult.data?.length || 0,
        totalShipments: shipmentsResult.data?.length || 0,
        totalInvoices: invoicesResult.data?.length || 0,
        totalSKUs: skusResult.data?.length || 0,
        dateRange: requestContext.dateRange,
        currentPage: requestContext.currentPage
      },
      forecasts: {
        byStatus: groupBy(forecastsResult.data || [], 'status'),
        byWeek: groupBy(forecastsResult.data || [], 'delivery_week'),
        totalQuantity: (forecastsResult.data || []).reduce((sum: number, f: any) => sum + (f.quantity || 0), 0)
      },
      shipments: {
        byStatus: groupBy(shipmentsResult.data || [], 'status'),
        byOrganization: groupBy(shipmentsResult.data || [], 'organization_id')
      },
      invoices: {
        byCustomer: groupBy(invoicesResult.data || [], 'customer_name'),
        totalValue: (invoicesResult.data || []).reduce((sum: number, inv: any) => sum + (inv.total_value || 0), 0)
      },
      topSKUs: (skusResult.data || []).slice(0, 10)
    };

    console.log('📊 Business context gathered:', {
      forecasts: businessData.forecasts.totalQuantity,
      shipments: businessData.summary.totalShipments,
      invoices: businessData.summary.totalInvoices
    });

    return businessData;

  } catch (error) {
    console.error('Error gathering business context:', error);
    return {
      summary: { error: 'Unable to gather complete business context' },
      note: 'Some data may be unavailable'
    };
  }
}

// Helper function to group data by a field
function groupBy(array: any[], key: string) {
  return array.reduce((groups: any, item: any) => {
    const value = item[key] || 'unknown';
    groups[value] = (groups[value] || 0) + 1;
    return groups;
  }, {});
}
