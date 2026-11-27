import type { SlaState } from '@/types/database'

interface Props {
  state: SlaState
  dueAt: string | null
  label?: string
}

const stateConfig: Record<SlaState, { color: string; dot: string }> = {
  RUNNING:   { color: 'text-green-700 bg-green-50 border-green-200',  dot: 'bg-green-500' },
  PAUSED:    { color: 'text-gray-600 bg-gray-50 border-gray-200',     dot: 'bg-gray-400' },
  WARNING:   { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500 animate-pulse' },
  BREACHED:  { color: 'text-red-700 bg-red-50 border-red-200',        dot: 'bg-red-500 animate-pulse' },
  COMPLETED: { color: 'text-blue-700 bg-blue-50 border-blue-200',     dot: 'bg-blue-500' },
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return '—'
  const diff = new Date(dueAt).getTime() - Date.now()
  if (diff < 0) return 'Vencido'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function SlaIndicator({ state, dueAt, label = 'SLA' }: Props) {
  const cfg = stateConfig[state]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label}: {formatDue(dueAt)}
    </span>
  )
}
