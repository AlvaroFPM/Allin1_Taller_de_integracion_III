'use client';

import * as React from 'react';
import { isAxiosError } from 'axios';
import { uploadMedia, MediaUploadError } from '@/services/mediaService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EditProfileFormData, ProfileEditModalProps } from '@/types/profile';

export function ProfileEditModal({ isOpen, initialData, onClose, onSave }: ProfileEditModalProps) {
  const [formData, setFormData] = React.useState<EditProfileFormData>(initialData);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = React.useState<string | undefined>();
  const [stage, setStage] = React.useState<'upload' | 'save' | null>(null);
  const busy = React.useRef(false);

  // Cierre accesible con tecla Escape
  React.useEffect(() => {
    if (!isOpen || isSaving) return;
    const handleKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current) return;

    busy.current = true;
    setIsSaving(true);
    setSaveError(null);
    let uploading = false;
    try {
      let photoUrl = uploadedUrl;
      if (photo && !photoUrl) {
        uploading = true;
        setStage('upload');
        const media = await uploadMedia(photo, 'PERFIL');
        photoUrl = media.url;
        setUploadedUrl(photoUrl);
      }
      uploading = false;
      setStage('save');
      await onSave({ ...formData, ...(photoUrl ? { avatarUrl: photoUrl } : {}) });
      onClose();
    } catch (error) {
      if (uploading) {
        setSaveError(
          `No se pudo subir la foto. ${error instanceof MediaUploadError ? error.message : 'Intenta nuevamente.'} Tu perfil no se ha actualizado.`,
        );
        return;
      }
      const detail =
        isAxiosError<{ message?: unknown }>(error) && error.response?.status === 400
          ? error.response.data?.message
          : undefined;
      setSaveError(
        typeof detail === 'string' && detail.trim()
          ? `No se pudo guardar el perfil en IAM: ${detail}`
          : 'No se pudo confirmar el guardado en IAM. La imagen mostrada no cambia. Puedes reintentar Guardar sin volver a subir la foto, o recargar para consultar el estado real.',
      );
    } finally {
      setIsSaving(false);
      setStage(null);
      busy.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={isSaving ? undefined : onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-main rounded-3xl border border-border-base shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border-base">
          <div>
            <h3 className="text-lg font-bold text-content-main">Editar Datos Personales</h3>
            <p className="text-xs text-content-muted mt-0.5">
              Actualiza tu teléfono, ubicación y presentación
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg text-content-muted hover:text-content-main hover:bg-surface-base transition-colors"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="profile-photo" className="text-sm font-semibold">
              Foto de perfil
            </label>
            <input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={isSaving}
              onChange={(e) => {
                setPhoto(e.target.files?.[0] ?? null);
                setUploadedUrl(undefined);
                setSaveError(null);
              }}
            />
            <p className="text-xs text-content-muted">
              Hasta 5 MiB. La foto actual se conserva hasta confirmar el guardado.
              {uploadedUrl && ' Foto subida; falta confirmar el guardado en IAM.'}
            </p>
          </div>
          {/* Nombres y Apellidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombres" placeholder="Tus nombres" value={formData.firstName} readOnly />
            <Input
              label="Apellidos"
              placeholder="Tus apellidos"
              value={formData.lastName}
              readOnly
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
            disabled={isSaving}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          {/* Ubicación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ciudad / Comuna"
              placeholder="Ej: Providencia, Temuco"
              value={formData.city}
              disabled={isSaving}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Input
              label="Región"
              placeholder="Ej: Región Metropolitana"
              value={formData.region}
              disabled={isSaving}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            />
          </div>

          {/* Biografía */}
          <Textarea
            label="Biografía / Presentación"
            placeholder="Describe tus oficios, servicios o intereses de intercambio..."
            value={formData.bio}
            disabled={isSaving}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={3}
          />

          {saveError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {saveError}
            </p>
          )}
          {stage && (
            <p role="status">
              {stage === 'upload' ? 'Subiendo foto a Media…' : 'Guardando perfil en IAM…'}
            </p>
          )}

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
