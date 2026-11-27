import type { Message } from '@/types/database'

interface Props { message: Message }

const typeIcon: Record<string, string> = {
  IMAGE: '🖼️', VIDEO: '🎥', AUDIO: '🎵',
  DOCUMENT: '📄', STICKER: '😊', LOCATION: '📍',
}

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === 'OUTBOUND'
  const time = new Date(message.sent_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isOutbound
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
        }`}
      >
        {message.type !== 'TEXT' && message.type !== 'SYSTEM' && (
          <span className="text-xs opacity-70 block mb-1">
            {typeIcon[message.type] ?? '📎'} {message.type.toLowerCase()}
          </span>
        )}

        {message.media_url && message.type === 'IMAGE' && (
          <img
            src={message.media_url}
            alt="imagem"
            className="rounded-lg max-w-full mb-1"
          />
        )}

        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        )}

        <span className={`text-xs mt-1 block text-right ${isOutbound ? 'text-blue-100' : 'text-gray-400'}`}>
          {time}
        </span>
      </div>
    </div>
  )
}
