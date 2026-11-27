export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BUSY' | 'AWAY'
export type ChannelType = 'META_CLOUD' | 'EVOLUTION_WEB'
export type ChannelStatus = 'ACTIVE' | 'INACTIVE' | 'CONNECTING' | 'DISCONNECTED'
export type TicketSource = 'WHATSAPP_1TO1' | 'WHATSAPP_GROUP'
export type TicketStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type SlaState = 'RUNNING' | 'PAUSED' | 'WARNING' | 'BREACHED' | 'COMPLETED'
export type MessageDirection = 'INBOUND' | 'OUTBOUND'
export type MessageType =
  | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  | 'STICKER' | 'LOCATION' | 'CONTACT_CARD' | 'TEMPLATE' | 'INTERACTIVE' | 'SYSTEM'
export type SurveyStatus = 'PENDING' | 'SENT' | 'RESPONDED' | 'EXPIRED'

export interface Tenant {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  tenant_id: string
  name: string
  email: string
  password_hash: string
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  tenant_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface DepartmentUser {
  department_id: string
  user_id: string
}

export interface Channel {
  id: string
  tenant_id: string
  department_id: string | null
  name: string
  type: ChannelType
  status: ChannelStatus
  phone_number_id: string | null
  waba_id: string | null
  access_token: string | null
  instance_name: string | null
  instance_key: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  tenant_id: string
  name: string | null
  phone: string
  email: string | null
  avatar_url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  tenant_id: string
  channel_id: string
  remote_jid: string
  name: string
  description: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface GroupParticipant {
  id: string
  group_id: string
  phone: string
  name: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface SlaPolicy {
  id: string
  tenant_id: string
  department_id: string | null
  name: string
  priority: TicketPriority
  first_response_minutes: number
  resolution_minutes: number
  business_hours_only: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  tenant_id: string
  protocol: string
  channel_id: string
  department_id: string | null
  assigned_user_id: string | null
  sla_policy_id: string | null
  contact_id: string | null
  group_id: string | null
  opened_by_id: string | null
  source: TicketSource
  status: TicketStatus
  priority: TicketPriority
  subject: string | null
  metadata: Record<string, unknown> | null
  opened_at: string
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  sla_first_response_state: SlaState
  sla_resolution_state: SlaState
  sla_first_response_due_at: string | null
  sla_resolution_due_at: string | null
  sla_paused_at: string | null
  sla_accumulated_pause_seconds: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  tenant_id: string
  ticket_id: string
  user_id: string | null
  external_id: string | null
  direction: MessageDirection
  type: MessageType
  content: string | null
  media_url: string | null
  metadata: Record<string, unknown> | null
  sent_at: string
  created_at: string
}

export interface SatisfactionSurvey {
  id: string
  tenant_id: string
  ticket_id: string
  contact_id: string | null
  participant_id: string | null
  status: SurveyStatus
  score: number | null
  comment: string | null
  sent_at: string | null
  responded_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}
