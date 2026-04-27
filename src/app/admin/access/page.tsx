"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Input, Modal, PremiumSelect } from "@/components/ui";
import {
  Users, Check, X, AlertCircle, Save, Search, ChevronDown,
  Shield, UserCog, ToggleLeft, ToggleRight, ArrowRightLeft,
  CheckSquare, Square, Loader2
} from "lucide-react";
import { isMasterAdmin } from "@/lib/auth";
import { format } from "date-fns";
import { clsx } from "clsx";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  tenant_id: string;
  manager_id: string | null;
  created_at: string;
}

interface Tenant {
  id: string;
  name: string;
}

const ROLES = [
  { value: "master_admin", label: "Master Admin" },
  { value: "tenant_admin", label: "Tenant Admin" },
  { value: "gestor", label: "Gestor" },
  { value: "funcionario", label: "Funcionário" },
];

const STATUS_COLORS: Record<string, string> = {
  master_admin: "bg-purple-100 text-purple-800",
  tenant_admin: "bg-blue-100 text-blue-800",
  gestor: "bg-green-100 text-green-800",
  funcionario: "bg-gray-100 text-gray-800",
};

export default function AccessManagementPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit user modal
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("funcionario");
  const [editTenant, setEditTenant] = useState<string>("");
  const [editManager, setEditManager] = useState<string>("");
  const [editActive, setEditActive] = useState(true);

  // Bulk role modal
  const [bulkRole, setBulkRole] = useState<string>("funcionario");
  const [showBulkRole, setShowBulkRole] = useState(false);

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
    await loadData();
    setLoading(false);
  };

  const loadData = async () => {
    const [{ data: usersData }, { data: tenantsData }] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("tenants")
        .select("id, name")
        .order("name"),
    ]);

    setUsers(usersData || []);
    setTenants(tenantsData || []);
  };

  const getTenantName = (tenantId: string) => {
    return tenants.find(t => t.id === tenantId)?.name || "—";
  };

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "—";
    const m = users.find(u => u.id === managerId);
    return m?.name || "—";
  };

  const filteredUsers = users.filter(u => {
    const matchSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchTenant = filterTenant === "all" || u.tenant_id === filterTenant;
    const matchStatus = filterStatus === "all" ||
      (filterStatus === "active" && u.is_active) ||
      (filterStatus === "inactive" && !u.is_active);
    return matchSearch && matchRole && matchTenant && matchStatus;
  });

  const openEditUser = (user: Profile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditTenant(user.tenant_id || "");
    setEditManager(user.manager_id || "");
    setEditActive(user.is_active);
    setError(null);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({
          role: editRole,
          tenant_id: editTenant || null,
          manager_id: editManager || null,
          is_active: editActive,
        })
        .eq("id", editingUser.id);

      if (updateError) throw updateError;

      // Log the action
      await (supabase as any)
        .from("user_access_log")
        .insert({
          user_id: profile?.id,
          action: "user_access_modified",
          details: {
            target_user_id: editingUser.id,
            target_user_name: editingUser.name,
            changes: {
              role: { from: editingUser.role, to: editRole },
              tenant_id: { from: editingUser.tenant_id, to: editTenant },
              manager_id: { from: editingUser.manager_id, to: editManager },
              is_active: { from: editingUser.is_active, to: editActive },
            },
            changed_by: profile?.name,
          },
        });

      setUsers(prev =>
        prev.map(u =>
          u.id === editingUser.id
            ? { ...u, role: editRole, tenant_id: editTenant, manager_id: editManager, is_active: editActive }
            : u
        )
      );
      setEditingUser(null);
      setSuccess("Usuário atualizado com sucesso!");
    } catch (e: any) {
      setError(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserActive = async (user: Profile) => {
    const newActive = !user.is_active;
    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ is_active: newActive })
      .eq("id", user.id);

    if (updateError) {
      setError(`Erro: ${updateError.message}`);
      return;
    }

    await (supabase as any)
      .from("user_access_log")
      .insert({
        user_id: profile?.id,
        action: newActive ? "user_activated" : "user_deactivated",
        details: { target_user_id: user.id, target_user_name: user.name, changed_by: profile?.name },
      });

    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newActive } : u));
    setSuccess(newActive ? "Usuário ativado" : "Usuário desativado");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const bulkActivate = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    for (const id of selectedIds) {
      await (supabase as any).from("profiles").update({ is_active: true }).eq("id", id);
    }
    setUsers(prev => prev.map(u => selectedIds.has(u.id) ? { ...u, is_active: true } : u));
    setSelectedIds(new Set());
    setSaving(false);
    setSuccess(`${selectedIds.size} usuário(s) ativado(s)`);
  };

  const bulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    for (const id of selectedIds) {
      await (supabase as any).from("profiles").update({ is_active: false }).eq("id", id);
    }
    setUsers(prev => prev.map(u => selectedIds.has(u.id) ? { ...u, is_active: false } : u));
    setSelectedIds(new Set());
    setSaving(false);
    setSuccess(`${selectedIds.size} usuário(s) desativado(s)`);
  };

  const bulkChangeRole = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    for (const id of selectedIds) {
      const user = users.find(u => u.id === id);
      await (supabase as any).from("profiles").update({ role: bulkRole }).eq("id", id);
      await (supabase as any).from("user_access_log").insert({
        user_id: profile?.id,
        action: "user_role_changed_bulk",
        details: { target_user_id: id, target_user_name: user?.name, new_role: bulkRole, changed_by: profile?.name },
      });
    }
    setUsers(prev => prev.map(u => selectedIds.has(u.id) ? { ...u, role: bulkRole } : u));
    setSelectedIds(new Set());
    setShowBulkRole(false);
    setSaving(false);
    setSuccess(`Role alterado para ${selectedIds.size} usuário(s)`);
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
            🔐 Gestão de Acessos
          </h1>
          <p className="text-[var(--color-brown-medium)] mt-1">
            Gerencie usuários, roles e permissões de todas as empresas
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

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-brown-medium)]" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]"
              />
            </div>
            <PremiumSelect
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { value: "all", label: "Todos os Roles" },
                ...ROLES.map(r => ({ value: r.value, label: r.label, icon: <Shield className="h-4 w-4" /> }))
              ]}
            />
            <PremiumSelect
              value={filterTenant}
              onChange={setFilterTenant}
              options={[
                { value: "all", label: "Todas as Empresas" },
                ...tenants.map(t => ({ value: t.id, label: t.name }))
              ]}
            />
            <PremiumSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "all", label: "Todos Status" },
                { value: "active", label: "Ativos" },
                { value: "inactive", label: "Inativos" }
              ]}
            />
            <span className="py-2 text-sm text-[var(--color-brown-medium)] whitespace-nowrap">
              {filteredUsers.length} usuário{filteredUsers.length !== 1 ? "s" : ""}
            </span>
          </div>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--color-cream)] border border-[var(--color-gold)] flex items-center justify-between gap-3 animate-slide-up">
            <span className="text-sm font-medium text-[var(--color-brown-dark)]">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button variant="primary" size="sm" loading={saving} onClick={bulkActivate}>
                <Check className="h-4 w-4 mr-1" /> Ativar
              </Button>
              <Button variant="danger" size="sm" loading={saving} onClick={bulkDeactivate}>
                <X className="h-4 w-4 mr-1" /> Desativar
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowBulkRole(true)}>
                <UserCog className="h-4 w-4 mr-1" /> Alterar Role
              </Button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <Card className="overflow-hidden">
          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-3 bg-[var(--color-cream)] text-xs font-semibold text-[var(--color-brown-medium)] uppercase tracking-wide">
            <div className="col-span-1 flex items-center">
              <button onClick={toggleSelectAll} className="hover:text-[var(--color-gold)]">
                {selectedIds.size === filteredUsers.length && filteredUsers.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-[var(--color-gold)]" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="col-span-3">Usuário</div>
            <div className="col-span-2 text-center">Role</div>
            <div className="col-span-2 text-center">Empresa</div>
            <div className="col-span-2 text-center">Manager</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1 text-right">Ações</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--border)]">
            {filteredUsers.map(user => (
              <div key={user.id} className={`grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-[var(--color-cream)]/50 transition-colors ${selectedIds.has(user.id) ? "bg-[var(--color-gold)]/5" : ""}`}>
                {/* Checkbox */}
                <div className="col-span-1 flex items-center">
                  <button onClick={() => toggleSelect(user.id)} className="hover:text-[var(--color-gold)]">
                    {selectedIds.has(user.id) ? (
                      <CheckSquare className="h-4 w-4 text-[var(--color-gold)]" />
                    ) : (
                      <Square className="h-4 w-4 text-[var(--color-brown-medium)]" />
                    )}
                  </button>
                </div>

                {/* User info */}
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-[var(--color-gold)]">
                        {user.name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--color-brown-dark)] truncate">{user.name}</p>
                      <p className="text-xs text-[var(--color-brown-medium)] truncate">{user.email}</p>
                      <p className="text-xs text-[var(--color-brown-light)]">
                        Criado em {format(new Date(user.created_at), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div className="col-span-2 flex justify-center">
                  <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2 py-1 ${STATUS_COLORS[user.role] || "bg-gray-100 text-gray-800"}`}>
                    {user.role.replace("_", " ")}
                  </span>
                </div>

                {/* Tenant */}
                <div className="col-span-2 text-center">
                  <p className="text-sm text-[var(--color-brown-dark)] truncate">{getTenantName(user.tenant_id)}</p>
                </div>

                {/* Manager */}
                <div className="col-span-2 text-center">
                  <p className="text-sm text-[var(--color-brown-medium)] truncate">{getManagerName(user.manager_id)}</p>
                </div>

                {/* Status */}
                <div className="col-span-1 flex justify-center">
                  <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2 py-1 ${
                    user.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                  }`}>
                    {user.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end gap-1">
                  <button
                    onClick={() => openEditUser(user)}
                    className="p-1.5 rounded-lg text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)] hover:text-[var(--color-brown-dark)] transition-colors"
                    title="Editar"
                  >
                    <UserCog className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleUserActive(user)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      user.is_active
                        ? "text-amber-600 hover:bg-amber-50"
                        : "text-green-600 hover:bg-green-50"
                    }`}
                    title={user.is_active ? "Desativar" : "Ativar"}
                  >
                    {user.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-[var(--color-brown-medium)] opacity-50" />
              <p className="text-[var(--color-brown-medium)]">
                {search || filterRole !== "all" || filterTenant !== "all" || filterStatus !== "all"
                  ? "Nenhum usuário encontrado"
                  : "Nenhum usuário cadastrado"}
              </p>
            </div>
          )}
        </Card>
      </main>

      {/* Edit User Modal */}
      <Modal
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title={`Editar: ${editingUser?.name}`}
        size="md"
      >
        {editingUser && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[var(--color-cream)]">
              <p className="text-sm font-medium text-[var(--color-brown-dark)]">{editingUser.email}</p>
            </div>

            <PremiumSelect
              label="Role"
              value={editRole}
              onChange={setEditRole}
              icon={<Shield className="h-4 w-4" />}
              options={ROLES.map(r => ({ value: r.value, label: r.label }))}
            />

            <PremiumSelect
              label="Empresa"
              value={editTenant}
              onChange={setEditTenant}
              icon={<ArrowRightLeft className="h-4 w-4" />}
              options={[
                { value: "", label: "Nenhuma" },
                ...tenants.map(t => ({ value: t.id, label: t.name }))
              ]}
            />

            <PremiumSelect
              label="Manager"
              value={editManager || ""}
              onChange={(val) => setEditManager(val)}
              icon={<UserCog className="h-4 w-4" />}
              options={[
                { value: "", label: "Nenhum" },
                ...users
                  .filter(u => u.id !== editingUser.id)
                  .map(u => ({ value: u.id, label: u.name }))
              ]}
            />

            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-cream)]">
              <span className="text-sm font-medium text-[var(--color-brown-dark)]">Usuário Ativo</span>
              <button
                onClick={() => setEditActive(!editActive)}
                className={`p-1.5 rounded-lg transition-colors ${
                  editActive ? "text-green-600 bg-green-50" : "text-gray-400 bg-gray-100"
                }`}
              >
                {editActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1" loading={saving} onClick={handleSaveUser}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Role Modal */}
      <Modal
        isOpen={showBulkRole}
        onClose={() => setShowBulkRole(false)}
        title={`Alterar Role de ${selectedIds.size} usuário(s)`}
        size="sm"
      >
        <div className="space-y-4">
          <PremiumSelect
            label="Novo Role"
            value={bulkRole}
            onChange={setBulkRole}
            icon={<Shield className="h-4 w-4" />}
            options={ROLES.map(r => ({ value: r.value, label: r.label }))}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowBulkRole(false)}>
              Cancelar
            </Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={bulkChangeRole}>
              Aplicar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
