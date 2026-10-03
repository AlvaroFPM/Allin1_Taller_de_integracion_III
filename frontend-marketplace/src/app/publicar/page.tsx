'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { publicationService } from '@/services/publicationService';
import type { PublicationCategory } from '@/types/publication';

export default function PublicarPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [categories, setCategories] = React.useState<PublicationCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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
        title: formData.titulo,
        description: formData.descripcion,
        price: Number(formData.precioBase),
        currency: 'CLP',
        type: formData.tipoServicio,
        sellerId: Number(user.id),
        categoryId: Number(formData.categoriaId),
      });

      router.push('/catalogo');
    } catch (err: unknown) {
      console.error('Error al crear publicación:', err);
      const error = err as AxiosError<{ message?: string }>;
      setErrorMessage(error.response?.data?.message || 'Ocurrió un error al crear la publicación');
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold mb-1">Título *</label>
          <input
            type="text"
            name="titulo"
            value={formData.titulo}
            onChange={handleChange}
            placeholder="Ej: Servicio de gasfitería a domicilio"
            className="w-full h-10 px-3.5 text-sm bg-surface-base border rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">Categoría *</label>
          <select
            name="categoriaId"
            value={formData.categoriaId}
            onChange={handleChange}
            className="w-full h-10 px-3.5 text-sm bg-surface-base border rounded-xl"
            disabled={isLoadingCategories}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">Tipo de Servicio *</label>
          <select
            name="tipoServicio"
            value={formData.tipoServicio}
            onChange={handleChange}
            className="w-full h-10 px-3.5 text-sm bg-surface-base border rounded-xl"
          >
            <option value="OFERTA">Ofrezco un servicio (Oferta)</option>
            <option value="DEMANDA">Busco un servicio (Demanda)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">Precio Base (CLP) *</label>
          <input
            type="number"
            name="precioBase"
            value={formData.precioBase}
            onChange={handleChange}
            placeholder="15000"
            className="w-full h-10 px-3.5 text-sm bg-surface-base border rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">Descripción *</label>
          <textarea
            name="descripcion"
            rows={4}
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Describe detalladamente el servicio..."
            className="w-full p-3.5 text-sm bg-surface-base border rounded-xl"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 bg-brand text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? 'Publicando...' : 'Publicar'}
        </button>
      </form>
    </main>
  );
}
