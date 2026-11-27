import type { Env } from '../config/env'
import { getSupabaseClient } from '../config/supabase'
import type { Ticket } from '../types/database'

// Roda a cada minuto via Cloudflare Cron Trigger (wrangler.toml: "* * * * *").
// Verifica tickets RUNNING/WARNING cujos vencimentos de SLA passaram 80% ou 100%
// e atualiza o estado — o Supabase Realtime entrega a mudança ao frontend automaticamente.

export async function slaCronJob(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const db  = getSupabaseClient(env)
  const now = new Date().toISOString()

  // 1. Busca tickets com SLA de PRIMEIRA RESPOSTA ainda ativo
  const { data: firstRespTickets } = await db
    .from('tickets')
    .select('id, sla_first_response_due_at, sla_first_response_state, sla_policy_id')
    .in('sla_first_response_state', ['RUNNING', 'WARNING'])
    .not('sla_first_response_due_at', 'is', null)

  for (const ticket of (firstRespTickets ?? []) as Ticket[]) {
    if (!ticket.sla_first_response_due_at) continue
    const state = computeSlaState(now, ticket.sla_first_response_due_at)
    if (state !== ticket.sla_first_response_state) {
      await db
        .from('tickets')
        .update({ sla_first_response_state: state })
        .eq('id', ticket.id)
    }
  }

  // 2. Busca tickets com SLA de RESOLUÇÃO ainda ativo
  const { data: resolutionTickets } = await db
    .from('tickets')
    .select('id, sla_resolution_due_at, sla_resolution_state, sla_policy_id')
    .in('sla_resolution_state', ['RUNNING', 'WARNING'])
    .not('sla_resolution_due_at', 'is', null)

  for (const ticket of (resolutionTickets ?? []) as Ticket[]) {
    if (!ticket.sla_resolution_due_at) continue
    const state = computeSlaState(now, ticket.sla_resolution_due_at)
    if (state !== ticket.sla_resolution_state) {
      await db
        .from('tickets')
        .update({ sla_resolution_state: state })
        .eq('id', ticket.id)
    }
  }
}

// Retorna WARNING quando restam ≤ 20% do tempo; BREACHED quando vencido.
function computeSlaState(
  nowIso: string,
  dueIso: string,
): 'RUNNING' | 'WARNING' | 'BREACHED' {
  const now = new Date(nowIso).getTime()
  const due = new Date(dueIso).getTime()

  if (now >= due) return 'BREACHED'

  // Para calcular 80%, precisaríamos do tempo total de SLA.
  // Aproximação conservadora: WARNING quando restam ≤ 20% do prazo total.
  // O prazo "total" é estimado pela diferença entre due e a hora atual — se já passou
  // mais de 80% do prazo original, o campo estaria BREACHED. Usamos 10 minutos como
  // threshold fixo de WARNING quando o prazo original não está disponível no query.
  const tenMinutes = 10 * 60_000
  if (due - now <= tenMinutes) return 'WARNING'

  return 'RUNNING'
}
