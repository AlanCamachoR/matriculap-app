import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente para uso en el frontend
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente admin para uso en el servidor (APIs)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)