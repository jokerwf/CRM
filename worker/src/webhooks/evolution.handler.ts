import { Hono } from 'hono'
import type { Env } from '../config/env'
import { getSupabaseClient } from '../config/supabase'
import { EvolutionWebProvider } from '../adapters/evolution/EvolutionWebProvider'
import { GroupService } from '../modules/groups/group.service'
import { TicketService } from '../modules/tickets/ticket.service'
import { SurveyService } from '../modules/surveys/survey.service'
import type { Channel, MessageType } from '../types/database'

const app = new Hono<{ Bindings: Env }>()

// A Evolution API não usa challenge — apenas valida a apikey no header (configurada na instância)
app.post('/', async (c) => {
  const body = await c.req.json<EvolutionWebhookPayload>()

  // Apenas mensagens de grupo
  if (body.event !== 'messages.upsert') return c.json({ status: 'ignored' })

  const data = body.data
  if (!data?.key?.remoteJid?.endsWith('@g.us')) return c.json({ status: 'not_group' })

  const db      = getSupabaseClient(c.env)
  const groups  = new GroupService(db)
  const tickets = new TicketService(db)
  const surveys = new SurveyService(db)

  // Localiza canal pelo instance name
  const { data: channel } = await db
    .from('channels')
    .select('*')
    .eq('instance_name', body.instance)
    .eq('type', 'EVOLUTION_WEB')
    .single()

  if (!channel) return c.json({ error: 'channel not found' }, 404)

  const ch       = channel as Channel
  const groupJid = data.key.remoteJid
  const sender   = data.key.participant ?? data.key.remoteJid

  // Extrai phone limpo do JID (ex: 5511999999999@s.whatsapp.net → 5511999999999)
  const senderPhone = sender.split('@')[0]

  const provider = new EvolutionWebProvider(
    c.env.EVOLUTION_API_URL,
    c.env.EVOLUTION_API_KEY,
    ch.instance_name!,
  )

  // Localiza ou cria o grupo e participante
  const group = await groups.findOrCreateGroup(
    ch.tenant_id,
    ch.id,
    groupJid,
    data.pushName ?? groupJid,
  )

  const participant = await groups.findOrCreateParticipant(
    group.id,
    senderPhone,
    data.pushName ?? undefined,
  )

  // Verifica se é resposta de CSAT pendente deste participante
  const { data: pendingSurvey } = await db
    .from('satisfaction_surveys')
    .select('ticket_id')
    .eq('participant_id', participant.id)
    .eq('status', 'SENT')
    .maybeSingle()

  const msgType  = mapEvolutionType(data.messageType)
  const content  = extractContent(data)

  if (pendingSurvey && msgType === 'TEXT' && content) {
    await surveys.recordResponse(pendingSurvey.ticket_id, content.trim())
    return c.json({ status: 'survey_recorded' })
  }

  // Verifica menção ao bot (@atendimento) ou palavra-chave para abrir ticket
  const triggerOpen = shouldOpenTicket(content, data.mentions ?? [])

  let ticket = await findActiveTicketForParticipant(db, ch.tenant_id, group.id, participant.id)

  if (!ticket && triggerOpen) {
    ticket = await tickets.create({
      tenantId: ch.tenant_id,
      channelId: ch.id,
      source: 'WHATSAPP_GROUP',
      groupId: group.id,
      openedById: participant.id,
      departmentId: ch.department_id ?? undefined,
      subject: content?.slice(0, 100) ?? undefined,
    })
  }

  if (!ticket) return c.json({ status: 'no_active_ticket' })

  // Resposta do participante que abriu retoma SLA se estava em WAITING_CUSTOMER
  if (data.key.participant === participant.phone + '@s.whatsapp.net') {
    await tickets.handleInboundReply(ticket)
  }

  await tickets.addMessage({
    tenantId: ch.tenant_id,
    ticketId: ticket.id,
    direction: 'INBOUND',
    type: msgType,
    content: content ?? undefined,
    externalId: data.key.id,
    metadata: { groupJid, senderPhone },
  })

  return c.json({ status: 'ok' })
})

// Ticket ativo de um participante em um grupo (não resolvido/fechado)
async function findActiveTicketForParticipant(
  db: ReturnType<typeof getSupabaseClient>,
  tenantId: string,
  groupId: string,
  openedById: string,
) {
  const { data } = await db
    .from('tickets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('group_id', groupId)
    .eq('opened_by_id', openedById)
    .not('status', 'in', '("RESOLVED","CLOSED")')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

function shouldOpenTicket(content: string | null, mentions: string[]): boolean {
  if (!content) return false
  const keywords = ['atendimento', 'suporte', 'ajuda', 'problema']
  const lower = content.toLowerCase()
  return keywords.some(k => lower.includes(k)) || mentions.length > 0
}

function mapEvolutionType(type: string): MessageType {
  const map: Record<string, MessageType> = {
    conversation:        'TEXT',
    extendedTextMessage: 'TEXT',
    imageMessage:        'IMAGE',
    videoMessage:        'VIDEO',
    audioMessage:        'AUDIO',
    documentMessage:     'DOCUMENT',
    stickerMessage:      'STICKER',
    locationMessage:     'LOCATION',
  }
  return map[type] ?? 'TEXT'
}

function extractContent(data: EvolutionMessageData): string | null {
  return (
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    data.message?.imageMessage?.caption ??
    data.message?.videoMessage?.caption ??
    data.message?.documentMessage?.caption ??
    null
  )
}

// ─── Payload types ────────────────────────────────────────────────────────────

interface EvolutionWebhookPayload {
  event: string
  instance: string
  data: EvolutionMessageData
}

interface EvolutionMessageData {
  key: {
    remoteJid: string
    id: string
    participant?: string
  }
  pushName?: string
  messageType: string
  mentions?: string[]
  message?: {
    conversation?: string
    extendedTextMessage?: { text: string }
    imageMessage?: { caption?: string; url?: string }
    videoMessage?: { caption?: string; url?: string }
    audioMessage?: { url?: string }
    documentMessage?: { caption?: string; fileName?: string; url?: string }
  }
}

export const evolutionWebhookRoutes = app
