'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  COMUNAS_DISPONIBLES,
  type CreatePublicationFormState,
  type PublicationCategory,
} from '@/types/publication';

export interface CreatePublicationFormProps {
  formState: CreatePublicationFormState;
  categories: PublicationCategory[];
  onChange: (fields: Partial<CreatePublicationFormState>) => void;
  photos: File[];
  onPhotosChange: (files: File[]) => void;
  disabled?: boolean;
}

export function CreatePublicationForm({
  formState,
  categories,
  onChange,
  photos,
  onPhotosChange,
  disabled,
}: CreatePublicationFormProps) {
  const coverInput = React.useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const { titulo, categoriaId, descripcion, ubicacion, moneda, precioBase } = formState;

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-xs font-black flex items-center justify-center shrink-0">
          2
        </span>
        <h3 className="text-sm sm:text-base font-bold text-content-main">
          Paso 2: Completa los detalles
        </h3>
      </div>

      <div className="space-y-4">
        {/* Campo: Título */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold text-content-main">
              Título <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-content-muted">
              {titulo.trim().length}/5 car. mín.
            </span>
          </div>
          <input
            type="text"
            value={titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
            placeholder="ej. Reparación de Cañería Filtrada en Cocina"
            className="w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border border-border-base rounded-xl transition-all focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {/* Campo: Categoría */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-content-main">
            Categoría <span className="text-red-500">*</span>
          </label>
          <select
            value={categoriaId}
            onChange={(e) => onChange({ categoriaId: e.target.value })}
            className="w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border border-border-base rounded-xl transition-all focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20 cursor-pointer"
          >
            <option value="">Selecciona una categoría...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Campo: Descripción */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold text-content-main">
              Descripción <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-[11px] ${
                descripcion.trim().length >= 50
                  ? 'text-emerald-600 font-medium'
                  : 'text-amber-600 font-medium'
              }`}
            >
              {descripcion.trim().length < 50
                ? `${descripcion.trim().length}/50 mín.`
                : `${descripcion.trim().length}/1000`}
            </span>
          </div>
          <textarea
            rows={4}
            value={descripcion}
            onChange={(e) => onChange({ descripcion: e.target.value })}
            placeholder="Describe tu requerimiento o producto con detalle (horarios, materiales, condiciones)... Mínimo 50 caracteres."
            className="w-full p-3.5 text-xs sm:text-sm bg-surface-base border border-border-base rounded-xl transition-all focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20 resize-y"
          />
        </div>

        {/* Grid: Ubicación y Presupuesto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ubicación */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-content-main">
              Ubicación <span className="text-red-500">*</span>
            </label>
            <select
              value={ubicacion}
              onChange={(e) => onChange({ ubicacion: e.target.value })}
              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border border-border-base rounded-xl transition-all focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20 cursor-pointer"
            >
              <option value="">Comuna / Sector...</option>
              {COMUNAS_DISPONIBLES.map((comuna) => (
                <option key={comuna} value={comuna}>
                  {comuna}
                </option>
              ))}
            </select>
          </div>

          {/* Presupuesto Estimado */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-content-main">
              Presupuesto Estimado
            </label>
            <div className="flex rounded-xl overflow-hidden border border-border-base focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <select
                value={moneda}
                onChange={(e) => onChange({ moneda: e.target.value })}
                className="h-10 px-3 bg-surface-main border-r border-border-base text-xs font-bold text-content-main cursor-pointer focus:outline-hidden"
              >
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
              </select>
              <input
                type="number"
                min="0"
                step="1000"
                value={precioBase}
                onChange={(e) => onChange({ precioBase: e.target.value })}
                placeholder="0"
                className="w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* La primera imagen es la portada; se suben al publicar. */}
        <div className="space-y-1.5 pt-1">
          <p className="text-sm font-bold text-content-main">
            Imágenes de la publicación (opcionales)
          </p>
          <input
            ref={coverInput}
            type="file"
            multiple
            hidden
            aria-label="Imágenes de la publicación"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={disabled || photos.length >= 5}
            onChange={(e) => {
              const added = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (!added.length) return;
              if (photos.length + added.length > 5) {
                setPhotoError(
                  `Puedes seleccionar hasta 5 imágenes. Quedan ${5 - photos.length} espacios; no se añadieron archivos.`,
                );
                return;
              }
              if (added.some((file) => file.size === 0 || file.size > 5 * 1024 * 1024)) {
                setPhotoError(
                  'Cada imagen debe tener contenido y pesar como máximo 5 MiB. No se añadieron archivos.',
                );
                return;
              }
              setPhotoError(null);
              onPhotosChange([...photos, ...added]);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={disabled || photos.length >= 5}
            onClick={() => coverInput.current?.click()}
          >
            {photos.length ? 'Añadir imágenes' : 'Seleccionar imágenes'}
          </Button>
          <p aria-live="polite" className="break-all text-sm text-content-main">
            {photos.length} / 5 imágenes seleccionadas. La primera será la portada.
          </p>
          {photoError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {photoError}
            </p>
          )}
          <ul className="space-y-2" aria-label="Imágenes seleccionadas">
            {photos.map((file, index) => (
              <SelectedPhoto
                key={`${file.name}-${file.lastModified}-${index}`}
                file={file}
                cover={index === 0}
                disabled={disabled}
                onRemove={() => {
                  setPhotoError(null);
                  onPhotosChange(photos.filter((_, i) => i !== index));
                }}
              />
            ))}
          </ul>
          <p className="text-xs text-content-muted">
            JPG, PNG, WebP o AVIF. Hasta 5 MiB por imagen. Las miniaturas son vistas previas
            locales; se subirán al publicar.
          </p>
        </div>
      </div>
    </div>
  );
}

function SelectedPhoto({
  file,
  cover,
  disabled,
  onRemove,
}: {
  file: File;
  cover: boolean;
  disabled?: boolean;
  onRemove: () => void;
}) {
  const image = React.useRef<HTMLImageElement>(null);
  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border-base bg-surface-base p-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
        alt={`Vista previa de ${file.name}`}
        className="h-12 w-16 shrink-0 rounded-lg object-cover bg-surface-main"
      />
      <div className="min-w-0 flex-1">
        <p className="break-all text-sm text-content-main">{file.name}</p>
        {cover && <span className="text-xs font-semibold text-brand">Portada</span>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Quitar ${file.name}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-surface-main hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
      >
        ×
      </button>
    </li>
  );
}
