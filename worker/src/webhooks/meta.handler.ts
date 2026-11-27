import { Hono } from 'hono'
import type { Env } from '../config/env'
import { getSupabaseClient } from '../config/supabase'
import { MetaCloudProvider } from '../adapters/meta/MetaCloudProvider'
import { ContactService } from '../modules/contacts/contact.service'
import { TicketService } from '../modules/tickets/ticket.service'
import { SurveyService } from '../modules/surveys/survey.service'
import type { IncomingMessage } from '../adapters/interfaces/WhatsAppProvider'
import type { Channel, MessageType } from '../types/database'

const app = new Hono<{ Bindings: Env }>()

// Verificação do webhook (Meta exige GET com challenge)
app.get('/', (c) => {
  const mode      = c.req.query('hub.mode')
  const token     = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  if (mode === 'subscribe' && token === c.env.META_VERIFY_TOKEN) {
    return c.text(challenge ?? '')
  }
  return c.text('Forbidden', 403)
})

// Recebimento de mensagens
app.post('/', async (c) => {
  const body = await c.req.json<MetaWebhookPayload>()

  if (body.object !== 'whatsapp_business_account') {
    return c.json({ status: 'ignored' })
  }

  const db       = getSupabaseClient(c.env)
  const contacts = new ContactService(db)
  const tickets  = new TicketService(db)
  const surveys  = new SurveyService(db)

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value?.messages?.length) continue

      // Localiza o canal pelo phone_number_id
      const { data: channel } = await db
        .from('channels')
        .select('*')
        .eq('phone_number_id', value.metadata.phone_number_id)
        .eq('type', 'META_CLOUD')
        .single()

      if (!channel) continue

      const ch = channel as Channel
      const provider = new MetaCloudProvider(ch.phone_number_id!, ch.access_token!)

      for (const msg of value.messages) {
        const incoming = parseMetaMessage(msg)
        const contact  = await contacts.findOrCreate(ch.tenant_id, incoming.from)

        // Verifica se é resposta de CSAT pendente
        const { data: pendingSurvey } = await db
          .from('satisfaction_surveys')
          .select('ticket_id')
          .eq('contact_id', contact.id)
          .eq('status', 'SENT')
          .maybeSingle()

        if (pendingSurvey && incoming.type === 'TEXT' && incoming.content) {
          await surveys.recordResponse(pendingSurvey.ticket_id, incoming.content.trim())
          continue
        }

        // Busca ticket aberto ou cria novo
        let ticket = await tickets.findOpenByContact(ch.tenant_id, contact.id)

        if (!ticket) {
          ticket = await tickets.create({
            tenantId: ch.tenant_id,
            channelId: ch.id,
            source: 'WHATSAPP_1TO1',
            contactId: contact.id,
            departmentId: ch.department_id ?? undefined,
          })
        } else {
          await tickets.handleInboundReply(ticket)
        }

        await tickets.addMessage({
          tenantId: ch.tenant_id,
          ticketId: ticket.id,
          direction: 'INBOUND',
          type: incoming.type,
          content: incoming.content ?? undefined,
          externalId: incoming.externalId,
        })
      }

      // Processa atualizações de status (mensagem lida, entregue etc.)
      for (const status of value.statuses ?? []) {
        // Poderia registrar delivery/read receipts aqui — deixado para fase 2
        void status
      }
    }
  }

  return c.json({ status: 'ok' })
})

function parseMetaMessage(msg: MetaMessage): IncomingMessage {
  let type: MessageType = 'TEXT'
  let content: string | null = null

  if (msg.type === 'text') {
    content = msg.text?.body ?? null
  } else if (['image', 'video', 'audio', 'document', 'sticker'].includes(msg.type)) {
    type = msg.type.toUpperCase() as MessageType
  } else if (msg.type === 'location') {
    type = 'LOCATION'
  } else if (msg.type === 'interactive') {
    type = 'INTERACTIVE'
    content = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null
  }

  return {
    externalId: msg.id,
    from: msg.from,
    type,
    content,
    mediaId: (msg.image ?? msg.video ?? msg.audio ?? msg.document)?.id ?? null,
    metadata: msg as unknown as Record<string, unknown>,
    timestamp: new Date(Number(msg.timestamp) * 1000),
  }
}

// ─── Payload types (subset do schema Meta) ───────────────────────────────────

interface MetaWebhookPayload {
  object: string
  entry: Array<{
    changes: Array<{
      value: {
        metadata: { phone_number_id: string }
        messages?: MetaMessage[]
        statuses?: Array<{ id: string; status: string }>
      }
    }>
  }>
}

interface MetaMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string }
  video?: { id: string; mime_type: string }
  audio?: { id: string; mime_type: string }
  document?: { id: string; filename: string; mime_type: string }
  sticker?: { id: string }
  location?: { latitude: number; longitude: number }
  interactive?: {
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
}

export const metaWebhookRoutes = app
