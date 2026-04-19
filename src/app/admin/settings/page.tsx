"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, Settings, AlertTriangle, Info, Loader2, Shield } from "lucide-react";

import { Card, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Policy } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "",
    vacation_days_per_year: 30,
    carry_over_days: 5,
    max_consecutive_days: 30,
    min_days_notice: 7,
  });

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setTimeout(() => router.push("/login"), 1500);
        return;
      }

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      const adminProfile = currentProfile as any;
      if (!adminProfile || adminProfile.role !== "admin") {
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }

      setProfile(adminProfile);

      // Fetch active policy
      const { data: activePolicy } = await (supabase as any)
        .from("policies")
        .select("*")
        .eq("is_active", true)
        .single();

      if (activePolicy) {
        const p = activePolicy as Policy;
        setPolicy(p);
        setForm({
          name: p.name || "",
          vacation_days_per_year: p.vacation_days_per_year || 30,
          carry_over_days: p.carry_over_days || 5,
          max_consecutive_days: p.max_consecutive_days || 30,
          min_days_notice: p.min_days_notice || 7,
        });
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      if (!policy?.id) {
        // Create new policy
        const { data, error } = await (supabase as any)
          .from("policies")
          .insert({
            name: form.name.trim() || "Política Padrão",
            vacation_days_per_year: form.vacation_days_per_year,
            carry_over_days: form.carry_over_days,
            max_consecutive_days: form.max_consecutive_days,
            min_days_notice: form.min_days_notice,
            is_active: true,
          } as any)
          .select()
          .single();

        if (error) throw error;
        setPolicy((data as any) as Policy);
      } else {
        // Update existing policy
        const { error } = await (supabase as any)
          .from("policies")
          .update({
            name: form.name.trim() || "Política Padrão",
            vacation_days_per_year: form.vacation_days_per_year,
            carry_over_days: form.carry_over_days,
            max_consecutive_days: form.max_consecutive_days,
            min_days_notice: form.min_days_notice,
          } as any)
          .eq("id", policy.id);

        if (error) throw error;

        setPolicy((prev) =>
          prev
            ? {
                ...prev,
                name: form.name.trim() || "Política Padrão",
                vacation_days_per_year: form.vacation_days_per_year,
                carry_over_days: form.carry_over_days,
                max_consecutive_days: form.max_consecutive_days,
                min_days_notice: form.min_days_notice,
              }
            : prev
        );
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving policy:", err);
      setSaveError(err.message || "Erro ao salvar políticas.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--cream)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid var(--color-gold)",
              borderTop: "4px solid transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[var(--color-green-olive)]/10">
            <Settings className="h-6 w-6 text-[var(--color-green-olive)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Configurações de Política
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Defina as regras de férias e folgas para a empresa
            </p>
          </div>
        </div>

        {/* Info banner */}
        <Card className="p-4 mb-6 flex items-start gap-3 bg-blue-50 border-blue-200">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Políticas ativas são aplicadas automaticamente aos pedidos de folga.</p>
            <p className="mt-1">
              Funcionários serão avisados se o pedido não cumprir as regras configuradas abaixo.
            </p>
          </div>
        </Card>

        {/* Policy Form */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-[var(--color-gold)]" />
            <h2 className="text-lg font-semibold text-[var(--color-brown-dark)]">
              {policy?.id ? "Editar Política" : "Nova Política"}
            </h2>
          </div>

          {saveError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {saveError}
            </div>
          )}

          {saveSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm animate-slide-up">
              ✅ Políticas salvas com sucesso!
            </div>
          )}

          <div className="space-y-5">
            {/* Policy Name */}
            <Input
              label="Nome da Política"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Política Padrão CLT"
              helperText="Identificação interna para esta política"
            />

            <div className="border-t border-[var(--border)] pt-5">
              <h3 className="text-sm font-semibold text-[var(--color-brown-dark)] mb-4 uppercase tracking-wide">
                Regras de Férias
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Dias de férias por ano"
                  type="number"
                  value={form.vacation_days_per_year}
                  onChange={(e) =>
                    setForm({ ...form, vacation_days_per_year: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                  max={365}
                  helperText="Dias padrões concedidos anualmente (CLT: 30 dias)"
                />

                <Input
                  label="Carry-over máximo"
                  type="number"
                  value={form.carry_over_days}
                  onChange={(e) =>
                    setForm({ ...form, carry_over_days: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                  max={365}
                  helperText="Máximo de dias que podem ser transferidos para o ano seguinte"
                />
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-5">
              <h3 className="text-sm font-semibold text-[var(--color-brown-dark)] mb-4 uppercase tracking-wide">
                Regras de Solicitação
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Máximo de dias consecutivos"
                  type="number"
                  value={form.max_consecutive_days}
                  onChange={(e) =>
                    setForm({ ...form, max_consecutive_days: parseInt(e.target.value) || 0 })
                  }
                  min={1}
                  max={365}
                  helperText="Limite de dias de folga em uma única solicitação"
                />

                <Input
                  label="Antecedência mínima (dias)"
                  type="number"
                  value={form.min_days_notice}
                  onChange={(e) =>
                    setForm({ ...form, min_days_notice: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                  max={365}
                  helperText="Quantos dias antes o pedido deve ser solicitado"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="border-t border-[var(--border)] pt-5">
              <div className="p-4 rounded-xl bg-[var(--color-cream)] space-y-2 text-sm">
                <p className="font-semibold text-[var(--color-brown-dark)] mb-3">
                  📋 Resumo da Política
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <span className="text-[var(--color-brown-medium)]">Dias de férias/ano:</span>
                  <span className="font-medium text-[var(--color-brown-dark)]">{form.vacation_days_per_year} dias</span>
                  <span className="text-[var(--color-brown-medium)]">Carry-over máximo:</span>
                  <span className="font-medium text-[var(--color-brown-dark)]">{form.carry_over_days} dias</span>
                  <span className="text-[var(--color-brown-medium)]">Máximo consecutivo:</span>
                  <span className="font-medium text-[var(--color-brown-dark)]">{form.max_consecutive_days} dias</span>
                  <span className="text-[var(--color-brown-medium)]">Antecedência mínima:</span>
                  <span className="font-medium text-[var(--color-brown-dark)]">{form.min_days_notice} dias</span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => router.push("/admin")}
                className="flex-1"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Políticas
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
