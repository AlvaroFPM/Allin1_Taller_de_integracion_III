import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Allin1 - Marketplace Integral & Servicios en Tiempo Real",
  description: "Ecosistema centralizado de conexión de oferta y demanda en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-surface-base text-content-main">
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}