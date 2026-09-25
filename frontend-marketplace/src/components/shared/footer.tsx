import * as React from 'react';
import Link from 'next/link';
import type { FooterProps, FooterSection } from '@/types/navigation';

const defaultFooterSections: FooterSection[] = [
  {
    title: 'Trabajadores & Proveedores',
    links: [
      { label: 'Bolsa de trabajos', href: '/#trabajos' },
      { label: 'Billetera y retiros', href: '/perfil#billetera' },
      { label: 'Garantía de pago (Escrow)', href: '/garantias' },
      { label: 'Validación de identidad', href: '/verificacion' },
    ],
  },
  {
    title: 'Clientes & Compradores',
    links: [
      { label: 'Publicar solicitud', href: '/publicar' },
      { label: 'Catálogo de artículos', href: '/#marketplace' },
      { label: 'Seguimiento de envíos', href: '/tracking' },
      { label: 'Soporte y mediación', href: '/soporte' },
    ],
  },
  {
    title: 'Plataforma',
    links: [
      { label: 'Términos y condiciones', href: '/terminos' },
      { label: 'Política de privacidad', href: '/privacidad' },
      { label: 'Seguridad y confianza', href: '/seguridad' },
    ],
  },
];

export function Footer({ sections = defaultFooterSections }: FooterProps) {
  return (
    <footer className="border-t border-border-base bg-surface-main text-content-main mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-light border border-brand/25 flex items-center justify-center text-brand-hover font-extrabold text-xs">
                A1
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-content-main">Allin1</h3>
            </div>
            <p className="text-sm text-content-muted leading-relaxed max-w-sm">
              Ecosistema centralizado de conexión oferta y demanda en tiempo real con
              transaccionalidad integrada y pagos protegidos.
            </p>
          </div>

          {/* Columnas de Navegación */}
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-main">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-content-muted hover:text-brand transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Barra Inferior */}
      <div className="border-t border-border-base bg-surface-base py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-content-muted">
          <span>© 2026 Allin1 Marketplace. Todos los derechos reservados.</span>
          <span>Conectando oferta y demanda en tiempo real</span>
        </div>
      </div>
    </footer>
  );
}
