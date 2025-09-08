import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST - Send user invitations for an organization
export async function POST(request: NextRequest) {
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

    const { organizationId, organizationCode, organizationName, invitations } = await request.json()

    // Validate required fields
    if (!organizationId || !organizationCode || !organizationName || !invitations?.length) {
      return NextResponse.json({ 
        error: 'Missing required fields: organizationId, organizationCode, organizationName, invitations' 
      }, { status: 400 })
    }

    console.log(`Sending ${invitations.length} invitations for ${organizationCode}`)

    let sentCount = 0
    const errors = []

    // Send each invitation
    for (const invite of invitations) {
      try {
        if (!invite.name || !invite.email) {
          errors.push(`Skipped invitation - missing name or email`)
          continue
        }

        // Generate a unique invitation token (in production, you'd want this to be more secure)
        const invitationToken = `${organizationCode}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // Store invitation in database
        const { error: dbError } = await supabase
          .from('organization_invitations')
          .insert({
            organization_id: organizationId,
            organization_code: organizationCode,
            invited_email: invite.email,
            invited_name: invite.name,
            invited_role: invite.role,
            invitation_token: invitationToken,
            status: 'pending',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
          })

        if (dbError) {
          console.error('Database error storing invitation:', dbError)
          errors.push(`Failed to store invitation for ${invite.email}`)
          continue
        }

        // Send email invitation - use consistent token format
        const inviteUrl = `https://www.bdibusinessportal.com/sign-up?token=${invitationToken}`
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${process.env.NEXT_PUBLIC_BASE_URL}/logos/PNG/BDI-Logo-Horizontal-Color.png" alt="BDI Logo" style="height: 60px;">
            </div>
            
            <h2 style="color: #1e3a8a; margin-bottom: 20px;">You're Invited to Join ${organizationName}</h2>
            
            <p>Hello ${invite.name},</p>
            
            <p>You have been invited to join <strong>${organizationName}</strong> (${organizationCode}) on the BDI Business Portal as a <strong>${invite.role}</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" 
                 style="background-color: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            
            <p>This invitation will expire in 7 days.</p>
            
            <p>If you have any questions, please contact your administrator.</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280; text-align: center;">
              This email was sent by BDI Business Portal on behalf of ${organizationName}
            </p>
          </div>
        `

        const emailResult = await resend.emails.send({
          from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
          to: [invite.email],
          subject: `Invitation to Join ${organizationName} - BDI Business Portal`,
          html: emailHtml,
          replyTo: 'support@bdibusinessportal.com'
        })

        if (emailResult.error) {
          console.error('Email error:', emailResult.error)
          errors.push(`Failed to send email to ${invite.email}`)
          continue
        }

        sentCount++
        console.log(`Successfully sent invitation to ${invite.email} for ${organizationCode} (Message ID: ${emailResult.data?.id})`)

      } catch (error) {
        console.error(`Error processing invitation for ${invite.email}:`, error)
        errors.push(`Failed to process invitation for ${invite.email}`)
      }
    }

    if (errors.length > 0) {
      console.log('Invitation errors:', errors)
    }

    return NextResponse.json({ 
      sentCount, 
      totalRequested: invitations.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error in organizations invitations POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
