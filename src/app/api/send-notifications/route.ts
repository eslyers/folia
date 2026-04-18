import { NextResponse } from "next/server";
import { createServerClientWithResponse } from "@/lib/supabase/server";
import nodemailer from "nodemailer";
import { format } from "date-fns";

// Helper function to format dates
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Helper function to generate email templates
function generateEmailTemplate(type: string, data: any): string {
  const templates: Record<string, string> = {
    // Férias Próximas (7 dias antes)
    upcoming_leave: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Férias em ${data.days_until} dias - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .highlight { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏖️ Suas Férias Estão Chegando!</h1>
            <p>Faltam apenas ${data.days_until} dias para você relaxar!</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <div class="highlight">
              <h3>📅 Suas Férias:</h3>
              <p><strong>Início:</strong> ${formatDate(data.leave_start)}</p>
              <p><strong>Término:</strong> ${formatDate(data.leave_end)}</p>
              <p><strong>Faltam:</strong> ${data.days_until} dia${data.days_until > 1 ? 's' : ''}</p>
            </div>
            <p>✅ Organize suas tarefas pendentes</p>
            <p>✅ Configure auto-resposta de email</p>
            <p>✅ Informe sua equipe sobre sua ausência</p>
            <p style="margin-top: 20px;"><strong>Aproveite muito! 🌴💫</strong></p>
          </div>
          <div class="footer">
            <p>📧 Este é um email automático do sistema FOLIA.</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // Férias Terminando (3 dias antes)
    expiring_leave: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Volta ao Trabalho - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .highlight { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Suas Férias Estão Terminando!</h1>
            <p>Faltam ${data.days_until} dias para você voltar</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <div class="highlight">
              <h3>📅 Último Dia de Férias:</h3>
              <p><strong>Data final:</strong> ${formatDate(data.leave_end)}</p>
              <p><strong>Faltam:</strong> ${data.days_until} dia${data.days_until > 1 ? 's' : ''}</p>
            </div>
            <p>✅ Prepare-se para voltar ao trabalho</p>
            <p>✅ Verifique suas mensagens pendentes</p>
            <p>✅ Organize sua agenda para os próximos dias</p>
            <p style="margin-top: 20px;"><strong>Volte com energia renovada! 💪</strong></p>
          </div>
          <div class="footer">
            <p>📧 Este é um email automático do sistema FOLIA.</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // Aprovação
    approval_approved: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pedido Aprovado - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .success { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Pedido Aprovado!</h1>
            <p>Seu pedido foi aceito!</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <p>Seu pedido de <strong>${data.leave_type}</strong> foi <strong>aprovado</strong>!</p>
            <div class="success">
              <h3>📅 Detalhes:</h3>
              <p><strong>Início:</strong> ${formatDate(data.leave_start)}</p>
              <p><strong>Término:</strong> ${formatDate(data.leave_end)}</p>
            </div>
            <p style="margin-top: 20px;"><strong>Aproveite! 🌴</strong></p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // Rejeição
    approval_rejected: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pedido Rejeitado - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .error { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .reason { background: #fff7ed; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f97316; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Pedido Rejeitado</h1>
            <p>Seu pedido não foi aprovado</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <p>Infelizmente, seu pedido de <strong>${data.leave_type}</strong> foi <strong>rejeitado</strong>.</p>
            ${data.rejection_reason ? `
            <div class="reason">
              <h3 style="margin: 0 0 8px; color: #c2410c;">📝 Motivo da Rejeição:</h3>
              <p style="margin: 0; color: #9a3412;">${data.rejection_reason}</p>
            </div>
            ` : ``}
            <div class="error">
              <h3>📅 Detalhes do Pedido:</h3>
              <p><strong>Início:</strong> ${formatDate(data.leave_start)}</p>
              <p><strong>Término:</strong> ${formatDate(data.leave_end)}</p>
            </div>
            <p>Procure RH para mais informações ou faça um novo pedido.</p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // PRIMEIRAS FÉRIAS VENCENDO (3 meses antes)
    vacation_vesting_1: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Suas Férias Vencem em Breve - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .warning { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Suas Primeira Férias Vencem em Breve!</h1>
            <p>Você precisa agendar agora!</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <p>Você completou <strong>12 meses de trabalho</strong> e já tem direito a suas <strong>primeiras férias (30 dias)</strong>!</p>
            <div class="warning">
              <h3>⚠️ Atenção:</h3>
              <p>Suas férias precisam ser <strong>gozadas em até 12 meses</strong>.</p>
              <p style="margin-top: 10px;"><strong>Faltam apenas ${data.days_until} dias!</strong></p>
            </div>
            <p>✅ Procure o RH imediatamente para agendar suas férias</p>
            <p>✅ Não perca seu direito adquirido!</p>
            <p style="margin-top: 20px;"><strong>Agende antes que vença! ⏰</strong></p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // PRIMEIRAS FÉRIAS VENCERAM
    vacation_expired_1: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>URGENTE: Férias Vencidas - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .danger { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 URGENTE: Suas Férias VENCERAM!</h1>
            <p>Você pode perder seu direito!</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <div class="danger">
              <h3>🚨 Suas primeiras férias (30 dias) VENCERAM sem gozo!</h3>
              <p style="margin-top: 10px;">Você precisava ter gozado suas férias dentro do prazo legal.</p>
              <p style="margin-top: 10px;">Procure o RH <strong>IMEDIATAMENTE</strong> para verificar suas opções.</p>
            </div>
            <p style="margin-top: 20px;"><strong>Não perca mais tempo! Procure RH agora! ⏰</strong></p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // MARCAR SEGUNDA FÉRIAS (6 meses antes)
    vacation_mark_2: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Segunda Férias - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .info { background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Hora de Agendar sua Segunda Férias!</h1>
            <p>Você tem direito a mais 30 dias!</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <p>Você já goozou suas primeiras férias e agora tem direito à <strong>segunda férias (30 dias)</strong>!</p>
            <div class="info">
              <h3>📋 Suas Datas:</h3>
              <p><strong>Faltam ${data.days_until} dias!</strong></p>
            </div>
            <p>✅ Procure o RH para agendar</p>
            <p>✅ Lembre-se: são mais 30 dias de descanso!</p>
            <p style="margin-top: 20px;"><strong>Não deixe para depois! 🌴</strong></p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // MARCAR SEGUNDA FÉRIAS URGENTE (3 meses antes)
    vacation_mark_2_urgent: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>URGENTE: Segunda Férias - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .warning { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 URGENTE: Segunda Férias Prazo Apertando!</h1>
            <p>Falta pouco tempo para agendar!</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <div class="warning">
              <h3>⚠️ Faltam apenas ${data.days_until} dias!</h3>
              <p style="margin-top: 10px;">Você ainda não agendou sua segunda férias.</p>
              <p style="margin-top: 10px;">Procure o RH <strong>IMEDIATAMENTE</strong> para garantir seus 30 dias adicionais!</p>
            </div>
            <p>⏰ Não perca seu direito!</p>
            <p style="margin-top: 20px;"><strong>Corra para o RH agora! 🚨</strong></p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // SEGUNDA FÉRIAS VENCERAM
    vacation_expired_2: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>URGENTE: Segunda Férias Vencidas - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .danger { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 URGENTE: Segunda Férias VENCERAM!</h1>
            <p>Você pode perder seu direito!</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <div class="danger">
              <h3>🚨 Suas segunda férias (30 dias) VENCERAM sem gozo!</h3>
              <p style="margin-top: 10px;">Você perdeu o prazo legal para gozar.</p>
              <p style="margin-top: 10px;">Procure o RH <strong>IMEDIATAMENTE</strong> para verificar suas opções.</p>
            </div>
            <p style="margin-top: 20px;"><strong>Procure RH urgentemente! ⏰</strong></p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `,

    // DADOS INCOMPLETOS - SEM DATA DE ADMISSÃO
    vacation_no_hire_date: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dados Incompletos - FOLIA</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .danger { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Dados Incompletos!</h1>
            <p>Não é possível rastrear suas férias</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${data.user_name}</strong>!</p>
            <div class="danger">
              <h3>⚠️ ATENÇÃO: Dados Obrigatórios Faltando!</h3>
              <p style="margin-top: 10px;">Você tem <strong>${data.days_until || '?'} dias</strong> de férias, porém não possui <strong>data de admissão</strong> cadastrada.</p>
              <p style="margin-top: 10px;">Sem a data de admissão, o sistema <strong>não consegue calcular</strong> o vencimento das suas férias.</p>
              <p style="margin-top: 10px;">Procure o RH <strong>IMEDIATAMENTE</strong> para cadastrar sua data de admissão!</p>
            </div>
            <p style="margin-top: 20px;"><strong>Sem data de admissão = Férias não rastreáveis! ⏰</strong></p>
          </div>
          <div class="footer">
            <p>📧 Sistema FOLIA - Gerenciamento de Férias</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return templates[type] || templates.upcoming_leave;
}

export async function POST(request: Request) {
  const supabase = createServerClientWithResponse(null);

  try {
    const notifications = await request.json();

    if (!Array.isArray(notifications)) {
      return NextResponse.json(
        { success: false, error: "Invalid notifications format" },
        { status: 400 }
      );
    }

    const results = [];
    const fromEmail = process.env.EMAIL_FROM || "FOLIA <noreply@folia-vercel.app>";

    // Create Brevo transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_LOGIN,
        pass: process.env.SMTP_KEY,
      },
    });

    for (const notification of notifications) {
      let emailSent = false;
      let error: string | null = null;

      try {
        // Generate email content
        const emailHtml = generateEmailTemplate(notification.type, notification);

        console.log(`[Notification] Type: ${notification.type}`);
        console.log(`[Notification] To: ${notification.user_email}`);
        console.log(`[Notification] Title: ${notification.title}`);

        // Send real email via Brevo
        try {
          const info = await transporter.sendMail({
            from: fromEmail,
            to: notification.user_email,
            subject: notification.title,
            html: emailHtml,
          });

          emailSent = true;
          console.log(`[Brevo] Email sent: ${info.messageId}`);
        } catch (smtpError) {
          error = smtpError instanceof Error ? smtpError.message : "SMTP error";
          console.error(`[Brevo Error] ${error}`);
        }

        results.push({
          user_name: notification.user_name,
          user_email: notification.user_email,
          type: notification.type,
          success: emailSent,
          message: notification.title,
          error
        });

        // Log the notification
        const supabase = createServerClientWithResponse(null);
        const { error: insertError } = await supabase
          .from("notification_logs")
          .insert({
            user_id: notification.user_id,
            type: notification.type,
            status: emailSent ? "sent" : "failed",
            message: notification.title,
            email_sent: emailSent,
            error: error,
          });

        if (insertError) {
          console.error(`[DB Insert Error] ${insertError.message}`);
        }
      } catch (error) {
        console.error(`Failed to process notification for ${notification.user_email}:`, error);
        
        error = error instanceof Error ? error.message : "Unknown error";

        // Try to log failed notification
        try {
          const supabase = createServerClientWithResponse(null);
          await supabase
            .from("notification_logs")
            .insert({
              user_id: notification.user_id,
              type: notification.type,
              status: "failed",
              message: notification.title,
              email_sent: false,
              error: error,
            });
        } catch (dbError) {
          console.error(`Failed to insert notification log:`, dbError);
        }

        results.push({
          user_name: notification.user_name,
          user_email: notification.user_email,
          type: notification.type,
          success: false,
          message: error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${notifications.length} notifications`,
      results 
    });
  } catch (error) {
    console.error("Error in send-notifications:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to process notifications" 
    }, { status: 500 });
  }
}
