'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Message } from '@/types/database'

export function useRealtimeMessages(ticketId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('sent_at', { ascending: true })
      setMessages((data as Message[]) ?? [])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`messages-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message])
          // Scroll automático para a última mensagem
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ticketId])

  return { messages, loading, bottomRef }
}
