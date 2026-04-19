"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Edit2, Trash2, Calendar, Save, X, Loader2, Clock, Download } from "lucide-react";

import { Card, Button, Input } from "@/components/ui";
import { Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { format, differenceInYears, differenceInMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmployeeForm {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: "admin" | "employee";
  department: string;
  position: string;
  hire_date: string;
  vacation_balance: number;
  hours_balance: number;
  manager_id: string;
  schedule_id: string;
}

export default function EmployeesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      if (!adminProfile || adminProfile.role !== "admin") {
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }

      setProfile(adminProfile);

      const { data: allEmployees } = await supabase
        .from("profiles")
        .select("*, manager:profiles!manager_id(id, name), schedule:work_schedules(id, name)")
        .order("name");

      setEmployees(allEmployees || []);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openNewModal = () => {
    setEditingEmployee({
      name: "",
      email: "",
      password: "",
      role: "employee",
      department: "",
      position: "",
      hire_date: format(new Date(), "yyyy-MM-dd"),
      vacation_balance: 30,
      hours_balance: 0,
      manager_id: "",
      schedule_id: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (emp: any) => {
    setEditingEmployee({
      id: emp.id,
      name: emp.name || "",
      email: emp.email || "",
      role: emp.role || "employee",
      department: emp.department || "",
      position: emp.position || "",
      hire_date: emp.hire_date || format(new Date(), "yyyy-MM-dd"),
      vacation_balance: emp.vacation_balance ?? 30,
      hours_balance: emp.hours_balance ?? 0,
      manager_id: emp.manager_id || "",
      schedule_id: emp.schedule_id || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingEmployee) return;

    if (!editingEmployee.name.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    setSaving(true);

    try {
      if (editingEmployee.id) {
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
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
          alert("Email é obrigatório");
          setSaving(false);
          return;
        }
        if (!editingEmployee.password || editingEmployee.password.length < 6) {
          alert("Senha deve ter pelo menos 6 caracteres");
          setSaving(false);
          return;
        }

        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
      }

      await fetchData();
      setModalOpen(false);
    } catch (err: any) {
      console.error("Error saving:", err);
      alert("Erro ao salvar: " + err.message);
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
      alert("Erro ao excluir: " + err.message);
    }

    setDeleting(null);
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
      

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Funcionários 👥
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Cadastro e gestão de equipe
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.open("/api/reports/employees", "_blank")}>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Nome</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Cargo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Área</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Gestor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Escala</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Admissão</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Tempo</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Férias</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-[var(--color-brown-medium)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const stats = getVacationStats(emp);
                    const vacationStatus = getVacationStatus(emp);

                    return (
                      <tr key={emp.id} className="border-b border-[var(--border)] hover:bg-[var(--color-cream)]">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-[var(--color-brown-dark)]">{emp.name}</p>
                            <p className="text-xs text-[var(--color-brown-medium)]">{emp.email}</p>
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
                  value={editingEmployee.email}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  placeholder="email@empresa.com"
                />

                <Input
                  label="Senha *"
                  type="password"
                  value={editingEmployee.password || ""}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
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
                  .filter((e) => e.id !== editingEmployee.id)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
              </select>
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
                onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as "admin" | "employee" })}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--color-brown-dark)]"
              >
                <option value="employee">Funcionário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

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
