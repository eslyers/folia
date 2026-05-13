"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      subject: formData.get("subject"),
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        e.currentTarget.reset();
      } else {
        setError(result.error || "Erro ao enviar mensagem.");
      }
    } catch (err) {
      setError("Erro de rede ao enviar mensagem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--cream)] p-4">
      <div className="w-full max-w-lg animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="FOLIA" className="h-16 mx-auto mb-4 object-contain" />
          <p className="text-[var(--color-brown-medium)] mt-2 font-medium">
            Sistema de Controle de Férias e Folgas
          </p>
        </div>

        <Card className="p-8">
          <div className="flex items-center mb-6">
            <Link 
              href="/login" 
              className="text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] transition-colors p-2 -ml-2 rounded-full hover:bg-[var(--color-surface)] cursor-pointer"
            >
              <ArrowLeft size={20} />
            </Link>
            <h2 className="text-xl font-semibold text-[var(--color-brown-dark)] flex-1 text-center pr-8">
              Entre em contato
            </h2>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h3 className="text-lg font-medium text-[var(--color-brown-dark)] mb-2">
                Mensagem enviada!
              </h3>
              <p className="text-[var(--color-brown-medium)] mb-6">
                Recebemos o seu contato e retornaremos o mais breve possível para o e-mail informado.
              </p>
              <Button 
                variant="primary" 
                onClick={() => setSuccess(false)}
                className="w-full"
              >
                Enviar nova mensagem
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5">
                <Input
                  label="Nome completo"
                  type="text"
                  name="name"
                  placeholder="Seu nome"
                  required
                />

                <Input
                  label="E-mail"
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <Input
                label="Assunto"
                type="text"
                name="subject"
                placeholder="Ex: Dúvida sobre o plano"
                required
              />

              <div className="flex flex-col">
                <label className="text-sm font-medium text-[var(--color-brown-dark)] mb-1.5">
                  Mensagem
                </label>
                <textarea
                  name="message"
                  required
                  rows={4}
                  placeholder="Como podemos te ajudar?"
                  className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] transition-all resize-y"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full flex items-center justify-center gap-2"
                loading={loading}
              >
                <Send size={18} />
                <span>Enviar mensagem</span>
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
