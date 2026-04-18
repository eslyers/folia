"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { Leaf } from "lucide-react";
import { clsx } from "clsx";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      window.location.href = (profile as any)?.role === "admin" ? "/admin" : "/dashboard";
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--cream)] p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--green-olive)] mb-4">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[var(--brown-dark)] font-[family-name:var(--font-playfair)]">
            FOLIA
          </h1>
          <p className="text-[var(--brown-medium)] mt-2">
            Sistema de Controle de Férias e Folgas
          </p>
        </div>

        <Card className="p-8">
          {/* Mode Toggle */}
          <div className="flex mb-6 bg-[var(--cream)] rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={clsx(
                "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200",
                mode === "login"
                  ? "bg-white text-[var(--brown-dark)] shadow-sm"
                  : "text-[var(--brown-medium)] hover:text-[var(--brown-dark)]"
              )}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={clsx(
                "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200",
                mode === "signup"
                  ? "bg-white text-[var(--brown-dark)] shadow-sm"
                  : "text-[var(--brown-medium)] hover:text-[var(--brown-dark)]"
              )}
            >
              Criar conta
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <h2 className="text-xl font-semibold text-[var(--brown-dark)] text-center mb-6">
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
                <span
                  className="text-sm text-[var(--gold)] transition-folia cursor-default"
                >
                  Esqueci minha senha
                </span>
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
          ) : (
            <form onSubmit={handleSignup} className="space-y-5">
              <h2 className="text-xl font-semibold text-[var(--brown-dark)] text-center mb-6">
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

              <p className="text-xs text-[var(--brown-medium)] -mt-2">
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
        </Card>

        <p className="text-center text-sm text-[var(--brown-medium)] mt-6">
          Precisa de ajuda?{" "}
          <span className="text-[var(--gold)] cursor-default">
            Entre em contato
          </span>
        </p>
      </div>
    </div>
  );
}