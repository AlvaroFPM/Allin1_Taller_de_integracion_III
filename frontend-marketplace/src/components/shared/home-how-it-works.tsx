import * as React from 'react';
import type { StepItem } from '@/types/home';

const defaultSteps: StepItem[] = [
  {
    number: '01',
    title: 'Publica en 1 minuto',
    tag: 'Rápido y Gratis',
    icon: '📝',
    description:
      'Describe lo que necesitas (un flete, una reparación técnica o un artículo), tu comuna y fija tu presupuesto estimado sin costo alguno.',
  },
  {
    number: '02',
    title: 'Compara y coordina',
    tag: 'Perfiles Verificados',
    icon: '💬',
    description:
      'Recibe propuestas de personas y técnicos calificados en tiempo real, revisa sus estrellas de reputación y chatea directamente.',
  },
  {
    number: '03',
    title: 'Pago Seguro en Custodia',
    tag: 'Garantía Escrow',
    icon: '🛡️',
    description:
      'Paga con total tranquilidad: tu dinero queda protegido en custodia Escrow y solo se libera al proveedor cuando confirmes tu conformidad.',
  },
];

export function HomeHowItWorks({ steps = defaultSteps }: { steps?: StepItem[] }) {
  return (
    <section className="space-y-8">
      {/* Cabecera de la sección */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-content-main">
          ¿Cómo funciona Allin1?
        </h2>
        <p className="text-xs sm:text-base text-content-muted">
          Conectamos oferta y demanda en tres pasos simples, transparentes y 100% protegidos.
        </p>
      </div>

      {/* Cuadrícula de 3 pasos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step) => (
          <div
            key={step.number}
            className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-surface-main border border-border-base transition-all duration-200 hover:border-brand/50 hover:shadow-lg hover:-translate-y-1"
          >
            <div>
              {/* Fila Superior: Número y Tag */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-2xl font-black text-brand tracking-tight">{step.number}</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-light text-brand-hover border border-brand/20">
                  {step.tag}
                </span>
              </div>

              {/* Icono en contenedor */}
              <div className="w-12 h-12 rounded-xl bg-surface-base border border-border-base/80 flex items-center justify-center text-xl mb-4 group-hover:scale-110 group-hover:border-brand transition-transform">
                {step.icon}
              </div>

              {/* Título del paso */}
              <h3 className="text-base font-bold text-content-main group-hover:text-brand transition-colors">
                {step.title}
              </h3>

              {/* Descripción */}
              <p className="mt-2 text-xs sm:text-sm text-content-muted leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Micro-borde inferior decorativo */}
            <div className="mt-5 pt-3 border-t border-border-base/60 flex items-center gap-1.5 text-[11px] font-semibold text-brand">
              <span>Paso {step.number}</span>
              <span>→</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
