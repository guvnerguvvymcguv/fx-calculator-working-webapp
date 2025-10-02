// supabase/functions/send-invitation/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token, companyName, inviterEmail, role, inviteUrl } = await req.json()
    
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'SpreadChecker <noreply@spreadchecker.co.uk>',
        to: [email],
        subject: `You're invited to join ${companyName} on SpreadChecker`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background: #667eea; color: white; padding: 40px 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: white;">You've been invited to SpreadChecker!</h1>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 16px 0; color: #4a4a4a;">Hi there,</p>
                        
                        <p style="margin: 16px 0; color: #4a4a4a;"><strong>${inviterEmail}</strong> has invited you to join <strong>${companyName}</strong> as ${role === 'Admin' ? 'an' : 'a'} <strong>${role}</strong>.</p>
                        
                        <!-- Info Box -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                          <tr>
                            <td style="background: #f8f9fc; border-left: 3px solid #667eea; padding: 16px 20px;">
                              <p style="margin: 0; color: #4a4a4a;"><strong>What is SpreadChecker?</strong></p>
                              <p style="margin: 8px 0 0 0; color: #4a4a4a;">SpreadChecker helps FX brokers calculate competitive rates and close more deals with real-time spread calculations, team activity tracking, and Salesforce integration.</p>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 16px 0; color: #4a4a4a;">Click the button below to accept your invitation and get started:</p>
                        
                        <!-- Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 24px 0;">
                              <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Accept Invitation</a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #888; font-size: 14px; margin: 16px 0;">Or copy and paste this link into your browser:</p>
                        <p style="color: #667eea; word-break: break-all; font-size: 13px; margin: 16px 0;">${inviteUrl}</p>
                        
                        <p style="color: #888; font-size: 14px; margin-top: 24px;">This invitation will expire in 7 days. If you have any questions, please contact ${inviterEmail}.</p>
                        
                        <p style="margin: 16px 0; color: #4a4a4a;">Best regards,<br>The SpreadChecker Team</p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee;">
                        <p style="margin: 0;">SpreadChecker Ltd | London, UK<br>
                        © 2025 SpreadChecker. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    })

    const data = await res.json()
    
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})