import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr'
import type { cookies } from 'next/headers'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side (componentes 'use client')
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnon)
}

// Server-side (Server Components, Route Handlers, Server Actions)
export function createServerSupabaseClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll()          { return cookieStore.getAll() },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    },
  })
}
