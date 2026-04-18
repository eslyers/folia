#!/usr/bin/env node

/**
 * Script para enviar notificações diárias de férias
 * 
 * Este script deve ser executado diariamente (recomendado: às 9h da manhã)
 * para verificar e enviar notificações de férias próximas e expirando.
 * 
 * Para configurar como cron job:
 * 1. Abrir crontab: crontab -e
 * 2. Adicionar linha: 0 9 * * * /usr/bin/node /caminho/para/scripts/send-daily-notifications.js
 * 
 * Ou usando PM2:
 * 1. Criar arquivo ecosystem.config.js
 * 2. Adicionar: "scripts": { "start": "node scripts/send-daily-notifications.js" }
 * 3. Rodar: pm2 start ecosystem.config.js --name "daily-notifications"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuração
const config = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  apiSecret: process.env.NOTIFICATION_API_SECRET || 'your-secret-key-here',
  
  // Tipos de notificação para enviar
  notificationTypes: [
    'upcoming_leave',  // Férias começando em até 7 dias
    'expiring_leave',  // Férias terminando em até 3 dias
  ],

  // Configurações de email (para produção, usar serviço real)
  emailConfig: {
    service: 'resend', // 'resend', 'sendgrid', 'ses', 'mailgun'
    apiKey: process.env.EMAIL_API_KEY,
    from: 'noreply@folia.com',
  }
};

// Função principal
async function main() {
  console.log(`[${new Date().toISOString()}] Iniciando verificação de notificações...`);
  
  try {
    // 1. Verificar notificações pendentes
    const notifications = await checkNotifications();
    console.log(`[${new Date().toISOString()}] Encontradas ${notifications.length} notificações para enviar`);
    
    if (notifications.length === 0) {
      console.log(`[${new Date().toISOString()}}] Nenhuma notificação pendente. Finalizando.`);
      return;
    }
    
    // 2. Enviar notificações
    const result = await sendNotifications(notifications);
    console.log(`[${new Date().toISOString()}] Resultado: ${JSON.stringify(result)}`);
    
    // 3. Registrar log
    await logExecution({
      totalNotifications: notifications.length,
      success: result.success,
      sentCount: result.results?.filter(r => r.success).length || 0,
      failedCount: result.results?.filter(r => !r.success).length || 0,
      errors: result.results?.filter(r => !r.success).map(r => r.message) || []
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro ao executar notificações:`, error);
    
    // Log de erro
    await logExecution({
      error: error.message,
      stack: error.stack
    });
  }
}

// Função para verificar notificações
async function checkNotifications() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(config.baseUrl).hostname,
      port: 443,
      path: '/api/check-notifications',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiSecret}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result.notifications || []);
          } catch (error) {
            reject(new Error(`Erro ao parsear resposta: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Função para enviar notificações
async function sendNotifications(notifications) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(config.baseUrl).hostname,
      port: 443,
      path: '/api/send-notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiSecret}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(new Error(`Erro ao parsear resposta: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(notifications));
    req.end();
  });
}

// Função para registrar log
async function logExecution(data) {
  const logData = {
    timestamp: new Date().toISOString(),
    ...data
  };

  // Salvar em arquivo de log
  const logPath = path.join(__dirname, '../logs/notifications.log');
  const logDir = path.dirname(logPath);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logEntry = JSON.stringify(logData) + '\n';
  fs.appendFileSync(logPath, logEntry);
  
  // Também salvar no formato JSON para análise
  const jsonPath = path.join(logDir, `notification-${new Date().toISOString().split('T')[0]}.json`);
  let existingData = [];
  
  if (fs.existsSync(jsonPath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (error) {
      console.error(`Erro ao ler arquivo JSON existente: ${error.message}`);
    }
  }
  
  existingData.push(logData);
  fs.writeFileSync(jsonPath, JSON.stringify(existingData, null, 2));
}

// Executar script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, checkNotifications, sendNotifications };