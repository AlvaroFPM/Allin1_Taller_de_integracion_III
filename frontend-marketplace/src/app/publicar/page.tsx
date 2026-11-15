'use client';

import * as React from 'react';
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
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { user } = useAuthStore();

  const [formState, setFormState] = React.useState<CreatePublicationFormState>({
    titulo: '',
    descripcion: '',
    tipo: 'SERVICIO',
    precioBase: '',
    categoriaId: '',
    moneda: 'CLP',
    ubicacion: 'Temuco',
  });

  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await publicationService.getCategories();
        setCategories(data);
      } catch (error: unknown) {
        console.error('Error al cargar categorías:', error);
      }
    };

    fetchCategories();
  }, []);

  const handleChange = (fields: Partial<CreatePublicationFormState>) => {
    setFormState((prev) => ({ ...prev, ...fields }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('Debes iniciar sesión para publicar');
      return;
    }

    if (
      !formState.titulo.trim() ||
      !formState.descripcion.trim() ||
      !formState.categoriaId ||
      !formState.precioBase
    ) {
      setErrorMessage('Por favor completa todos los campos obligatorios');
      return;
    }

    if (formState.titulo.trim().length < 5) {
      setErrorMessage('El título debe tener al menos 5 caracteres (RN-18)');
      return;
    }

    const descLength = formState.descripcion.trim().length;
    if (descLength < 50) {
      setErrorMessage(
        `La descripción debe tener al menos 50 caracteres (actualmente tiene ${descLength} caracteres). Agrega más detalles sobre el servicio o requerimiento (RN-19).`,
      );
      return;
    }

    if (descLength > 1000) {
      setErrorMessage('La descripción no puede superar los 1000 caracteres (RN-19)');
      return;
    }

    const priceNum = Number(formState.precioBase);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMessage('El precio base debe ser mayor a 0 (RN-23)');
      return;
    }

    try {
      setIsSubmitting(true);

      await publicationService.createPublication({
        title: formState.titulo.trim(),
        description: formState.descripcion.trim(),
        categoryId: Number(formState.categoriaId),
        price: priceNum,
        currency: formState.moneda,
        type: formState.tipo,
        sellerId: user.id,
        location: formState.ubicacion,
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
    <main className="container max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Crear nueva publicación</h1>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Layout de 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
        {/* Columna Izquierda: Pasos 1 y 2 */}
        <div className="lg:col-span-7 space-y-8 bg-surface-main p-6 sm:p-8 rounded-3xl border border-border-base shadow-xs">
          <PublicationTypeSelector
            value={formState.tipo}
            onChange={(tipo) => setFormState((prev) => ({ ...prev, tipo }))}
          />
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
    </main>
  );
}
