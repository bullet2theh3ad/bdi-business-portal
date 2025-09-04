import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - Fetch all organizations
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching organizations:', error)
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
    }

    // Transform data to match frontend expectations
    const transformedOrgs = organizations.map(org => ({
      id: org.id,
      name: org.name,
      legalName: org.legal_name,
      code: org.code,
      type: org.type,
      dunsNumber: org.duns_number,
      taxId: org.tax_id,
      industryCode: org.industry_code,
      companySize: org.company_size,
      contactEmail: org.contact_email,
      contactPhone: org.contact_phone,
      businessAddress: org.business_address,
      billingAddress: org.billing_address,
      isActive: org.is_active,
      createdAt: org.created_at,
      updatedAt: org.updated_at
    }))

    return NextResponse.json(transformedOrgs)
  } catch (error) {
    console.error('Error in organizations GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update organization with cascade changes
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const { organizationId, oldCode, newCode, name, legalName } = await request.json()

    // Validate required fields
    if (!organizationId || !newCode || !name) {
      return NextResponse.json({ 
        error: 'Missing required fields: organizationId, newCode, name' 
      }, { status: 400 })
    }

    // Start transaction-like operations
    console.log(`Updating organization ${organizationId}: ${oldCode} → ${newCode}`)

    // Step 1: Update the main organization record
    const { data: updatedOrg, error: orgError } = await supabase
      .from('organizations')
      .update({
        code: newCode,
        name: name,
        legal_name: legalName,
        updated_at: new Date().toISOString()
      })
      .eq('id', organizationId)
      .select()
      .single()

    if (orgError) {
      console.error('Error updating organization:', orgError)
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
    }

    // Step 2: If code changed, cascade the changes to related tables
    if (oldCode && oldCode !== newCode) {
      console.log(`Cascading code change from ${oldCode} to ${newCode}`)

      // Update invoices table
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ customer_name: newCode })
        .eq('customer_name', oldCode)

      if (invoiceError) {
        console.error('Error updating invoices:', invoiceError)
        // Continue with other updates even if one fails
      }

      // Update users table (supplier_code field)
      const { error: userError } = await supabase
        .from('users')
        .update({ supplier_code: newCode })
        .eq('supplier_code', oldCode)

      if (userError) {
        console.error('Error updating users:', userError)
        // Continue with other updates even if one fails
      }

      // Update purchase orders table (if it has supplier_code)
      const { error: poError } = await supabase
        .from('purchaseOrders')
        .update({ supplier_name: newCode })
        .eq('supplier_name', oldCode)

      if (poError) {
        console.error('Error updating purchase orders:', poError)
        // Continue with other updates even if one fails
      }

      // Log successful cascade
      console.log(`Successfully cascaded organization code change: ${oldCode} → ${newCode}`)
    }

    // Transform response data to match frontend expectations
    const transformedOrg = {
      id: updatedOrg.id,
      name: updatedOrg.name,
      legalName: updatedOrg.legal_name,
      code: updatedOrg.code,
      type: updatedOrg.type,
      dunsNumber: updatedOrg.duns_number,
      taxId: updatedOrg.tax_id,
      industryCode: updatedOrg.industry_code,
      companySize: updatedOrg.company_size,
      contactEmail: updatedOrg.contact_email,
      contactPhone: updatedOrg.contact_phone,
      businessAddress: updatedOrg.business_address,
      billingAddress: updatedOrg.billing_address,
      isActive: updatedOrg.is_active,
      createdAt: updatedOrg.created_at,
      updatedAt: updatedOrg.updated_at
    }

    return NextResponse.json(transformedOrg)
  } catch (error) {
    console.error('Error in organizations PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}