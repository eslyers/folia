"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Clock, Edit2, Trash2, Users, Save, X, Loader2, Check } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, Button, Input, Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface WorkSchedule {
  id: string;
  name: string;
  daily_hours: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  tolerance_minutes: number;
  start_work: string;
  end_work: string;
  lunch_duration_minutes: number;
  is_active: boolean;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  schedule_id?: string | null;
}

interface ScheduleForm {
  id?: string;
  name: string;
  daily_hours: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  tolerance_minutes: number;
  start_work: string;
  end_work: string;
  lunch_duration_minutes: number;
}

const DAYS = [
  { key: "monday" as const, label: "Seg" },
  { key: "tuesday" as const, label: "Ter" },
  { key: "wednesday" as const, label: "Qua" },
  { key: "thursday" as const, label: "Qui" },
  { key: "friday" as const, label: "Sex" },
  { key: "saturday" as const, label: "Sáb" },
  { key: "sunday" as const, label: "Dom" },
];

export default function SchedulesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleForm | null>(null);
  const [assigningSchedule, setAssigningSchedule] = useState<WorkSchedule | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

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

      // Fetch schedules
      const { data: schedulesData } = await supabase
        .from("work_schedules")
        .select("*")
        .order("name");

      setSchedules(schedulesData || []);

      // Fetch employees
      const { data: employeesData } = await supabase
        .from("profiles")
        .select("id, name, email, schedule_id")
        .order("name");

      setEmployees(employeesData || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openNewModal = () => {
    setEditingSchedule({
      name: "",
      daily_hours: 8,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      tolerance_minutes: 5,
      start_work: "09:00",
      end_work: "18:00",
      lunch_duration_minutes: 60,
    });
    setModalOpen(true);
  };

  const openEditModal = (schedule: WorkSchedule) => {
    setEditingSchedule({
      id: schedule.id,
      name: schedule.name,
      daily_hours: schedule.daily_hours,
      monday: schedule.monday,
      tuesday: schedule.tuesday,
      wednesday: schedule.wednesday,
      thursday: schedule.thursday,
      friday: schedule.friday,
      saturday: schedule.saturday,
      sunday: schedule.sunday,
      tolerance_minutes: schedule.tolerance_minutes,
      start_work: schedule.start_work || "09:00",
      end_work: schedule.end_work || "18:00",
      lunch_duration_minutes: schedule.lunch_duration_minutes || 60,
    });
    setModalOpen(true);
  };

  const openAssignModal = (schedule: WorkSchedule) => {
    setAssigningSchedule(schedule);
    setSelectedUserIds(employees.filter((e) => e.schedule_id === schedule.id).map((e) => e.id));
    setAssignModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingSchedule) return;
    if (!editingSchedule.name.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    setSaving(true);

    try {
      if (editingSchedule.id) {
        const response = await fetch(`/api/point/schedules/${editingSchedule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingSchedule),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
      } else {
        const response = await fetch("/api/point/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingSchedule),
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
    if (!confirm("Tem certeza que deseja excluir esta escala?")) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/point/schedules/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      await fetchData();
    } catch (err: any) {
      console.error("Error deleting:", err);
      alert("Erro ao excluir: " + err.message);
    }

    setSaving(false);
  };

  const handleAssign = async () => {
    if (!assigningSchedule) return;

    setAssigning(true);

    try {
      const response = await fetch(`/api/point/schedules/${assigningSchedule.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedUserIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      await fetchData();
      setAssignModalOpen(false);
    } catch (err: any) {
      console.error("Error assigning:", err);
      alert("Erro ao atribuir: " + err.message);
    }

    setAssigning(false);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const getAssignedCount = (scheduleId: string) => {
    return employees.filter((e) => e.schedule_id === scheduleId).length;
  };

  const getWorkDays = (schedule: WorkSchedule) => {
    const days = DAYS.filter((d) => schedule[d.key]).map((d) => d.label);
    return days.length > 0 ? days.join(", ") : "Nenhum";
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
      <Header profile={profile!} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Escalas de Trabalho 📅
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Cadastro e gestão de horários de trabalho
            </p>
          </div>
          <Button onClick={openNewModal}>
            <Plus className="h-5 w-5 mr-2" />
            Nova Escala
          </Button>
        </div>

        {/* Schedules Grid */}
        {schedules.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-[var(--color-brown-medium)] opacity-50" />
            <p className="text-[var(--color-brown-medium)]">Nenhuma escala cadastrada</p>
            <Button className="mt-4" onClick={openNewModal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Escala
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-brown-dark)]">{schedule.name}</h3>
                    <p className="text-sm text-[var(--color-brown-medium)] mt-1">
                      <Users className="h-3 w-3 inline mr-1" />
                      {getAssignedCount(schedule.id)} funcionário{getAssignedCount(schedule.id) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openAssignModal(schedule)}
                      className="p-2 rounded-lg hover:bg-[var(--color-cream)] transition-colors"
                      title="Atribuir funcionários"
                    >
                      <Users className="h-4 w-4 text-[var(--color-brown-medium)]" />
                    </button>
                    <button
                      onClick={() => openEditModal(schedule)}
                      className="p-2 rounded-lg hover:bg-[var(--color-cream)] transition-colors"
                    >
                      <Edit2 className="h-4 w-4 text-[var(--color-brown-medium)]" />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Daily hours */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-cream)] mb-3">
                  <Clock className="h-5 w-5 text-[var(--color-brown-medium)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-brown-dark)]">{schedule.daily_hours.toFixed(2)}h dia</p>
                    <p className="text-xs text-[var(--color-brown-medium)]">{schedule.start_work} - {schedule.end_work}</p>
                  </div>
                </div>

                {/* Work days */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {DAYS.map(({ key, label }) => (
                    <span
                      key={key}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        schedule[key]
                          ? "bg-[var(--color-green-olive)]/10 text-[var(--color-green-olive)]"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-brown-medium)]">
                    Almoço: {schedule.lunch_duration_minutes}min · Tolerância: {schedule.tolerance_minutes}min
                  </span>
                  {schedule.is_active ? (
                    <span className="text-xs text-[var(--color-green-olive)] font-medium">Ativa</span>
                  ) : (
                    <span className="text-xs text-gray-400">Inativa</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSchedule?.id ? "Editar Escala" : "Nova Escala"}
        size="md"
      >
        {editingSchedule && (
          <div className="space-y-4">
            <Input
              label="Nome da Escala *"
              value={editingSchedule.name}
              onChange={(e) => setEditingSchedule({ ...editingSchedule, name: e.target.value })}
              placeholder="Ex: 8h Padrão CLT, Escala 6x1, Flex 7h..."
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Horas por dia"
                type="number"
                step={0.5}
                min={0}
                max={24}
                value={editingSchedule.daily_hours}
                onChange={(e) =>
                  setEditingSchedule({ ...editingSchedule, daily_hours: parseFloat(e.target.value) || 0 })
                }
                helperText="Ex: 8.00, 7.00, 6.50"
              />

              <Input
                label="Tolerância (min)"
                type="number"
                min={0}
                value={editingSchedule.tolerance_minutes}
                onChange={(e) =>
                  setEditingSchedule({ ...editingSchedule, tolerance_minutes: parseInt(e.target.value) || 0 })
                }
                helperText="Minutos de tolerância"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Início do trabalho"
                type="time"
                value={editingSchedule.start_work}
                onChange={(e) =>
                  setEditingSchedule({ ...editingSchedule, start_work: e.target.value })
                }
              />

              <Input
                label="Fim do trabalho"
                type="time"
                value={editingSchedule.end_work}
                onChange={(e) =>
                  setEditingSchedule({ ...editingSchedule, end_work: e.target.value })
                }
              />
            </div>

            <Input
              label="Duração do almoço (minutos)"
              type="number"
              min={0}
              value={editingSchedule.lunch_duration_minutes}
              onChange={(e) =>
                setEditingSchedule({ ...editingSchedule, lunch_duration_minutes: parseInt(e.target.value) || 0 })
              }
            />

            <div>
              <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-3">
                Dias de Trabalho
              </label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                      editingSchedule[key]
                        ? "border-[var(--color-green-olive)] bg-[var(--color-green-olive)]/5"
                        : "border-[var(--border)] hover:bg-[var(--color-cream)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editingSchedule[key]}
                      onChange={(e) =>
                        setEditingSchedule({ ...editingSchedule, [key]: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-[var(--color-green-olive)] focus:ring-[var(--color-green-olive)]"
                    />
                    <span className="text-sm font-medium text-[var(--color-brown-dark)]">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Employees Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={`Atribuir: ${assigningSchedule?.name}`}
        size="md"
      >
        <div>
          <p className="text-sm text-[var(--color-brown-medium)] mb-4">
            Selecione os funcionários que usarão esta escala:
          </p>

          <div className="max-h-80 overflow-y-auto space-y-2 mb-4">
            {employees.map((emp) => (
              <label
                key={emp.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedUserIds.includes(emp.id)
                    ? "border-[var(--color-green-olive)] bg-[var(--color-green-olive)]/5"
                    : "border-[var(--border)] hover:bg-[var(--color-cream)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(emp.id)}
                  onChange={() => toggleUser(emp.id)}
                  className="h-4 w-4 rounded border-gray-300 text-[var(--color-green-olive)] focus:ring-[var(--color-green-olive)]"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-brown-dark)]">{emp.name}</p>
                  <p className="text-xs text-[var(--color-brown-medium)]">{emp.email}</p>
                </div>
                {selectedUserIds.includes(emp.id) && (
                  <Check className="h-4 w-4 text-[var(--color-green-olive)]" />
                )}
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setAssignModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={assigning} className="flex-1">
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Atribuir ({selectedUserIds.length})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
