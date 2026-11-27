'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Ticket, TicketStatus } from '@/types/database'

export function useRealtimeTickets(status?: TicketStatus) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('opened_at', { ascending: false })

      if (status) query = query.eq('status', status)

      const { data } = await query
      setTickets((data as Ticket[]) ?? [])
      setLoading(false)
    }

    load()

    // Supabase Realtime — escuta INSERT e UPDATE na tabela tickets
    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTicket = payload.new as Ticket
            if (!status || newTicket.status === status) {
              setTickets(prev => [newTicket, ...prev])
            }
          }
          if (payload.eventType === 'UPDATE') {
            setTickets(prev =>
              prev.map(t => t.id === payload.new.id ? payload.new as Ticket : t)
            )
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [status])

  return { tickets, loading }
}
