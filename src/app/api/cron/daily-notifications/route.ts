import { NextResponse } from "next/server";
import { createServerClientWithResponse } from "@/lib/supabase/server";
import nodemailer from "nodemailer";
import { addMonths, addYears, differenceInMonths, differenceInDays, format } from "date-fns";

// Types
interface Notification {
  user_id: string;
  user_name: string;
  user_email: string;
  type: string;
  title: string;
  message: string;
  leave_start?: string;
  leave_end?: string;
  days_until?: number;
}

interface EmailResult {
  success: boolean;
  email: string;
  error?: string;
}

// Email template generator
function generateEmailTemplate(type: string, data: Notification): string {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const templates: Record<string, string> = {
    vacation_vesting_1: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">⏰ Suas Primeira Férias Vencem em Breve!</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá, <strong>${data.user_name}</strong>!</p>
          <p>Você completou <strong>12 meses de trabalho</strong> e tem direito a <strong>30 dias de férias</strong>!</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0;"><strong>⚠️ Faltam apenas ${data.days_until} dias!</strong></p>
          </div>
          <p>Procure o RH para agendar suas férias antes do vencimento.</p>
        </div>
        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Este é um email automático do sistema FOLIA.</p>
        </div>
      </div>
    `,
    vacation_expired_1: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🚨 URGENTE: Suas Férias VENCERAM!</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá, <strong>${data.user_name}</strong>!</p>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 0;"><strong>Suas primeiras férias (30 dias) VENCERAM sem gozo!</strong></p>
          </div>
          <p>Procure o RH <strong>IMEDIATAMENTE</strong> para não perder seu direito!</p>
        </div>
        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Este é um email automático do sistema FOLIA.</p>
        </div>
      </div>
    `,
    vacation_mark_2: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">📅 Hora de Agendar sua Segunda Férias!</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá, <strong>${data.user_name}</strong>!</p>
          <p>Você tem direito à <strong>segunda férias (30 dias)</strong>!</p>
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0;"><strong>Faltam ${data.days_until} dias!</strong></p>
          </div>
          <p>Procure o RH para agendar.</p>
        </div>
        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Este é um email automático do sistema FOLIA.</p>
        </div>
      </div>
    `,
    vacation_mark_2_urgent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🚨 URGENTE: Segunda Férias Prazo Apertando!</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá, <strong>${data.user_name}</strong>!</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0;"><strong>Faltam apenas ${data.days_until} dias!</strong></p>
          </div>
          <p>Procure o RH <strong>IMEDIATAMENTE</strong>!</p>
        </div>
        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Este é um email automático do sistema FOLIA.</p>
        </div>
      </div>
    `,
    upcoming_leave: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🏖️ Suas Férias Estão Chegando!</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá, <strong>${data.user_name}</strong>!</p>
          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0;"><strong>Faltam ${data.days_until} dias!</strong></p>
            <p style="margin: 5px 0 0;">Período: ${formatDate(data.leave_start || '')} a ${formatDate(data.leave_end || '')}</p>
          </div>
          <p>Aproveite seu descanso!</p>
        </div>
        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Este é um email automático do sistema FOLIA.</p>
        </div>
      </div>
    `,
    expiring_leave: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">⏰ Suas Férias Estão Terminando!</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá, <strong>${data.user_name}</strong>!</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0;"><strong>Faltam ${data.days_until} dias para voltar!</strong></p>
          </div>
          <p>Prepare-se para retornar ao trabalho.</p>
        </div>
        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Este é um email automático do sistema FOLIA.</p>
        </div>
      </div>
    `,
    vacation_no_hire_date: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">⚠️ Dados Incompletos - Férias Não Rastreáveis!</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Olá, <strong>${data.user_name}</strong>!</p>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 0;"><strong>Você tem ${data.days_until} dias de férias, porém não possui data de admissão cadastrada.</strong></p>
          </div>
          <p>Procure o RH para cadastrar sua data de admissão e evitar problemas com o vencimento de férias.</p>
        </div>
        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Este é um email automático do sistema FOLIA.</p>
        </div>
      </div>
    `
  };

  return templates[type] || templates.vacation_vesting_1;
}

// Check if notification was already sent today
async function wasNotificationSentToday(
  supabase: any, 
  userId: string, 
  type: string
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data } = await supabase
    .from("notification_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("status", "sent")
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString())
    .limit(1);

  return (data?.length || 0) > 0;
}

// Main cron handler
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    success: true,
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
    duration: 0
  };

  try {
    const supabase = createServerClientWithResponse(null);

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("*");

    if (usersError) throw usersError;

    // Get all approved leave requests
    const { data: leaveRequests } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "approved");

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_LOGIN,
        pass: process.env.SMTP_KEY,
      },
    });

    const notifications: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate notifications for each user
    for (const user of users || []) {
      const userBalance = user.vacation_balance || 0;
      
      // Check employees without hire_date
      if (!user.hire_date && userBalance > 0) {
        notifications.push({
          user_id: user.id,
          user_name: user.name,
          user_email: user.email,
          type: "vacation_no_hire_date",
          title: "⚠️ Dados Incompletos - Suas Férias Não São Rastreáveis",
          message: `${user.name} tem ${userBalance} dias de férias, porém não possui data de admissão.`,
          days_until: userBalance
        });
      }

      const hireDate = user.hire_date ? new Date(user.hire_date) : null;
      if (!hireDate) continue;

      const monthsWorked = differenceInMonths(today, hireDate);
      const firstVacationDate = addMonths(hireDate, 12);
      const secondVacationDate = addYears(firstVacationDate, 1);

      const userScheduledVacations = leaveRequests?.filter(
        (lr: any) => lr.user_id === user.id && lr.type === "vacation"
      ) || [];

      // First vacation vesting
      if (monthsWorked >= 12) {
        const firstVacationTaken = userScheduledVacations.some(
          (lv: any) => new Date(lv.start_date) >= firstVacationDate
        );

        if (!firstVacationTaken) {
          const daysUntilExpiry = differenceInDays(addYears(firstVacationDate, 1), today);

          if (daysUntilExpiry > 0 && daysUntilExpiry <= 90) {
            notifications.push({
              user_id: user.id,
              user_name: user.name,
              user_email: user.email,
              type: "vacation_vesting_1",
              title: "⏰ Suas Primeira Férias Vencem em Breve!",
              message: `Faltam ${daysUntilExpiry} dias para o vencimento!`,
              days_until: daysUntilExpiry
            });
          }

          if (daysUntilExpiry <= 0) {
            notifications.push({
              user_id: user.id,
              user_name: user.name,
              user_email: user.email,
              type: "vacation_expired_1",
              title: "🚨 URGENTE: Suas Primeira Férias VENCERAM!",
              message: "Suas primeiras férias venceram sem gozo!",
              days_until: 0
            });
          }
        }
      }

      // Second vacation
      if (monthsWorked >= 24) {
        const secondVacationTaken = userScheduledVacations.some(
          (lv: any) => new Date(lv.start_date) >= secondVacationDate
        );

        if (!secondVacationTaken) {
          const actualFirstVacation = userScheduledVacations.find(
            (lv: any) => new Date(lv.start_date) >= firstVacationDate
          );

          if (actualFirstVacation) {
            const actualSecondDate = addYears(new Date(actualFirstVacation.start_date), 1);
            const hasSecondScheduled = userScheduledVacations.some(
              (lv: any) => new Date(lv.start_date) >= actualSecondDate
            );

            if (!hasSecondScheduled) {
              const daysUntilMark = differenceInDays(actualSecondDate, today);

              if (daysUntilMark > 0 && daysUntilMark <= 180) {
                notifications.push({
                  user_id: user.id,
                  user_name: user.name,
                  user_email: user.email,
                  type: "vacation_mark_2",
                  title: "📅 Hora de Agendar sua Segunda Férias!",
                  message: `Faltam ${daysUntilMark} dias.`,
                  leave_start: format(actualSecondDate, "yyyy-MM-dd"),
                  days_until: daysUntilMark
                });
              }

              if (daysUntilMark > 0 && daysUntilMark <= 90) {
                notifications.push({
                  user_id: user.id,
                  user_name: user.name,
                  user_email: user.email,
                  type: "vacation_mark_2_urgent",
                  title: "🚨 URGENTE: Segunda Férias Prazo Apertando!",
                  message: `Faltam apenas ${daysUntilMark} dias!`,
                  leave_start: format(actualSecondDate, "yyyy-MM-dd"),
                  days_until: daysUntilMark
                });
              }
            }
          }
        }
      }

      // Upcoming vacations (7 days)
      for (const vacation of userScheduledVacations) {
        const startDate = new Date(vacation.start_date);
        const daysUntil = differenceInDays(startDate, today);
        
        if (daysUntil > 0 && daysUntil <= 7) {
          notifications.push({
            user_id: user.id,
            user_name: user.name,
            user_email: user.email,
            type: "upcoming_leave",
            title: "🏖️ Suas Férias estão Chegando!",
            message: `Faltam ${daysUntil} dias!`,
            leave_start: vacation.start_date,
            leave_end: vacation.end_date,
            days_until: daysUntil
          });
        }

        const endDate = new Date(vacation.end_date);
        const daysUntilEnd = differenceInDays(endDate, today);
        
        if (daysUntilEnd > 0 && daysUntilEnd <= 3) {
          notifications.push({
            user_id: user.id,
            user_name: user.name,
            user_email: user.email,
            type: "expiring_leave",
            title: "⏰ Suas Férias Estão Terminando!",
            message: `Faltam ${daysUntilEnd} dias para voltar!`,
            leave_start: vacation.start_date,
            leave_end: vacation.end_date,
            days_until: daysUntilEnd
          });
        }
      }
    }

    results.processed = notifications.length;

    // Send notifications
    for (const notification of notifications) {
      // Skip if already sent today
      const alreadySent = await wasNotificationSentToday(supabase, notification.user_id, notification.type);
      if (alreadySent) {
        results.skipped++;
        continue;
      }

      // Send email
      const emailHtml = generateEmailTemplate(notification.type, notification);
      let emailSent = false;
      let errorMessage: string | null = null;

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || "FOLIA <noreply@folia-vercel.app>",
          to: notification.user_email,
          subject: notification.title,
          html: emailHtml,
        });
        emailSent = true;
        results.sent++;
      } catch (emailError) {
        errorMessage = emailError instanceof Error ? emailError.message : "Email error";
        results.failed++;
        results.errors.push(`${notification.user_email}: ${errorMessage}`);
      }

      // Log to database
      await supabase.from("notification_logs").insert({
        user_id: notification.user_id,
        type: notification.type,
        status: emailSent ? "sent" : "failed",
        message: notification.title,
        email_sent: emailSent,
        error: errorMessage,
      });
    }

    results.duration = Date.now() - startTime;

    return NextResponse.json({
      message: `Daily notifications completed`,
      ...results
    });

  } catch (error) {
    console.error("[Cron] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      ...results
    }, { status: 500 });
  }
}

// Vercel Cron configuration - runs daily at 8 AM
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max
