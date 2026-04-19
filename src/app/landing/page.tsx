import { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "FOLIA - Sistema de Gestão de Férias, Ponto e RH para Empresas",
  description:
    "O sistema completo para PME brasileiras. Gestão de férias, controle de ponto e RH simplificado. Comece grátis hoje mesmo!",
  keywords: [
    "gestão de férias",
    "controle de ponto",
    "sistema RH",
    "folha de pagamento",
    "gestão de equipes",
    "PME",
    "recursos humanos",
    "banco de horas",
    "escala de trabalho",
    "feriados brasileiros",
  ],
  authors: [{ name: "FOLIA" }],
  openGraph: {
    title: "FOLIA - Gestão de Férias, Ponto e RH para Empresas",
    description:
      "Simplifique a gestão de férias, ponto e RH da sua empresa. Sistema completo para PME brasileiras.",
    type: "website",
    locale: "pt_BR",
    siteName: "FOLIA",
  },
  twitter: {
    card: "summary_large_image",
    title: "FOLIA - Gestão de Férias, Ponto e RH para Empresas",
    description: "Simplifique a gestão de férias, ponto e RH da sua empresa.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingPage() {
  return <LandingClient />;
}