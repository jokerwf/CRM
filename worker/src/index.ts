import { Hono } from 'hono'
import type { Env } from './config/env'
import { metaWebhookRoutes }      from './webhooks/meta.handler'
import { evolutionWebhookRoutes } from './webhooks/evolution.handler'
import { ticketRoutes }           from './modules/tickets/ticket.routes'
import { slaCronJob }             from './jobs/sla-cron'

const app = new Hono<{ Bindings: Env }>()

app.get('/health', (c) => c.json({ status: 'ok', env: c.env.ENVIRONMENT }))

app.route('/webhooks/meta',      metaWebhookRoutes)
app.route('/webhooks/evolution', evolutionWebhookRoutes)
app.route('/api/tickets',        ticketRoutes)

export default {
  fetch:     app.fetch,
  scheduled: slaCronJob,
}
