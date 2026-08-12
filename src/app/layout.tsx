import type { Metadata } from "next";
import { ReportLayoutClientProviders } from "@/components/report/ReportLayoutClientProviders";
import { ReportPerfRoot } from "@/components/report/ReportPerfRoot";
import "./globals.css";

/**
 * Fuentes vía CSS runtime (globals.css) — evita fallo de build Vercel cuando
 * next/font/google no puede bajar Merriweather/Source Sans desde gstatic.
 */

export const metadata: Metadata = {
  title: "RIMEC · Informe operativo",
  description:
    "Informe ejecutivo — ventas, stock y reposición. Demostración con estándar visual de documento institucional.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-report-paper font-sans text-report-ink antialiased">
        <ReportLayoutClientProviders>{children}</ReportLayoutClientProviders>
        <ReportPerfRoot />
      </body>
    </html>
  );
}
