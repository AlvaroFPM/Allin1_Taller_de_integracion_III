'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import {
  PublicationTypeSelector,
  PublicationLivePreview,
  CreatePublicationForm,
} from '@/components/shared';
import type { PublicationCategory } from '@/types/publication';
import { publicationService } from '@/services/publicationService';

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

  const [formData, setFormData] = React.useState({
    titulo: '',
    descripcion: '',
    tipoServicio: 'OFERTA',
    precioBase: '',
    categoriaId: '',
  });

  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await publicationService.getCategories();
        setCategories(data);
      } catch (error: unknown) {
        console.error('Error al cargar categorías:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('Debes iniciar sesión para publicar');
      return;
    }

    if (
      !formData.titulo ||
      !formData.descripcion ||
      !formData.categoriaId ||
      !formData.precioBase
    ) {
      setErrorMessage('Por favor completa todos los campos obligatorios');
      return;
    }

    try {
      setIsSubmitting(true);

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
    <main className="container max-w-2xl mx-auto px-4 py-8">
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
            onChange={(tipo) => handleChange({ tipo })}
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
