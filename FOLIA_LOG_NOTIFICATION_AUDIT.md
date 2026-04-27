# FOLIA - Auditoria de Logging e Notificações

**Data:** 2026-04-27  
**Sistema:** FOLIA - Controle de Férias e Folgas  
**Meta:** 100% das interações com logs em `system_logs` + notificações na barra

---

## PARTE 1: LOCAIS QUE JÁ GERAM LOG + NOTIFICAÇÃO

### Tabela `audit_log` (via `log_audit_action` RPC) + Webhooks

| # | Local | Ação | Tabela | Notificação | Módulo |
|---|-------|------|--------|-------------|--------|
| 1 | `actions.ts` → `createLeaveRequest()` | created | leave_requests | webhook | leave_requests |
| 2 | `actions.ts` → `approveLeaveRequest()` | approved | leave_requests | webhook | leave_requests |
| 3 | `actions.ts` → `rejectLeaveRequest()` | rejected | leave_requests | webhook | leave_requests |
| 4 | `actions.ts` → `cancelLeaveRequest()` | cancelled | leave_requests | webhook | leave_requests |
| 5 | `api/admin/users/route.ts` POST | create | profiles | ✅ notification | employees |
| 6 | `api/admin/users/route.ts` PUT | update | profiles | ✅ notification | employees |

**Observação importante:** O sistema já usa `log_audit_action` para a tabela `audit_log` (não `system_logs`). A tabela `system_logs` existe (migration 014) mas está quase completamente vazia — nenhuma API ou action escreve nela ainda.

---

## PARTE 2: LOCAIS QUE PRECISAM GERAR LOG (system_logs)

### ❌ MISSING - Necessitam implementação

| # | Interação | Local | Módulo | Motivo |
|---|-----------|-------|--------|--------|
| 1 | Login | Frontend login/page.tsx | auth | Não há API de auth custom; preciso adicionar no frontend |
| 2 | Logout | Frontend | auth | Mesmo motivo |
| 3 | Employee DELETE | `employees/page.tsx` handleDelete | employees | DELETE direto no Supabase, sem API |
| 4 | Schedule CREATE | `api/point/schedules/route.ts` POST | schedules | Sem log |
| 5 | Schedule UPDATE | `api/point/schedules/[id]/route.ts` PUT | schedules | Sem log |
| 6 | Schedule DELETE | `api/point/schedules/[id]/route.ts` DELETE | schedules | Sem log |
| 7 | Schedule ASSIGN | `api/point/schedules/[id]/assign/route.ts` POST | schedules | Sem log |
| 8 | Leave Request REJECT (AdminDashboard) | `admin/AdminDashboard.tsx` confirmReject | leave_requests | Faz update direto, sem log |
| 9 | Leave Request CANCEL (AdminDashboard) | `admin/AdminDashboard.tsx` confirmCancel | leave_requests | Faz update direto, sem log |
| 10 | Tenant CREATE | `api/admin/tenants/route.ts` POST | tenants | Sem log |
| 11 | Tenant UPDATE | `api/admin/tenants/route.ts` PUT | tenants | Sem log |
| 12 | Tenant DELETE | `api/admin/tenants/route.ts` DELETE | tenants | Sem log |
| 13 | Timesheet APPROVE/REJECT | `api/point/timesheets/route.ts` PUT | timesheets | Sem log |

---

## PARTE 3: LOCAIS QUE PRECISAM GERAR NOTIFICAÇÃO

| # | Interação | Local | Por que falta |
|---|-----------|-------|---------------|
| 1 | Schedule CREATE | `api/point/schedules/route.ts` POST | Existe log_audit mas sem notificação |
| 2 | Schedule UPDATE | `api/point/schedules/[id]/route.ts` PUT | Sem notificação |
| 3 | Schedule DELETE | `api/point/schedules/[id]/route.ts` DELETE | Sem notificação |
| 4 | Schedule ASSIGN | `api/point/schedules/[id]/assign/route.ts` POST | Sem notificação |
| 5 | Leave Request REJECT (AdminDashboard) | `admin/AdminDashboard.tsx` confirmReject | Faz fetch pra `/api/send-notifications` mas só envia email, não cria notificação no DB |
| 6 | Leave Request CANCEL (AdminDashboard) | `admin/AdminDashboard.tsx` confirmCancel | Sem notificação |
| 7 | Leave Request APPROVE (AdminDashboard) | `admin/AdminDashboard.tsx` confirmApprove | Faz update direto sem notificação |
| 8 | Employee DELETE | `employees/page.tsx` handleDelete | Sem notificação |
| 9 | Tenant CREATE | `api/admin/tenants/route.ts` POST | Sem notificação |
| 10 | Tenant UPDATE | `api/admin/tenants/route.ts` PUT | Sem notificação |
| 11 | Tenant DELETE | `api/admin/tenants/route.ts` DELETE | Sem notificação |
| 12 | Bulk APPROVE (AdminDashboard) | `admin/AdminDashboard.tsx` | Sem notificação |
| 13 | Timesheet APPROVE/REJECT | `api/point/timesheets/route.ts` PUT | Sem notificação |

---

## PARTE 4: CÓDIGO PRONTO PARA IMPLEMENTAÇÃO

### 4.1 Login/Logout - Frontend (`login/page.tsx` + logout)

Adicionar ao `login/page.tsx` após login com sucesso:

```typescript
// Após: if (!authError) { ... }
import { logSystemAction } from "@/lib/system-logger";

// No handleSubmit do login, após signInWithPassword com sucesso:
await logSystemAction({
  userId: user.id,
  tenantId: profile?.tenant_id,
  action: "login",
  module: "auth",
  details: `Login successful: ${email}`,
  ipAddress: request.headers.get("x-forwarded-for") || null,
});
```

Para logout, adicionar no `Sidebar.tsx` ou onde for feito o logout:

```typescript
// Antes de supabase.auth.signOut()
await logSystemAction({
  userId: user.id,
  tenantId: profile?.tenant_id,
  action: "logout",
  module: "auth",
  details: "User logged out",
});
```

### 4.2 Employee DELETE - `employees/page.tsx`

```typescript
// Em handleDelete(), após successful delete do Supabase:
// Adicionar ANTES de setEmployees filter

// Buscar profile para tenant_id
const { data: deletedProfile } = await supabase
  .from("profiles")
  .select("tenant_id, name")
  .eq("id", id)
  .single();

// System log
await (supabase as any)
  .from("system_logs")
  .insert({
    user_id: profile?.id,
    tenant_id: profile?.tenant_id,
    action: "delete",
    module: "employees",
    details: `Funcionário excluído: ${deleteConfirm?.name}`,
  });

// Notification para admin que excluiu
await (supabase as any)
  .from("notifications")
  .insert({
    user_id: profile?.id,
    title: "Funcionário excluído",
    message: `${deleteConfirm?.name} foi removido do sistema`,
    type: "warning",
    is_read: false,
  });
```

### 4.3 Schedule CREATE - `api/point/schedules/route.ts` POST

Adicionar após INSERT com sucesso (antes do `return NextResponse.json`):

```typescript
// System log
await supabase.from("system_logs").insert({
  user_id: userId,
  tenant_id: finalTenantId,
  action: "create",
  module: "schedules",
  details: `Escala criada: ${name}`,
});

// Notification para admin
await supabase.from("notifications").insert({
  user_id: userId,
  title: "Escala criada",
  message: `Nova escala "${name}" foi criada`,
  type: "success",
  is_read: false,
});
```

### 4.4 Schedule UPDATE - `api/point/schedules/[id]/route.ts` PUT

Adicionar após UPDATE com sucesso (antes do `return NextResponse.json`):

```typescript
// System log
await supabase.from("system_logs").insert({
  user_id: userId,
  tenant_id: profile?.tenant_id,
  action: "update",
  module: "schedules",
  details: `Escala atualizada: ${updates.name || id}`,
});

// Notification
await supabase.from("notifications").insert({
  user_id: userId,
  title: "Escala atualizada",
  message: `Escala foi atualizada`,
  type: "info",
  is_read: false,
});
```

### 4.5 Schedule DELETE - `api/point/schedules/[id]/route.ts` DELETE

Adicionar após DELETE com sucesso:

```typescript
// System log
await supabase.from("system_logs").insert({
  user_id: userId,
  tenant_id: profile?.tenant_id,
  action: "delete",
  module: "schedules",
  details: `Escala excluída: ${id}`,
});

// Notification
await supabase.from("notifications").insert({
  user_id: userId,
  title: "Escala excluída",
  message: `Uma escala foi removida do sistema`,
  type: "warning",
  is_read: false,
});
```

### 4.6 Schedule ASSIGN - `api/point/schedules/[id]/assign/route.ts` POST

Adicionar após loop de assign:

```typescript
// System log
await supabase.from("system_logs").insert({
  user_id: userId,
  tenant_id: profile?.tenant_id,
  action: "assign",
  module: "schedules",
  details: `${assigned.length} funcionário(s) atribuído(s) à escala ${id} (efetivo em ${effectiveFrom})`,
});

// Notificar cada usuário atribuído
for (const uid of assigned) {
  await supabase.from("notifications").insert({
    user_id: uid,
    title: "Nova escala atribuída",
    message: `Uma nova escala de trabalho foi atribuída a você, efetiva em ${effectiveFrom}`,
    type: "info",
    is_read: false,
  });
}

// Notificar admin
await supabase.from("notifications").insert({
  user_id: userId,
  title: "Escala atribuída",
  message: `${assigned.length} funcionário(s) recebeu(ram) a escala "${scheduleName}"`,
  type: "success",
  is_read: false,
});
```

### 4.7 Leave Request REJECT (AdminDashboard) - `admin/AdminDashboard.tsx`

Adicionar após update bem-sucedido:

```typescript
// System log
await (supabase as any)
  .from("system_logs")
  .insert({
    user_id: profile.id,
    tenant_id: profile.tenant_id,
    action: "reject",
    module: "leave_requests",
    details: `Pedido de férias rejeitado: ${request?.type} (${request?.start_date} a ${request?.end_date}) - Motivo: ${rejectionReason || "Não informado"}`,
  });

// Notification (além do email que já existe)
const userProfile = profiles.find((p) => p.id === request?.user_id);
if (userProfile) {
  await (supabase as any)
    .from("notifications")
    .insert({
      user_id: userProfile.id,
      title: "❌ Pedido Rejeitado",
      message: `Seu pedido de ${LEAVE_TYPE_LABELS[request?.type]} foi rejeitado${rejectionReason ? `: ${rejectionReason}` : ""}`,
      type: "error",
      is_read: false,
    });
}
```

### 4.8 Leave Request CANCEL (AdminDashboard) - `admin/AdminDashboard.tsx`

Adicionar após update bem-sucedido:

```typescript
// System log
await (supabase as any)
  .from("system_logs")
  .insert({
    user_id: profile.id,
    tenant_id: profile.tenant_id,
    action: "cancel",
    module: "leave_requests",
    details: `Pedido de férias cancelado: ${cancellingRequest?.type}`,
  });

// Notification
await (supabase as any)
  .from("notifications")
  .insert({
    user_id: cancellingRequest.userId,
    title: "Pedido Cancelado",
    message: `Seu pedido de ${LEAVE_TYPE_LABELS[cancellingRequest?.type]} foi cancelado pelo gestor`,
    type: "warning",
    is_read: false,
  });
```

### 4.9 Leave Request APPROVE (AdminDashboard) - `admin/AdminDashboard.tsx`

Adicionar após balance deduction + status update:

```typescript
// System log
await (supabase as any)
  .from("system_logs")
  .insert({
    user_id: profile.id,
    tenant_id: profile.tenant_id,
    action: "approve",
    module: "leave_requests",
    details: `Pedido de férias aprovado: ${request?.type} (${request?.days_count} dias)`,
  });

// Notification
const userProfile = profiles.find((p) => p.id === request?.user_id);
if (userProfile) {
  await (supabase as any)
    .from("notifications")
    .insert({
      user_id: userProfile.id,
      title: "✅ Pedido Aprovado",
      message: `Seu pedido de ${LEAVE_TYPE_LABELS[request?.type]} foi aprovado!`,
      type: "success",
      is_read: false,
    });
}
```

### 4.10 Tenant CRUD - `api/admin/tenants/route.ts`

**POST (create)** - adicionar após INSERT com sucesso:

```typescript
// System log
await adminClient.from("system_logs").insert({
  user_id: user.id,
  tenant_id: data.id,
  action: "create",
  module: "tenants",
  details: `Empresa criada: ${name} (slug: ${slug})`,
});

// Notification
await adminClient.from("notifications").insert({
  user_id: user.id,
  title: "Empresa criada",
  message: `Empresa "${name}" foi criada com sucesso`,
  type: "success",
  is_read: false,
});
```

**PUT (update)** - adicionar após UPDATE:

```typescript
// System log
await adminClient.from("system_logs").insert({
  user_id: user.id,
  tenant_id: id,
  action: "update",
  module: "tenants",
  details: `Empresa atualizada: ${name}`,
});
```

**DELETE** - adicionar após DELETE:

```typescript
// System log
await adminClient.from("system_logs").insert({
  user_id: user.id,
  action: "delete",
  module: "tenants",
  details: `Empresa excluída: ${id}`,
});

// Notification
await adminClient.from("notifications").insert({
  user_id: user.id,
  title: "Empresa excluída",
  message: `Empresa foi removida do sistema`,
  type: "warning",
  is_read: false,
});
```

### 4.11 Timesheet APPROVE/REJECT - `api/point/timesheets/route.ts` PUT

Adicionar após cada ação (approve_all, reject_all, approve_day, reject_day):

```typescript
// Common: get current user + profile
const { data: adminProfile } = await supabase
  .from("profiles")
  .select("tenant_id")
  .eq("id", session.user.id)
  .single();

const actionLabel = action === "approve_all" || action === "approve_day" ? "aprovadas" : "rejeitadas";
const actionModule = action === "approve_all" || action === "reject_all" ? "approve" : "update";

// System log
await supabase.from("system_logs").insert({
  user_id: session.user.id,
  tenant_id: adminProfile?.tenant_id,
  action: actionModule,
  module: "timesheets",
  details: `Horas extras ${actionLabel} para ${user_id} (${monthDate})`,
});

// Notification
await supabase.from("notifications").insert({
  user_id: user_id,
  title: action.includes("approve") ? "Horas Extras Aprovadas" : "Horas Extras Rejeitadas",
  message: `Suas horas extras de ${monthDate} foram ${actionLabel}`,
  type: action.includes("approve") ? "success" : "warning",
  is_read: false,
});
```

---

## RESUMO EXECUTIVO

| Categoria | Já gera log | Já gera notif | Precisa Log | Precisa Notif |
|----------|------------|---------------|-------------|---------------|
| Login/Logout | ❌ | ❌ | ✅ | ✅ |
| Employee CREATE | ✅ (audit_log) | ✅ | ✅ system_logs | — |
| Employee UPDATE | ✅ (audit_log) | ✅ | ✅ system_logs | — |
| Employee DELETE | ❌ | ❌ | ✅ | ✅ |
| Schedule CREATE | ❌ | ❌ | ✅ | ✅ |
| Schedule UPDATE | ❌ | ❌ | ✅ | ✅ |
| Schedule DELETE | ❌ | ❌ | ✅ | ✅ |
| Schedule ASSIGN | ❌ | ❌ | ✅ | ✅ |
| Leave CREATE (actions.ts) | ✅ | webhook | ✅ system_logs | ✅ DB |
| Leave APPROVE (actions.ts) | ✅ | webhook | ✅ system_logs | ✅ DB |
| Leave REJECT (actions.ts) | ✅ | webhook | ✅ system_logs | ✅ DB |
| Leave CANCEL (actions.ts) | ✅ | webhook | ✅ system_logs | ✅ DB |
| Leave APPROVE (AdminDashboard) | ❌ | ❌ | ✅ | ✅ |
| Leave REJECT (AdminDashboard) | ❌ | ❌ | ✅ | ✅ |
| Leave CANCEL (AdminDashboard) | ❌ | ❌ | ✅ | ✅ |
| Tenant CREATE | ❌ | ❌ | ✅ | ✅ |
| Tenant UPDATE | ❌ | ❌ | ✅ | ✅ |
| Tenant DELETE | ❌ | ❌ | ✅ | ✅ |
| Timesheet APPROVE/REJECT | ❌ | ❌ | ✅ | ✅ |

**Total de intervenções necessárias:** 13 pontos de falha + login/logout = 15 inserções de código

**Arquivo helper criado:** `/data/.openclaw/workspace/PROJECTS/FOLIA/src/lib/system-logger.ts`

---

## PRÓXIMOS PASSOS RECOMENDADOS

1. **Criar migration para adicionar `system_logs`** (já existe table mas verificar se foi executada)
2. **Implementar os 13 pontos de falha** usando o código acima
3. **Adicionar Login/Logout tracking** no frontend
4. **Criar API de auth custom** se quiser tracking de login via server-side
5. **Verificar se todas as APIs estão usando o `log_audit_action`** do `audit_log` corretamente (algumas ações como schedule CRUD não usam)
