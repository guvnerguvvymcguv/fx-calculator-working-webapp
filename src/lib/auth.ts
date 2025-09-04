import { supabase } from './supabase'

// Test function to check if Supabase is connected
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Supabase connection error:', error)
      return false
    }
    console.log('✅ Supabase connected successfully!')
    console.log('Session data:', data)
    return true
  } catch (err) {
    console.error('Failed to connect to Supabase:', err)
    return false
  }
}

// Sign up a new user
export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      }
    }
  })
  
  return { data, error }
}

// Sign in an existing user
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  return { data, error }
}

// Sign out the current user
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}