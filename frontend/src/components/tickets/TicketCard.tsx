import Link from 'next/link'
import type { Ticket } from '@/types/database'
import { SlaIndicator } from '@/components/sla/SlaIndicator'

interface Props { ticket: Ticket }

const statusLabel: Record<string, string> = {
  OPEN:             'Aberto',
  ASSIGNED:         'Atribuído',
  IN_PROGRESS:      'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando cliente',
  RESOLVED:         'Resolvido',
  CLOSED:           'Fechado',
}

const priorityColor: Record<string, string> = {
  LOW:    'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

export function TicketCard({ ticket }: Props) {
  const isGroup = ticket.source === 'WHATSAPP_GROUP'
  const openedAt = new Date(ticket.opened_at).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Link href={`/tickets/${ticket.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-500 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{ticket.protocol}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor[ticket.priority]}`}>
                {ticket.priority}
              </span>
              <span className="text-xs text-gray-400">{isGroup ? '👥 Grupo' : '💬 1:1'}</span>
            </div>
            <p className="text-sm font-medium text-gray-900 mt-1 truncate">
              {ticket.subject ?? '(sem assunto)'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{openedAt}</p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-gray-500">{statusLabel[ticket.status]}</span>
            {ticket.sla_first_response_due_at && (
              <SlaIndicator
                state={ticket.sla_first_response_state}
                dueAt={ticket.sla_first_response_due_at}
                label="1ª resp"
              />
            )}
            {ticket.sla_resolution_due_at && (
              <SlaIndicator
                state={ticket.sla_resolution_state}
                dueAt={ticket.sla_resolution_due_at}
                label="Resolução"
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
