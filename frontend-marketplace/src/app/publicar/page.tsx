'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PublicationTypeSelector,
  PublicationLivePreview,
  CreatePublicationForm,
} from '@/components/shared';
import type { CreatePublicationFormState } from '@/types/publication';

export default function PublicarPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [formState, setFormState] = React.useState<CreatePublicationFormState>({
    tipo: 'TRABAJO',
    titulo: '',
    categoriaId: '',
    descripcion: '',
    ubicacion: 'Providencia',
    moneda: 'CLP',
    precioBase: '',
  });

  const handleChange = (fields: Partial<CreatePublicationFormState>) => {
    setFormState((prev) => ({ ...prev, ...fields }));
  };

  const handleSubmit = async () => {
    if (!formState.titulo.trim()) {
      alert('Por favor ingresa un título para tu publicación.');
      return;
    }
    if (!formState.categoriaId) {
      alert('Por favor selecciona una categoría.');
      return;
    }

    setIsSubmitting(true);
    // Simulación de envío antes de integración con microservicio de Catalog
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    alert('¡Publicación maquetada con éxito! Redirigiendo...');
    router.push('/');
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Navegación superior hacia atrás */}
      <div className="w-full text-left">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-muted hover:text-brand transition-colors select-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>Volver al inicio</span>
        </Link>
      </div>

      {/* Encabezado: Título y Subtítulo */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-content-main">
          Nueva Publicación
        </h1>
        <p className="text-xs sm:text-sm text-content-muted">
          Crea tu solicitud, servicio o artículo para el marketplace completando los siguientes
          pasos.
        </p>

        {/* Stepper visual de progreso */}
        <div className="pt-6 max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider">
            <span className="text-brand">PASO 1: TIPO</span>
            <span className="text-brand">PASO 2: DETALLES</span>
            <span className="text-content-muted">PASO 3: PUBLICAR</span>
          </div>
          <div className="w-full h-1.5 bg-surface-base rounded-full overflow-hidden flex">
            <div className="w-2/3 h-full bg-linear-to-r from-brand-dark to-brand rounded-full transition-all" />
          </div>
        </div>
      </div>

      {/* Layout de 2 Columnas: Formulario a la izquierda y Vista Previa a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
        {/* Columna Izquierda: Pasos 1 y 2 */}
        <div className="lg:col-span-7 space-y-8 bg-surface-main p-6 sm:p-8 rounded-3xl border border-border-base shadow-xs">
          <PublicationTypeSelector
            value={formState.tipo}
            onChange={(tipo) => handleChange({ tipo })}
          />

          <hr className="border-border-base/70" />

          <CreatePublicationForm formState={formState} onChange={handleChange} />
        </div>

        {/* Columna Derecha: Vista Previa en Vivo (Paso 3) Sticky */}
        <div className="lg:col-span-5 lg:sticky lg:top-8">
          <PublicationLivePreview
            formState={formState}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
