import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { Navbar, Footer } from '@/components/shared';
import { ToastContainer } from '@/components/ui';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Allin1 - Marketplace Integral & Servicios en Tiempo Real',
  description:
    'Ecosistema centralizado de conexión de oferta y demanda en tiempo real con pagos protegidos y verificación de identidad.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-surface-base text-content-main">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <ToastContainer />
      </body>
    </html>
  );
}
