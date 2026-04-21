"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Modal, Input, Select } from "@/components/ui";
import { 
  Building2, Users, Plus, Edit2, Power, PowerOff, Webhook, Trash2, Check, X, AlertCircle,
  TrendingUp, TrendingDown, Activity, Clock, DollarSign, UserPlus, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Globe, Settings, BarChart3, Calendar
} from "lucide-react";
import { isMasterAdmin } from "@/lib/auth";

interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  slug: string;
  logo_url: string | null;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TenantStats {
  employee_count: number;
  pending_requests: number;
  approved_requests: number;
  total_requests: number;
}

interface WebhookConfig {
  id: string;
  tenant_id: string;
  name: string;
  channel: "slack" | "teams";
  webhook_url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface SystemStats {
  total_tenants: number;
  active_tenants: number;
  total_employees: number;
  total_requests: number;
  pending_requests: number;
}

const AVAILABLE_EVENTS = [
  { value: "leave_request_created", label: "Novo pedido criado" },
  { value: "leave_request_approved", label: "Pedido aprovado" },
  { value: "leave_request_rejected", label: "Pedido rejeitado" },
  { value: "leave_request_cancelled", label: "Pedido cancelado" },
];

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export default function SaasAdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantStats, setTenantStats] = useState<Record<string, TenantStats>>({});
  const [systemStats, setSystemStats] = useState<SystemStats>({
    total_tenants: 0, active_tenants: 0, total_employees: 0, total_requests: 0, pending_requests: 0
  });
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "webhooks">("overview");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showEditTenant, setShowEditTenant] = useState(false);
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  
  // Form state
  const [newTenant, setNewTenant] = useState({ name: "", domain: "", slug: "", logo_url: "" });
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [newWebhook, setNewWebhook] = useState({ name: "", channel: "slack" as "slack" | "teams", webhook_url: "", events: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

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
    await loadData();
    setLoading(false);
  };

  const loadData = async () => {
    await loadTenants();
    await loadSystemStats();
  };

  const loadSystemStats = async () => {
    // Get all tenants
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select("*") as { data: Tenant[] | null };

    const allTenants = tenantsData || [];
    const activeCount = allTenants.filter(t => t.is_active).length;

    // Get all employees
    const { count: employeeCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Get request stats
    const { count: totalRequests } = await supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true });

    const { count: pendingRequests } = await supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    setSystemStats({
      total_tenants: allTenants.length,
      active_tenants: activeCount,
      total_employees: employeeCount || 0,
      total_requests: totalRequests || 0,
      pending_requests: pendingRequests || 0,
    });
  };

  const loadTenants = async () => {
    try {
      const response = await fetch("/api/admin/tenants");
      const result = await response.json();

      if (!response.ok) {
        setError("Erro ao carregar empresas");
        return;
      }

      const tenantList = result.data || [];
      setTenants(tenantList);
      
      // Load stats for each tenant
      const stats: Record<string, TenantStats> = {};
      for (const tenant of tenantList) {
        const { data: statData } = await (supabase as any)
          .rpc("get_tenant_stats", { p_tenant_id: tenant.id });
        stats[tenant.id] = statData || { employee_count: 0, pending_requests: 0, approved_requests: 0, total_requests: 0 };
      }
      setTenantStats(stats);
    } catch {
      setError("Erro ao carregar empresas");
    }
  };

  const handleCreateTenant = async () => {
    console.log("[DEBUG] handleCreateTenant chamado", { name: newTenant.name, slug: newTenant.slug });
    if (!newTenant.name || !newTenant.slug) {
      setError("Nome e slug são obrigatórios");
      return;
    }

    setSaving(true);
    setError(null);

    const slug = newTenant.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    
    try {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTenant.name,
          domain: newTenant.domain || null,
          slug,
          logo_url: newTenant.logo_url || null,
          settings: { timezone: "America/Sao_Paulo", locale: "pt-BR", plan: "basic" },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(`Erro ao criar empresa: ${result.error}`);
        setSaving(false);
        return;
      }

      setSuccess("Empresa criada com sucesso!");
      setShowCreateTenant(false);
      setNewTenant({ name: "", domain: "", slug: "", logo_url: "" });
      await loadData();
    } catch (err) {
      setError("Erro ao criar empresa. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTenant = async (tenant: Tenant) => {
    try {
      const response = await fetch("/api/admin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tenant.id,
          name: tenant.name,
          domain: tenant.domain,
          logo_url: tenant.logo_url,
          settings: tenant.settings,
          is_active: !tenant.is_active,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(`Erro ao atualizar empresa: ${result.error}`);
        return;
      }

      await loadData();
      setSuccess(tenant.is_active ? "Empresa desativada" : "Empresa ativada");
    } catch {
      setError("Erro ao atualizar empresa");
    }
  };

  const handleEditTenant = async () => {
    if (!editTenant) return;
    setSaving(true);

    try {
      const response = await fetch("/api/admin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTenant.id,
          name: editTenant.name,
          domain: editTenant.domain || null,
          logo_url: editTenant.logo_url || null,
          settings: editTenant.settings,
          is_active: editTenant.is_active,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(`Erro ao editar empresa: ${result.error}`);
        setSaving(false);
        return;
      }

      setShowEditTenant(false);
      setEditTenant(null);
      await loadData();
      setSuccess("Empresa atualizada!");
    } catch {
      setError("Erro ao editar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (tenant.id === DEFAULT_TENANT_ID) {
      setError("Não é possível excluir o tenant padrão");
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir "${tenant.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tenants?id=${tenant.id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (!response.ok) {
        setError(`Erro ao excluir empresa: ${result.error}`);
        return;
      }

      await loadData();
      setSuccess("Empresa excluída");
    } catch {
      setError("Erro ao excluir empresa");
    }
  };

  const openWebhooks = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    const { data } = await (supabase as any)
      .from("webhook_configs")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: true });
    
    setWebhooks(data || []);
    setShowWebhooks(true);
    setActiveTab("webhooks");
  };

  const handleCreateWebhook = async () => {
    if (!newWebhook.name || !newWebhook.webhook_url || newWebhook.events.length === 0) {
      setError("Nome, URL do webhook e eventos são obrigatórios");
      return;
    }

    if (!selectedTenant) return;

    setSaving(true);
    
    const { data, error } = await (supabase as any)
      .from("webhook_configs")
      .insert({
        tenant_id: selectedTenant.id,
        name: newWebhook.name,
        channel: newWebhook.channel,
        webhook_url: newWebhook.webhook_url,
        events: newWebhook.events,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      setError(`Erro ao criar webhook: ${error.message}`);
      setSaving(false);
      return;
    }

    setSuccess("Webhook criado!");
    setShowCreateWebhook(false);
    setNewWebhook({ name: "", channel: "slack", webhook_url: "", events: [] });
    const { data: updated } = await (supabase as any)
      .from("webhook_configs")
      .select("*")
      .eq("tenant_id", selectedTenant.id)
      .order("created_at", { ascending: true });
    setWebhooks(updated || []);
    setSaving(false);
  };

  const handleToggleWebhook = async (webhook: WebhookConfig) => {
    const { error } = await (supabase as any)
      .from("webhook_configs")
      .update({ is_active: !webhook.is_active })
      .eq("id", webhook.id);

    if (error) {
      setError(`Erro ao atualizar webhook: ${error.message}`);
      return;
    }

    setWebhooks(webhooks.map(w => w.id === webhook.id ? { ...w, is_active: !w.is_active } : w));
    setSuccess(webhook.is_active ? "Webhook desativado" : "Webhook ativado");
  };

  const handleDeleteWebhook = async (webhook: WebhookConfig) => {
    if (!confirm(`Excluir webhook "${webhook.name}"?`)) return;

    const { error } = await (supabase as any).from("webhook_configs").delete().eq("id", webhook.id);
    
    if (error) {
      setError(`Erro ao excluir webhook: ${error.message}`);
      return;
    }

    setWebhooks(webhooks.filter(w => w.id !== webhook.id));
    setSuccess("Webhook excluído");
  };

  const handleTestWebhook = async (webhook: WebhookConfig) => {
    try {
      const response = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhook.webhook_url,
          channel: webhook.channel,
          test_event: "leave_request_created",
          test_payload: {
            user_name: "Teste Usuário",
            start_date: "2026-04-20",
            end_date: "2026-04-22",
            days_count: 3,
            approver_name: "Admin",
            rejection_reason: null,
          },
        }),
      });

      if (response.ok) {
        setSuccess("Teste enviado com sucesso!");
      } else {
        const data = await response.json();
        setError(`Falha no teste: ${data.error || "Verifique a URL do webhook"}`);
      }
    } catch {
      setError("Erro ao enviar teste");
    }
  };

  const toggleEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const filteredTenants = useMemo(() => {
    if (!searchTerm) return tenants;
    const term = searchTerm.toLowerCase();
    return tenants.filter(t => 
      t.name.toLowerCase().includes(term) ||
      t.slug.toLowerCase().includes(term) ||
      (t.domain?.toLowerCase().includes(term) ?? false)
    );
  }, [tenants, searchTerm]);

  const inactiveTenants = systemStats.total_tenants - systemStats.active_tenants;
  const activeRate = systemStats.total_tenants > 0 
    ? Math.round((systemStats.active_tenants / systemStats.total_tenants) * 100) 
    : 0;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cream)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            width: "48px", 
            height: "48px", 
            border: "4px solid var(--color-gold)", 
            borderTop: "4px solid transparent", 
            borderRadius: "50%", 
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px"
          }} />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
                🏢 Cockpit SaaS
              </h1>
              <p className="text-[var(--color-brown-medium)] mt-1">
                Gerenciamento completo de empresas e assinantes
              </p>
            </div>
            <Button variant="primary" onClick={() => setShowCreateTenant(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </div>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-purple-100">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <span className={`inline-flex items-center text-xs font-medium ${activeRate >= 80 ? 'text-green-600' : activeRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {activeRate}% ativo
              </span>
            </div>
            <p className="text-3xl font-bold text-[var(--color-brown-dark)] mt-3">
              {systemStats.total_tenants}
            </p>
            <p className="text-sm text-[var(--color-brown-medium)]">Empresas Cadastradas</p>
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span className="text-green-600 font-medium">{systemStats.active_tenants}</span>
              <span className="text-[var(--color-brown-light)]">ativas</span>
              {inactiveTenants > 0 && (
                <>
                  <span className="text-[var(--color-brown-light)]">,</span>
                  <span className="text-red-600 font-medium">{inactiveTenants}</span>
                  <span className="text-[var(--color-brown-light)]">inativas</span>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <span className="inline-flex items-center text-green-600 text-xs font-medium">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12%
              </span>
            </div>
            <p className="text-3xl font-bold text-[var(--color-brown-dark)] mt-3">
              {systemStats.total_employees}
            </p>
            <p className="text-sm text-[var(--color-brown-medium)]">Total de Funcionários</p>
            <p className="text-xs text-[var(--color-brown-light)] mt-1">
              Média {systemStats.total_tenants > 0 ? Math.round(systemStats.total_employees / systemStats.total_tenants) : 0} por empresa
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              {systemStats.pending_requests > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {systemStats.pending_requests > 9 ? "9+" : systemStats.pending_requests}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-[var(--color-brown-dark)] mt-3">
              {systemStats.total_requests}
            </p>
            <p className="text-sm text-[var(--color-brown-medium)]">Pedidos de Férias</p>
            <p className="text-xs text-[var(--color-brown-light)] mt-1">
              {systemStats.pending_requests} pendentes de aprovação
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-green-100">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              <span className="inline-flex items-center text-green-600 text-xs font-medium">
                Online
              </span>
            </div>
            <p className="text-3xl font-bold text-[var(--color-brown-dark)] mt-3">
              100%
            </p>
            <p className="text-sm text-[var(--color-brown-medium)]">Uptime do Sistema</p>
            <p className="text-xs text-[var(--color-brown-light)] mt-1">
              Última verificação: agora
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)] pb-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "bg-[var(--color-gold)] text-white"
                : "text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)]"
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab("tenants")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "tenants"
                ? "bg-[var(--color-gold)] text-white"
                : "text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)]"
            }`}
          >
            <Building2 className="h-4 w-4 inline mr-2" />
            Empresas ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "webhooks"
                ? "bg-[var(--color-gold)] text-white"
                : "text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)]"
            }`}
          >
            <Webhook className="h-4 w-4 inline mr-2" />
            Webhooks
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tenants Table */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-brown-dark)]">
                  Empresas Recentes
                </h2>
                <button 
                  onClick={() => setActiveTab("tenants")}
                  className="text-sm text-[var(--color-gold)] hover:underline"
                >
                  Ver todas →
                </button>
              </div>
              <div className="space-y-3">
                {tenants.slice(0, 5).map((tenant) => {
                  const stats = tenantStats[tenant.id] || { employee_count: 0, pending_requests: 0, approved_requests: 0, total_requests: 0 };
                  return (
                    <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-cream)] hover:bg-[var(--color-cream)]/80 transition-colors">
                      <div className="flex items-center gap-3">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt={tenant.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="p-2 rounded-lg bg-white">
                            <Building2 className="h-4 w-4 text-[var(--color-gold)]" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[var(--color-brown-dark)]">{tenant.name}</p>
                          <p className="text-xs text-[var(--color-brown-medium)]">/{tenant.slug}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[var(--color-brown-dark)]">{stats.employee_count}</p>
                        <p className="text-xs text-[var(--color-brown-medium)]">funcionários</p>
                      </div>
                    </div>
                  );
                })}
                {tenants.length === 0 && (
                  <p className="text-center text-[var(--color-brown-medium)] py-4">
                    Nenhuma empresa cadastrada
                  </p>
                )}
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4">
                Estatísticas do Sistema
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-brown-dark)]">Taxa de Aprovação</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {systemStats.total_requests > 0 
                      ? Math.round(((systemStats.total_requests - systemStats.pending_requests) / systemStats.total_requests) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <UserPlus className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-brown-dark)]">Média Employees/Empresa</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">
                    {systemStats.total_tenants > 0 
                      ? (systemStats.total_employees / systemStats.total_tenants).toFixed(1)
                      : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Globe className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-brown-dark)]">Empresas com Domínio</span>
                  </div>
                  <span className="text-lg font-bold text-purple-600">
                    {tenants.filter(t => t.domain).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-brown-dark)]">Sistema Ativo Desde</span>
                  </div>
                  <span className="text-lg font-bold text-amber-600">
                    {new Date("2026-04-15").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === "tenants" && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Buscar empresas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-4 pr-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
                />
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-[var(--color-brown-medium)] py-2">
                  {filteredTenants.length} empresas
                </span>
              </div>
            </div>

            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--color-cream)] rounded-t-lg text-xs font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide">
              <div className="col-span-4">Empresa</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-center">Funcionários</div>
              <div className="col-span-2 text-center">Pedidos</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[var(--border)]">
              {filteredTenants.map((tenant) => {
                const stats = tenantStats[tenant.id] || { employee_count: 0, pending_requests: 0, approved_requests: 0, total_requests: 0 };
                const isDefault = tenant.id === DEFAULT_TENANT_ID;

                return (
                  <div key={tenant.id} className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-[var(--color-cream)]/50 transition-colors">
                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt={tenant.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="p-2 rounded-lg bg-[var(--color-gold)]/10">
                            <Building2 className="h-5 w-5 text-[var(--color-gold)]" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[var(--color-brown-dark)]">{tenant.name}</p>
                          <p className="text-xs text-[var(--color-brown-medium)]">
                            /{tenant.slug}
                            {tenant.domain && ` • ${tenant.domain}`}
                          </p>
                          <p className="text-xs text-[var(--color-brown-light)] mt-1">
                            Criado em {new Date(tenant.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <span className={`inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 ${
                        tenant.is_active 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {tenant.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-lg font-bold text-[var(--color-brown-dark)]">{stats.employee_count}</span>
                      {stats.pending_requests > 0 && (
                        <span className="ml-2 text-xs text-amber-600">({stats.pending_requests} pend.)</span>
                      )}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-lg font-bold text-[var(--color-brown-dark)]">{stats.total_requests}</span>
                      <p className="text-xs text-green-600">{stats.approved_requests} aprov.</p>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        onClick={() => { setEditTenant(tenant); setShowEditTenant(true); }}
                        className="p-2 rounded-lg text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)] hover:text-[var(--color-brown-dark)] transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openWebhooks(tenant)}
                        className="p-2 rounded-lg text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)] hover:text-[var(--color-brown-dark)] transition-colors"
                        title="Webhooks"
                      >
                        <Webhook className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleTenant(tenant)}
                        className={`p-2 rounded-lg transition-colors ${
                          tenant.is_active 
                            ? "text-amber-600 hover:bg-amber-50" 
                            : "text-green-600 hover:bg-green-50"
                        }`}
                        title={tenant.is_active ? "Desativar" : "Ativar"}
                      >
                        {tenant.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </button>
                      {!isDefault && (
                        <button
                          onClick={() => handleDeleteTenant(tenant)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTenants.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-[var(--color-brown-medium)] opacity-50" />
                <p className="text-[var(--color-brown-medium)]">
                  {searchTerm ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Webhooks Tab */}
        {activeTab === "webhooks" && (
          <div>
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-brown-dark)]">
                    {selectedTenant ? `Webhooks - ${selectedTenant.name}` : "Selecione uma empresa"}
                  </h2>
                  <p className="text-sm text-[var(--color-brown-medium)]">
                    {!selectedTenant && "Escolha uma empresa na aba Empresas para gerenciar seus webhooks"}
                  </p>
                </div>
                {selectedTenant && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => { setShowCreateWebhook(true); setError(null); setNewWebhook({ name: "", channel: "slack", webhook_url: "", events: [] }); }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Webhook
                  </Button>
                )}
              </div>

              {!selectedTenant ? (
                <p className="text-center text-[var(--color-brown-medium)] py-8">
                  Selecione uma empresa primeiro para ver seus webhooks
                </p>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8">
                  <Webhook className="h-12 w-12 mx-auto mb-4 text-[var(--color-brown-medium)] opacity-50" />
                  <p className="text-[var(--color-brown-medium)]">Nenhum webhook configurado</p>
                  <p className="text-sm text-[var(--color-brown-light)] mt-1">
                    Adicione para receber notificações no Slack ou Teams
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-cream)]">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${webhook.channel === "slack" ? "bg-purple-100" : "bg-blue-100"}`}>
                          <Webhook className={`h-4 w-4 ${webhook.channel === "slack" ? "text-purple-600" : "text-blue-600"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--color-brown-dark)]">{webhook.name}</p>
                          <p className="text-xs text-[var(--color-brown-medium)] truncate max-w-xs">{webhook.webhook_url}</p>
                          <div className="flex gap-1 mt-1">
                            {webhook.events.slice(0, 3).map((event) => (
                              <span key={event} className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs text-[var(--color-brown-medium)]">
                                {event.replace("leave_request_", "")}
                              </span>
                            ))}
                            {webhook.events.length > 3 && (
                              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs text-[var(--color-brown-medium)]">
                                +{webhook.events.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full text-xs font-medium px-2 py-1 ${
                          webhook.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                        }`}>
                          {webhook.is_active ? "Ativo" : "Inativo"}
                        </span>
                        <button
                          onClick={() => handleTestWebhook(webhook)}
                          className="px-3 py-1 text-xs font-medium text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors"
                        >
                          Testar
                        </button>
                        <button
                          onClick={() => handleToggleWebhook(webhook)}
                          className={`p-1.5 rounded-lg ${
                            webhook.is_active ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {webhook.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* Create Tenant Modal */}
      <Modal
        isOpen={showCreateTenant}
        onClose={() => { setShowCreateTenant(false); setError(null); setNewTenant({ name: "", domain: "", slug: "", logo_url: "" }); }}
        title="Nova Empresa"
        size="md"
      >
        <form 
          id="create-tenant-form"
          onSubmit={(e) => { e.preventDefault(); console.log('[DEBUG] form onSubmit firing'); handleCreateTenant(); }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Nome da Empresa <span className="text-red-500">*</span>
            </label>
            <Input
              value={newTenant.name}
              onChange={(e) => setNewTenant(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Magna Inc."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Domínio <span className="text-xs text-[var(--color-brown-medium)]">(opcional)</span>
            </label>
            <Input
              value={newTenant.domain}
              onChange={(e) => setNewTenant(prev => ({ ...prev, domain: e.target.value }))}
              placeholder="empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Logo URL <span className="text-xs text-[var(--color-brown-medium)]">(opcional)</span>
            </label>
            <Input
              value={newTenant.logo_url}
              onChange={(e) => setNewTenant(prev => ({ ...prev, logo_url: e.target.value }))}
              placeholder="https://exemplo.com/logo.png"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Slug <span className="text-xs text-[var(--color-brown-medium)]">(URL única)</span>
            </label>
            <Input
              value={newTenant.slug}
              onChange={(e) => setNewTenant(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
              placeholder="magna-inc"
              required
            />
            <p className="text-xs text-[var(--color-brown-light)] mt-1">
              Será usado como: suaurl.com/{newTenant.slug || "slug"}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => { console.log('[DEBUG] Cancel clicked'); setShowCreateTenant(false); }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-[#C7A76C] text-[#2C2416] hover:bg-[#D4A853] disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Criando..." : "Criar Empresa"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal
        isOpen={showEditTenant}
        onClose={() => { setShowEditTenant(false); setEditTenant(null); setError(null); }}
        title={`Editar: ${editTenant?.name}`}
        size="md"
      >
        {editTenant && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                Nome da Empresa <span className="text-red-500">*</span>
              </label>
              <Input
                value={editTenant.name}
                onChange={(e) => setEditTenant(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                Domínio <span className="text-xs text-[var(--color-brown-medium)]">(opcional)</span>
              </label>
              <Input
                value={editTenant.domain || ""}
                onChange={(e) => setEditTenant(prev => prev ? { ...prev, domain: e.target.value } : null)}
                placeholder="empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                Logo URL <span className="text-xs text-[var(--color-brown-medium)]">(opcional)</span>
              </label>
              <Input
                value={editTenant.logo_url || ""}
                onChange={(e) => setEditTenant(prev => prev ? { ...prev, logo_url: e.target.value } : null)}
                placeholder="https://exemplo.com/logo.png"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowEditTenant(false)}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1" loading={saving} onClick={handleEditTenant}>
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Webhook Modal */}
      <Modal
        isOpen={showCreateWebhook}
        onClose={() => { setShowCreateWebhook(false); setError(null); setNewWebhook({ name: "", channel: "slack", webhook_url: "", events: [] }); }}
        title="Novo Webhook"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <Input
              value={newWebhook.name}
              onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Produção Notifications"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Canal <span className="text-red-500">*</span>
            </label>
            <select
              value={newWebhook.channel}
              onChange={(e) => setNewWebhook(prev => ({ ...prev, channel: e.target.value as "slack" | "teams" }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
            >
              <option value="slack">Slack</option>
              <option value="teams">Microsoft Teams</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Webhook URL <span className="text-red-500">*</span>
            </label>
            <Input
              value={newWebhook.webhook_url}
              onChange={(e) => setNewWebhook(prev => ({ ...prev, webhook_url: e.target.value }))}
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-2">
              Eventos <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label key={event.value} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-cream)] cursor-pointer hover:bg-[var(--color-cream)]/80">
                  <input
                    type="checkbox"
                    checked={newWebhook.events.includes(event.value)}
                    onChange={() => toggleEvent(event.value)}
                    className="rounded border-[var(--border)] text-[var(--color-gold)] focus:ring-[var(--color-gold)]"
                  />
                  <span className="text-sm text-[var(--color-brown-dark)]">{event.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowCreateWebhook(false)}>
              Cancelar
            </Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={handleCreateWebhook}>
              Criar Webhook
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
