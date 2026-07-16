import type { Metadata } from "next";
import { Merriweather, Source_Sans_3 } from "next/font/google";
import { ReportLayoutClientProviders } from "@/components/report/ReportLayoutClientProviders";
import { ReportPerfRoot } from "@/components/report/ReportPerfRoot";
import "./globals.css";

const reportSerif = Merriweather({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-report-serif",
});

const reportSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-report-sans",
});

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
      <body
        className={`${reportSerif.variable} ${reportSans.variable} min-h-screen bg-report-paper font-sans text-report-ink antialiased`}
      >
        <ReportLayoutClientProviders>{children}</ReportLayoutClientProviders>
        <ReportPerfRoot />
      </body>
    </html>
  );
}
