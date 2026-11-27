import type {
  WhatsAppProvider,
  SendTextPayload,
  SendTemplatePayload,
  SendMediaPayload,
  SendResult,
} from '../interfaces/WhatsAppProvider'

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export class MetaCloudProvider implements WhatsAppProvider {
  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
  ) {}

  async sendText({ to, text }: SendTextPayload): Promise<SendResult> {
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }
    return this.post(`/${this.phoneNumberId}/messages`, body)
  }

  async sendTemplate({ to, templateName, languageCode, components }: SendTemplatePayload): Promise<SendResult> {
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    }
    return this.post(`/${this.phoneNumberId}/messages`, body)
  }

  async sendMedia({ to, type, mediaUrl, caption, filename }: SendMediaPayload): Promise<SendResult> {
    const mediaObj: Record<string, string> = { link: mediaUrl }
    if (caption) mediaObj.caption = caption
    if (filename) mediaObj.filename = filename

    const body = {
      messaging_product: 'whatsapp',
      to,
      type,
      [type]: mediaObj,
    }
    return this.post(`/${this.phoneNumberId}/messages`, body)
  }

  async resolveMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const res = await this.graphFetch(`/${mediaId}`, 'GET')
    return { url: res.url as string, mimeType: res.mime_type as string }
  }

  private async post(path: string, body: unknown): Promise<SendResult> {
    const res = await this.graphFetch(path, 'POST', body)
    const msgId = (res.messages as Array<{ id: string }>)[0].id
    return { externalId: msgId, sentAt: new Date() }
  }

  private async graphFetch(path: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Meta API error ${res.status}: ${err}`)
    }

    return res.json() as Promise<Record<string, unknown>>
  }
}
