'use client';

import * as React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/components/ui';
import {
  ProfilePersonalCard,
  ProfileReputationCard,
  ProfileActivityPanel,
  ProfileEditModal,
} from '@/components/shared';
import type { UserProfileData, EditProfileFormData } from '@/types/profile';

const FALLBACK_PROFILE: UserProfileData = {
  id: 0,
  firstName: 'Usuario',
  lastName: 'Allin1',
  email: 'usuario@ejemplo.com',
  rut: '12.345.678-K',
  phone: '+56 9 1234 5678',
  city: 'Santiago',
  region: 'Región Metropolitana',
  bio: 'Bienvenido a tu perfil de Allin1.',
  role: 'CLIENTE',
  isVerified: true,
};

export default function PerfilPage() {
  const storeUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [editOverrides, setEditOverrides] = React.useState<Partial<EditProfileFormData> | null>(
    null,
  );

  // Derivar el perfil reactivamente desde storeUser (hidratado desde localStorage) y posibles ediciones locales
  const profile = React.useMemo<UserProfileData>(() => {
    const nameParts = (storeUser?.name || 'Usuario').trim().split(/\s+/);
    const firstName = editOverrides?.firstName ?? (nameParts[0] || 'Usuario');
    const lastName = editOverrides?.lastName ?? (nameParts.slice(1).join(' ') || 'Allin1');

    return {
      ...FALLBACK_PROFILE,
      id: storeUser?.id ?? 0,
      firstName,
      lastName,
      email: storeUser?.email || FALLBACK_PROFILE.email,
      phone: editOverrides?.phone ?? FALLBACK_PROFILE.phone,
      city: editOverrides?.city ?? FALLBACK_PROFILE.city,
      region: editOverrides?.region ?? FALLBACK_PROFILE.region,
      bio: editOverrides?.bio ?? FALLBACK_PROFILE.bio,
      role: storeUser?.role || 'CLIENTE',
      isVerified: storeUser?.isVerified ?? true,
      avatarUrl: storeUser?.avatarUrl,
    };
  }, [storeUser, editOverrides]);

  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const handleSaveProfile = (data: EditProfileFormData) => {
    const updatedFullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    setEditOverrides({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone,
      city: data.city,
      region: data.region,
      bio: data.bio,
    });

    // Sincroniza también en el store global para que el Navbar actualice el nombre de inmediato
    if (storeUser) {
      updateUser({ name: updatedFullName });
    }

    toast.success('¡Tus datos de perfil se actualizaron correctamente!');
  };

  return (
    <div className="min-h-screen bg-surface-base py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Columna Izquierda: Datos Personales y Reputación */}
          <div className="w-full lg:w-84 xl:w-96 shrink-0 space-y-6">
            <ProfilePersonalCard profile={profile} onEditClick={() => setIsEditOpen(true)} />
            <ProfileReputationCard score={4.9} totalReviews={28} />
          </div>

          {/* Columna Derecha: Panel de Actividad y Publicaciones */}
          <div className="flex-1 min-w-0 w-full">
            <ProfileActivityPanel userId={storeUser?.id} />
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
