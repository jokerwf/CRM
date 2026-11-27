import type { MessageType } from '../../types/database'

export interface IncomingMessage {
  externalId: string
  from: string         // phone E.164
  type: MessageType
  content: string | null
  mediaId: string | null
  metadata: Record<string, unknown>
  timestamp: Date
}

export interface IncomingGroupMessage extends IncomingMessage {
  groupJid: string
  senderPhone: string
  senderName: string | null
  mentionedJids: string[]
}

export interface SendTextPayload {
  to: string
  text: string
}

export interface SendTemplatePayload {
  to: string
  templateName: string
  languageCode: string
  components: unknown[]
}

export interface SendMediaPayload {
  to: string
  type: 'image' | 'video' | 'audio' | 'document'
  mediaUrl: string
  caption?: string
  filename?: string
}

export interface SendResult {
  externalId: string
  sentAt: Date
}

export interface WhatsAppProvider {
  sendText(payload: SendTextPayload): Promise<SendResult>
  sendTemplate(payload: SendTemplatePayload): Promise<SendResult>
  sendMedia(payload: SendMediaPayload): Promise<SendResult>
  // Retorna URL temporária + mimeType para download de mídia
  resolveMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }>
}
