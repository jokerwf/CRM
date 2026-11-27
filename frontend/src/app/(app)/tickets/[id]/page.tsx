import { createServerSupabaseClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { SlaIndicator } from '@/components/sla/SlaIndicator'
import type { Ticket } from '@/types/database'

const statusLabel: Record<string, string> = {
  OPEN:             'Aberto',
  ASSIGNED:         'Atribuído',
  IN_PROGRESS:      'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando cliente',
  RESOLVED:         'Resolvido',
  CLOSED:           'Fechado',
}

const priorityLabel: Record<string, string> = {
  LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente',
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  const { data } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (!data) notFound()

  const ticket = data as Ticket

  const openedAt = new Date(ticket.opened_at).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex h-full">
      {/* Painel de informações do ticket */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-xs font-mono text-gray-400">{ticket.protocol}</p>
          <h2 className="text-sm font-semibold text-gray-900 mt-1">
            {ticket.subject ?? '(sem assunto)'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{openedAt}</p>
        </div>

        <div className="px-4 py-4 space-y-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-1">Status</p>
            <span className="font-medium text-gray-700">{statusLabel[ticket.status]}</span>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Prioridade</p>
            <span className="font-medium text-gray-700">{priorityLabel[ticket.priority]}</span>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Canal</p>
            <span className="font-medium text-gray-700">
              {ticket.source === 'WHATSAPP_GROUP' ? '👥 Grupo' : '💬 1:1'}
            </span>
          </div>

          {ticket.sla_first_response_due_at && (
            <div>
              <p className="text-xs text-gray-400 mb-1">SLA 1ª Resposta</p>
              <SlaIndicator
                state={ticket.sla_first_response_state}
                dueAt={ticket.sla_first_response_due_at}
                label="1ª resp"
              />
            </div>
          )}

          {ticket.sla_resolution_due_at && (
            <div>
              <p className="text-xs text-gray-400 mb-1">SLA Resolução</p>
              <SlaIndicator
                state={ticket.sla_resolution_state}
                dueAt={ticket.sla_resolution_due_at}
                label="Resolução"
              />
            </div>
          )}
        </div>
      </div>

      {/* Chat em tempo real */}
      <div className="flex-1 overflow-hidden">
        <ChatPanel ticketId={ticket.id} tenantId={ticket.tenant_id} />
      </div>
    </div>
  )
}
