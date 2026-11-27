import type { SupabaseClient } from '@supabase/supabase-js'
import type { SatisfactionSurvey, Ticket } from '../../types/database'
import type { WhatsAppProvider } from '../../adapters/interfaces/WhatsAppProvider'

const SURVEY_EXPIRY_HOURS = 24

export class SurveyService {
  constructor(private readonly db: SupabaseClient) {}

  // Ticket 1:1 → envia CSAT na mesma conversa do contato
  async createAndSend1to1(ticket: Ticket, provider: WhatsAppProvider): Promise<void> {
    if (!ticket.contact_id) return

    const { data: contact } = await this.db
      .from('contacts')
      .select('phone')
      .eq('id', ticket.contact_id)
      .single()

    if (!contact) return

    const survey = await this.createSurveyRecord(ticket.id, ticket.tenant_id, {
      contactId: ticket.contact_id,
    })

    const text = this.buildSurveyText(ticket.protocol)
    await provider.sendText({ to: contact.phone as string, text })

    await this.markSent(survey.id)
  }

  // Ticket GROUP → envia CSAT no privado (1:1) do participante que abriu o ticket
  async createAndSendGroup(ticket: Ticket, provider: WhatsAppProvider): Promise<void> {
    if (!ticket.opened_by_id) return

    const { data: participant } = await this.db
      .from('group_participants')
      .select('phone, name')
      .eq('id', ticket.opened_by_id)
      .single()

    if (!participant) return

    const survey = await this.createSurveyRecord(ticket.id, ticket.tenant_id, {
      participantId: ticket.opened_by_id,
    })

    const text = this.buildSurveyText(ticket.protocol, participant.name as string | null)
    await provider.sendText({ to: participant.phone as string, text })

    await this.markSent(survey.id)
  }

  // Recebe resposta do CSAT via mensagem inbound (score numérico 1-5)
  async recordResponse(ticketId: string, rawScore: string, comment?: string): Promise<void> {
    const score = parseInt(rawScore, 10)
    if (isNaN(score) || score < 1 || score > 5) return

    await this.db
      .from('satisfaction_surveys')
      .update({
        score,
        comment: comment ?? null,
        status: 'RESPONDED',
        responded_at: new Date().toISOString(),
      })
      .eq('ticket_id', ticketId)
      .eq('status', 'SENT')
  }

  private async createSurveyRecord(
    ticketId: string,
    tenantId: string,
    opts: { contactId?: string; participantId?: string },
  ): Promise<SatisfactionSurvey> {
    const expiresAt = new Date(Date.now() + SURVEY_EXPIRY_HOURS * 3_600_000).toISOString()

    const { data, error } = await this.db
      .from('satisfaction_surveys')
      .insert({
        tenant_id: tenantId,
        ticket_id: ticketId,
        contact_id: opts.contactId ?? null,
        participant_id: opts.participantId ?? null,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) throw new Error(`SurveyService.createRecord: ${error.message}`)
    return data as SatisfactionSurvey
  }

  private async markSent(surveyId: string): Promise<void> {
    await this.db
      .from('satisfaction_surveys')
      .update({ status: 'SENT', sent_at: new Date().toISOString() })
      .eq('id', surveyId)
  }

  private buildSurveyText(protocol: string, name?: string | null): string {
    const greeting = name ? `Olá, ${name}! ` : 'Olá! '
    return (
      `${greeting}Seu atendimento (protocolo *${protocol}*) foi encerrado.\n\n` +
      `Como você avalia nosso atendimento?\n` +
      `Responda com um número de *1 a 5*:\n` +
      `1️⃣ Muito ruim  2️⃣ Ruim  3️⃣ Regular  4️⃣ Bom  5️⃣ Excelente`
    )
  }
}
