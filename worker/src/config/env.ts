export interface Env {
  // Supabase
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string

  // Meta WhatsApp Cloud API
  META_VERIFY_TOKEN: string

  // Evolution API
  EVOLUTION_API_URL: string
  EVOLUTION_API_KEY: string

  // JWT (para validar tokens do frontend se necessário)
  JWT_SECRET: string

  // Cloudflare R2
  MEDIA_BUCKET: R2Bucket

  // Runtime
  ENVIRONMENT: 'development' | 'production'
}
