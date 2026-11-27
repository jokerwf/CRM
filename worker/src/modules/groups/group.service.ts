import type { SupabaseClient } from '@supabase/supabase-js'
import type { Group, GroupParticipant } from '../../types/database'

export class GroupService {
  constructor(private readonly db: SupabaseClient) {}

  async findOrCreateGroup(
    tenantId: string,
    channelId: string,
    remoteJid: string,
    name: string,
  ): Promise<Group> {
    const { data: existing } = await this.db
      .from('groups')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('remote_jid', remoteJid)
      .maybeSingle()

    if (existing) return existing as Group

    const { data, error } = await this.db
      .from('groups')
      .insert({ tenant_id: tenantId, channel_id: channelId, remote_jid: remoteJid, name })
      .select()
      .single()

    if (error) throw new Error(`GroupService.findOrCreateGroup: ${error.message}`)
    return data as Group
  }

  async findOrCreateParticipant(
    groupId: string,
    phone: string,
    name?: string,
  ): Promise<GroupParticipant> {
    const { data: existing } = await this.db
      .from('group_participants')
      .select('*')
      .eq('group_id', groupId)
      .eq('phone', phone)
      .maybeSingle()

    if (existing) return existing as GroupParticipant

    const { data, error } = await this.db
      .from('group_participants')
      .insert({ group_id: groupId, phone, name: name ?? null })
      .select()
      .single()

    if (error) throw new Error(`GroupService.findOrCreateParticipant: ${error.message}`)
    return data as GroupParticipant
  }

  async getParticipant(groupId: string, phone: string): Promise<GroupParticipant | null> {
    const { data } = await this.db
      .from('group_participants')
      .select('*')
      .eq('group_id', groupId)
      .eq('phone', phone)
      .maybeSingle()
    return (data as GroupParticipant) ?? null
  }
}
