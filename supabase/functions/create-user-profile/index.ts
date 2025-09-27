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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log('Creating Supabase client...')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { userId, email, companyId, roleType, fullName, invitedBy, invitedAt } = await req.json()
    console.log('Request data:', { userId, email, companyId, roleType, fullName })
    
    // Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (existingProfile) {
      console.log('User profile already exists:', existingProfile)
      return new Response(JSON.stringify({ 
        error: 'User already has an account' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      })
    }
    
    // Create profile using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email: email,
        company_id: companyId,
        role_type: roleType,
        full_name: fullName || null,
        invited_by: invitedBy || null,
        invited_at: invitedAt || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      // Check for duplicate key error
      if (error.code === '23505') {
        return new Response(JSON.stringify({ 
          error: 'User already has an account' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        })
      }
      throw error
    }
    
    console.log('Profile created successfully:', data)
    
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Function error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})