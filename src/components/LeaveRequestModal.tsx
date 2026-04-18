"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { LEAVE_TYPE_LABELS } from "@/lib/types";
import type { LeaveType, Policy } from "@/lib/types";
import { format, differenceInDays, eachDayOfInterval, differenceInBusinessDays } from "date-fns";
import { Calendar as CalendarIcon, AlertTriangle, Info } from "lucide-react";
import { getHolidaysInRange, isHoliday } from "@/lib/holidays";

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isAdmin?: boolean;
}

export function LeaveRequestModal({
  isOpen,
  onClose,
  onSuccess,
  isAdmin = false,
}: LeaveRequestModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [policyWarnings, setPolicyWarnings] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    type: "vacation" as LeaveType,
    start_date: "",
    end_date: "",
    notes: "",
  });

  // Get user and fetch active policy on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };

    const getPolicy = async () => {
      const { data: activePolicy } = await supabase
        .from("policies")
        .select("*")
        .eq("is_active", true)
        .single();
      if (activePolicy) {
        setPolicy(activePolicy as Policy);
      }
    };

    getUser();
    if (isOpen) getPolicy();
  }, [supabase.auth, supabase, isOpen]);

  const daysCount =
    formData.start_date && formData.end_date
      ? differenceInDays(new Date(formData.end_date), new Date(formData.start_date)) + 1
      : 0;

  // Policy validation warnings
  useEffect(() => {
    if (!policy || !formData.start_date) {
      setPolicyWarnings([]);
      return;
    }

    const warnings: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(formData.start_date);
    startDate.setHours(0, 0, 0, 0);

    // Check minimum notice (business days)
    const noticeDays = differenceInBusinessDays(startDate, today);
    if (policy.min_days_notice > 0 && noticeDays < policy.min_days_notice) {
      warnings.push(
        `⚠️ A política exige mínimo ${policy.min_days_notice} dia${policy.min_days_notice > 1 ? "s" : ""} de antecedência. Você está solicitando com apenas ${noticeDays} dia${noticeDays !== 1 ? "s" : ""} de aviso.`
      );
    }

    // Check max consecutive days
    if (policy.max_consecutive_days > 0 && daysCount > policy.max_consecutive_days) {
      warnings.push(
        `⚠️ A política limita a ${policy.max_consecutive_days} dia${policy.max_consecutive_days !== 1 ? "s" : ""} consecutivos por pedido. Você está solicitando ${daysCount} dias.`
      );
    }

    setPolicyWarnings(warnings);
  }, [policy, formData.start_date, daysCount]);

  // Check for holidays in the selected date range
  const holidaysInRange =
    formData.start_date && formData.end_date && daysCount > 0
      ? getHolidaysInRange(formData.start_date, formData.end_date)
      : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!userId) {
      setError("Sessão não encontrada. Faça login novamente.");
      setLoading(false);
      return;
    }

    if (daysCount <= 0) {
      setError("Selecione um período válido.");
      setLoading(false);
      return;
    }

    try {
      // Check balance for vacation
      if (formData.type === "vacation") {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("vacation_balance")
          .eq("id", userId)
          .single();

        if (profileError) {
          setError("Erro ao verificar saldo: " + profileError.message);
          setLoading(false);
          return;
        }

        if (profile && (profile as any).vacation_balance < daysCount) {
          setError(`Saldo insuficiente. Você tem ${(profile as any).vacation_balance} dias.`);
          setLoading(false);
          return;
        }

        // Admin: debit balance immediately (no approval needed)
        if (isAdmin) {
          const { error: rpcError } = await (supabase as any).rpc("deduct_vacation_balance", {
            p_user_id: userId,
            p_days: daysCount,
            p_expected_balance: (profile as any).vacation_balance,
          });

          if (rpcError) {
            setError("Falha ao debitar saldo: " + rpcError.message);
            setLoading(false);
            return;
          }
        }
      }

      // Check hours balance for hours type leave
      if (formData.type === "hours") {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("hours_balance")
          .eq("id", userId)
          .single();

        if (profileError) {
          setError("Erro ao verificar banco de horas: " + profileError.message);
          setLoading(false);
          return;
        }

        const availableMinutes = (profile as any)?.hours_balance || 0;
        if (availableMinutes < daysCount * 8 * 60) {
          setError(`Banco de horas insuficiente. Você tem ${Math.floor(availableMinutes / 60)}h${availableMinutes % 60 > 0 ? ` ${availableMinutes % 60}m` : ""} disponível.`);
          setLoading(false);
          return;
        }

        // Admin: debit hours balance immediately
        if (isAdmin) {
          const { error: rpcError } = await (supabase as any).rpc("deduct_hours_balance", {
            p_user_id: userId,
            p_minutes: daysCount * 8 * 60,
            p_expected_balance: availableMinutes,
          });

          if (rpcError) {
            setError("Falha ao debitar banco de horas: " + rpcError.message);
            setLoading(false);
            return;
          }
        }
      }

      // Prepare the insert data - Admin gets approved automatically
      const insertData = {
        user_id: userId,
        type: formData.type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days_count: daysCount,
        notes: formData.notes || null,
        status: isAdmin ? "approved" : "pending",
        reviewed_by: isAdmin ? userId : null,
        reviewed_at: isAdmin ? new Date().toISOString() : null,
      };

      // Insert leave request
      const { data, error: insertError } = await supabase
        .from("leave_requests")
        .insert(insertData as any)
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        setError("Erro ao criar pedido: " + insertError.message);
      } else {
        console.log("Leave request created:", data);
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setFormData({ type: "vacation", start_date: "", end_date: "", notes: "" });
          onSuccess?.();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Catch error:", err);
      setError(err.message || "Erro ao enviar pedido.");
    } finally {
      setLoading(false);
    }
  };

  const leaveTypeOptions = Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Folga" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm animate-slide-up">
            ✨ Pedido enviado com sucesso!
          </div>
        )}

        <Select
          label="Tipo de Afastamento"
          options={leaveTypeOptions}
          value={formData.type}
          onChange={(e) =>
            setFormData({ ...formData, type: e.target.value as LeaveType })
          }
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data Início"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            min={format(new Date(), "yyyy-MM-dd")}
            required
          />

          <Input
            label="Data Fim"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            min={formData.start_date || format(new Date(), "yyyy-MM-dd")}
            required
          />
        </div>

        {daysCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-cream)] text-[var(--color-brown-dark)]">
            <CalendarIcon className="h-5 w-5 text-[var(--color-gold)]" />
            <span className="text-sm">
              Período: <strong>{daysCount} dia{daysCount > 1 ? "s" : ""}</strong>
            </span>
          </div>
        )}

        {holidaysInRange.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium mb-1">⚠️ Atenção: {holidaysInRange.length} feriado(s) no período!</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-700">
                {holidaysInRange.map((h) => (
                  <li key={h.date}>
                    {format(new Date(h.date + "T12:00:00"), "dd/MM", { locale: require("date-fns/locale/pt-BR") })} — {h.name}
                    {h.type === "optional" && " (facultativo)"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {policyWarnings.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-medium mb-1">⚠️ Aviso: Pedido fora da política</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                {policyWarnings.map((w, i) => (
                  <li key={i}>{w.replace(/^[⚠️ ]+/, "")}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
            Observações (opcional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)] placeholder:text-[var(--color-brown-medium)]/60 transition-folia focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent resize-none"
            placeholder="Informações adicionais..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            loading={loading}
            disabled={!formData.start_date || !formData.end_date || daysCount <= 0}
          >
            {policyWarnings.length > 0 ? "Enviar com Aviso" : "Enviar Pedido"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}