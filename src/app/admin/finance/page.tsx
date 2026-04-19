"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isMasterAdmin } from "@/lib/auth";
import { Card, Button, Input, Modal } from "@/components/ui";
import {
  DollarSign,
  Building2,
  TrendingUp,
  AlertTriangle,
  Users,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Download,
  CreditCard,
  Receipt,
  ArrowUpRight,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price_per_employee: number;
  min_employees: number;
  max_employees: number;
  features: string[];
  is_active: boolean;
  created_at: string;
}

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  employee_count: number;
  plan_name: string;
  monthly_revenue: number;
  is_overdue: boolean;
  last_invoice_date: string | null;
}

interface Invoice {
  id: string;
  tenant_id: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  due_date: string;
  paid_at: string | null;
  created_at: string;
  tenant_name?: string;
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: "free",
    name: "Grátis",
    price_per_employee: 0,
    min_employees: 0,
    max_employees: 5,
    features: ["Até 5 funcionários", "Gestão de férias", "Controle de ponto", "Relatórios básicos"],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "starter",
    name: "Starter",
    price_per_employee: 29,
    min_employees: 6,
    max_employees: 50,
    features: ["6 a 50 funcionários", "Tudo do Grátis", "Banco de horas", "Escalas automáticas", "Suporte por email"],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "business",
    name: "Business",
    price_per_employee: 49,
    min_employees: 51,
    max_employees: 500,
    features: ["51 a 500 funcionários", "Tudo do Starter", "Integração Slack/Teams", "Relatórios avançados", "Webhook notifications", "Suporte prioritário"],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_per_employee: 0,
    min_employees: 501,
    max_employees: 999999,
    features: ["Mais de 500 funcionários", "Tudo do Business", "SLA garantido", "Gerente de conta dedicado", "Customizações"],
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export default function FinancePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "plans" | "invoices">("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [newPlan, setNewPlan] = useState<Partial<Plan>>({ name: "", price_per_employee: 0, min_employees: 0, max_employees: 999, features: [], is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single() as { data: any };
    if (!profileData || !isMasterAdmin(profileData.role)) { router.push("/dashboard"); return; }
    setProfile(profileData);
    await loadData();
    setLoading(false);
  };

  const loadData = async () => {
    await loadTenants();
    await loadInvoices();
    await loadPlans();
  };

  const loadTenants = async () => {
    const { data } = await (supabase as any)
      .from("tenants")
      .select("*") as { data: any[] | null };

    const tenantList: TenantWithStats[] = [];
    for (const tenant of (data || [])) {
      const { count: empCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id);
      const count = (empCount ?? 0) as number;
      const plan = getPlanForEmployeeCount(count);
      const monthlyRevenue = count > 5 ? count * plan.price_per_employee : 0;

      tenantList.push({
        ...tenant,
        employee_count: count || 0,
        plan_name: plan.name,
        monthly_revenue: monthlyRevenue,
        is_overdue: false,
        last_invoice_date: null,
      });
    }
    setTenants(tenantList);
  };

  const loadInvoices = async () => {
    // Mock invoices for now - in production would have an invoices table
    const mockInvoices: Invoice[] = tenants
      .filter((t) => t.is_active && t.employee_count > 5)
      .slice(0, 5)
      .map((t, i) => ({
        id: `inv-${i}`,
        tenant_id: t.id,
        amount: t.monthly_revenue,
        status: i % 3 === 0 ? "overdue" : i % 2 === 0 ? "pending" : "paid",
        due_date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        paid_at: i % 2 === 0 ? new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        created_at: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
        tenant_name: t.name,
      }));
    setInvoices(mockInvoices);
  };

  const loadPlans = async () => {
    const { data } = await (supabase as any)
      .from("plans")
      .select("*")
      .order("min_employees");
    if (data && data.length > 0) setPlans(data);
  };

  const getPlanForEmployeeCount = (count: number): Plan => {
    const sorted = [...plans].sort((a, b) => a.min_employees - b.min_employees);
    for (const plan of sorted) {
      if (count >= plan.min_employees && count <= plan.max_employees) return plan;
    }
    return sorted[sorted.length - 1];
  };

  const handleCreatePlan = async () => {
    if (!newPlan.name) { setError("Nome é obrigatório"); return; }
    setSaving(true);
    const { error: err } = await (supabase as any)
      .from("plans")
      .insert({ ...newPlan, features: newPlan.features || [] });
    if (err) { setError(`Erro: ${err.message}`); setSaving(false); return; }
    setSuccess("Plano criado!");
    setShowCreatePlan(false);
    await loadPlans();
    setSaving(false);
  };

  const handleUpdatePlan = async () => {
    if (!editPlan) return;
    setSaving(true);
    const { error: err } = await (supabase as any)
      .from("plans")
      .update({ name: editPlan.name, price_per_employee: editPlan.price_per_employee, min_employees: editPlan.min_employees, max_employees: editPlan.max_employees, features: editPlan.features, is_active: editPlan.is_active })
      .eq("id", editPlan.id);
    if (err) { setError(`Erro: ${err.message}`); setSaving(false); return; }
    setSuccess("Plano atualizado!");
    setEditPlan(null);
    await loadPlans();
    setSaving(false);
  };

  const handleTogglePlan = async (plan: Plan) => {
    await (supabase as any).from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    await loadPlans();
    setSuccess(plan.is_active ? "Plano desativado" : "Plano ativado");
  };

  const totalActiveTenants = tenants.filter((t) => t.is_active).length;
  const totalEmployees = tenants.reduce((sum, t) => sum + t.employee_count, 0);
  const totalMRR = tenants.reduce((sum, t) => sum + t.monthly_revenue, 0);
  const overdueTenants = tenants.filter((t) => t.is_overdue);

  const filteredTenants = tenants.filter((t) =>
    !searchTerm ||
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.plan_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-cream)]">
        <div className="text-center">
          <div style={{ width: "48px", height: "48px", border: "4px solid var(--color-gold)", borderTop: "4px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] flex items-center gap-2">
              💰 Gestão Financeira
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Visão geral de receitas, planos e inadimplência
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
            <X className="h-4 w-4" /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" /> {success}
            <button onClick={() => setSuccess(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Building2 className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{totalActiveTenants}</p>
                <p className="text-xs text-[var(--color-brown-medium)]">Empresas Ativas</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><Users className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{totalEmployees}</p>
                <p className="text-xs text-[var(--color-brown-medium)]">Total Funcionários</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{formatCurrency(totalMRR)}</p>
                <p className="text-xs text-[var(--color-brown-medium)]">MRR Estimado</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{overdueTenants.length}</p>
                <p className="text-xs text-[var(--color-brown-medium)]">Inadimplentes</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)] pb-4">
          {[
            { key: "overview", label: "Visão Geral", icon: TrendingUp },
            { key: "tenants", label: "Empresas", icon: Building2 },
            { key: "plans", label: "Planos", icon: CreditCard },
            { key: "invoices", label: "Faturas", icon: Receipt },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-[var(--color-gold)] text-white"
                  : "text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4">Receita por Plano</h2>
              <div className="space-y-3">
                {plans.filter((p) => p.is_active).map((plan) => {
                  const planTenants = tenants.filter((t) => t.plan_name === plan.name && t.is_active);
                  const planRevenue = planTenants.reduce((sum, t) => sum + t.monthly_revenue, 0);
                  return (
                    <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-cream)]">
                      <div>
                        <p className="font-medium text-[var(--color-brown-dark)]">{plan.name}</p>
                        <p className="text-xs text-[var(--color-brown-medium)]">{planTenants.length} empresas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[var(--color-brown-dark)]">{formatCurrency(planRevenue)}</p>
                        <p className="text-xs text-[var(--color-brown-medium)]">/mês</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4">Inadimplentes</h2>
              {overdueTenants.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-50" />
                  <p className="text-[var(--color-brown-medium)]">Nenhuma empresa inadimplente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueTenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50">
                      <div>
                        <p className="font-medium text-[var(--color-brown-dark)]">{tenant.name}</p>
                        <p className="text-xs text-red-600">Atrasada desde {tenant.last_invoice_date ? new Date(tenant.last_invoice_date).toLocaleDateString("pt-BR") : "—"}</p>
                      </div>
                      <span className="text-sm font-bold text-red-600">{formatCurrency(tenant.monthly_revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === "tenants" && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <input type="text" placeholder="Buscar empresa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]" />
              </div>
              <p className="text-sm text-[var(--color-brown-medium)]">{filteredTenants.length} empresas</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-cream)] text-left">
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Empresa</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs text-center">Funcionários</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs text-center">Plano</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs text-right">Receita Mensal</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-[var(--color-cream)]/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-brown-dark)]">{tenant.name}</p>
                        <p className="text-xs text-[var(--color-brown-medium)]">/{tenant.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg font-bold text-[var(--color-brown-dark)]">{tenant.employee_count}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-[var(--color-cream)] px-2 py-0.5 text-xs font-medium text-[var(--color-brown-medium)]">
                          {tenant.plan_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-[var(--color-brown-dark)]">{formatCurrency(tenant.monthly_revenue)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 ${tenant.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                          {tenant.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Plans Tab */}
        {activeTab === "plans" && (
          <div>
            <div className="flex justify-end mb-4">
              <Button variant="primary" size="sm" onClick={() => { setShowCreatePlan(true); setNewPlan({ name: "", price_per_employee: 0, min_employees: 0, max_employees: 999, features: [], is_active: true }); setError(null); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Plano
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {plans.map((plan) => (
                <Card key={plan.id} className={`p-6 ${!plan.is_active ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--color-brown-dark)]">{plan.name}</h3>
                      <p className="text-xs text-[var(--color-brown-medium)]">
                        {plan.max_employees >= 999 ? "Sem limite" : `Até ${plan.max_employees} funcionários`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2 py-1 ${plan.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-[var(--color-brown-dark)]">
                      {plan.price_per_employee === 0 ? "Grátis" : formatCurrency(plan.price_per_employee)}
                    </span>
                    {plan.price_per_employee > 0 && <span className="text-sm text-[var(--color-brown-medium)]">/funcionário/mês</span>}
                  </div>
                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-[var(--color-brown-medium)]">
                        <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditPlan(plan); setError(null); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors">
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button onClick={() => handleTogglePlan(plan)} className={`p-2 rounded-lg transition-colors ${plan.is_active ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}>
                      {plan.is_active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-brown-dark)]">Histórico de Transações</h2>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-cream)] text-left">
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Empresa</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Valor</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Vencimento</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Status</th>
                    <th className="px-4 py-3 font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide text-xs">Pago em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[var(--color-cream)]/50">
                      <td className="px-4 py-3 font-medium text-[var(--color-brown-dark)]">{inv.tenant_name || "—"}</td>
                      <td className="px-4 py-3 font-bold text-[var(--color-brown-dark)]">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-3 text-[var(--color-brown-medium)]">{new Date(inv.due_date).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 ${
                          inv.status === "paid" ? "bg-green-100 text-green-800" :
                          inv.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {inv.status === "paid" ? "Pago" : inv.status === "pending" ? "Pendente" : "Atrasada"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-brown-medium)]">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Create/Edit Plan Modal */}
      <Modal
        isOpen={showCreatePlan || !!editPlan}
        onClose={() => { setShowCreatePlan(false); setEditPlan(null); setError(null); }}
        title={editPlan ? "Editar Plano" : "Novo Plano"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">Nome</label>
            <Input value={editPlan ? editPlan.name : newPlan.name || ""} onChange={(e) => editPlan ? setEditPlan({ ...editPlan, name: e.target.value }) : setNewPlan({ ...newPlan, name: e.target.value })} placeholder="Business" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">Preço por funcionário (R$)</label>
              <Input type="number" value={editPlan ? editPlan.price_per_employee : newPlan.price_per_employee || ""} onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                if (editPlan) setEditPlan({ ...editPlan, price_per_employee: val });
                else setNewPlan({ ...newPlan, price_per_employee: val });
              }} placeholder="49" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">Funcionários min.</label>
              <Input type="number" value={editPlan ? editPlan.min_employees : newPlan.min_employees || ""} onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                if (editPlan) setEditPlan({ ...editPlan, min_employees: val });
                else setNewPlan({ ...newPlan, min_employees: val });
              }} placeholder="6" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1">Funcionários máx. (0 = ilimitado)</label>
            <Input type="number" value={editPlan ? editPlan.max_employees : newPlan.max_employees || ""} onChange={(e) => {
              const val = parseInt(e.target.value) || 999;
              if (editPlan) setEditPlan({ ...editPlan, max_employees: val });
              else setNewPlan({ ...newPlan, max_employees: val });
            }} placeholder="500" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => { setShowCreatePlan(false); setEditPlan(null); }}>Cancelar</Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={editPlan ? handleUpdatePlan : handleCreatePlan}>
              {editPlan ? "Salvar" : "Criar Plano"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}