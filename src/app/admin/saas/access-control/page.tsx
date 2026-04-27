"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Input } from "@/components/ui";
import {
  Building2, Check, X, AlertCircle, Save, ChevronDown, Shield, Users,
  HardDrive, Calendar, Package, ToggleLeft, ToggleRight
} from "lucide-react";
import { clsx } from "clsx";
import { isMasterAdmin } from "@/lib/auth";
import { format } from "date-fns";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

interface TenantFeature {
  id: string;
  tenant_id: string;
  feature: string;
  enabled: boolean;
  max_value: number | null;
  expires_at: string | null;
}

const PLANS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basic" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

const FEATURES = [
  { key: "vacation_management", label: "Gestão de Férias", icon: "🏖️" },
  { key: "time_tracking", label: "Controle de Ponto", icon: "⏰" },
  { key: "hours_bank", label: "Banco de Horas", icon: "⏱️" },
  { key: "reports_csv", label: "Relatórios CSV/Excel", icon: "📊" },
  { key: "webhooks", label: "Webhooks Slack/Teams", icon: "🔗" },
  { key: "national_holidays", label: "Feriados Nacionais", icon: "🇧🇷" },
  { key: "bulk_actions", label: "Bulk Actions (aprovar múltiplos)", icon: "📋" },
  { key: "configurable_policies", label: "Políticas Configuráveis", icon: "⚙️" },
  { key: "push_notifications", label: "Notificações Push", icon: "🔔" },
  { key: "mobile_app", label: "App Mobile", icon: "📱" },
];

export default function AccessControlPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [features, setFeatures] = useState<TenantFeature[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);

  // Limits form
  const [maxUsers, setMaxUsers] = useState<number>(10);
  const [maxOrdersMonth, setMaxOrdersMonth] = useState<number>(100);
  const [storageGb, setStorageGb] = useState<number>(5);
  const [planExpiration, setPlanExpiration] = useState<string>("");
  const [currentPlan, setCurrentPlan] = useState<string>("basic");

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single() as { data: any };

    if (!profileData || !isMasterAdmin(profileData.role)) {
      router.push("/dashboard");
      return;
    }

    setProfile(profileData);
    await loadTenants();
    setLoading(false);
  };

  const loadTenants = async () => {
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .order("name") as { data: Tenant[] | null };
    setTenants(data || []);
    if (data && data.length > 0) {
      setSelectedTenantId(data[0].id);
    }
  };

  useEffect(() => {
    if (selectedTenantId) {
      loadTenantData(selectedTenantId);
    }
  }, [selectedTenantId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tenant-dropdown')) {
        setTenantDropdownOpen(false);
      }
      if (!target.closest('.plan-dropdown')) {
        setPlanDropdownOpen(false);
      }
    };
    if (tenantDropdownOpen || planDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [tenantDropdownOpen, planDropdownOpen]);

  const loadTenantData = async (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    setSelectedTenant(tenant || null);

    // Load settings
    if (tenant?.settings) {
      setMaxUsers(tenant.settings.max_users || 10);
      setMaxOrdersMonth(tenant.settings.max_orders_month || 100);
      setStorageGb(tenant.settings.storage_gb || 5);
      setPlanExpiration(tenant.settings.plan_expiration || "");
      setCurrentPlan(tenant.settings.plan || "basic");
    }

    // Load features
    const { data: featData } = await supabase
      .from("tenant_features")
      .select("*")
      .eq("tenant_id", tenantId) as { data: TenantFeature[] | null };

    const featList = featData || [];
    setFeatures(featList);

    // Ensure all features exist
    const existingKeys = new Set(featList.map(f => f.feature));
    for (const f of FEATURES) {
      if (!existingKeys.has(f.key)) {
        featList.push({
          id: `new-${f.key}`,
          tenant_id: tenantId,
          feature: f.key,
          enabled: true,
          max_value: null,
          expires_at: null,
        });
      }
    }
    setFeatures([...featList]);
  };

  const toggleFeature = (featureKey: string) => {
    setFeatures(prev =>
      prev.map(f =>
        f.feature === featureKey ? { ...f, enabled: !f.enabled } : f
      )
    );
  };

  const handleSave = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Update tenant settings
      const { error: tenantError } = await (supabase as any)
        .from("tenants")
        .update({
          settings: {
            ...selectedTenant?.settings,
            max_users: maxUsers,
            max_orders_month: maxOrdersMonth,
            storage_gb: storageGb,
            plan_expiration: planExpiration || null,
            plan: currentPlan,
          },
        })
        .eq("id", selectedTenantId);

      if (tenantError) throw tenantError;

      // Upsert features
      for (const feat of features) {
        const { error: featError } = await (supabase as any)
          .from("tenant_features")
          .upsert({
            tenant_id: selectedTenantId,
            feature: feat.feature,
            enabled: feat.enabled,
            max_value: feat.max_value,
            expires_at: feat.expires_at || null,
          }, {
            onConflict: "tenant_id,feature",
          });

        if (featError) console.error(`Error saving feature ${feat.feature}:`, featError);
      }

      // Log the action
      await (supabase as any)
        .from("user_access_log")
        .insert({
          user_id: profile?.id,
          action: "tenant_features_updated",
          details: {
            tenant_id: selectedTenantId,
            tenant_name: selectedTenant?.name,
            changed_by: profile?.name,
          },
        });

      setSuccess("Configurações salvas com sucesso!");
    } catch (e: any) {
      setError(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-brown-medium)]">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
            🎛️ Controle de Acesso por Empresa
          </h1>
          <p className="text-[var(--color-brown-medium)] mt-1">
            Gerencie planos, funcionalidades e limites de cada empresa
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0" />
            {success}
            <button onClick={() => setSuccess(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Tenant Selector */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                Selecionar Empresa
              </label>
              <div className="relative tenant-dropdown">
                <button
                  onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white hover:border-[#5C724A] transition-colors text-left"
                >
                  <Building2 className="h-4 w-4 text-[#5C724A]" />
                  <span className="flex-1 text-sm text-[var(--color-brown-dark)]">
                    {selectedTenant?.name || "Selecione uma empresa"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${tenantDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {tenantDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 max-h-60 overflow-y-auto">
                    {tenants.map((tenant) => (
                      <button
                        key={tenant.id}
                        onClick={() => { setSelectedTenantId(tenant.id); setTenantDropdownOpen(false); }}
                        className={clsx(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                          tenant.id === selectedTenantId && "bg-[#5C724A]/5 text-[#5C724A]"
                        )}
                      >
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1 truncate">{tenant.name}</span>
                        {tenant.id === selectedTenantId && <Check className="h-4 w-4 text-[#5C724A]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {selectedTenant && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-cream)]">
                <Shield className="h-4 w-4 text-[var(--color-gold)]" />
                <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2 py-0.5 ${
                  selectedTenant.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                }`}>
                  {selectedTenant.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            )}
          </div>
        </Card>

        {selectedTenant && (
          <div className="space-y-6">
            {/* Plan & Validity */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-[var(--color-gold)]" />
                Plano e Validade
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                    Plano
                  </label>
                  <div className="relative plan-dropdown">
                    <button
                      onClick={() => setPlanDropdownOpen(!planDropdownOpen)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white hover:border-[#5C724A] transition-colors text-left"
                    >
                      <Package className="h-4 w-4 text-[#5C724A]" />
                      <span className="flex-1 text-sm text-[var(--color-brown-dark)]">
                        {PLANS.find(p => p.value === currentPlan)?.label || "Selecione"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${planDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {planDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                        {PLANS.map((plan) => (
                          <button
                            key={plan.value}
                            onClick={() => { setCurrentPlan(plan.value); setPlanDropdownOpen(false); }}
                            className={clsx(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                              plan.value === currentPlan && "bg-[#5C724A]/5 text-[#5C724A]"
                            )}
                          >
                            <Package className="h-4 w-4 flex-shrink-0" />
                            <span className="flex-1">{plan.label}</span>
                            {plan.value === currentPlan && <Check className="h-4 w-4 text-[#5C724A]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                    Validade do Plano
                  </label>
                  <input
                    type="date"
                    value={planExpiration}
                    onChange={(e) => setPlanExpiration(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] text-[var(--color-brown-dark)]"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-sm text-[var(--color-brown-medium)]">
                    {currentPlan.toUpperCase()} • {planExpiration ? `Expira em ${format(new Date(planExpiration), "dd/MM/yyyy")}` : "Sem expiração"}
                  </p>
                </div>
              </div>
            </Card>

            {/* Features */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
                <ToggleLeft className="h-5 w-5 text-[var(--color-gold)]" />
                Funcionalidades e Módulos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FEATURES.map(f => {
                  const feat = features.find(x => x.feature === f.key);
                  const enabled = feat?.enabled ?? true;
                  return (
                    <div key={f.key} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-cream)] hover:bg-[var(--color-cream)]/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{f.icon}</span>
                        <span className="text-sm font-medium text-[var(--color-brown-dark)]">{f.label}</span>
                      </div>
                      <button
                        onClick={() => toggleFeature(f.key)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          enabled
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {enabled ? (
                          <><ToggleRight className="h-4 w-4" /> Ativo</>
                        ) : (
                          <><ToggleLeft className="h-4 w-4" /> Inativo</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Limits */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-[var(--color-gold)]" />
                Limites
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                    <Users className="h-4 w-4 inline mr-1" />
                    Máximo de Usuários
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Máx. Pedidos/Mês
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={maxOrdersMonth}
                    onChange={(e) => setMaxOrdersMonth(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                    <HardDrive className="h-4 w-4 inline mr-1" />
                    Storage (GB)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={storageGb}
                    onChange={(e) => setStorageGb(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => router.push("/admin/saas")}>
                Cancelar
              </Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
