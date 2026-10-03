'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import {
  PublicationTypeSelector,
  PublicationLivePreview,
  CreatePublicationForm,
} from '@/components/shared';
import type { CreatePublicationFormState, PublicationCategory } from '@/types/publication';
import { publicationService } from '@/services/publicationService';
import { useAuthStore } from '@/store/useAuthStore';

export default function PublicarPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [categories, setCategories] = React.useState<PublicationCategory[]>([]);

  React.useEffect(() => {
    publicationService
      .getCategories()
      .then((data) => setCategories(data as PublicationCategory[]))
      .catch((err: unknown) => console.error('Error cargando categorías:', err));
  }, []);

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

  const { user } = useAuthStore();

  const handleSubmit = async () => {
    if (!formState.titulo.trim()) {
      alert('Por favor ingresa un título para tu publicación.');
      return;
    }
    if (!formState.categoriaId) {
      alert('Por favor selecciona una categoría.');
      return;
    }
    if (!user) {
      alert('Debes iniciar sesión para publicar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await publicationService.createPublication({
        title: formState.titulo,
        description: formState.descripcion,
        categoryId: Number(formState.categoriaId),
        price: Number(formState.precioBase) || 0,
        currency: formState.moneda,
        type: formState.tipo,
        sellerId: user.id,
      });
      alert('¡Publicación creada con éxito! Redirigiendo...');
      router.push('/');
    } catch (error: unknown) {
      const err = error as AxiosError<{ message?: string }>;
      const errorMsg =
        err.response?.data?.message || 'Ocurrió un error desconocido al crear la publicación.';
      alert(`No se pudo crear: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
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

      {/* Layout de 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
        {/* Columna Izquierda: Pasos 1 y 2 */}
        <div className="lg:col-span-7 space-y-8 bg-surface-main p-6 sm:p-8 rounded-3xl border border-border-base shadow-xs">
          <PublicationTypeSelector
            value={formState.tipo}
            onChange={(tipo) => handleChange({ tipo })}
          />

          <hr className="border-border-base/70" />

          <CreatePublicationForm
            formState={formState}
            categories={categories}
            onChange={handleChange}
          />
        </div>

        {/* Columna Derecha: Vista Previa en Vivo */}
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
