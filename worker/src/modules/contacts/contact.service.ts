import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact } from '../../types/database'

export class ContactService {
  constructor(private readonly db: SupabaseClient) {}

  async findOrCreate(tenantId: string, phone: string, name?: string): Promise<Contact> {
    const { data: existing } = await this.db
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle()

    if (existing) {
      // Atualiza nome se veio um valor novo e o atual é nulo
      if (name && !existing.name) {
        const { data } = await this.db
          .from('contacts')
          .update({ name })
          .eq('id', existing.id)
          .select()
          .single()
        return data as Contact
      }
      return existing as Contact
    }

    const { data, error } = await this.db
      .from('contacts')
      .insert({ tenant_id: tenantId, phone, name: name ?? null })
      .select()
      .single()

    if (error) throw new Error(`ContactService.findOrCreate: ${error.message}`)
    return data as Contact
  }

  async findByPhone(tenantId: string, phone: string): Promise<Contact | null> {
    const { data } = await this.db
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle()
    return (data as Contact) ?? null
  }
}
