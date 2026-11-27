import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://nvrxnllqvqytjjwkjrix.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_QnlsRgpKUuRLuhln4XAdng_ViFe5Fwb',
    NEXT_PUBLIC_WORKER_URL: 'https://crm-worker.welton-oliveira.workers.dev',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
      { protocol: 'https', hostname: 'pps.whatsapp.net' },
    ],
  },
}

export default nextConfig
