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
import { uploadMedia, MediaUploadError } from '@/services/mediaService';

export default function PublicarPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [categories, setCategories] = React.useState<PublicationCategory[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { user } = useAuthStore();
  const [photos, setPhotos] = React.useState<File[]>([]);
  const uploadedPhotos = React.useRef(new Map<File, string>());
  const uploadOwner = React.useRef<number | null>(null);
  const [stage, setStage] = React.useState<'upload' | 'save' | null>(null);
  const busy = React.useRef(false);

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
    if (busy.current) return;
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

    const token = useAuthStore.getState().token;
    let uploading = false;
    try {
      busy.current = true;
      setIsSubmitting(true);
      if (uploadOwner.current !== user.id) {
        uploadedPhotos.current.clear();
        uploadOwner.current = user.id;
      }
      const imageUrls: string[] = [];
      for (const photo of photos) {
        const session = useAuthStore.getState();
        if (!token || session.token !== token || session.user?.id !== user.id) {
          throw new MediaUploadError('session', 'La sesión cambió.');
        }
        let url = uploadedPhotos.current.get(photo);
        if (!url) {
          uploading = true;
          setStage('upload');
          url = (await uploadMedia(photo, 'PORTADA')).url;
          uploadedPhotos.current.set(photo, url);
        }
        imageUrls.push(url);
      }
      uploading = false;
      setStage('save');
      const session = useAuthStore.getState();
      if (!token || session.token !== token || session.user?.id !== user.id) {
        setErrorMessage(
          'Tu sesión cambió. Inicia sesión y revisa tus publicaciones antes de continuar.',
        );
        return;
      }
      const created = await publicationService.createPublication({
        title: formState.titulo.trim(),
        description: formState.descripcion.trim(),
        categoryId: Number(formState.categoriaId),
        price: priceNum,
        currency: formState.moneda,
        type: formState.tipo,
        sellerId: user.id,
        location: formState.ubicacion,
        images: imageUrls,
      });
      if (
        !created?.id ||
        created.images?.length !== imageUrls.length ||
        imageUrls.some((url, i) => created.images?.[i] !== url)
      ) {
        setErrorMessage(
          'No se pudo confirmar la publicación con sus imágenes. Revisa tu perfil antes de reintentar para evitar duplicados.',
        );
        return;
      }
      alert('¡Publicación creada con éxito! Redirigiendo...');
      router.push(`/publicaciones/${created.id}`);
    } catch (error: unknown) {
      if (uploading) {
        const kind = error instanceof MediaUploadError ? error.kind : undefined;
        setErrorMessage(
          kind === 'size'
            ? 'Una imagen supera el límite de 5 MiB. Selecciona una imagen más pequeña.'
            : kind === 'format'
              ? 'Selecciona una imagen válida JPG, PNG, WebP o AVIF.'
              : kind === 'session'
                ? 'Inicia sesión nuevamente para subir las imágenes.'
                : 'No se pudieron subir todas las imágenes. Comprueba tu conexión. La publicación no se ha enviado.',
        );
      } else {
        const err = error as AxiosError;
        setErrorMessage(
          err.response?.status === 400
            ? 'No se pudo guardar la publicación. Revisa sus datos; al reintentar se reutilizarán las imágenes subidas.'
            : 'No se pudo confirmar el guardado. Revisa tus publicaciones antes de reintentar para evitar duplicados.',
        );
      }
    } finally {
      busy.current = false;
      setIsSubmitting(false);
      setStage(null);
    }
  };

  return (
    <main className="container max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Crear nueva publicación</h1>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs"
        >
          {errorMessage}
        </div>
      )}
      {stage && (
        <p role="status">{stage === 'upload' ? 'Subiendo imágenes…' : 'Guardando publicación…'}</p>
      )}

      {/* Layout de 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
        {/* Columna Izquierda: Pasos 1 y 2 */}
        <fieldset
          disabled={isSubmitting}
          className="lg:col-span-7 min-w-0 space-y-8 bg-surface-main p-6 sm:p-8 rounded-3xl border border-border-base shadow-xs"
        >
          <PublicationTypeSelector
            value={formState.tipo}
            onChange={(tipo) => setFormState((prev) => ({ ...prev, tipo }))}
          />
          <CreatePublicationForm
            formState={formState}
            categories={categories}
            onChange={handleChange}
            photos={photos}
            disabled={isSubmitting}
            onPhotosChange={(files) => {
              if (busy.current) return;
              setPhotos(files);
              for (const file of uploadedPhotos.current.keys()) {
                if (!files.includes(file)) uploadedPhotos.current.delete(file);
              }
              setErrorMessage(null);
            }}
          />
        </fieldset>

        {/* Columna Derecha: Vista Previa en Vivo */}
        <div className="lg:col-span-5 lg:sticky lg:top-8">
          <PublicationLivePreview
            formState={formState}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            photoCount={photos.length}
          />
        </div>
      </div>
    </main>
  );
}
