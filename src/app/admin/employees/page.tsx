"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Edit2, Trash2, Calendar, Save, Loader2, Clock, Download, Search, ChevronUp, ChevronDown } from "lucide-react";

import { Card, Button, Input } from "@/components/ui";
import { Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { format, differenceInYears, differenceInMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isTenantAdmin, isMasterAdmin, getRoleLabel } from "@/lib/auth";

interface EmployeeForm {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: "tenant_admin" | "gestor" | "funcionario";
  department: string;
  position: string;
  hire_date: string;
  vacation_balance: number;
  hours_balance: number;
  manager_id: string;
  schedule_id: string;
  tenant_id?: string;
}

export default function EmployeesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [currentTenantName, setCurrentTenantName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

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
      if (!adminProfile || !isTenantAdmin(adminProfile.role)) {
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }

      setProfile(adminProfile);

      let query = supabase
        .from("profiles")
        .select("*, manager:profiles!inner(name), schedule:work_schedules(name)")
        .order("name");

      // Se não for master_admin, filtra pelo tenant do admin
      if (!isMasterAdmin(adminProfile.role) && adminProfile.tenant_id) {
        query = query.eq("tenant_id", adminProfile.tenant_id);
      }

      const { data: allEmployees, error: empError } = await query;


      console.log("[DEBUG] Employees query:", allEmployees?.length, "error:", empError);
      setEmployees(allEmployees || []);
      setFilteredEmployees(allEmployees || []);

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", adminProfile.tenant_id)
        .single() as { data: { name: string } | null };
      setCurrentTenantName(tenantData?.name || "");

      if (isMasterAdmin(adminProfile.role)) {
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("id, name")
          .order("name");
        setTenants(allTenants || []);
      }

      const { data: schedulesData } = await supabase
        .from("work_schedules")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setSchedules(schedulesData || []);

      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  }, [router, supabase]);

  // Filter and sort employees
  useEffect(() => {
    let result = [...employees];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(emp =>
        emp.name?.toLowerCase().includes(query) ||
        emp.email?.toLowerCase().includes(query) ||
        emp.position?.toLowerCase().includes(query) ||
        emp.department?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle null/undefined
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      // String comparison
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredEmployees(result);
  }, [employees, searchQuery, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openNewModal = () => {
    // Auto-assign tenant from current admin's session
    const defaultTenantId = profile?.tenant_id || "";
    setEditingEmployee({
      name: "",
      email: "",
      password: "",
      role: "funcionario",
      department: "",
      position: "",
      hire_date: format(new Date(), "yyyy-MM-dd"),
      vacation_balance: 30,
      hours_balance: 0,
      manager_id: "",
      schedule_id: "",
      tenant_id: defaultTenantId,
    });
    setModalOpen(true);
  };

  const openEditModal = (emp: any) => {
    setEditingEmployee({
      id: emp.id,
      name: emp.name || "",
      email: emp.email || "",
      role: emp.role || "funcionario",
      department: emp.department || "",
      position: emp.position || "",
      hire_date: emp.hire_date || format(new Date(), "yyyy-MM-dd"),
      vacation_balance: emp.vacation_balance ?? 30,
      hours_balance: emp.hours_balance ?? 0,
      manager_id: emp.manager_id || "",
      schedule_id: emp.schedule_id || "",
      tenant_id: emp.tenant_id || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingEmployee) return;

    if (!editingEmployee.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    setSaving(true);

    try {
      if (editingEmployee.id) {
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            ...(authToken && { "Authorization": `Bearer ${authToken}` }),
          },
          body: JSON.stringify({
            id: editingEmployee.id,
            name: editingEmployee.name.trim(),
            role: editingEmployee.role,
            department: editingEmployee.department.trim() || null,
            position: editingEmployee.position.trim() || null,
            hire_date: editingEmployee.hire_date || null,
            vacation_balance: editingEmployee.vacation_balance,
            hours_balance: editingEmployee.hours_balance,
            manager_id: editingEmployee.manager_id || null,
            schedule_id: editingEmployee.schedule_id || null,
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
      } else {
        if (!editingEmployee.email.trim()) {
          setError("Email é obrigatório");
          setSaving(false);
          return;
        }
        if (!editingEmployee.password || editingEmployee.password.length < 6) {
          setError("Senha deve ter pelo menos 6 caracteres");
          setSaving(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(authToken && { "Authorization": `Bearer ${authToken}` }),
          },
          body: JSON.stringify({
            email: editingEmployee.email.trim(),
            password: editingEmployee.password,
            name: editingEmployee.name.trim(),
            role: editingEmployee.role,
            department: editingEmployee.department.trim() || null,
            position: editingEmployee.position.trim() || null,
            hire_date: editingEmployee.hire_date || null,
            vacation_balance: editingEmployee.vacation_balance,
            hours_balance: editingEmployee.hours_balance,
            manager_id: editingEmployee.manager_id || null,
            schedule_id: editingEmployee.schedule_id || null,
            tenant_id: editingEmployee.tenant_id || null,
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
      }

      await fetchData();
      setModalOpen(false);
      setSuccess(editingEmployee?.id ? "Funcionário atualizado com sucesso!" : "Funcionário criado com sucesso!");
    } catch (err: any) {
      console.error("Error saving:", err);
      setError("Erro ao salvar: " + err.message);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este funcionário?")) return;

    setDeleting(id);

    try {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;

      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      console.error("Error deleting:", err);
      setError("Erro ao excluir: " + err.message);
    }

    setDeleting(null);
  };

  const handleExportCSV = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/reports/employees", {
        headers: {
          ...(token && { "Authorization": `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao exportar");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `funcionarios-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Error exporting:", err);
      setError("Erro ao exportar CSV: " + err.message);
    }
  };

  const getVacationStats = (emp: any) => {
    const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
    if (!hireDate) return { yearsWorked: 0, vestingMonths: 0, hasVesting: false, needsAttention: false };

    const now = new Date();
    const yearsWorked = differenceInYears(now, hireDate);
    const totalMonths = differenceInMonths(now, hireDate);
    const vestingMonths = totalMonths % 12;
    const hasVesting = totalMonths >= 12;
    const balance = emp.vacation_balance ?? 30;
    const needsAttention = hasVesting && (balance > 25 || balance <= 0);

    return { yearsWorked, vestingMonths, hasVesting, needsAttention };
  };

  const getVacationStatus = (emp: any) => {
    const stats = getVacationStats(emp);
    const balance = emp.vacation_balance ?? 30;

    if (!emp.hire_date) return { label: "Sem data", color: "text-gray-500", variant: "warning" as const };
    if (balance < 0) return { label: `${balance} dias`, color: "text-red-600", variant: "error" as const };
    if (balance === 0) return { label: "Zerado", color: "text-red-600", variant: "error" as const };
    if (stats.hasVesting && balance >= 25) return { label: `${balance} dias ⚠️`, color: "text-amber-600", variant: "warning" as const };
    if (balance <= 5) return { label: `${balance} dias`, color: "text-amber-600", variant: "warning" as const };
    return { label: `${balance} dias`, color: "text-green-600", variant: "success" as const };
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "master_admin":
        return "bg-purple-100 text-purple-800";
      case "tenant_admin":
        return "bg-blue-100 text-blue-800";
      case "gestor":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-cream)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "4px solid var(--color-gold)",
            borderTop: "4px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px",
          }} />
          <p style={{ color: "var(--color-brown-medium)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* Error Banner */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">×</button>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
          <div className="flex-1">{success}</div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800 font-bold">×</button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {/* Page title removed - Sidebar already shows current page */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-5 w-5 mr-2" />
              Baixar CSV
            </Button>
            <Button onClick={openNewModal}>
              <Plus className="h-5 w-5 mr-2" />
              Novo Funcionário
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Total</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">{employees.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Atenção Necessária</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">
                  {employees.filter((e) => {
                    const stats = getVacationStats(e);
                    return stats.needsAttention || !e.hire_date;
                  }).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50">
                <Calendar className="h-6 w-6 text-[var(--color-warning)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-brown-medium)]">Zeraram Saldo</p>
                <p className="text-2xl font-bold text-[var(--color-brown-dark)]">
                  {employees.filter((e) => (e.vacation_balance ?? 30) <= 0).length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Employee Table */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] mb-4">
            Lista de Funcionários
          </h2>

          {employees.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-brown-medium)]">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum funcionário cadastrado</p>
            </div>
          ) : (
            <>
              {/* Search and Filter Bar */}
              <div className="mb-4 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, email, cargo..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)] placeholder:text-gray-400"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <span className="text-sm text-[var(--color-brown-medium)]">
                  {filteredEmployees.length} de {employees.length} funcionários
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th 
                        className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Nome
                          {sortField === "name" && (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </th>
                      <th 
                        className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort("position")}
                      >
                        <div className="flex items-center gap-1">
                          Cargo
                          {sortField === "position" && (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </th>
                      <th 
                        className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort("department")}
                      >
                        <div className="flex items-center gap-1">
                          Área
                          {sortField === "department" && (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Gestor</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Escala</th>
                      <th 
                        className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort("hire_date")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Admissão
                          {sortField === "hire_date" && (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Tempo</th>
                      <th 
                        className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)] cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort("vacation_balance")}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Férias
                          {sortField === "vacation_balance" && (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => {
                      const stats = getVacationStats(emp);
                    const vacationStatus = getVacationStatus(emp);

                    return (
                      <tr key={emp.id} className="border-b border-[var(--border)] hover:bg-[var(--color-cream)]">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-[var(--color-brown-dark)] flex items-center gap-1.5">
                              {emp.name}
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(emp.role)}`}>
                                {emp.role === "master_admin" ? "Master" : emp.role === "tenant_admin" ? "Admin" : emp.role === "gestor" ? "Gestor" : "Func."}
                              </span>
                            </p>
                            <p className="text-xs text-[var(--color-brown-medium)]">{emp.email}</p>
                            {emp.tenant?.name && (
                              <p className="text-xs text-blue-600 mt-0.5">🏢 {emp.tenant.name}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-[var(--color-brown-dark)]">{emp.position || "-"}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-[var(--color-brown-medium)]">{emp.department || "-"}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-[var(--color-brown-medium)]">{emp.manager?.name || "-"}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-[var(--color-brown-dark)] flex items-center gap-1">
                            {emp.schedule ? <Clock className="h-3 w-3" /> : null}
                            {emp.schedule?.name || "-"}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <p className="text-sm text-[var(--color-brown-dark)]">
                            {emp.hire_date ? format(new Date(emp.hire_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <p className="text-sm text-[var(--color-brown-medium)]">
                            {stats.hasVesting ? `${stats.yearsWorked} ano${stats.yearsWorked > 1 ? "s" : ""}` : `${stats.vestingMonths}m`}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center rounded-full border border-transparent text-xs font-semibold px-2.5 py-0.5 ${vacationStatus.color}`}>
                            {vacationStatus.label}
                          </span>
                          {stats.hasVesting && emp.vacation_balance > 0 && (
                            <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                              +30 em {addMonths(new Date(emp.hire_date), (stats.yearsWorked + 1) * 12).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(emp)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {emp.id !== profile?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(emp.id)}
                                disabled={deleting === emp.id}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Card>
      </main>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEmployee?.id ? "Editar Funcionário" : "Novo Funcionário"}
        size="md"
      >
        {editingEmployee && (
          <div className="space-y-4">
            <Input
              label="Nome Completo *"
              value={editingEmployee.name}
              onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
              placeholder="Nome do funcionário"
            />

            {!editingEmployee.id && (
              <>
                <Input
                  label="Email *"
                  type="email"
                  value={editingEmployee.email || ""}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  placeholder="email@empresa.com"
                  autoComplete="off"
                />

                <Input
                  label="Senha *"
                  type="password"
                  value={editingEmployee.password || ""}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </>
            )}

            <Input
              label="Cargo"
              value={editingEmployee.position}
              onChange={(e) => setEditingEmployee({ ...editingEmployee, position: e.target.value })}
              placeholder="Ex: Desenvolvedor, Designer..."
            />

            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                Departamento
              </label>
              <input
                type="text"
                value={editingEmployee.department}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                placeholder="Ex: TI, Marketing..."
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                Gestor
              </label>
              <select
                value={editingEmployee.manager_id}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, manager_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)]"
              >
                <option value="">Nenhum</option>
                {employees
                  .filter((e) => e.id !== editingEmployee.id && (e.role === "gestor" || e.role === "tenant_admin"))
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role === "tenant_admin" ? "Admin" : "Gestor"})</option>
                  ))}
              </select>
              <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                Apenas gestores e admins da empresa
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                Escala de Trabalho
              </label>
              <select
                value={editingEmployee.schedule_id}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, schedule_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)]"
              >
                <option value="">Padrão</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                Data de Admissão
              </label>
              <input
                type="date"
                value={editingEmployee.hire_date}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, hire_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)]"
              />
              <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                Define o início do período aquisitivo de férias
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Dias de Férias"
                type="number"
                value={editingEmployee.vacation_balance}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, vacation_balance: parseInt(e.target.value) || 0 })}
                min={0}
              />

              <Input
                label="Banco de Horas (min)"
                type="number"
                value={editingEmployee.hours_balance}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, hours_balance: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                Tipo de Acesso
              </label>
              <select
                value={editingEmployee.role}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as any })}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)]"
              >
                <option value="funcionario">Funcionário</option>
                <option value="gestor">Gestor</option>
                <option value="tenant_admin">Admin Empresa</option>
              </select>
            </div>

            {/* Tenant selector - show for master_admin and if admin has a tenant */}
            {(tenants.length > 0 || profile?.tenant_id) && (
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Empresa
                </label>
                <select
                  value={editingEmployee.tenant_id || profile?.tenant_id || ""}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, tenant_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)]"
                >
                  {tenants.length > 0 ? (
                    tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))
                  ) : (
                    <option value={profile?.tenant_id}>{currentTenantName || "Empresa atual"}</option>
                  )}
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
