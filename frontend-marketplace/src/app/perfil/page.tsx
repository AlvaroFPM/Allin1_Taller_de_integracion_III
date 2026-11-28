'use client';

import * as React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/components/ui';
import { mapPrivateProfile, mapProfileToUser } from '@/lib/mappers/auth';
import { getPrivateProfile, updatePrivateProfile } from '@/services/authService';
import { orderExtrasService } from '@/services/orderExtrasService';
import {
  ProfilePersonalCard,
  ProfileReputationCard,
  ProfileActivityPanel,
  ProfileEditModal,
} from '@/components/shared';
import type { UserProfileData, EditProfileFormData } from '@/types/profile';

function subscribeToHydration(listener: () => void) {
  const start = useAuthStore.persist.onHydrate(listener);
  const finish = useAuthStore.persist.onFinishHydration(listener);
  return () => {
    start();
    finish();
  };
}

export default function PerfilPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const token = useAuthStore((state) => state.token);
  const hydrated = React.useSyncExternalStore(
    subscribeToHydration,
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );

  if (!hydrated) {
    return (
      <p role="status" className="p-8 text-content-muted">
        Cargando perfil…
      </p>
    );
  }
  if (!token || !userId) {
    return <p className="p-8 text-content-muted">Inicia sesión para ver tu perfil.</p>;
  }

  return <PrivateProfile key={token} userId={userId} token={token} />;
}

function PrivateProfile({ userId, token }: { userId: number; token: string }) {
  const [profile, setProfile] = React.useState<UserProfileData | null>(null);
  const [reputation, setReputation] = React.useState<{ score: number; total: number }>({
    score: 0,
    total: 0,
  });
  const [loadError, setLoadError] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    void getPrivateProfile(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const loaded = mapPrivateProfile(response);
        if (loaded.id !== userId) {
          setLoadError(true);
          return;
        }
        setProfile(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    void orderExtrasService
      .getUserReviews(userId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setReputation({ score: res.averageScore, total: res.totalReviews });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [userId]);

  if (loadError) {
    return (
      <p role="alert" className="p-8 text-content-main">
        No pudimos cargar tu perfil. Recarga la página para volver a intentarlo.
      </p>
    );
  }
  if (!profile) {
    return (
      <p role="status" className="p-8 text-content-muted">
        Cargando perfil…
      </p>
    );
  }

  const handleSaveProfile = async (data: EditProfileFormData) => {
    const active = useAuthStore.getState();
    if (active.token !== token || active.user?.id !== userId) {
      throw new Error('La sesion cambio. Recarga el perfil antes de guardar.');
    }
    const response = await updatePrivateProfile(data, profile.habilidades);
    const updated = mapPrivateProfile(response);
    if (data.avatarUrl && updated.avatarUrl !== data.avatarUrl) {
      throw new Error('IAM no confirmo la foto solicitada. Recarga antes de reintentar.');
    }
    const session = useAuthStore.getState();

    if (session.token !== token || session.user?.id !== userId || updated.id !== userId) {
      throw new Error('La respuesta no coincide con la sesión activa.');
    }

    setProfile(updated);
    session.updateUser({ ...mapProfileToUser(response), isVerified: session.user.isVerified });
    toast.success('¡Tus datos de perfil se actualizaron correctamente!');
  };

  return (
    <div className="min-h-screen bg-surface-base py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Columna Izquierda: Datos Personales y Reputación */}
          <div className="w-full lg:w-84 xl:w-96 shrink-0 space-y-6">
            <ProfilePersonalCard profile={profile} onEditClick={() => setIsEditOpen(true)} />
            <ProfileReputationCard score={reputation.score} totalReviews={reputation.total} />
          </div>

          {/* Columna Derecha: Panel de Actividad y Publicaciones */}
          <div className="flex-1 min-w-0 w-full">
            <ProfileActivityPanel userId={profile.id} />
          </div>
        </div>
      </div>

      {/* Modal interactivo de edición */}
      <ProfileEditModal
        key={isEditOpen ? 'modal-open' : 'modal-closed'}
        isOpen={isEditOpen}
        initialData={{
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phone: profile.phone,
          city: profile.city,
          region: profile.region,
          bio: profile.bio,
        }}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
