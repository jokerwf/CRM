'use client'

import { useState } from 'react'
import { useRealtimeTickets } from '@/hooks/useRealtimeTickets'
import { TicketCard } from '@/components/tickets/TicketCard'
import type { TicketStatus } from '@/types/database'

const tabs: { label: string; status: TicketStatus | undefined }[] = [
  { label: 'Todos',              status: undefined },
  { label: 'Abertos',           status: 'OPEN' },
  { label: 'Em atendimento',    status: 'IN_PROGRESS' },
  { label: 'Aguardando',        status: 'WAITING_CUSTOMER' },
  { label: 'Resolvidos',        status: 'RESOLVED' },
]

export default function TicketsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const { tickets, loading } = useRealtimeTickets(tabs[activeTab].status)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Atendimentos</h1>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                activeTab === i
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading && (
          <div className="text-sm text-gray-400 text-center py-8">Carregando...</div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">
            Nenhum atendimento encontrado.
          </div>
        )}

        {tickets.map(ticket => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  )
}
