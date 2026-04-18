"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select, Card } from "@/components/ui";
import type { HourEntry } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Plus, RefreshCw } from "lucide-react";

interface HoursBankSectionProps {
  userId: string;
  initialEntries?: HourEntry[];
  onBalanceChange?: () => void;
}

export function HoursBankSection({ userId, initialEntries = [], onBalanceChange }: HoursBankSectionProps) {
  const supabase = createClient();
  const [entries, setEntries] = useState<HourEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    hours: "",
    type: "extra" as "extra" | "compensated",
    notes: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    if (!formData.date || !formData.hours) {
      setMessage({ type: "error", text: "Preencha data e horas." });
      setLoading(false);
      return;
    }

    try {
      // Insert hour entry
      const { error: insertError } = await (supabase as any)
        .from("hour_entries")
        .insert({
          user_id: userId,
          date: formData.date,
          hours: parseInt(formData.hours),
          type: formData.type,
          notes: formData.notes || null,
        });

      if (insertError) {
        setMessage({ type: "error", text: "Erro ao registrar: " + insertError.message });
        setLoading(false);
        return;
      }

      // Update hours_balance via RPC
      const { error: rpcError } = await (supabase as any).rpc("add_hours_balance", {
        p_user_id: userId,
        p_minutes: parseInt(formData.hours) * 60,
      });

      if (rpcError) {
        setMessage({ type: "error", text: "Erro ao atualizar saldo: " + rpcError.message });
        setLoading(false);
        return;
      }

      setMessage({ type: "success", text: "Hora registrada com sucesso!" });
      setFormData({ date: "", hours: "", type: "extra", notes: "" });
      setShowForm(false);
      onBalanceChange?.();

      // Refresh entries
      const { data: newEntries } = await supabase
        .from("hour_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setEntries(newEntries || []);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao registrar hora." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] flex items-center gap-2">
            <Clock className="h-5 w-5 text-[var(--color-gold)]" />
            Banco de Horas
          </h2>
          <p className="text-sm text-[var(--color-brown-medium)] mt-1">
            Registre horas extras trabalhadas
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "secondary" : "primary"}
        >
          {showForm ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Cancelar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Registrar Hora
            </>
          )}
        </Button>
      </div>

      {/* Registration Form */}
      {showForm && (
        <Card className="animate-fade-in-up">
          <form onSubmit={handleRegister} className="space-y-4">
            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
              <Input
                label="Horas"
                type="number"
                min="1"
                max="12"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                placeholder="Ex: 2"
                required
              />
            </div>

            <Select
              label="Tipo"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as "extra" | "compensated" })}
              options={[
                { value: "extra", label: "Hora Extra" },
                { value: "compensated", label: "Hora Compensada" },
              ]}
            />

            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                Observações (opcional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)] placeholder:text-[var(--color-brown-medium)]/60 transition-folia focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent resize-none"
                placeholder="Ex: Trabalho no fim de semana..."
              />
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Registrar
            </Button>
          </form>
        </Card>
      )}

      {/* History Table */}
      <Card>
        <h3 className="font-medium text-[var(--color-brown-dark)] mb-4">Histórico de Entradas</h3>
        {!entries || entries.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-brown-medium)]">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum registro de hora ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 text-[var(--color-brown-medium)] font-medium">Data</th>
                  <th className="text-left py-2 text-[var(--color-brown-medium)] font-medium">Tipo</th>
                  <th className="text-left py-2 text-[var(--color-brown-medium)] font-medium">Horas</th>
                  <th className="text-left py-2 text-[var(--color-brown-medium)] font-medium">Observações</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 10).map((entry) => {
                  let dateStr = "--/--/----";
                  try {
                    dateStr = format(new Date(entry.date), "dd/MM/yyyy", { locale: ptBR });
                  } catch {}
                  return (
                    <tr key={entry.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--color-cream)]">
                      <td className="py-2.5 text-[var(--color-brown-dark)]">{dateStr}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 ${
                          entry.type === "extra"
                            ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                            : "bg-[var(--color-green-olive)]/10 text-[var(--color-green-olive)]"
                        }`}>
                          {entry.type === "extra" ? "Hora Extra" : "Compensada"}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-[var(--color-brown-dark)]">{entry.hours}h</td>
                      <td className="py-2.5 text-[var(--color-brown-medium)]">
                        {entry.notes || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}