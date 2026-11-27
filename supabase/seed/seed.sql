-- =============================================================================
-- Seed: tenant padrão, departamentos, canais, políticas de SLA e usuários de teste
-- =============================================================================

-- ─── Tenant ──────────────────────────────────────────────────────────────────

INSERT INTO tenants (id, name, slug) VALUES
  ('tenant_demo', 'Demo Company', 'demo');

-- ─── Departamentos ───────────────────────────────────────────────────────────

INSERT INTO departments (id, tenant_id, name, description) VALUES
  ('dept_suporte',   'tenant_demo', 'Suporte Técnico',  'Atendimento técnico a clientes finais'),
  ('dept_comercial', 'tenant_demo', 'Comercial',         'Propostas e negociações'),
  ('dept_parceiros', 'tenant_demo', 'Parceiros',         'Atendimento a revendedores e fornecedores');

-- ─── Canais ──────────────────────────────────────────────────────────────────

-- Canal 1:1 via Meta Cloud API (Suporte)
INSERT INTO channels (id, tenant_id, department_id, name, type, status, phone_number_id, waba_id, access_token) VALUES
  ('ch_meta_suporte', 'tenant_demo', 'dept_suporte',
   'WhatsApp Suporte', 'META_CLOUD', 'ACTIVE',
   'PHONE_NUMBER_ID_AQUI', 'WABA_ID_AQUI', 'ACCESS_TOKEN_AQUI');

-- Canal de Grupos via Evolution API (Parceiros)
INSERT INTO channels (id, tenant_id, department_id, name, type, status, instance_name, instance_key) VALUES
  ('ch_evo_parceiros', 'tenant_demo', 'dept_parceiros',
   'WhatsApp Grupos Parceiros', 'EVOLUTION_WEB', 'ACTIVE',
   'crm-instance', 'INSTANCE_KEY_AQUI');

-- ─── Políticas de SLA ────────────────────────────────────────────────────────
-- Padrão por prioridade (sem department_id = aplica a todos os depts)

INSERT INTO sla_policies (tenant_id, department_id, name, priority, first_response_minutes, resolution_minutes, business_hours_only, is_default) VALUES
  -- Globais
  ('tenant_demo', NULL, 'SLA Urgente',  'URGENT', 15,  240,  TRUE, FALSE),
  ('tenant_demo', NULL, 'SLA Alto',     'HIGH',   30,  480,  TRUE, FALSE),
  ('tenant_demo', NULL, 'SLA Médio',    'MEDIUM', 60,  1440, TRUE, TRUE),
  ('tenant_demo', NULL, 'SLA Baixo',    'LOW',    240, 2880, TRUE, FALSE),
  -- Suporte Técnico (SLA mais apertado)
  ('tenant_demo', 'dept_suporte', 'Suporte - Urgente', 'URGENT', 10, 120,  TRUE, FALSE),
  ('tenant_demo', 'dept_suporte', 'Suporte - Alto',    'HIGH',   20, 240,  TRUE, FALSE),
  ('tenant_demo', 'dept_suporte', 'Suporte - Médio',   'MEDIUM', 30, 480,  TRUE, FALSE);

-- ─── Usuários de teste ───────────────────────────────────────────────────────
-- password_hash = bcrypt("senha123") — trocar em produção

INSERT INTO users (id, tenant_id, name, email, password_hash, role, status) VALUES
  ('user_admin',   'tenant_demo', 'Admin Demo',    'admin@demo.com',    '$2b$10$placeholder_hash_admin',    'ADMIN',      'ACTIVE'),
  ('user_sup1',    'tenant_demo', 'Ana Suporte',   'ana@demo.com',      '$2b$10$placeholder_hash_ana',      'AGENT',      'ACTIVE'),
  ('user_sup2',    'tenant_demo', 'Bruno Suporte', 'bruno@demo.com',    '$2b$10$placeholder_hash_bruno',    'AGENT',      'ACTIVE'),
  ('user_parceiro','tenant_demo', 'Carla Parceiros','carla@demo.com',   '$2b$10$placeholder_hash_carla',    'SUPERVISOR', 'ACTIVE');

-- ─── Associação usuário ↔ departamento ──────────────────────────────────────

INSERT INTO department_users (department_id, user_id) VALUES
  ('dept_suporte',   'user_sup1'),
  ('dept_suporte',   'user_sup2'),
  ('dept_parceiros', 'user_parceiro'),
  ('dept_suporte',   'user_admin'),
  ('dept_comercial', 'user_admin'),
  ('dept_parceiros', 'user_admin');
