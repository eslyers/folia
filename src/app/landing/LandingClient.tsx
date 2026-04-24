"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  ArrowRight,
  Zap,
  Users,
  Calendar,
  BarChart3,
  Bell,
  Cloud,
  Clock,
  Shield,
  TrendingUp,
  ChevronDown,
  Menu,
  X,
  Star,
  Building2,
  Headphones,
  Globe,
  CreditCard,
} from "lucide-react";

// Schema.org structured data
const schemaData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FOLIA",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Sistema completo de gestão de férias, ponto e RH para PME brasileiras.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
    description: "Grátis até 5 funcionários",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "127",
  },
};

const FEATURES = [
  {
    icon: Calendar,
    title: "Gestão de Férias",
    description:
      "Solicite, aprove e acompanhe férias com poucos cliques. Saldo atualizado automaticamente.",
  },
  {
    icon: Clock,
    title: "Controle de Ponto Automatizado",
    description:
      "Registros de entrada e saída com cálculo de horas extras e banco de horas automático.",
  },
  {
    icon: Users,
    title: "Hierarquia de Gestores",
    description:
      "Cada equipe com seu gestor. Aprovações fluem automaticamente para o responsável.",
  },
  {
    icon: BarChart3,
    title: "Relatórios em Tempo Real",
    description:
      "Dashboards com indicadores de presença, horas extras e absenteeísmo.",
  },
  {
    icon: Bell,
    title: "Notificações Automáticas",
    description:
      "E-mail e Slack/Teams a cada solicitação, aprovação ou vencimento de prazos.",
  },
  {
    icon: Cloud,
    title: "100% Online",
    description:
      "Acesse de qualquer lugar, em qualquer dispositivo. Nada para instalar.",
  },
];

const USE_CASES = [
  { label: "PME de 5 a 500 funcionários" },
  { label: "Departamentos de RH" },
  { label: "Gestores de equipe" },
  { label: "Empresas com múltiplas filiais" },
];

const RESOURCES = [
  "Banco de Horas automático",
  "Feriados brasileiros",
  "Aprovações em 1 clique",
  "Relatórios CSV/Excel",
  "Integração Slack/Teams",
  "Multi-empresa (SaaS)",
];

const TESTIMONIALS = [
  {
    quote:
      "Reduzimos 80% do tempo gasto em planilhas de férias. A equipe agora aprova pedidos em segundos.",
    author: "Marina Silva",
    role: "Gestora de RH",
    company: "TechFlow Brasil",
    avatar: "MS",
  },
  {
    quote:
      "O controle de ponto ficou simples e transparente. Nossos gestores adoraram.",
    author: "Ricardo Pereira",
    role: "Diretor de Operações",
    company: "Grupo Conecta",
    avatar: "RP",
  },
  {
    quote:
      "Migraremos 200 funcionários em uma semana. A experiência foi surpreendentemente tranquila.",
    author: "Carla Mendes",
    role: "Coordenadora de People",
    company: "Nexo Digital",
    avatar: "CM",
  },
];

const PLANS = [
  {
    name: "Grátis",
    price: "Grátis",
    period: "",
    description: "Para pequenos times começarem.",
    features: ["Até 5 funcionários", "Gestão de férias", "Controle de ponto básico", "Relatórios simples"],
    cta: "Começar Grátis",
    highlight: false,
  },
  {
    name: "Starter",
    price: "R$ 29",
    period: "/funcionário/mês",
    description: "Para empresas crescendo.",
    features: [
      "6 a 50 funcionários",
      "Banco de horas",
      "Escalas automáticas",
      "Relatórios avançados",
      "Suporte por email",
    ],
    cta: "Experimentar Grátis",
    highlight: false,
  },
  {
    name: "Business",
    price: "R$ 49",
    period: "/funcionário/mês",
    description: "O mais popular para PMEs.",
    features: [
      "51 a 500 funcionários",
      "Tudo do Starter",
      "Integração Slack/Teams",
      "Webhooks",
      "Múltiplos gestores",
      "Suporte prioritário",
    ],
    cta: "Começar Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para grandes organizações.",
    features: [
      "Mais de 500 funcionários",
      "Tudo do Business",
      "SLA garantido",
      "Gerente de conta dedicado",
      "Customizações sob demanda",
    ],
    cta: "Falar com Vendas",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "Como funciona o período gratuito?",
    a: "Você pode usar o FOLIA gratuitamente até 5 funcionários. Não pedimos cartão de crédito. Upgrade quando precisar.",
  },
  {
    q: "Posso migrar dados do meu sistema atual?",
    a: "Sim! Importamos planilhas Excel e podemos ajudar com migrações de sistemas como TOTVS, Senior, ContaAzul e outros.",
  },
  {
    q: "O sistema é seguro?",
    a: "Absolutamente. Todos os dados são criptografados em trânsito e em repouso. Estamos em conformidade com LGPD.",
  },
  {
    q: "Posso testar antes de comprar?",
    a: "Sim! Oferecemos 14 dias de teste gratuito em todos os planos pagos, sem compromisso.",
  },
  {
    q: "Vocês oferecem suporte em português?",
    a: "Sim, suporte completo em português brasileiro, por email e chat, de segunda a sexta das 9h às 18h.",
  },
  {
    q: "O sistema funciona em mobile?",
    a: "Sim, FOLIA é totalmente responsivo e funciona perfeitamente em smartphones e tablets.",
  },
];

export default function LandingClient() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Inject schema
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(schemaData);
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-md shadow-black/5"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="FOLIA" className="h-10 object-contain" />
            </div>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)]">
                Recursos
              </a>
              <a href="#pricing" className="text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)]">
                Preços
              </a>
              <a href="#testimonials" className="text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)]">
                Depoimentos
              </a>
              <a href="#faq" className="text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)]">
                FAQ
              </a>
            </div>

            {/* CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--color-brown-medium)] hover:text-[var(--color-brown-dark)] px-4 py-2"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-[var(--color-green-olive)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[var(--color-green-olive)]/90 transition-colors shadow-lg shadow-[var(--color-green-olive)]/20"
              >
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-[var(--color-brown-dark)]"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-[var(--border)] py-4 space-y-2 bg-white rounded-b-2xl shadow-lg">
              {["Recursos", "Preços", "Depoimentos", "FAQ"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="block px-4 py-3 text-sm font-medium text-[var(--color-brown-medium)] hover:bg-[var(--color-cream)] rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
              <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                <Link href="/login" className="block px-4 py-3 text-sm font-medium text-center text-[var(--color-brown-dark)]">
                  Login
                </Link>
                <Link
                  href="/login"
                  className="mx-4 inline-flex items-center justify-center gap-2 bg-[var(--color-green-olive)] text-white text-sm font-semibold px-5 py-3 rounded-xl"
                >
                  Começar Grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--color-gold)]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[var(--color-green-olive)]/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[var(--color-gold)]/10 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-4 w-4 text-[var(--color-gold)]" />
              <span className="text-sm font-medium text-[var(--color-gold)]">
                Novo: Integração com Slack e Microsoft Teams
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] leading-tight mb-6">
              Simplifique a Gestão de{" "}
              <span className="text-[var(--color-green-olive)]">Férias, Ponto e RH</span>{" "}
              da Sua Empresa
            </h1>

            <p className="text-lg sm:text-xl text-[var(--color-brown-medium)] mb-10 max-w-2xl mx-auto leading-relaxed">
              O sistema completo para PME brasileiras — sem complicações. Gestione férias, controle ponto e acompanhe indicadores em um único lugar.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-[var(--color-green-olive)] text-white text-base font-semibold px-8 py-4 rounded-2xl hover:bg-[var(--color-green-olive)]/90 transition-colors shadow-xl shadow-[var(--color-green-olive)]/20 w-full sm:w-auto justify-center"
              >
                Começar Grátis
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 text-[var(--color-brown-dark)] text-base font-medium px-8 py-4 rounded-2xl border-2 border-[var(--color-brown-dark)]/20 hover:border-[var(--color-brown-dark)]/40 transition-colors w-full sm:w-auto justify-center"
              >
                Ver Demo
              </a>
            </div>

            <p className="text-sm text-[var(--color-brown-medium)] mb-8">
              Grátis até 5 funcionários • Sem cartão de crédito
            </p>

            {/* Dashboard Preview */}
            <div className="relative mx-auto max-w-5xl">
              <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 border border-[var(--border)] overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-cream)] border-b border-[var(--border)]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white rounded-md px-4 py-1.5 text-xs text-[var(--color-brown-medium)] text-center max-w-md mx-auto border border-[var(--border)]">
                      folia.magnainc.tech/dashboard
                    </div>
                  </div>
                </div>
                {/* Dashboard screenshot placeholder */}
                <div className="bg-gradient-to-br from-[var(--color-cream)] to-white p-6 lg:p-10">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: "Férias Pendentes", value: "12", color: "amber" },
                      { label: "Horas Extras", value: "48h", color: "green" },
                      { label: "Funcionários", value: "47", color: "blue" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white rounded-xl p-4 border border-[var(--border)] shadow-sm">
                        <p className="text-xs text-[var(--color-brown-medium)] mb-1">{stat.label}</p>
                        <p className={`text-2xl font-bold ${
                          stat.color === "amber" ? "text-amber-600" :
                          stat.color === "green" ? "text-green-600" : "text-blue-600"
                        }`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Table preview */}
                  <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="flex gap-4 p-4 bg-[var(--color-cream)] text-xs font-semibold text-[var(--color-brown-medium)]">
                      <div className="w-8" />
                      <div className="flex-1">Funcionário</div>
                      <div className="w-20 text-center">Férias</div>
                      <div className="w-20 text-center">Banco</div>
                      <div className="w-20 text-center">Status</div>
                    </div>
                    {[
                      { name: "Ana Beatriz Costa", initials: "AB", days: "22", hours: "+8h", status: "Aprovado", statusColor: "green" },
                      { name: "Carlos Eduardo Lima", initials: "CE", days: "18", hours: "-4h", status: "Pendente", statusColor: "amber" },
                      { name: "Fernanda Oliveira", initials: "FO", days: "30", hours: "0h", status: "Aprovado", statusColor: "green" },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-[var(--border)] hover:bg-[var(--color-cream)]/50">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-[var(--color-gold)]">{row.initials}</span>
                        </div>
                        <div className="flex-1 text-sm font-medium text-[var(--color-brown-dark)]">{row.name}</div>
                        <div className="w-20 text-center text-sm text-[var(--color-brown-dark)]">{row.days} dias</div>
                        <div className="w-20 text-center text-sm text-[var(--color-brown-medium)]">{row.hours}</div>
                        <div className="w-20 text-center">
                          <span className={`inline-flex rounded-full text-xs font-medium px-2 py-0.5 ${
                            row.statusColor === "green" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                          }`}>{row.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problems section */}
      <section className="py-16 lg:py-24 bg-white border-y border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] mb-4">
              Chega de planilhas e controle manual
            </h2>
            <p className="text-lg text-[var(--color-brown-medium)] max-w-2xl mx-auto">
              Estes são os problemas que ouvimos todos os dias de empresas que ainda gerenciam RH no Excel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: "📊", title: "Planilhas desatualizadas", desc: "Férias expirando sem ninguém perceber, saldos inconsistentes entre abas." },
              { icon: "⏰", title: "Ponto manual com erros", desc: "Colaboradores batendo cartão errado, Horas extras calculadas na mão, falhas constantes." },
              { icon: "🏖️", title: "Férias sem controle", desc: "Pilha de pedidos pendentes, gestores sem visibilidade do time, conflitos de escala." },
            ].map((p) => (
              <div key={p.title} className="bg-[var(--color-cream)] rounded-2xl p-6 text-center">
                <div className="text-5xl mb-4">{p.icon}</div>
                <h3 className="text-lg font-bold text-[var(--color-brown-dark)] mb-2">{p.title}</h3>
                <p className="text-[var(--color-brown-medium)] text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-[var(--color-gold)] uppercase tracking-wider mb-3">
              Recursos Poderosos
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] mb-4">
              Tudo o que sua empresa precisa
            </h2>
            <p className="text-lg text-[var(--color-brown-medium)] max-w-2xl mx-auto">
              FOLIA foi construído especificamente para a realidade de PME brasileiras.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-[var(--border)] hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-green-olive)]/10 flex items-center justify-center mb-4">
                  <f.icon className="h-6 w-6 text-[var(--color-green-olive)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--color-brown-dark)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--color-brown-medium)] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>

          {/* Extras grid */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {RESOURCES.map((r) => (
              <div key={r} className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-[var(--border)] text-sm text-[var(--color-brown-dark)]">
                <Check className="h-4 w-4 text-[var(--color-green-olive)] flex-shrink-0" />
                {r}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-16 lg:py-24 bg-[var(--color-green-olive)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                Para quem é
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white font-[family-name:var(--font-playfair)] mb-6">
                Feito para empresas brasileiras que valorizam simplicidade
              </h2>
              <div className="space-y-4">
                {USE_CASES.map((uc) => (
                  <div key={uc.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-white text-lg">{uc.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Building2, label: "Multi-empresa", sub: "Cada filial com seu próprio controle" },
                { icon: Headphones, label: "Suporte em PT-BR", sub: "Pessoas reais, não bots" },
                { icon: Globe, label: "100% Web", sub: "Acesse de qualquer lugar" },
                { icon: Shield, label: "LGPD Ready", sub: "Seus dados protegidos" },
              ].map((item) => (
                <div key={item.label} className="bg-white/10 rounded-2xl p-5 backdrop-blur-sm">
                  <item.icon className="h-8 w-8 text-white mb-3" />
                  <p className="font-semibold text-white mb-1">{item.label}</p>
                  <p className="text-sm text-white/70">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-[var(--color-gold)] uppercase tracking-wider mb-3">
              Depoimentos
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Empresas que já simplificaram
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="bg-white rounded-2xl p-6 border border-[var(--border)] shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-4 w-4 fill-[var(--color-gold)] text-[var(--color-gold)]" />
                  ))}
                </div>
                <p className="text-[var(--color-brown-dark)] text-base leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-[var(--color-gold)]">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-brown-dark)]">{t.author}</p>
                    <p className="text-xs text-[var(--color-brown-medium)]">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 lg:py-24 bg-white border-y border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-[var(--color-gold)] uppercase tracking-wider mb-3">
              Preços Transparentes
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)] mb-4">
              Comece grátis, escale quando precisar
            </h2>
            <p className="text-lg text-[var(--color-brown-medium)]">
              Sem surpresas. Sem mensalidades escondidas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border-2 transition-all ${
                  plan.highlight
                    ? "border-[var(--color-green-olive)] bg-[var(--color-green-olive)]/5 shadow-xl"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                {plan.highlight && (
                  <div className="inline-flex items-center gap-1 bg-[var(--color-green-olive)] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    <TrendingUp className="h-3 w-3" /> Mais Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-[var(--color-brown-dark)] mb-1">{plan.name}</h3>
                <p className="text-sm text-[var(--color-brown-medium)] mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-[var(--color-brown-dark)]">{plan.price}</span>
                  {plan.period && <span className="text-sm text-[var(--color-brown-medium)] ml-1">{plan.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-brown-dark)]">
                      <Check className="h-4 w-4 text-[var(--color-green-olive)] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`block w-full text-center text-sm font-semibold px-5 py-3 rounded-xl transition-colors ${
                    plan.highlight
                      ? "bg-[var(--color-green-olive)] text-white hover:bg-[var(--color-green-olive)]/90"
                      : "bg-[var(--color-cream)] text-[var(--color-brown-dark)] hover:bg-[var(--color-cream)]/80"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-[var(--color-gold)] uppercase tracking-wider mb-3">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brown-dark)] font-[family-name:var(--font-playfair)]">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="font-medium text-[var(--color-brown-dark)]">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-[var(--color-brown-medium)] flex-shrink-0 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-[var(--color-brown-medium)] text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-[var(--color-green-olive)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white font-[family-name:var(--font-playfair)] mb-6">
            Comece grátis hoje mesmo
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Sem compromisso. Configure em 5 minutos. Seus funcionários vão adorar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-[var(--color-green-olive)] text-base font-bold px-8 py-4 rounded-2xl hover:bg-white/90 transition-colors shadow-xl w-full sm:w-auto justify-center"
            >
              Começar Grátis Agora
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="mailto:vendas@folia.com.br"
              className="inline-flex items-center gap-2 text-white text-base font-medium px-8 py-4 rounded-2xl border-2 border-white/40 hover:border-white/60 transition-colors w-full sm:w-auto justify-center"
            >
              Falar com Vendas
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-brown-dark)] text-white/70 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="FOLIA" className="h-10 object-contain" />
            </div>
            <p className="text-sm text-center">
              © {new Date().getFullYear()} FOLIA — Gestão de Férias, Ponto e RH para Empresas.
            </p>
            <div className="flex gap-4">
              <Link href="/login" className="text-sm hover:text-white transition-colors">Login</Link>
              <a href="mailto:suporte@folia.com.br" className="text-sm hover:text-white transition-colors">Suporte</a>
              <a href="#" className="text-sm hover:text-white transition-colors">Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}