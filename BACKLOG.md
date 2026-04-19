# FOLIA - Backlog de Melhorias

**Projeto:** FOLIA
**Started:** 17/04/2026
**Status:** 🔄 Em Progresso

---

## 📋 Alta Prioridade (MVP Completo)

### ✅ 1. Modal de Rejeição com Motivo
- [x] Backend: campo `rejection_reason` já existe no schema
- [x] UI: criar modal para admin escrever motivo ao rejeitar
- [x] Email: incluir motivo no email de rejeição
- **Status:** ✅ Concluído (Developer)

### ✅ 2. Bulk Actions (Aprovar/Rejeitar Múltiplos)
- [x] Criar checkboxes nos pedidos pendentes
- [x] Botões "Aprovar Selecionados" / "Rejeitar Selecionados"
- [x] Lógica de batch update via API
- **Status:** ✅ Concluído (Developer)

### ✅ 3. Feriados Nacionais (Calendário)
- [x] Lista de feriados brasileiros 2026
- [x] Mostrar no calendário com cor diferenciada
- [x] Não permitir pedidos em feriados (avisar)
- **Status:** ✅ Concluído (Developer)

### ✅ 4. Perfil Employee (Ver/Editar Dados)
- [x] Ver/editar dados: nome, email, departamento, cargo, telefone, contato emergência
- [x] Editar: avatar (upload), phone, emergency contact
- [x] Mostrar data de admissão (readonly)
- **Status:** ✅ Concluído (Developer)

---

## 📋 Média Prioridade

### ✅ 5. Políticas Configuráveis
- [ ] Criar tabela `policies` (já no schema mas não usada)
- [ ] UI admin: configurar dias/ano, carry-over, antecedência
- [ ] Aplicar regras na solicitação
- **Status:** 🔴 Não iniciado

### ✅ 6. Banco de Horas Automático
- [x] Cadastro de horas extras pelo employee
- [x] Cálculo automático para dias de folga
- [x] Histórico de entradas/saídas
- **Status:** ✅ Concluído (Developer) — 18/04/2026

### ✅ 7. Histórico de Alterações
- [x] Criar tabela `audit_log`
- [x] Registrar: criação/edição de pedidos, mudanças de saldo
- [x] UI admin: visualizar histórico
- **Status:** ✅ Concluído (Developer) — 18/04/2026

---

### ✅ 13. Controle de Ponto (Time Tracking)
- [x] Migration 009: `time_entries` (clock_in, clock_out, lunch_start/end, total_hours, overtime_hours)
- [x] Migration 010: `monthly_timesheets` (fechamento mensal, overtime_pending_approval, approved_overtime_hours)
- [x] Migration 011: `work_schedules` (name, daily_hours, monday..sunday bool, tolerance_minutes) + `manager_id`/`schedule_id` em profiles
- [x] RPCs: `calculate_overtime`, `get_user_overtime_summary`, `get_team_timesheets`, `upsert_monthly_timesheet`
- [x] UI Employee: /dashboard/point (batida de ponto, relógio ao vivo, semana, saldo extras)
- [x] UI Gestor: /admin/timesheets (aprovação horas extras da equipe por mês)
- [x] UI Admin: /admin/team/point (visão global, tabela, CSV export)
- [x] APIs existentes: entries, overtime, team, timesheets, schedules (front-end + API já implementados)
- [x] Regras: cálculo de horas extras baseado em schedule daily_hours, aprovação por dia ou bulk
- [x] Seed schedules: 8h Padrão CLT, 6h Reduzido, Horário Flexível
- **Status:** ✅ Concluído (Developer) — 18/04/2026

---

## 📋 Futuras (Fase 2+)

### ✅ 8. Relatórios PDF/Excel
- [x] Exportar pedidos por período
- [x] Relatório anual por employee
- [x] Gerar PDF ou Excel
- **Status:** ✅ Concluído

### ✅ 9. Integração Slack/Teams
- [x] Webhook para notificações (Slack + Teams)
- [x] Tabela webhook_configs com suporte a múltiplos eventos
- [x] API de webhook (GET/POST/DELETE) em /api/webhooks
- [x] Teste de webhook em /api/webhooks/test
- [x] Notificações automáticas ao criar/aprovar/rejeitar/cancelar pedidos
- [ ] Slash commands (/folga, /saldo)
- **Status:** ✅ Concluído (Developer) — 18/04/2026

### ✅ 10. OAuth Google/GitHub
- [ ] Configurar OAuth providers no Supabase
- [ ] Login social opcional
- **Status:** 🔴 Não iniciado

### ✅ 11. App Mobile
- [ ] React Native ou Expo
- [ ] Funcionalidades core mobile-friendly
- **Status:** 🔴 Não iniciado

### ✅ 12. Multi-empresa
- [x] Tabela tenants com slug, domain, settings
- [x] Tenant default (UUID fixo 00000000-...) para compatibilidade
- [x] tenant_id em todas as tabelas (profiles, leave_requests, policies, hour_entries, audit_log, notifications)
- [x] Migrations: 006_add_tenants.sql, 007_add_tenant_id.sql, 008_add_webhook_configs.sql
- [x] RLS policies atualizadas para isolamento por tenant
- [x] Dashboard Admin SaaS em /admin/saas/page.tsx
- [x] Funções helper: get_user_tenant, is_tenant_admin, is_tenant_active
- [x] Onboarding: trigger handle_new_user já atribui tenant_id automaticamente
- **Status:** ✅ Concluído (Developer) — 18/04/2026

---

## 📝 Changelog

| Data | Mudança |
|------|---------|
| 17/04/2026 | Criado backlog |
| 18/04/2026 | Slack/Teams webhooks (TASK #9) concluído |
| 18/04/2026 | Multi-tenant SaaS (TASK #12) concluído |
| 18/04/2026 | Controle de Ponto (TASK #13) concluído |
