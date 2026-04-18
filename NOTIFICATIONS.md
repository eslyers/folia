# Sistema de Notificações por Email

O sistema FOLIA inclui um sistema robusto de notificações por email para automatizar comunicados sobre férias e folgas.

## Funcionalidades

### 🎯 Tipos de Notificações

1. **Férias Próximas** (`upcoming_leave`)
   - Enviado quando férias começam em até 7 dias
   - Template verde agradável com instruções

2. **Férias Terminando** (`expiring_leave`)
   - Enviado quando folgas terminam em até 3 dias
   - Template laranja com lembretes de retorno

3. **Aprovação Aprovada** (`approval_approved`)
   - Enviado quando pedidos são aprovados
   - Template verde confirmando aprovação

4. **Aprovação Rejeitada** (`approval_rejected`)
   - Enviado quando pedidos são rejeitados
   - Template vermelho com informações

## 📧 Configuração de Email

### Opções de Serviço

Para enviar emails reais, escolha um provedor:

#### 1. Resend (Recomendado)
```bash
# Instalar pacote
npm install resend

# Configurar variáveis de ambiente
echo "RESEND_API_KEY=your_resend_api_key" >> .env.local
```

#### 2. SendGrid
```bash
# Instalar pacote
npm install @sendgrid/mail

# Configurar variáveis de ambiente
echo "SENDGRID_API_KEY=your_sendgrid_api_key" >> .env.local
echo "SENDGRID_FROM=noreply@folia.com" >> .env.local
```

#### 3. AWS SES
```bash
# Instalar pacote
npm install aws-sdk

# Configurar variáveis de ambiente
echo "AWS_ACCESS_KEY_ID=your_access_key" >> .env.local
echo "AWS_SECRET_ACCESS_KEY=your_secret_key" >> .env.local
echo "AWS_REGION=us-east-1" >> .env.local
```

#### 4. Mailgun
```bash
# Instalar pacote
npm install mailgun-js

# Configurar variáveis de ambiente
echo "MAILGUN_API_KEY=your_mailgun_api_key" >> .env.local
echo "MAILGUN_DOMAIN=your_mailgun_domain" >> .env.local
```

### Modo de Teste

Para desenvolvimento, o sistema simula envio (log no console). Para produção, implemente o serviço real.

## 🕒 Agendamento Automático

### Método 1: Cron Job (Linux/macOS)

```bash
# Abrir crontab
crontab -e

# Adicionar linha para executar diariamente às 9h
0 9 * * * /usr/bin/node /caminho/para/scripts/send-daily-notifications.js

# Ou se usar Node.js completo
0 9 * * * cd /caminho/para/folia && npm run send-notifications
```

### Método 2: PM2

```bash
# Criar arquivo ecosystem.config.js
{
  "apps": [{
    "name": "daily-notifications",
    "script": "scripts/send-daily-notifications.js",
    "cwd": "/caminho/para/folia",
    "instances": 1,
    "autorestart": true,
    "watch": false,
    "max_memory_restart": "1G",
    "env": {
      "NODE_ENV": "production"
    }
  }]
}

# Iniciar serviço
pm2 start ecosystem.config.js

# Verificar status
pm2 status
```

### Método 3: GitHub Actions (para Vercel)

```yaml
# .github/workflows/daily-notifications.yml
name: Daily Notifications
on:
  schedule:
    - cron: '0 9 * * *'
  workflow_dispatch:

jobs:
  notifications:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run notifications
        run: |
          curl -X POST https://folia-rust.vercel.app/api/send-notifications \
            -H "Authorization: Bearer ${{ secrets.NOTIFICATION_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{"notifications":[]}'
        env:
          NOTIFICATION_SECRET: ${{ secrets.NOTIFICATION_SECRET }}
```

## 🔧 Endpoints da API

### 1. Verificar Notificações
```http
GET /api/check-notifications
```
Retorna todas as notificações pendentes para enviar.

### 2. Enviar Notificações
```http
POST /api/send-notifications
Content-Type: application/json

{
  "notifications": [
    {
      "user_id": "uuid",
      "user_email": "user@example.com",
      "user_name": "Nome do Usuário",
      "type": "upcoming_leave",
      "leave_type": "vacation",
      "leave_start": "2026-05-20",
      "leave_end": "2026-05-27",
      "days_until": 7,
      "message": "Suas férias começam em 7 dias"
    }
  ]
}
```

### 3. Enviar Email Individual
```http
POST /api/send-email
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Assunto do Email",
  "html": "<html>...</html>"
}
```

### 4. Criar Notificações de Teste
```http
GET /api/test-notifications
```
Cria notificações de teste para teste do sistema.

## 📊 Painel de Administração

Acesse `/admin/notifications` para:
- Ver estatísticas de envio
- Testar notificações
- Ver logs de envio
- Manter histórico

## 🗂️ Estrutura de Dados

### Tabela: notification_logs
```sql
CREATE TABLE notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  message TEXT NOT NULL,
  email_sent BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Variáveis de Ambiente Necessárias

```bash
# Configuração geral
NEXT_PUBLIC_BASE_URL=https://sua-url.com
NOTIFICATION_API_SECRET=sua-chave-secreta

# Configuração de email
RESEND_API_KEY=your_resend_api_key
# OU
SENDGRID_API_KEY=your_sendgrid_api_key
# OU
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
# OU
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
```

## 🚀 Deploy em Produção

1. **Configurar serviço de email**
   - Escolher provedor (Resend recomendado)
   - Configurar variáveis de ambiente

2. **Configurar agendamento**
   - Usar cron job ou PM2
   - Testar antes de produção

3. **Monitorar**
   - Verificar logs em `/admin/notifications`
   - Configurar alertas para falhas

4. **Manutenção**
   - Limpar logs periodicamente
   - Atualizar templates quando necessário

## 🔐 Segurança

- Use chaves secretas fortes
- Restrinja acesso ao painel admin
- Monitore logs suspeitos
- Use HTTPS em produção
- Valide todos os inputs da API

## 📈 Melhorias Futuras

- [ ] Notificações push via WebSockets
- [ ] Integração com Slack/Teams
- [ ] Templates personalizáveis
- - Agendamento avançado
- [ ] Análise de entregas e aberturas
- [ ] Testes A/B de templates