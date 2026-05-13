"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { Leaf } from "lucide-react";
import { clsx } from "clsx";

type Mode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
    const password = (e.currentTarget.elements.namedItem("password") as HTMLInputElement).value;

    const supabase = createSupabaseClient();

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Wait a moment for session to fully persist
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        setError("Erro ao buscar perfil: " + profileError.message);
        setLoading(false);
        return;
      }

      // Full page redirect
      // Redirect based on role
      const userRole = (profile as any)?.role;
      const isAdmin = userRole === 'master_admin' || userRole === 'tenant_admin';
      window.location.href = isAdmin ? "/admin" : "/dashboard";
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const supabase = createSupabaseClient();

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Wait for session
      await new Promise(resolve => setTimeout(resolve, 500));

      // Full page redirect
      window.location.href = "/dashboard";
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
    const supabase = createSupabaseClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccessMessage("Email de recuperação enviado! Verifique sua caixa de entrada.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--cream)] p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="FOLIA" className="h-16 mx-auto mb-4 object-contain" />
          <p className="text-[var(--brown-medium)] mt-2">
            Sistema de Controle de Férias e Folgas
          </p>
        </div>

        <Card className="p-8">
          {/* Mode Toggle */}
          {mode !== "forgot" && (
            <div className="flex mb-6 bg-[var(--cream)] rounded-lg p-1 border border-[var(--border)]">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}
                className={clsx(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  mode === "login"
                    ? "bg-[var(--color-surface)] text-[var(--color-brown-dark)] shadow-sm font-semibold"
                    : "text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)]"
                )}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); setSuccessMessage(""); }}
                className={clsx(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  mode === "signup"
                    ? "bg-[var(--color-surface)] text-[var(--color-brown-dark)] shadow-sm font-semibold"
                    : "text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)]"
                )}
              >
                Criar conta
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              {successMessage}
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] text-center mb-6">
                Entrar na sua conta
              </h2>

              <Input
                label="Email"
                type="email"
                name="email"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />

              <Input
                label="Senha"
                type="password"
                name="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setSuccessMessage(""); }}
                  className="text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-vivid)] transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
              >
                Entrar
              </Button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-5">
              <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] text-center mb-6">
                Criar sua conta
              </h2>

              <Input
                label="Nome completo"
                type="text"
                name="name"
                placeholder="Seu nome"
                required
                autoComplete="name"
              />

              <Input
                label="Email"
                type="email"
                name="email"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />

              <Input
                label="Senha"
                type="password"
                name="password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />

              <p className="text-xs text-[var(--color-brown-medium)] -mt-2">
                Mínimo de 6 caracteres. O primeiro usuário cadastrado se torna administrador.
              </p>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
              >
                Criar conta
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] text-center mb-6">
                Recuperar senha
              </h2>

              <p className="text-sm text-[var(--color-brown-medium)] text-center -mt-2">
                Informe seu email para receber um link de recuperação.
              </p>

              <Input
                label="Email"
                type="email"
                name="email"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
              >
                Enviar link de recuperação
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}
                  className="text-sm font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-vivid)] transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          )}
        </Card>

        <p className="text-center text-sm text-[var(--color-brown-medium)] mt-6">
          Precisa de ajuda?{" "}
          <span className="text-[var(--color-gold)] cursor-default">
            Entre em contato
          </span>
        </p>
      </div>
    </div>
  );
}