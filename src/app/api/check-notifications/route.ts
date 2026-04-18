import { NextResponse } from "next/server";
import { createServerClientWithResponse } from "@/lib/supabase/server";
import { addMonths, addYears, differenceInMonths, differenceInDays, format } from "date-fns";

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

export async function GET() {
  const supabase = createServerClientWithResponse(null);

  try {
    // Get all users with profiles
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("*");

    if (usersError) {
      console.error("[check-notifications] Users error:", usersError);
      return NextResponse.json(
        { success: false, error: "Erro ao buscar usuários: " + usersError.message },
        { status: 500 }
      );
    }

    // Get all approved leave requests
    const { data: leaveRequests, error: requestsError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "approved");

    if (requestsError) {
      console.error("[check-notifications] Leave requests error:", requestsError);
      return NextResponse.json(
        { success: false, error: "Erro ao buscar pedidos: " + requestsError.message },
        { status: 500 }
      );
    }

    const notifications: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of users || []) {
      // Get user's vacation balance
      const userBalance = user.vacation_balance || 0;
      
      // ========== 0. EMPLOYEES WITHOUT HIRE_DATE (CRITICAL) ==========
      // Employees without hire_date but with vacation balance need attention!
      if (!user.hire_date && userBalance > 0) {
        notifications.push({
          user_id: user.id,
          user_name: user.name,
          user_email: user.email,
          type: "vacation_no_hire_date",
          title: "⚠️ Dados Incompletos - Férias Não Rastreáveis!",
          message: `${user.name} tem ${userBalance} dias de férias, porém não possui data de admissão cadastrada. O sistema não consegue rastrear o vencimento. Procure RH para cadastrar a data de admissão!`,
        });
      }

      const hireDate = user.hire_date ? new Date(user.hire_date) : null;
      if (!hireDate) continue; // Skip if no hire_date for other calculations

      // Calculate vacation vesting dates
      const monthsWorked = differenceInMonths(today, hireDate);
      const firstVacationDate = addMonths(hireDate, 12); // First vacation after 12 months
      const secondVacationDate = addYears(firstVacationDate, 1); // Second vacation 12 months after first

      // Check if first vacation has been taken
      const firstVacationTaken = leaveRequests?.some(
        (lr) => lr.user_id === user.id && 
        lr.type === "vacation" &&
        new Date(lr.start_date) >= firstVacationDate
      );

      // Check if second vacation has been taken
      const secondVacationTaken = leaveRequests?.some(
        (lr) => lr.user_id === user.id && 
        lr.type === "vacation" &&
        new Date(lr.start_date) >= secondVacationDate
      );

      // Get scheduled vacations for this user
      const userScheduledVacations = leaveRequests?.filter(
        (lr) => lr.user_id === user.id && lr.type === "vacation"
      ) || [];

      // ========== 1. FIRST VACATION VESTING NOTIFICATIONS ==========
      
      // If employee has worked 12+ months and hasn't taken first vacation
      if (monthsWorked >= 12 && !firstVacationTaken) {
        const daysUntilExpiry = differenceInDays(
          addYears(firstVacationDate, 1), // First vacation expires 12 months after vesting
          today
        );

        // Notification: 3 months before first vacation expires
        if (daysUntilExpiry > 0 && daysUntilExpiry <= 90) {
          notifications.push({
            user_id: user.id,
            user_name: user.name,
            user_email: user.email,
            type: "vacation_vesting_1",
            title: "⏰ Suas Primeira Férias Vence em Breve!",
            message: `Você completou 12 meses de trabalho em ${format(firstVacationDate, "dd/MM/yyyy")}. Suas férias precisam ser agendadas e serão gozo em até 12 meses. Faltam ${daysUntilExpiry} dias para o vencimento!`,
            days_until: daysUntilExpiry
          });
        }

        // Notification: First vacation expired
        if (daysUntilExpiry <= 0) {
          notifications.push({
            user_id: user.id,
            user_name: user.name,
            user_email: user.email,
            type: "vacation_expired_1",
            title: "🚨 Suas Primeira Férias VENCERAM!",
            message: `${user.name}, suas primeiras férias (30 dias) venceram sem gozo! Você precisa agendar e gozar urgentemente para não perder o direito!`,
          });
        }
      }

      // ========== 2. SECOND VACATION NOTIFICATIONS ==========
      
      if (monthsWorked >= 24 && !secondVacationTaken) {
        // Check if first vacation was actually taken
        const actualFirstVacation = userScheduledVacations.find(
          (lv) => new Date(lv.start_date) >= firstVacationDate
        );

        if (actualFirstVacation) {
          const actualSecondDate = addYears(new Date(actualFirstVacation.start_date), 1);
          const hasSecondScheduled = userScheduledVacations.some(
            (lv) => new Date(lv.start_date) >= actualSecondDate
          );

          if (!hasSecondScheduled) {
            // Notification: 6 months before second vacation needs to be marked
            const daysUntilMark = differenceInDays(actualSecondDate, today);
            
            if (daysUntilMark > 0 && daysUntilMark <= 180) {
              notifications.push({
                user_id: user.id,
                user_name: user.name,
                user_email: user.email,
                type: "vacation_mark_2",
                title: "📅 Hora de Agendar sua Segunda Férias!",
                message: `${user.name}, sua segunda férias devem ser agendadas! Você tem até ${format(actualSecondDate, "dd/MM/yyyy")} para gozar. Faltam ${daysUntilMark} dias.`,
                leave_start: format(actualSecondDate, "yyyy-MM-dd"),
                days_until: daysUntilMark
              });
            }

            // Notification: URGENT - 3 months before second vacation
            if (daysUntilMark > 0 && daysUntilMark <= 90) {
              notifications.push({
                user_id: user.id,
                user_name: user.name,
                user_email: user.email,
                type: "vacation_mark_2_urgent",
                title: "🚨 URGENTE: Segunda Férias Prazo apertando!",
                message: `${user.name}, faltam apenas ${daysUntilMark} dias para agendar sua segunda férias! Procure RH urgentemente para não perder o direito.`,
                leave_start: format(actualSecondDate, "yyyy-MM-dd"),
                days_until: daysUntilMark
              });
            }

            // Notification: Second vacation expired
            if (daysUntilMark <= 0) {
              notifications.push({
                user_id: user.id,
                user_name: user.name,
                user_email: user.email,
                type: "vacation_expired_2",
                title: "🚨 Suas Segunda Férias VENCERAM!",
                message: `${user.name}, sua segunda férias venceram sem gozo! Você precisa agendar urgentemente para não perder o direito.`,
              });
            }
          }
        }
      }

      // ========== 3. UPCOMING VACATION (7 days before) ==========
      
      const upcomingVacations = userScheduledVacations.filter((lv) => {
        const startDate = new Date(lv.start_date);
        const daysUntil = differenceInDays(startDate, today);
        return daysUntil > 0 && daysUntil <= 7;
      });

      for (const vacation of upcomingVacations) {
        const daysUntil = differenceInDays(new Date(vacation.start_date), today);
        notifications.push({
          user_id: user.id,
          user_name: user.name,
          user_email: user.email,
          type: "upcoming_leave",
          title: "🏖️ Suas Férias estão Chegando!",
          message: `${user.name}, suas férias começam em ${daysUntil} dia${daysUntil > 1 ? "s" : ""}! Prepare-se para relaxar.`,
          leave_start: vacation.start_date,
          leave_end: vacation.end_date,
          days_until: daysUntil
        });
      }

      // ========== 4. VACATION ENDING (3 days before) ==========
      
      const endingVacations = userScheduledVacations.filter((lv) => {
        const endDate = new Date(lv.end_date);
        const daysUntilEnd = differenceInDays(endDate, today);
        return daysUntilEnd > 0 && daysUntilEnd <= 3;
      });

      for (const vacation of endingVacations) {
        const daysUntil = differenceInDays(new Date(vacation.end_date), today);
        notifications.push({
          user_id: user.id,
          user_name: user.name,
          user_email: user.email,
          type: "expiring_leave",
          title: "⏰ Suas Férias Estão Terminando!",
          message: `${user.name}, faltam ${daysUntil} dia${daysUntil > 1 ? "s" : ""} para suas férias terminarem. Prepare-se para voltar!`,
          leave_start: vacation.start_date,
          leave_end: vacation.end_date,
          days_until: daysUntil
        });
      }
    }

    // Remove duplicates and sort by urgency
    const uniqueNotifications = notifications.filter(
      (notif, index, self) =>
        index === self.findIndex((n) => n.user_id === notif.user_id && n.type === notif.type)
    );

    uniqueNotifications.sort((a, b) => (a.days_until || 999) - (b.days_until || 999));

    return NextResponse.json({
      success: true,
      notifications: uniqueNotifications,
      count: uniqueNotifications.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-notifications] Catch error:", errorMessage, error);
    return NextResponse.json(
      { success: false, error: "Erro interno: " + errorMessage },
      { status: 500 }
    );
  }
}
