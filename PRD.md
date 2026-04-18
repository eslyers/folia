# FOLIA - Product Requirements Document (PRD)

**Versão:** 1.0
**Data:** 15/04/2026
**Autor:** Sarah (cominput do Esly)
**Status:** Em elaboração

---

## 1. Resumo Executivo

### 1.1 O que é o FOLIA?

**FOLIA** é um sistema web de controle de férias, folgas e banco de horas para times corporativos. Permite que funcionários solicitem períodos de ausência e que gestores aprovem ou rejeitem essas solicitações.

### 1.2 Problema a Resolver

O time do Esly (trabalho CLT) não possui um sistema adequado para:
- Solicitar férias e folgas
- Controlar banco de horas
- Obter aprovação do gestor
- Visualizar calendários de ausência
- Gerenciar múltiplos сотрудники (funcionários)

Atualmente o processo é manual (planilhas, WhatsApp, e-mail), o que gera:
- Esquecimentos e perda de solicitações
- Dificuldade em rastrear saldos
- Ausência de histórico estruturado
- Falta de visibilidade para o gestor

### 1.3 Solução Proposta

Sistema web responsivo, elegante e premium, hospedado na **Vercel**, com banco de dados no **Supabase**. Cada funcionário acessa com login próprio, vê seu saldo, solicita folgas e acompanha aprovações. O gestor (admin) tem visão completa do time e approves ou rejeita pedidos.

### 1.4 Objetivos do Projeto

**Fase 1 (MVP):**
- Sistema de login por e-mail
- Dashboard do funcionário com saldo de férias
- Calendário visual com folgas
- Sistema de solicitação de folgas
- Sistema de aprovação para o admin
- Deploy na Vercel

**Fases futuras (não escopo MVP):**
- App mobile nativo
- Integração com Slack/Teams
- Relatórios avançados
- Histórico de alterações detalhado
- Sistema multi-empresa
- Banco de horas automático

---

## 2. Referências de Mercado

### 2.1 Sistemas Analisados

Foram pesquisados 3 sistemas open-source para inspiration:

#### A) TimeOff Management Application
- **Link:** github.com/timeoff-management/timeoff-management-application
- **Stack:** Node.js + SQLite
- **Prós:** Completo, calendário, aprovação, relatórios, e-mail
- **Contras:** SQLite não serve para Vercel (precisa migrar)
- **Funcionalidades a incluir:**
  - Solicitação de férias com calendário
  - Aprovação por gestor
  - E-mail de notificação
  - Relatórios de uso

#### B) Livly
- **Link:** github.com/JankoLancer/livly
- **Stack:** Node.js + Slack API
- **Prós:** Integração com Slack (moderno)
- **Contras:** Precisa configurar Slack API (técnico)
- **Funcionalidades a incluir:**
  - Fluxo de aprovação moderno
  - Interface limpa

#### C) Gadael
- **Link:** gadael.org
- **Stack:** Python/Django
- **Prós:** Enterprise, banco de horas, escalas
- **Contras:** Complexo de configurar
- **Funcionalidades a incluir:**
  - Controle de banco de horas
  - Políticas configuráveis

### 2.2 Funcionalidades "Core de Mercado"

Dos sistemas pesquisados, o core comum é:
1. Login do funcionário
2. Visualização de saldo (férias restantes)
3. Calendário com folgas marcadas
4. Solicitar novo período de ausência
5. Gestor vê fila de aprovações
6. Aprovar/rejeitar com um clique
7. Notificação por e-mail ao solicitante
8. Histórico de pedidos

---

## 3. Design System

### 3.1 Conceito Visual

**Estilo:** Minimalismo provençal sofisticado
**Inspiração:** L'Occitane en Provence - papelaria de luxo encontra interface digital
**Vibe:** Calma, organização, profissionalismo, natureza

### 3.2 Paleta de Cores

```
CORES PRINCIPAIS:
┌─────────────────────────────────────────────────────────────────────┐
│ Nome             │ Hex       │ RGB              │ Uso               │
├─────────────────────────────────────────────────────────────────────┤
│ Verde Oliva      │ #5C724A   │ rgb(92,114,74)  │ Botões, links     │
│ Dourado          │ #C7A76C   │ rgb(199,167,108)│ CTAs, highlights  │
│ Dourado Vivid   │ #D4A853   │ rgb(212,168,83) │ Hover states      │
│ Creme            │ #F5F0E6   │ rgb(245,240,230)│ Background        │
│ Branco           │ #FFFFFF   │ rgb(255,255,255)│ Cards, surfaces   │
├─────────────────────────────────────────────────────────────────────┤
│ CORES DE TEXTO:                                                    │
│ Marrom Escuro    │ #2C2416   │ rgb(44,36,22)   │ Títulos, texto   │
│ Marrom Médio     │ #6B5F4D   │ rgb(107,95,77)  │ Texto secundário  │
├─────────────────────────────────────────────────────────────────────┤
│ CORES DE STATUS:                                                   │
│ Sucesso/Verde    │ #4A7C4E   │ rgb(74,124,78)  │ Aprovado           │
│ Alerta/Laranja   │ #C4883A   │ rgb(196,136,58) │ Pendente          │
│ Erro/Vermelho    │ #A65D4E   │ rgb(166,93,78)  │ Rejeitado, erro   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Tipografia

```
HEADINGS (Títulos):
- Font Family: Playfair Display
- Weights: 500 (medium), 600 (semibold), 700 (bold)
- Fallback: Georgia, 'Times New Roman', serif
- Uso: Títulos de página, cards, headings principais

BODY (Corpo de texto):
- Font Family: Inter
- Weights: 400 (regular), 500 (medium), 600 (semibold)
- Fallback: system-ui, -apple-system, sans-serif
- Uso: Texto corrido, labels, botões

ACCENT (Destaques):
- Font Family: Montserrat
- Weights: 500 (medium), 600 (semibold)
- Fallback: 'Segoe UI', sans-serif
- Uso: Badges, tags, pequenos destaques
```

### 3.4 Espaçamento (Spacing System)

```
Base unit: 4px

Escala de espaçamento:
┌────────────────────────────────────────┐
│ Nome    │ Valor │ Exemplo de uso       │
├────────────────────────────────────────┤
│ xs      │ 4px   │ Gap entre badges      │
│ sm      │ 8px   │ Padding interno cards │
│ md      │ 16px  │ Padding padrão        │
│ lg      │ 24px  │ Margins de seção      │
│ xl      │ 32px  │ Espaçamento grande    │
│ 2xl     │ 48px  │ Margins de página     │
│ 3xl     │ 64px  │ Hero sections         │
└────────────────────────────────────────┘
```

### 3.5 Bordas e Sombras

```
Border Radius:
- sm: 4px (inputs, badges)
- md: 8px (botões)
- lg: 16px (cards)
- xl: 24px (modais)
- full: 9999px (avatares, pills)

Sombras:
- sm: 0 1px 2px rgba(0,0,0,0.05)
- md: 0 4px 6px rgba(0,0,0,0.07)
- lg: 0 10px 15px rgba(0,0,0,0.1)
- xl: 0 20px 25px rgba(0,0,0,0.15)
```

### 3.6 Motion & Animation

```
Princípios:
- Transições suaves, nunca abruptas
- Duração: 200ms (micro), 300ms (padrão), 400ms (complexo)
- Easing: ease-out para entrar, ease-in para sair

Animações específicas:
┌─────────────────────────────────────────────────────────────┐
│ Elemento        │ Animação              │ Duração          │
├─────────────────────────────────────────────────────────────┤
│ Botão hover     │ translateY(-2px) +    │ 200ms ease-out  │
│                 │ shadow increase       │                 │
├─────────────────────────────────────────────────────────────┤
│ Card hover      │ shadow increase       │ 200ms ease-out  │
├─────────────────────────────────────────────────────────────┤
│ Modal open      │ fade + scale(0.95→1) │ 300ms ease-out  │
├─────────────────────────────────────────────────────────────┤
│ Toast/Slide-in  │ translateX fade       │ 300ms ease-out  │
├─────────────────────────────────────────────────────────────┤
│ Loading spinner │ rotate 360deg loop    │ 1s linear        │
├─────────────────────────────────────────────────────────────┤
│ Skeleton pulse  │ opacity 0.5→1 loop   │ 1.5s ease-in-out│
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Arquitetura Técnica

### 4.1 Stack Tecnológico

```
FRONTEND:
- Framework: Next.js 15 (App Router)
- Linguagem: TypeScript
- Estilização: Tailwind CSS
- Ícones: Lucide React
- Datas: date-fns
- Utilidades: clsx, tailwind-merge

BACKEND:
- Database: Supabase (PostgreSQL)
- Autenticação: Supabase Auth
- ORM/Query: Supabase Client
- Hosting: Vercel

INTEGRAÇÕES:
- Não há integrações externas na Fase 1
- E-mail: Future (Supabase Edge Functions)
```

### 4.2 Estrutura de Pastas

```
FOLIA/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        # Dashboard funcionário
│   │   │   └── admin/
│   │   │       └── page.tsx         # Dashboard admin
│   │   ├── api/
│   │   │   └── ...
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Redirect para /login ou /dashboard
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Calendar.tsx
│   │   │   ├── Table.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── dashboard/
│   │   │   ├── BalanceCard.tsx
│   │   │   ├── RequestCard.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   └── RequestModal.tsx
│   │   └── admin/
│   │       ├── ApprovalQueue.tsx
│   │       ├── TeamMembers.tsx
│   │       └── AdminCalendar.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Supabase browser client
│   │   │   ├── server.ts          # Supabase server client
│   │   │   └── middleware.ts      # Auth middleware
│   │   ├── utils.ts
│   │   └── types.ts
│   └── actions/
│       ├── auth.ts                # Server actions de auth
│       ├── profile.ts             # Server actions de perfil
│       └── leave-requests.ts       # Server actions de pedidos
├── public/
│   └── ...
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### 4.3 Schema do Banco de Dados (Supabase/PostgreSQL)

```sql
-- =====================================================
-- TABELA 1: profiles (extensão do auth.users)
-- =====================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  avatar_url TEXT,
  vacation_balance INTEGER NOT NULL DEFAULT 30,  -- dias de férias restantes
  hours_balance INTEGER NOT NULL DEFAULT 0,        -- banco de horas em minutos
  department TEXT,                                 -- departamento (opcional)
  hire_date DATE,                                  -- data de admissão (opcional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- TABELA 2: leave_requests (solicitações de folga)
-- =====================================================
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('vacation', 'day_off', 'hours', 'sick', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,                     -- quantidade de dias
  hours_count INTEGER DEFAULT 0,                    -- para tipo 'hours' (em minutos)
  notes TEXT,                                      -- observações do solicitante
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason TEXT,                           -- motivo da rejeição (se rejeitado)
  reviewed_by UUID REFERENCES profiles(id),        -- admin que aprovou/rejeitou
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Validações
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_days CHECK (days_count > 0)
);

CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- TABELA 3: policies (políticas de férias)
-- =====================================================
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vacation_days_per_year INTEGER NOT NULL DEFAULT 30,
  carry_over_days INTEGER NOT NULL DEFAULT 5,      -- dias que podem ser transferidos
  max_consecutive_days INTEGER NOT NULL DEFAULT 30, -- máximo de dias seguidos
  min_days_notice INTEGER NOT NULL DEFAULT 7,      -- dias mínimos de antecedência
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert política padrão
INSERT INTO policies (name, vacation_days_per_year, carry_over_days, max_consecutive_days)
VALUES ('Política Padrão CLT', 30, 5, 30);

-- =====================================================
-- TABELA 4: notifications (notificações)
-- =====================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- === PROFILES ===

-- Usuários podem ver próprio perfil
CREATE POLICY "users_view_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin pode ver todos os perfis
CREATE POLICY "admins_view_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Usuários podem atualizar próprio perfil
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- === LEAVE REQUESTS ===

-- Funcionários veem próprias solicitações
CREATE POLICY "users_view_own_requests" ON leave_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Admin vê todas as solicitações
CREATE POLICY "admins_view_all_requests" ON leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Funcionários criam próprias solicitações
CREATE POLICY "users_create_own_requests" ON leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin pode atualizar qualquer solicitação
CREATE POLICY "admins_update_all_requests" ON leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Funcionários podem cancelar próprias solicitações pendentes
CREATE POLICY "users_cancel_own_pending_requests" ON leave_requests
  FOR UPDATE USING (
    auth.uid() = user_id AND status = 'pending'
  );

-- === NOTIFICATIONS ===

-- Usuários veem próprias notificações
CREATE POLICY "users_view_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- === POLICIES ===

-- Todos veem políticas (read-only)
CREATE POLICY "everyone_view_policies" ON policies
  FOR SELECT USING (is_active = true);

-- === INDEXES ===
CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

### 4.4 Autenticação (Supabase Auth)

```
MÉTODOS DE LOGIN:
- Email + Password (primário)
- OAuth futuro: Google, GitHub (não escopo MVP)

FLUXO DE AUTENTICAÇÃO:
1. Usuário acessa /login
2. Insere email + senha
3. Supabase valida credenciais
4. Se válido: redirect para /dashboard
5. Se inválido: mostrar erro
6. Middleware verifica sessão em todas as páginas protegidas

ARMAZENAMENTO DE SESSÃO:
- Supabase Auth usa cookies HTTPOnly
- Sessão persiste até logout ou expiração (1 semana)

PROTEÇÃO DE ROTAS:
- /dashboard → requer login (qualquer usuário)
- /admin → requer login + role='admin'
- /login → público (redirect se já logado)
```

### 4.5 Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Opcional (para server actions)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 5. Funcionalidades Detalhadas

### 5.1 Tela de Login

**URL:** `/login`
**Acesso:** Público
**Autenticado:** Redireciona para `/dashboard`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                        [LOGO FOLIA]                         │
│                                                             │
│                   Gerencie suas folgas                      │
│                                                             │
│    ┌─────────────────────────────────────────────────┐      │
│    │  Email                                         │      │
│    └─────────────────────────────────────────────────┘      │
│    ┌─────────────────────────────────────────────────┐      │
│    │  Senha                              [👁 Mostrar]│      │
│    └─────────────────────────────────────────────────┘      │
│                                                             │
│              [     Entrar     ]                             │
│                                                             │
│                   Esqueci minha senha                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Comportamentos:**
- Validação de email (formato)
- Validação de senha (mínimo 6 caracteres)
- Loading state no botão durante login
- Erro inline abaixo do campo inválido
- Toast de erro se credenciais incorretas
- Redirecionamento automático após login

### 5.2 Dashboard do Funcionário

**URL:** `/dashboard`
**Acesso:** Usuário logado (role: employee ou admin)
**Layout (Desktop):**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo]  FOLIA              [Nome] ▼  [🔔]  [Sair]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Olá, [Nome]!                          Quarta, 15 de Abril   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 🎉            │  │ ⏰            │  │ 📅            │      │
│  │ Férias        │  │ Banco de      │  │ Próxima       │      │
│  │ Restantes     │  │ Horas         │  │ Folga         │      │
│  │              │  │              │  │              │      │
│  │  18 dias     │  │  40h (8d)    │  │  22/04       │      │
│  │              │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Calendário - Abril 2026                    [<] [>]  │    │
│  │                                                     │    │
│  │  D   S   T   Q   Q   S   S                        │    │
│  │                      1   2   3   4                 │    │
│  │  5   6   7   8   9  10  11  12  [13-17] 14  15    │    │
│  │                                  Férias            │    │
│  │ 19  20  21  [22] 23  24  25  26  27  28  29  30    │    │
│  │                    Folga                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [+ Solicitar Folga]                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Pedidos Recentes                                    │    │
│  │                                                     │    │
│  │ ┌─────────────────────────────────────────────────┐│    │
│  │ │ Férias   13/04 - 17/04   ✅ Aprovado           ││    │
│  │ └─────────────────────────────────────────────────┘│    │
│  │ ┌─────────────────────────────────────────────────┐│    │
│  │ │ Folga    22/04/2026     ⏳ Pendente            ││    │
│  │ └─────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Cards de Saldo:**
1. **Férias Restantes**
   - Mostra dias restantes do ano
   - Badge verde se > 10 dias
   - Badge amarelo se 5-10 dias
   - Badge vermelho se < 5 dias

2. **Banco de Horas**
   - Mostra horas acumuladas
   - Converte para dias (8h = 1 dia)

3. **Próxima Folga**
   - Mostra próxima data aprovada
   - "Nenhuma agendada" se vazio

**Calendário:**
- Navegação mês anterior/próximo
- Dias com pedido aprovado: fundo verde claro
- Dias com pedido pendente: fundo amarelo claro
- Click no dia: mostra detalhes do pedido
- Fins de semana: cor diferenciada (cinza claro)

### 5.3 Modal de Solicitar Folga

**Trigger:** Botão "+ Solicitar Folga"
**Tipo:** Modal centralizado

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Solicitar Folga                     [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tipo de Afastamento *                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Férias                                            ▼  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Data de Início *    │  │ Data de Término *    │        │
│  │ [13/04/2026        ] │  │ [17/04/2026        ] │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                             │
│  Período: 5 dias úteis                                      │
│  Saldo atual: 18 dias                                       │
│                                                             │
│  Observações (opcional)                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [!] Atenção                                     │    │
│  │ Você tem 18 dias de férias disponíveis.           │    │
│  │ Solicitar 5 dias. Restarão 13 dias.              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│           [Cancelar]              [Enviar Solicitação]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tipos de Afastamento:**
- Férias (desconta do saldo)
- Folga (compensação)
- Banco de Horas (desconta do banco)
- Licença (médica, não desconta saldo)
- Outro

**Validações:**
- Data início >= hoje
- Data término >= data início
- Dias solicitados <= saldo disponível
- Não sobrepõe pedidos existentes
- Mínimo 7 dias de antecedência (se política exigir)

**Após envio:**
- Toast de sucesso
- Modal fecha
- Calendário atualiza
- Lista de pedidos atualiza
- Notificação para admin

### 5.4 Dashboard Admin

**URL:** `/admin`
**Acesso:** Usuário logado com role: admin
**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] FOLIA ADMIN        [🔔 3] [Nome ▼] [Sair]           │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  NAVEGAÇÃO    │  RESUMO DO DIA                             │
│               │                                             │
│  📊 Overview  │  ┌────────┐ ┌────────┐ ┌────────┐        │
│  ✅ Aprovar   │  │   12   │ │   3    │ │   8    │        │
│  👥 Equipe    │  │Total   │ │Pendentes│ │Ferias  │        │
│  📅 Calendário│  │Membros │ │Aprovar │ │Hoje    │        │
│  ⚙️ Config   │  └────────┘ └────────┘ └────────┘        │
│               │                                             │
│               │  ┌─────────────────────────────────────┐    │
│               │  │ PEDIDOS PENDENTES                  │    │
│               │  ├─────────────────────────────────────┤    │
│               │  │                                     │    │
│               │  │ Maria Silva - Férias                │    │
│               │  │ 13/04 - 17/04 (5 dias)             │    │
│               │  │ Pedido: há 2 dias                  │    │
│               │  │ [Aprovar] [Rejeitar]               │    │
│               │  ├─────────────────────────────────────┤    │
│               │  │                                     │    │
│               │  │ João Santos - Folga                 │    │
│               │  │ 22/04/2026 (1 dia)                 │    │
│               │  │ Pedido: há 5 dias                  │    │
│               │  │ [Aprovar] [Rejeitar]               │    │
│               │  └─────────────────────────────────────┘    │
│               │                                             │
│               │  ┌─────────────────────────────────────┐    │
│               │  │ CALENDÁRIO DA EQUIPE    [mês] [>]  │    │
│               │  ├─────────────────────────────────────┤    │
│               │  │     Abr 2026                        │    │
│               │  │  D   S   T   Q   Q   S   S         │    │
│               │  │                          1   2     │    │
│               │  │  [Maria    ]                     3  │    │
│               │  │  4   5   6   7   8   9  10        │    │
│               │  │        [João   ]                  │    │
│               │  │ 11  12 [Férias] 14  15  16  17     │    │
│               │  │      Maria                        │    │
│               │  │ 18  19  20  21 [Feriado] 23  24   │    │
│               │  │ 25  26  27  28  29  30           │    │
│               │  └─────────────────────────────────────┘    │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

**Funcionalidades Admin:**

1. **Overview**
   - Total de membros na equipe
   - Pedidos pendentes de aprovação
   - Pessoas de férias hoje
   - Próximas férias na semana

2. **Fila de Aprovações**
   - Lista de pedidos pendentes
   - Botões "Aprovar" e "Rejeitar"
   - Modal de rejeição com motivo (opcional)
   - Bulk actions (aprovar múltiplos)

3. **Gestão de Equipe**
   - Lista de membros
   - Adicionar novo membro
   - Editar saldo de férias
   - Remover membro

4. **Calendário Team**
   - Visão de todos os membros
   - Cores por membro
   - Feriados marcados
   - Zoom in/out

5. **Configurações**
   - Política de férias (dias/ano, carry-over)
   - Tipos de afastamento
   - Avisos de antecedência

### 5.5 Fluxo de Aprovação

```
FUNCIONÁRIO                          ADMIN
     │                                  │
     │──── Solicita folga ─────────────>│
     │     (status: pending)             │
     │                                  │──── Aprova ─────>│
     │                                  │     (status: approved)
     │<--- Notificação ─────            │       (-dias do saldo)
     │      "Sua folga foi             │
     │       aprovada!"                │
     │                                  │
     │                          OU     │
     │                                  │---- Rejeita ---->│
     │                                  │    (status: rejected)
     │<--- Notificação ─────            │    (motivo opcional)
     │      "Sua folga foi             │
     │       rejeitada: ..."           │
```

### 5.6 Notificações

**Tipos:**
- `success`: "Sua solicitação foi aprovada!"
- `info`: Lembrete de férias em X dias
- `warning`: Status de pedido pendente
- `error`: "Sua solicitação foi rejeitada"

**Exibição:**
- Badge no ícone de sino (Header)
- Dropdown com lista
- Marcar como lida ao clicar

---

## 6. Componentes UI

### 6.1 Button

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// Variants:
// primary: bg-green-olive, text-white, hover:darken
// secondary: border-green-olive, text-green-olive, hover:bg-green-olive/10
// ghost: transparent, text-green-olive, hover:bg-green-olive/10
// danger: bg-red-terra, text-white, hover:darken
```

### 6.2 Input

```tsx
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'date';
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
}

// States:
// default: border-gray-300
// focus: border-gold, ring-2 ring-gold/20
// error: border-red-terra, text below in red
// disabled: bg-gray-100, cursor-not-allowed
```

### 6.3 Card

```tsx
interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean; // Adds hover shadow animation
}

// Base: bg-white, shadow-sm, rounded-lg
// hover: shadow-md, translateY(-2px)
```

### 6.4 Badge

```tsx
interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  children: ReactNode;
}

// variants:
// success: bg-green/10, text-green-olive
// warning: bg-yellow/10, text-yellow-700
// error: bg-red/10, text-red-terra
// info: bg-blue/10, text-blue-600
// neutral: bg-gray/10, text-gray-600
```

### 6.5 Modal

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

// Overlay: bg-black/50
// Animation: fade-in + scale(0.95→1)
```

### 6.6 Calendar

```tsx
interface CalendarProps {
  month: Date;
  onMonthChange: (date: Date) => void;
  events?: CalendarEvent[];
  onDateClick?: (date: Date) => void;
}

interface CalendarEvent {
  id: string;
  date: Date;
  type: 'vacation' | 'day_off' | 'sick';
  status: 'approved' | 'pending';
  userId: string;
  userName?: string;
}

// Days with events:
// approved: bg-green-olive/10, border-left-4 border-green
// pending: bg-yellow/10, border-left-4 border-yellow
```

### 6.7 DataTable

```tsx
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  width?: string;
}

// Mobile: transforms to cards
```

---

## 7. Estados e Edge Cases

### 7.1 Estados de Loading

- **Page loading:** Skeleton screens com pulse animation
- **Button loading:** Spinner + texto "Carregando..."
- **Table loading:** Skeleton rows (5 rows)
- **Calendar loading:** Skeleton grid

### 7.2 Estados Vazios

- **Sem pedidos:** Ilustração + "Nenhuma solicitação ainda"
- **Sem notificações:** "Tudo em dia! 🎉"
- **Calendário vazio:** "Sem folgas agendadas"

### 7.3 Estados de Erro

- **Erro de rede:** Toast "Erro de conexão. Tente novamente."
- **Erro de validação:** Inline abaixo do campo
- **Erro genérico:** Toast "Algo deu errado. Tente novamente."
- **Sessão expirada:** Redirect para /login com toast

### 7.4 Edge Cases

1. **Saldo insuficiente:** Botão desabilitado, mensagem explicativa
2. **Datas passadas:** Não permitir seleção
3. **Sobreposição:** Alertar usuário antes de submeter
4. **Cancelamento:** Funcionário pode cancelar se status='pending'
5. **Admin não pode aprovar próprio pedido:** Regra de negócio
6. **Múltiplos pedidos no mesmo dia:** Mostrar warning

---

## 8. Roadmap de Desenvolvimento

### Fase 1: Setup + Auth (Duração estimada: 2h)
- [ ] Setup Next.js com Tailwind
- [ ] Configurar Supabase project
- [ ] Implementar schema + RLS
- [ ] Criar componentes base (Button, Input, Card, etc)
- [ ] Implementar tela de login
- [ ] Implementar middleware de autenticação
- [ ] Testar login/logout

### Fase 2: Dashboard Funcionário (Duração estimada: 3h)
- [ ] Layout base do dashboard
- [ ] Componente Header
- [ ] Cards de saldo
- [ ] Calendário com date-fns
- [ ] Lista de pedidos recentes
- [ ] Modal de solicitar folga
- [ ] Server actions para criar pedido

### Fase 3: Dashboard Admin (Duração estimada: 3h)
- [ ] Layout admin com sidebar
- [ ] Overview com métricas
- [ ] Fila de aprovações
- [ ] Aprovar/rejeitar functionality
- [ ] Calendário team view
- [ ] Gestão de membros

### Fase 4: Polimento (Duração estimada: 2h)
- [ ] Estados de loading
- [ ] Estados vazios
- [ ] Notificações toast
- [ ] Animações e transições
- [ ] Responsividade mobile
- [ ] Testes de usabilidade

### Fase 5: Deploy (Duração estimada: 1h)
- [ ] Configurar Vercel
- [ ] Variáveis de ambiente
- [ ] Deploy production
- [ ] Testar URL pública
- [ ] Configurar domínio (opcional)

**Total estimado: 11 horas**

---

## 9. Checklist de Testes

### Login
- [ ] Login com credenciais válidas
- [ ] Login com credenciais inválidas
- [ ] Logout
- [ ] Sessão persiste ao recarregar
- [ ] Redirecionamento se não autenticado

### Funcionário
- [ ] Ver saldo de férias
- [ ] Ver calendário com pedidos
- [ ] Solicitar folga com dados válidos
- [ ] Solicitar com saldo insuficiente
- [ ] Solicitar com datas inválidas
- [ ] Cancelar pedido pendente

### Admin
- [ ] Ver fila de aprovações
- [ ] Aprovar pedido
- [ ] Rejeitar pedido com motivo
- [ ] Ver calendário team
- [ ] Adicionar membro
- [ ] Editar saldo de membro

### Mobile
- [ ] Layout responsivo
- [ ] Navegação funcional
- [ ] Modais abrem/fecham corretamente
- [ ] Calendário navegável

---

## 10. Glossário

```
TERMO              DEFINIÇÃO
─────────────────────────────────────────────────────────────
FOLIA              Nome do projeto (do latim "folia" = folga)
Employee/Funcionário  Usuário padrão do sistema
Admin/Gestor       Usuário com poder de aprovação
RLS                Row Level Security (Segurança por linha)
PTO                Paid Time Off (Tempo remunerado fora)
Saldo de Férias    Dias de férias disponíveis
Banco de Horas     Horas de compensação acumuladas
Solicitação/Pedido  Request de folga feito pelo funcionário
Supabase           Plataforma de banco de dados + auth
Vercel             Plataforma de hosting para Next.js
```

---

## 11. Contato e Dúvidas

Se houver dúvidas durante o desenvolvimento, consultar este PRD primeiro. Se não estiver claro, perguntar ao Esly (dono do projeto).

**Canais de comunicação:**
- Para dúvidas técnicas: perguntar diretamente
- Para mudanças de escopo: criar task separate

---

*Documento criado em 15/04/2026*
*Última atualização: 15/04/2026*
