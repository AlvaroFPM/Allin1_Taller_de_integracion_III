'use client';

import * as React from 'react';
import {
  CATEGORIAS_DISPONIBLES,
  COMUNAS_DISPONIBLES,
  type CreatePublicationFormState,
} from '@/types/publication';

export interface CreatePublicationFormProps {
  formState: CreatePublicationFormState;
  onChange: (fields: Partial<CreatePublicationFormState>) => void;
}

export function CreatePublicationForm({ formState, onChange }: CreatePublicationFormProps) {
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
          <label className="block text-xs font-bold text-content-main">
            Título <span className="text-red-500">*</span>
          </label>
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
            {CATEGORIAS_DISPONIBLES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icono} {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Campo: Descripción */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-content-main">
            Descripción <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            value={descripcion}
            onChange={(e) => onChange({ descripcion: e.target.value })}
            placeholder="Describe tu requerimiento o producto con detalle (horarios, materiales, condiciones)..."
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

        {/* Slot: Multimedia y Fotos (Preparado para Paso 2) */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-bold text-content-main">Multimedia y Fotos</label>
          <div className="w-full border-2 border-dashed border-border-base rounded-2xl p-6 sm:p-8 text-center bg-surface-main/50 hover:bg-surface-base/60 transition-all flex flex-col items-center justify-center gap-2 select-none cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-surface-base flex items-center justify-center text-content-muted">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-content-main">
              Click para subir fotos o arrastra archivos
            </p>
            <p className="text-[11px] text-content-muted">
              Soporta JPG, PNG (Max 10MB) · Área preparada para componente Drag & Drop
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
