import { Hono } from 'hono'
import type { Env } from '../../config/env'
import { getSupabaseClient } from '../../config/supabase'
import { TicketService } from './ticket.service'
import { SlaService } from '../sla/sla.service'
import type { TicketStatus } from '../../types/database'

const app = new Hono<{ Bindings: Env }>()

// GET /api/tickets/:id
app.get('/:id', async (c) => {
  const db = getSupabaseClient(c.env)
  const service = new TicketService(db)
  const ticket = await service.findById(c.req.param('id'))
  if (!ticket) return c.json({ error: 'Not found' }, 404)
  return c.json(ticket)
})

// PATCH /api/tickets/:id/status
app.patch('/:id/status', async (c) => {
  const { status } = await c.req.json<{ status: TicketStatus }>()
  const db = getSupabaseClient(c.env)
  const service = new TicketService(db)
  const sla = new SlaService(db)

  const ticket = await service.findById(c.req.param('id'))
  if (!ticket) return c.json({ error: 'Not found' }, 404)

  await service.updateStatus(ticket.id, status)

  if (status === 'WAITING_CUSTOMER') {
    await sla.pause(ticket.id)
  }

  if (status === 'RESOLVED' || status === 'CLOSED') {
    await sla.recordResolution(ticket.id, new Date())
  }

  return c.json({ success: true })
})

// PATCH /api/tickets/:id/assign
app.patch('/:id/assign', async (c) => {
  const { userId } = await c.req.json<{ userId: string }>()
  const db = getSupabaseClient(c.env)

  const { error } = await db
    .from('tickets')
    .update({ assigned_user_id: userId, status: 'ASSIGNED' })
    .eq('id', c.req.param('id'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

export const ticketRoutes = app
