# CLAUDE.md - Central de Atendimento Omnichannel (Cloudflare + Supabase)

## Visão Geral do Projeto
Sistema SaaS multi-tenant de atendimento omnichannel com duas frentes simultâneas:
1. **Cliente Final (1:1):** Via **Meta WhatsApp Cloud API (Oficial)** com bot de triagem por setor, roteamento automático e pesquisa CSAT na própria conversa.
2. **Parceiros e Fornecedores (Grupos):** Via **WhatsApp Web / QR Code (Evolution API)** com monitoramento de grupos, abertura de múltiplos tickets por grupo (manual, por gatilho/menção ou classificação de intenção), controle de SLA independente e disparo de CSAT no privado do solicitante.

## Stack & Arquitetura Obrigatória
- **Monorepo:**
  - `/worker` (Backend API + Webhooks + Cron de SLA): **Cloudflare Workers** com framework **Hono** e TypeScript.
  - `/frontend` (Painel do Atendente + Dashboard): **Next.js** (compatível com `@cloudflare/next-on-pages`) ou **React + Vite** para deploy no **Cloudflare Pages**.
  - `/supabase` (Migrations, SQL Schema, RLS Policies e Seeds).
- **Banco de Dados & Realtime:** **Supabase (PostgreSQL)** via `@supabase/supabase-js` (sem necessidade de ORM pesado para manter o bundle do Worker leve e rápido).
- **Tempo Real:** **Supabase Realtime** (Postgres Changes) no frontend para atualização instantânea de mensagens, fila de tickets e alertas de SLA.
- **Storage de Mídias:** **Cloudflare R2** (via binding nativo `env.MEDIA_BUCKET` no Worker) para salvar áudios, imagens e documentos do WhatsApp.
- **Filas / Timers de SLA:** **Cloudflare Cron Triggers** (`scheduled` handler no Worker rodando a cada `* * * * *`) em vez de Redis/BullMQ.
- **Padrão de Integração WhatsApp:** **Adapter Pattern** (`WhatsAppProvider` interface) separando `MetaCloudProvider` e `EvolutionWebProvider`.

## Regras Críticas de Negócio
1. **Multi-Tenant:** Todas as tabelas possuem `tenant_id` com políticas de Row Level Security (RLS) no Supabase.
2. **Motor de SLA (Sem Redis):**
   - Cada ticket armazena `sla_first_response_due_at`, `sla_resolution_due_at`, `sla_paused_at` e `sla_accumulated_pause_seconds`.
   - Quando o status muda para `WAITING_CUSTOMER`, registra `sla_paused_at = now()`. Quando o cliente/parceiro responde, soma a diferença em `sla_accumulated_pause_seconds` e recalcula os vencimentos.
   - O Cron Trigger do Worker verifica a cada minuto os tickets `RUNNING` e atualiza status para `WARNING` (80%) ou `BREACHED` (100%), fazendo o Supabase Realtime notificar o frontend automaticamente.
3. **Pesquisa de Satisfação (CSAT):**
   - Ticket `1:1`: dispara pesquisa na mesma conversa ao resolver.
   - Ticket `GROUP`: dispara pesquisa **no WhatsApp privado (1:1)** do `participant_phone` solicitante, citando o protocolo.

## Fluxo de Trabalho
- Priorizar zero dependências incompatíveis com o runtime V8 dos Cloudflare Workers (não usar bibliotecas dependentes de `fs`, `net` ou `crypto` legado do Node).
- Validar tipos TypeScript (`tsc --noEmit`) e configurações do `wrangler.toml` a cada etapa.