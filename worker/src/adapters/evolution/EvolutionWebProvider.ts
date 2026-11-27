import type {
  WhatsAppProvider,
  SendTextPayload,
  SendTemplatePayload,
  SendMediaPayload,
  SendResult,
} from '../interfaces/WhatsAppProvider'

export class EvolutionWebProvider implements WhatsAppProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly instanceName: string,
  ) {}

  async sendText({ to, text }: SendTextPayload): Promise<SendResult> {
    const res = await this.post('/message/sendText', {
      number: to,
      text,
    })
    return { externalId: res.key?.id ?? res.messageId ?? '', sentAt: new Date() }
  }

  async sendTemplate(_payload: SendTemplatePayload): Promise<SendResult> {
    // Evolution API (WhatsApp Web) não suporta templates oficiais Meta.
    // Recebe payload por compatibilidade de interface; envia como texto simples.
    throw new Error('Template messages are not supported by Evolution (WhatsApp Web) provider.')
  }

  async sendMedia({ to, type, mediaUrl, caption, filename }: SendMediaPayload): Promise<SendResult> {
    const endpointMap = {
      image: '/message/sendMedia',
      video: '/message/sendMedia',
      audio: '/message/sendWhatsAppAudio',
      document: '/message/sendMedia',
    }

    const body: Record<string, unknown> = {
      number: to,
      mediatype: type,
      media: mediaUrl,
    }
    if (caption) body.caption = caption
    if (filename) body.fileName = filename

    const res = await this.post(endpointMap[type], body)
    return { externalId: res.key?.id ?? '', sentAt: new Date() }
  }

  async resolveMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
    // Evolution armazena mídia localmente; retorna URL direta do servidor.
    return { url: `${this.baseUrl}/media/${mediaId}`, mimeType: 'application/octet-stream' }
  }

  // Envia mensagem para um grupo (remoteJid = groupId@g.us)
  async sendGroupText(groupJid: string, text: string): Promise<SendResult> {
    return this.sendText({ to: groupJid, text })
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/message${path}/${this.instanceName}`, {
      method: 'POST',
      headers: {
        apikey: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Evolution API error ${res.status}: ${err}`)
    }

    return res.json() as Promise<Record<string, unknown>>
  }
}
