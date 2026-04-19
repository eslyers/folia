"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, Camera, Lock, Save, Loader2, AlertCircle, Phone, UserCircle } from "lucide-react";
import { Card, Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { getRoleLabel } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      try {

        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setTimeout(() => router.push("/login"), 1500);
          return;
        }

        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error) {
          setLoading(false);
          return;
        }

        const profile = profileData as Profile;
        setProfile(profile);
        setName(profile.name || "");
        setAvatarUrl(profile.avatar_url || null);
        setDepartment((profile as any).department || "");
        setPosition((profile as any).position || "");
        setPhone((profile as any).phone || "");
        setEmergencyContact((profile as any).emergency_contact || "");
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [router, supabase]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setSaving(true);
    setMessage(null);

    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        
        // Update profile with base64 avatar
        const { error: updateError } = await (supabase as any)
          .from("profiles")
          .update({ avatar_url: dataUrl })
          .eq("id", profile.id);

        if (updateError) {
          setMessage({ type: "error", text: "Erro ao salvar: " + updateError.message });
        } else {
          setAvatarUrl(dataUrl);
          setProfile({ ...profile, avatar_url: dataUrl });
          setMessage({ type: "success", text: "Foto atualizada com sucesso!" });
        }
        setSaving(false);
      };
      reader.onerror = () => {
        setMessage({ type: "error", text: "Erro ao ler arquivo" });
        setSaving(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setMessage({ type: "error", text: "Erro: " + err.message });
      setSaving(false);
    }
  };

  const handleNameSave = async () => {
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", profile.id);

      if (error) {
        setMessage({ type: "error", text: "Erro: " + error.message });
      } else {
        setProfile({ ...profile, name: name.trim() });
        setMessage({ type: "success", text: "Nome atualizado!" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Erro: " + err.message });
    }

    setSaving(false);
  };

  const handleProfileSave = async () => {
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          department: department.trim() || null,
          position: position.trim() || null,
          phone: phone.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
        })
        .eq("id", profile.id);

      if (error) {
        setMessage({ type: "error", text: "Erro: " + error.message });
      } else {
        setProfile({ ...profile, department: department.trim() || null, position: position.trim() || null });
        setMessage({ type: "success", text: "Dados atualizados!" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Erro: " + err.message });
    }

    setSaving(false);
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Preencha todos os campos" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Senhas não conferem" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Nova senha precisa de pelo menos 6 caracteres" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setMessage({ type: "error", text: "Erro: " + error.message });
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setMessage({ type: "success", text: "Senha alterada com sucesso!" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Erro: " + err.message });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cream)" }}>
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

  if (!profile) {
    return null;
  }

  return (
        <div className="min-h-screen bg-[var(--background)]">

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 animate-fade-in-up">
            <h1 className="text-3xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Meu Perfil 👤
            </h1>
            <p className="text-[var(--color-brown-medium)] mt-1">
              Visualize e edite suas informações pessoais
            </p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
              {message.type === "success" ? <Save className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {/* Avatar */}
          <Card className="p-6 mb-6 animate-fade-in-up">
            <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Foto de Perfil
            </h2>

            <div className="flex items-center gap-6">
              {/* Avatar preview */}
              <div 
                className="relative w-24 h-24 rounded-full overflow-hidden bg-[var(--color-gold)]/20 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-12 w-12 text-[var(--color-gold)]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-8 w-8 text-white" />
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm text-[var(--color-brown-medium)] mb-2">
                  Clique na foto para trocar
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <Button 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                  Trocar Foto
                </Button>
              </div>
            </div>
          </Card>

          {/* Profile Info */}
          <Card className="p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </h2>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Nome Completo
                </label>
                <div className="flex gap-3">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="flex-1"
                  />
                  <Button onClick={handleNameSave} disabled={saving || !name.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Email (readonly) */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-medium)] mb-1.5">
                  E-mail
                </label>
                <p className="text-[var(--color-brown-dark)] bg-[var(--color-cream)] px-4 py-2.5 rounded-lg">
                  {profile.email}
                </p>
                <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                  O e-mail não pode ser alterado
                </p>
              </div>

              {/* Role (readonly) */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-medium)] mb-1.5">
                  Tipo de Acesso
                </label>
                <p className="text-[var(--color-brown-dark)] bg-[var(--color-cream)] px-4 py-2.5 rounded-lg capitalize">
                  {getRoleLabel(profile.role)}
                </p>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Departamento
                </label>
                <div className="flex gap-3">
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ex: TI, Marketing, Vendas"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Cargo
                </label>
                <div className="flex gap-3">
                  <Input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Ex: Desenvolvedor, Designer..."
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Telefone
                </label>
                <div className="flex gap-3">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Contato de Emergência
                </label>
                <div className="flex gap-3">
                  <Input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Ex: Maria - (11) 98888-8888"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Hire Date (readonly) */}
              {(profile as any).hire_date && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brown-medium)] mb-1.5">
                    Data de Admissão
                  </label>
                  <p className="text-[var(--color-brown-dark)] bg-[var(--color-cream)] px-4 py-2.5 rounded-lg">
                    {new Date((profile as any).hire_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-[var(--color-brown-medium)] mt-1">
                    A data de admissão é definida pelo administrador
                  </p>
                </div>
              )}

              {/* Save button */}
              <Button onClick={handleProfileSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Dados Adicionais
              </Button>
            </div>
          </Card>

          {/* Password */}
          <Card className="p-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <h2 className="text-lg font-semibold text-[var(--color-brown-dark)] mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Nova Senha
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Confirmar Nova Senha
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>

              <Button 
                onClick={handlePasswordChange} 
                disabled={saving || !newPassword || !confirmPassword}
                className="w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Alterar Senha
              </Button>
            </div>
          </Card>

          {/* Info */}
          <div className="mt-6 text-center text-sm text-[var(--color-brown-medium)]">
            <p>Precisa de ajuda? Entre em contato com o administrador.</p>
          </div>
        </main>
      </div>
  );
}
