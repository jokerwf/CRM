import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Env } from './env'

// Worker sempre usa service_role key → bypassa RLS.
// Isolamento multi-tenant é garantido explicitamente via tenant_id nos queries.
export function getSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
