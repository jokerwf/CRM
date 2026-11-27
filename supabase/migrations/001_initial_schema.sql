-- =============================================================================
-- Migration: 001_initial_schema
-- CRM Omnichannel — Cloudflare Workers + Supabase
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('ADMIN', 'SUPERVISOR', 'AGENT');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'BUSY', 'AWAY');

CREATE TYPE channel_type AS ENUM ('META_CLOUD', 'EVOLUTION_WEB');
CREATE TYPE channel_status AS ENUM ('ACTIVE', 'INACTIVE', 'CONNECTING', 'DISCONNECTED');

CREATE TYPE ticket_source AS ENUM ('WHATSAPP_1TO1', 'WHATSAPP_GROUP');
CREATE TYPE ticket_status AS ENUM (
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'
);
CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE sla_state AS ENUM ('RUNNING', 'PAUSED', 'WARNING', 'BREACHED', 'COMPLETED');

CREATE TYPE message_direction AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE message_type AS ENUM (
  'TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT',
  'STICKER', 'LOCATION', 'CONTACT_CARD', 'TEMPLATE', 'INTERACTIVE', 'SYSTEM'
);

CREATE TYPE survey_status AS ENUM ('PENDING', 'SENT', 'RESPONDED', 'EXPIRED');

-- ─── Helper: updated_at trigger ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Helper: JWT tenant claim ─────────────────────────────────────────────────
-- The Worker sets tenant_id as a custom claim in the Supabase JWT.
-- Frontend reads use this function; Worker uses service_role (bypasses RLS).

CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', TRUE)::JSONB) ->> 'tenant_id',
    ''
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =============================================================================
-- TABLES
-- =============================================================================

-- ─── Tenants ─────────────────────────────────────────────────────────────────

CREATE TABLE tenants (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id     TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'AGENT',
  status        user_status NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users (tenant_id);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Departments ─────────────────────────────────────────────────────────────

CREATE TABLE departments (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX idx_departments_tenant ON departments (tenant_id);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE department_users (
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  PRIMARY KEY (department_id, user_id)
);

-- ─── Channels ────────────────────────────────────────────────────────────────

CREATE TABLE channels (
  id              TEXT           PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id       TEXT           NOT NULL REFERENCES tenants(id)     ON DELETE CASCADE,
  department_id   TEXT           REFERENCES departments(id)           ON DELETE SET NULL,
  name            TEXT           NOT NULL,
  type            channel_type   NOT NULL,
  status          channel_status NOT NULL DEFAULT 'ACTIVE',
  -- Meta Cloud API
  phone_number_id TEXT,
  waba_id         TEXT,
  access_token    TEXT,
  -- Evolution API
  instance_name   TEXT,
  instance_key    TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_channels_tenant      ON channels (tenant_id);
CREATE INDEX idx_channels_tenant_type ON channels (tenant_id, type);

CREATE TRIGGER trg_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Contacts ────────────────────────────────────────────────────────────────

CREATE TABLE contacts (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id  TEXT        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT,
  phone      TEXT        NOT NULL,
  email      TEXT,
  avatar_url TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX idx_contacts_tenant ON contacts (tenant_id);
CREATE INDEX idx_contacts_phone  ON contacts (phone);

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Groups ──────────────────────────────────────────────────────────────────

CREATE TABLE groups (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   TEXT        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  channel_id  TEXT        NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  remote_jid  TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, remote_jid)
);

CREATE INDEX idx_groups_tenant ON groups (tenant_id);

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE group_participants (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  group_id   TEXT        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  phone      TEXT        NOT NULL,
  name       TEXT,
  is_admin   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, phone)
);

CREATE INDEX idx_group_participants_group ON group_participants (group_id);

CREATE TRIGGER trg_group_participants_updated_at
  BEFORE UPDATE ON group_participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── SLA Policies ────────────────────────────────────────────────────────────

CREATE TABLE sla_policies (
  id                     TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id              TEXT            NOT NULL REFERENCES tenants(id)     ON DELETE CASCADE,
  department_id          TEXT            REFERENCES departments(id)           ON DELETE SET NULL,
  name                   TEXT            NOT NULL,
  priority               ticket_priority NOT NULL,
  first_response_minutes INTEGER         NOT NULL,
  resolution_minutes     INTEGER         NOT NULL,
  business_hours_only    BOOLEAN         NOT NULL DEFAULT TRUE,
  is_default             BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, department_id, priority)
);

CREATE INDEX idx_sla_policies_tenant ON sla_policies (tenant_id);

CREATE TRIGGER trg_sla_policies_updated_at
  BEFORE UPDATE ON sla_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Tickets ─────────────────────────────────────────────────────────────────
-- SLA fields are embedded here (no separate sla_tracking table).
-- The Cron Trigger reads these fields to compute WARNING / BREACHED states.

CREATE TABLE tickets (
  id               TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id        TEXT            NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  protocol         TEXT            UNIQUE NOT NULL,
  channel_id       TEXT            NOT NULL REFERENCES channels(id),
  department_id    TEXT            REFERENCES departments(id)               ON DELETE SET NULL,
  assigned_user_id TEXT            REFERENCES users(id)                    ON DELETE SET NULL,
  sla_policy_id    TEXT            REFERENCES sla_policies(id)             ON DELETE SET NULL,
  -- Relationship: contact (1:1) XOR group + opened_by (GROUP)
  contact_id       TEXT            REFERENCES contacts(id),
  group_id         TEXT            REFERENCES groups(id),
  opened_by_id     TEXT            REFERENCES group_participants(id),
  source           ticket_source   NOT NULL,
  status           ticket_status   NOT NULL DEFAULT 'OPEN',
  priority         ticket_priority NOT NULL DEFAULT 'MEDIUM',
  subject          TEXT,
  metadata         JSONB,
  -- Timestamps
  opened_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  -- SLA (embedded, managed by the Cron Worker)
  sla_first_response_state    sla_state   NOT NULL DEFAULT 'RUNNING',
  sla_resolution_state        sla_state   NOT NULL DEFAULT 'RUNNING',
  sla_first_response_due_at   TIMESTAMPTZ,
  sla_resolution_due_at       TIMESTAMPTZ,
  -- Pause tracking: set when status → WAITING_CUSTOMER, cleared on customer reply
  sla_paused_at                   TIMESTAMPTZ,
  sla_accumulated_pause_seconds   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_tenant          ON tickets (tenant_id);
CREATE INDEX idx_tickets_tenant_status   ON tickets (tenant_id, status);
CREATE INDEX idx_tickets_tenant_user     ON tickets (tenant_id, assigned_user_id);
CREATE INDEX idx_tickets_tenant_dept     ON tickets (tenant_id, department_id);
CREATE INDEX idx_tickets_contact         ON tickets (contact_id);
CREATE INDEX idx_tickets_group           ON tickets (group_id);
-- Cron uses these two indexes to efficiently find tickets needing SLA evaluation
CREATE INDEX idx_tickets_sla_first_resp  ON tickets (sla_first_response_state, sla_first_response_due_at)
  WHERE sla_first_response_state IN ('RUNNING', 'WARNING');
CREATE INDEX idx_tickets_sla_resolution  ON tickets (sla_resolution_state, sla_resolution_due_at)
  WHERE sla_resolution_state IN ('RUNNING', 'WARNING');

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Messages ────────────────────────────────────────────────────────────────

CREATE TABLE messages (
  id          TEXT             PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id   TEXT             NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  ticket_id   TEXT             NOT NULL REFERENCES tickets(id)  ON DELETE CASCADE,
  user_id     TEXT             REFERENCES users(id)             ON DELETE SET NULL,
  external_id TEXT,
  direction   message_direction NOT NULL,
  type        message_type      NOT NULL DEFAULT 'TEXT',
  content     TEXT,
  media_url   TEXT,
  metadata    JSONB,
  sent_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_ticket       ON messages (ticket_id);
CREATE INDEX idx_messages_tenant_sent  ON messages (tenant_id, sent_at DESC);
CREATE INDEX idx_messages_external_id  ON messages (external_id) WHERE external_id IS NOT NULL;

-- ─── Satisfaction Surveys (CSAT) ─────────────────────────────────────────────

CREATE TABLE satisfaction_surveys (
  id             TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id      TEXT          NOT NULL REFERENCES tenants(id)            ON DELETE CASCADE,
  ticket_id      TEXT          UNIQUE NOT NULL REFERENCES tickets(id)     ON DELETE CASCADE,
  -- 1:1 ticket → contact; GROUP ticket → group_participant
  contact_id     TEXT          REFERENCES contacts(id),
  participant_id TEXT          REFERENCES group_participants(id),
  status         survey_status NOT NULL DEFAULT 'PENDING',
  score          SMALLINT      CHECK (score >= 1 AND score <= 5),
  comment        TEXT,
  sent_at        TIMESTAMPTZ,
  responded_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_surveys_tenant ON satisfaction_surveys (tenant_id);
CREATE INDEX idx_surveys_status ON satisfaction_surveys (status) WHERE status IN ('PENDING', 'SENT');

CREATE TRIGGER trg_surveys_updated_at
  BEFORE UPDATE ON satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- SUPABASE REALTIME
-- Habilita Postgres Changes para tickets e messages.
-- O frontend escuta via supabase.channel(...).on('postgres_changes', ...).
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Worker usa service_role key → bypassa RLS.
-- Frontend usa anon/authenticated key → isolado por tenant via JWT claim.
-- =============================================================================

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- tenants: cada usuário vê apenas o seu tenant
CREATE POLICY "tenants_isolation" ON tenants
  FOR ALL USING (id = auth.tenant_id());

-- users
CREATE POLICY "users_isolation" ON users
  FOR ALL USING (tenant_id = auth.tenant_id());

-- departments
CREATE POLICY "departments_isolation" ON departments
  FOR ALL USING (tenant_id = auth.tenant_id());

-- department_users (via join na tenant do department)
CREATE POLICY "dept_users_isolation" ON department_users
  FOR ALL USING (
    department_id IN (
      SELECT id FROM departments WHERE tenant_id = auth.tenant_id()
    )
  );

-- channels
CREATE POLICY "channels_isolation" ON channels
  FOR ALL USING (tenant_id = auth.tenant_id());

-- contacts
CREATE POLICY "contacts_isolation" ON contacts
  FOR ALL USING (tenant_id = auth.tenant_id());

-- groups
CREATE POLICY "groups_isolation" ON groups
  FOR ALL USING (tenant_id = auth.tenant_id());

-- group_participants (via join no group do tenant)
CREATE POLICY "group_participants_isolation" ON group_participants
  FOR ALL USING (
    group_id IN (
      SELECT id FROM groups WHERE tenant_id = auth.tenant_id()
    )
  );

-- sla_policies
CREATE POLICY "sla_policies_isolation" ON sla_policies
  FOR ALL USING (tenant_id = auth.tenant_id());

-- tickets
CREATE POLICY "tickets_isolation" ON tickets
  FOR ALL USING (tenant_id = auth.tenant_id());

-- messages
CREATE POLICY "messages_isolation" ON messages
  FOR ALL USING (tenant_id = auth.tenant_id());

-- satisfaction_surveys
CREATE POLICY "surveys_isolation" ON satisfaction_surveys
  FOR ALL USING (tenant_id = auth.tenant_id());
