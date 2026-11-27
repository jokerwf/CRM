import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message, MessageDirection, MessageType, Ticket, TicketPriority, TicketSource, TicketStatus } from '../../types/database'
import { generateProtocol } from '../../utils/protocol'
import { SlaService } from '../sla/sla.service'

interface CreateTicketParams {
  tenantId: string
  channelId: string
  source: TicketSource
  priority?: TicketPriority
  departmentId?: string
  contactId?: string
  groupId?: string
  openedById?: string
  subject?: string
}

interface AddMessageParams {
  tenantId: string
  ticketId: string
  direction: MessageDirection
  type: MessageType
  content?: string
  mediaUrl?: string
  externalId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export class TicketService {
  private sla: SlaService

  constructor(private readonly db: SupabaseClient) {
    this.sla = new SlaService(db)
  }

  async create(params: CreateTicketParams): Promise<Ticket> {
    const priority = params.priority ?? 'MEDIUM'

    // Gera protocolo único baseado em contagem do dia
    const today = new Date().toISOString().slice(0, 10)
    const { count } = await this.db
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', params.tenantId)
      .gte('opened_at', `${today}T00:00:00Z`)

    const protocol = generateProtocol((count ?? 0) + 1)

    const { data, error } = await this.db
      .from('tickets')
      .insert({
        tenant_id: params.tenantId,
        protocol,
        channel_id: params.channelId,
        source: params.source,
        priority,
        department_id: params.departmentId ?? null,
        contact_id: params.contactId ?? null,
        group_id: params.groupId ?? null,
        opened_by_id: params.openedById ?? null,
        subject: params.subject ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`TicketService.create: ${error.message}`)

    const ticket = data as Ticket

    // Aplica SLA se houver política configurada
    const policy = await this.sla.resolvePolicy(
      params.tenantId,
      priority,
      params.departmentId,
    )
    if (policy) {
      await this.sla.applyToTicket(ticket.id, policy, new Date(ticket.opened_at))
    }

    return ticket
  }

  async addMessage(params: AddMessageParams): Promise<Message> {
    const { data, error } = await this.db
      .from('messages')
      .insert({
        tenant_id: params.tenantId,
        ticket_id: params.ticketId,
        direction: params.direction,
        type: params.type,
        content: params.content ?? null,
        media_url: params.mediaUrl ?? null,
        external_id: params.externalId ?? null,
        user_id: params.userId ?? null,
        metadata: params.metadata ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`TicketService.addMessage: ${error.message}`)
    return data as Message
  }

  async updateStatus(ticketId: string, status: TicketStatus): Promise<void> {
    const updates: Record<string, unknown> = { status }

    if (status === 'RESOLVED') updates.resolved_at = new Date().toISOString()
    if (status === 'CLOSED') updates.closed_at = new Date().toISOString()

    const { error } = await this.db.from('tickets').update(updates).eq('id', ticketId)
    if (error) throw new Error(`TicketService.updateStatus: ${error.message}`)
  }

  async findOpenByContact(tenantId: string, contactId: string): Promise<Ticket | null> {
    const { data } = await this.db
      .from('tickets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .not('status', 'in', '("RESOLVED","CLOSED")')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as Ticket) ?? null
  }

  async findOpenByGroup(tenantId: string, groupId: string): Promise<Ticket[]> {
    const { data } = await this.db
      .from('tickets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('group_id', groupId)
      .not('status', 'in', '("RESOLVED","CLOSED")')
      .order('opened_at', { ascending: false })
    return (data as Ticket[]) ?? []
  }

  async findById(ticketId: string): Promise<Ticket | null> {
    const { data } = await this.db
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()
    return (data as Ticket) ?? null
  }

  // Registra primeira resposta de agente e retoma SLA se estava pausado
  async handleAgentReply(ticket: Ticket, userId: string): Promise<void> {
    if (!ticket.first_response_at) {
      await this.sla.recordFirstResponse(ticket.id, new Date())
    }

    if (ticket.status === 'WAITING_CUSTOMER') {
      await this.updateStatus(ticket.id, 'IN_PROGRESS')
    }

    // Se SLA estava pausado (cliente não havia respondido ainda), retoma
    if (ticket.sla_paused_at) {
      await this.sla.resume(ticket)
    }
  }

  // Chamado quando o cliente/parceiro responde (retomada de WAITING_CUSTOMER)
  async handleInboundReply(ticket: Ticket): Promise<void> {
    if (ticket.status === 'WAITING_CUSTOMER') {
      await this.updateStatus(ticket.id, 'IN_PROGRESS')
      await this.sla.resume(ticket)
    }
  }
}
