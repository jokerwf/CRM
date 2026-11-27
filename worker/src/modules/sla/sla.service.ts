import type { SupabaseClient } from '@supabase/supabase-js'
import type { SlaPolicy, SlaState, Ticket, TicketPriority } from '../../types/database'
import { addBusinessMinutes } from '../../utils/business-hours'

export class SlaService {
  constructor(private readonly db: SupabaseClient) {}

  // Busca a política de SLA mais específica para o ticket (dept+prioridade > tenant+prioridade)
  async resolvePolicy(
    tenantId: string,
    priority: TicketPriority,
    departmentId?: string | null,
  ): Promise<SlaPolicy | null> {
    if (departmentId) {
      const { data } = await this.db
        .from('sla_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('department_id', departmentId)
        .eq('priority', priority)
        .maybeSingle()
      if (data) return data as SlaPolicy
    }

    const { data } = await this.db
      .from('sla_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('department_id', null)
      .eq('priority', priority)
      .maybeSingle()

    return (data as SlaPolicy) ?? null
  }

  // Calcula e persiste os vencimentos de SLA ao criar um ticket
  async applyToTicket(ticketId: string, policy: SlaPolicy, openedAt: Date): Promise<void> {
    const calc = policy.business_hours_only
      ? (mins: number) => addBusinessMinutes(openedAt, mins)
      : (mins: number) => new Date(openedAt.getTime() + mins * 60_000)

    await this.db.from('tickets').update({
      sla_policy_id: policy.id,
      sla_first_response_due_at: calc(policy.first_response_minutes).toISOString(),
      sla_resolution_due_at: calc(policy.resolution_minutes).toISOString(),
      sla_first_response_state: 'RUNNING' satisfies SlaState,
      sla_resolution_state: 'RUNNING' satisfies SlaState,
    }).eq('id', ticketId)
  }

  // Chamado quando o status muda para WAITING_CUSTOMER (cliente ainda não respondeu)
  async pause(ticketId: string): Promise<void> {
    const { data: ticket } = await this.db
      .from('tickets')
      .select('sla_paused_at')
      .eq('id', ticketId)
      .single()

    if ((ticket as Pick<Ticket, 'sla_paused_at'>).sla_paused_at) return // já pausado

    await this.db.from('tickets').update({
      sla_paused_at: new Date().toISOString(),
    }).eq('id', ticketId)
  }

  // Chamado quando o cliente responde (retomada do timer SLA)
  async resume(ticket: Ticket): Promise<void> {
    if (!ticket.sla_paused_at) return

    const pausedAt = new Date(ticket.sla_paused_at)
    const now = new Date()
    const pausedSeconds = Math.floor((now.getTime() - pausedAt.getTime()) / 1000)
    const totalPaused = ticket.sla_accumulated_pause_seconds + pausedSeconds
    const pausedMs = pausedSeconds * 1000

    // Desloca os vencimentos pelo tempo pausado
    const shiftDue = (iso: string | null) =>
      iso ? new Date(new Date(iso).getTime() + pausedMs).toISOString() : null

    await this.db.from('tickets').update({
      sla_paused_at: null,
      sla_accumulated_pause_seconds: totalPaused,
      sla_first_response_due_at: shiftDue(ticket.sla_first_response_due_at),
      sla_resolution_due_at: shiftDue(ticket.sla_resolution_due_at),
    }).eq('id', ticket.id)
  }

  // Marca o primeiro_response_at e encerra o SLA de primeira resposta
  async recordFirstResponse(ticketId: string, respondedAt: Date): Promise<void> {
    await this.db.from('tickets').update({
      first_response_at: respondedAt.toISOString(),
      sla_first_response_state: 'COMPLETED' satisfies SlaState,
    }).eq('id', ticketId).is('first_response_at', null)
  }

  // Encerra SLA de resolução ao resolver/fechar ticket
  async recordResolution(ticketId: string, resolvedAt: Date): Promise<void> {
    await this.db.from('tickets').update({
      resolved_at: resolvedAt.toISOString(),
      sla_resolution_state: 'COMPLETED' satisfies SlaState,
    }).eq('id', ticketId)
  }
}
