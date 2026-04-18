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
- [ ] Cadastro de horas extras pelo employee
- [ ] Cálculo automático para dias de folga
- [ ] Histórico de entradas/saídas
- **Status:** 🔴 Não iniciado

### ✅ 7. Histórico de Alterações
- [ ] Criar tabela `audit_log`
- [ ] Registrar: criação/edição de pedidos, mudanças de saldo
- [ ] UI admin: visualizar histórico
- **Status:** 🔴 Não iniciado

---

## 📋 Futuras (Fase 2+)

### ✅ 8. Relatórios PDF/Excel
- [x] Exportar pedidos por período
- [x] Relatório anual por employee
- [x] Gerar PDF ou Excel
- **Status:** ✅ Concluído

### ✅ 9. Integração Slack/Teams
- [ ] Webhook para notificações
- [ ] Slash commands (/folga, /saldo)
- **Status:** 🔴 Não iniciado

### ✅ 10. OAuth Google/GitHub
- [ ] Configurar OAuth providers no Supabase
- [ ] Login social opcional
- **Status:** 🔴 Não iniciado

### ✅ 11. App Mobile
- [ ] React Native ou Expo
- [ ] Funcionalidades core mobile-friendly
- **Status:** 🔴 Não iniciado

### ✅ 12. Multi-empresa
- [ ] Estrutura multi-tenant
- [ ] Cada empresa com policies separadas
- **Status:** 🔴 Não iniciado

---

## 📝 Changelog

| Data | Mudança |
|------|---------|
| 17/04/2026 | Criado backlog |
