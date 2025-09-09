// supabase/functions/salesforce-token-exchange/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, redirectUri } = await req.json()
    
    if (!code) {
      throw new Error('Authorization code is required')
    }

    // Exchange code for tokens with Salesforce
    const tokenResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: Deno.env.get('SALESFORCE_CLIENT_ID')!,
        client_secret: Deno.env.get('SALESFORCE_CLIENT_SECRET')!,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('Salesforce token error:', tokenData)
      throw new Error(tokenData.error_description || 'Failed to exchange token')
    }

    // Get user info from Salesforce
    const userResponse = await fetch(tokenData.id, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })
    
    const userData = await userResponse.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user's company from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      throw new Error('Company not found')
    }

    // Store the Salesforce connection
    const { error: upsertError } = await supabase
      .from('salesforce_connections')
      .upsert({
        company_id: profile.company_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        instance_url: tokenData.instance_url,
        user_id: userData.user_id,
        user_email: userData.email,
        organization_id: userData.organization_id,
        last_sync: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('Database error:', upsertError)
      throw new Error('Failed to store connection')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        instanceUrl: tokenData.instance_url 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Token exchange error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})