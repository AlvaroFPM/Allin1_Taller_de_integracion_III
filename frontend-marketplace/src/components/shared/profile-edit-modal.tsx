'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EditProfileFormData, ProfileEditModalProps } from '@/types/profile';

export function ProfileEditModal({ isOpen, initialData, onClose, onSave }: ProfileEditModalProps) {
  const [formData, setFormData] = React.useState<EditProfileFormData>(initialData);
  const [isSaving, setIsSaving] = React.useState(false);

  // Cierre accesible con tecla Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      onSave(formData);
      setIsSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-main rounded-3xl border border-border-base shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border-base">
          <div>
            <h3 className="text-lg font-bold text-content-main">Editar Datos Personales</h3>
            <p className="text-xs text-content-muted mt-0.5">
              Actualiza tu información pública de contacto y presentación
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content-main hover:bg-surface-base transition-colors"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Nombres y Apellidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombres"
              placeholder="Tus nombres"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="Apellidos"
              placeholder="Tus apellidos"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>

          {/* Correo Electrónico Protegido */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-content-main">Correo Electrónico</label>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                🔒 Protegido
              </span>
            </div>
            <input
              type="email"
              disabled
              value={formData.email}
              className="w-full h-10 px-3 text-xs bg-surface-base border border-border-base rounded-lg text-content-muted cursor-not-allowed select-none opacity-80"
            />
            <p className="text-[10px] text-content-muted mt-1">
              Por motivos de seguridad, el correo electrónico asociado no se puede modificar
              directamente.
            </p>
          </div>

          {/* Teléfono */}
          <Input
            label="Número Telefónico"
            placeholder="+56 9 1234 5678"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          {/* Ubicación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ciudad / Comuna"
              placeholder="Ej: Providencia, Temuco"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Input
              label="Región"
              placeholder="Ej: Región Metropolitana"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            />
          </div>

          {/* Biografía */}
          <Textarea
            label="Biografía / Presentación"
            placeholder="Describe tus oficios, servicios o intereses de intercambio..."
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={3}
          />

          <div className="pt-4 border-t border-border-base flex items-center justify-end gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
              Guardar Cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
