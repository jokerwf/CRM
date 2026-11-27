'use client'

import { useState } from 'react'
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages'
import { MessageBubble } from './MessageBubble'

interface Props { ticketId: string; tenantId: string }

export function ChatPanel({ ticketId, tenantId }: Props) {
  const { messages, loading, bottomRef } = useRealtimeMessages(ticketId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return

    setSending(true)
    await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.trim(), tenantId }),
    })
    setText('')
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {loading && (
          <p className="text-sm text-gray-400 text-center">Carregando mensagens...</p>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
