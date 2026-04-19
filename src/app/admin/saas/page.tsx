"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { Card, Button, Modal, Input, Select } from "@/components/ui";
import { Building2, Users, Plus, Edit2, Power, PowerOff, Webhook, Trash2, Check, X, AlertCircle } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  slug: string;
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
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  
  // Modals
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showEditTenant, setShowEditTenant] = useState(false);
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  
  // Form state
  const [newTenant, setNewTenant] = useState({ name: "", domain: "", slug: "" });
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

    if (!profileData || profileData.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    setProfile(profileData);
    await loadTenants();
    setLoading(false);
  };

  const loadTenants = async () => {
    // Use service role or admin query to get all tenants
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: true }) as { data: Tenant[] | null, error: any };

    if (error) {
      console.error("Error loading tenants:", error);
      setError("Erro ao carregar tenants");
      return;
    }

    const tenantList = data || [];
    setTenants(tenantList);
    
    // Load stats for each tenant
    const stats: Record<string, TenantStats> = {};
    for (const tenant of tenantList) {
      const { data: statData } = await (supabase as any)
        .rpc("get_tenant_stats", { p_tenant_id: tenant.id });
      stats[tenant.id] = statData || { employee_count: 0, pending_requests: 0, approved_requests: 0, total_requests: 0 };
    }
    setTenantStats(stats);
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug) {
      setError("Nome e slug são obrigatórios");
      return;
    }

    setSaving(true);
    setError(null);

    const slug = newTenant.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    
    const { data, error } = await (supabase as any)
      .from("tenants")
      .insert({
        name: newTenant.name,
        domain: newTenant.domain || null,
        slug,
        settings: { timezone: "America/Sao_Paulo", locale: "pt-BR" },
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      setError(`Erro ao criar tenant: ${error.message}`);
      setSaving(false);
      return;
    }

    setSuccess("Tenant criado com sucesso!");
    setShowCreateTenant(false);
    setNewTenant({ name: "", domain: "", slug: "" });
    await loadTenants();
    setSaving(false);
  };

  const handleToggleTenant = async (tenant: Tenant) => {
    const { error } = await (supabase as any)
      .from("tenants")
      .update({ is_active: !tenant.is_active })
      .eq("id", tenant.id);

    if (error) {
      setError(`Erro ao atualizar tenant: ${error.message}`);
      return;
    }

    await loadTenants();
    setSuccess(tenant.is_active ? "Tenant desativado" : "Tenant ativado");
  };

  const handleEditTenant = async () => {
    if (!editTenant) return;
    setSaving(true);

    const { error } = await (supabase as any)
      .from("tenants")
      .update({
        name: editTenant.name,
        domain: editTenant.domain || null,
        settings: editTenant.settings,
      })
      .eq("id", editTenant.id);

    if (error) {
      setError(`Erro ao editar tenant: ${error.message}`);
      setSaving(false);
      return;
    }

    setShowEditTenant(false);
    setEditTenant(null);
    await loadTenants();
    setSuccess("Tenant atualizado!");
    setSaving(false);
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (tenant.id === DEFAULT_TENANT_ID) {
      setError("Não é possível excluir o tenant padrão");
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o tenant "${tenant.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const { error } = await (supabase as any).from("tenants").delete().eq("id", tenant.id);
    
    if (error) {
      setError(`Erro ao excluir tenant: ${error.message}`);
      return;
    }

    await loadTenants();
    setSuccess("Tenant excluído");
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
      <Header profile={profile} pendingCount={0} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              🏢 Painel SaaS — Multi-Tenant
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Gerencie empresas, políticas e integrações
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateTenant(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
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

        {/* Tenants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => {
            const stats = tenantStats[tenant.id] || { employee_count: 0, pending_requests: 0, approved_requests: 0, total_requests: 0 };
            const isDefault = tenant.id === DEFAULT_TENANT_ID;

            return (
              <Card key={tenant.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--color-gold)]/10">
                      <Building2 className="h-5 w-5 text-[var(--color-gold)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-brown-dark)]">{tenant.name}</h3>
                      <p className="text-xs text-[var(--color-brown-medium)]">/{tenant.slug}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-0.5 ${tenant.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                    {tenant.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-[var(--color-cream)]">
                    <p className="text-xs text-[var(--color-brown-medium)]">Funcionários</p>
                    <p className="text-xl font-bold text-[var(--color-brown-dark)]">{stats.employee_count}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-cream)]">
                    <p className="text-xs text-[var(--color-brown-medium)]">Pedidos</p>
                    <p className="text-xl font-bold text-[var(--color-brown-dark)]">{stats.total_requests}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setEditTenant(tenant); setShowEditTenant(true); }}
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => openWebhooks(tenant)}
                  >
                    <Webhook className="h-3 w-3 mr-1" />
                    Webhooks
                  </Button>
                  <Button
                    variant={tenant.is_active ? "danger" : "primary"}
                    size="sm"
                    onClick={() => handleToggleTenant(tenant)}
                    title={tenant.is_active ? "Desativar" : "Ativar"}
                  >
                    {tenant.is_active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                  </Button>
                  {!isDefault && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteTenant(tenant)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {tenants.length === 0 && (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-[var(--color-brown-medium)] opacity-50" />
            <h3 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-2">Nenhuma empresa cadastrada</h3>
            <p className="text-[var(--color-brown-medium)] mb-4">Comece criando a primeira empresa no sistema</p>
            <Button variant="primary" onClick={() => setShowCreateTenant(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Empresa
            </Button>
          </Card>
        )}
      </main>

      {/* Create Tenant Modal */}
      <Modal
        isOpen={showCreateTenant}
        onClose={() => { setShowCreateTenant(false); setError(null); setNewTenant({ name: "", domain: "", slug: "" }); }}
        title="Nova Empresa"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
              Nome da Empresa <span className="text-red-500">*</span>
            </label>
            <Input
              value={newTenant.name}
              onChange={(e) => setNewTenant(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Magna Inc."
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
              Slug <span className="text-xs text-[var(--color-brown-medium)]">(URL única)</span>
            </label>
            <Input
              value={newTenant.slug}
              onChange={(e) => setNewTenant(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
              placeholder="magna-inc"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowCreateTenant(false)}>
              Cancelar
            </Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={handleCreateTenant}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal
        isOpen={showEditTenant}
        onClose={() => { setShowEditTenant(false); setEditTenant(null); setError(null); }}
        title={`Editar: ${editTenant?.name}`}
        size="sm"
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

      {/* Webhooks Modal */}
      <Modal
        isOpen={showWebhooks}
        onClose={() => { setShowWebhooks(false); setSelectedTenant(null); setError(null); }}
        title={`Webhooks — ${selectedTenant?.name}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setShowCreateWebhook(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Novo Webhook
            </Button>
          </div>

          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-brown-medium)]">
              <Webhook className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum webhook configurado</p>
              <p className="text-xs mt-1">Adicione para receber notificações no Slack ou Teams</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--color-cream)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-brown-dark)]">{wh.name}</span>
                      <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2 py-0.5 ${wh.channel === 'slack' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {wh.channel === 'slack' ? 'Slack' : 'Teams'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleTestWebhook(wh)} title="Testar">
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant={wh.is_active ? "danger" : "primary"} 
                        size="sm" 
                        onClick={() => handleToggleWebhook(wh)}
                        title={wh.is_active ? "Desativar" : "Ativar"}
                      >
                        {wh.is_active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteWebhook(wh)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-brown-medium)] truncate mb-2">{wh.webhook_url}</p>
                  <div className="flex flex-wrap gap-1">
                    {wh.events.map((event) => (
                      <span key={event} className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-0.5">
                        {AVAILABLE_EVENTS.find(e => e.value === event)?.label || event}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Webhook Sub-modal */}
        {showCreateWebhook && (
          <div className="mt-4 p-4 border-t border-[var(--border)]">
            <h4 className="font-medium text-[var(--color-brown-dark)] mb-3">Novo Webhook</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Notificações RH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">
                  Canal <span className="text-red-500">*</span>
                </label>
                <Select
                  value={newWebhook.channel}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, channel: e.target.value as "slack" | "teams" }))}
                  options={[
                    { value: "slack", label: "Slack" },
                    { value: "teams", label: "Microsoft Teams" },
                  ]}
                  placeholder="Selecione o canal"
                />
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
                    <label key={event.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="rounded border-gray-300 text-[var(--color-gold)] focus:ring-[var(--color-gold)]"
                      />
                      <span className="text-[var(--color-brown-medium)]">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowCreateWebhook(false); setNewWebhook({ name: "", channel: "slack", webhook_url: "", events: [] }); }}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" loading={saving} onClick={handleCreateWebhook}>
                  Criar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
