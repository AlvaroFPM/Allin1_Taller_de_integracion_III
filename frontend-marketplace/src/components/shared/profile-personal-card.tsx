'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UserProfileData } from '@/types/profile';

export interface ProfilePersonalCardProps {
  profile: UserProfileData;
  onEditClick: () => void;
}

export function ProfilePersonalCard({ profile, onEditClick }: ProfilePersonalCardProps) {
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="bg-surface-main rounded-2xl border border-border-base p-6 shadow-xs space-y-6">
      {/* Avatar e Identidad Principal */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="w-20 h-20 rounded-full bg-linear-to-br from-brand to-brand-dark text-white flex items-center justify-center font-black text-2xl shadow-sm overflow-hidden select-none">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.firstName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials || 'US'}</span>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold text-content-main leading-tight">
            {profile.firstName} {profile.lastName}
          </h2>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            {profile.isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Identidad Verificada
              </span>
            )}
            <Badge variant="brand" size="sm">
              {profile.role}
            </Badge>
          </div>
        </div>
      </div>

      {/* Lista de Datos Personales */}
      <div className="space-y-4 pt-2 border-t border-border-base/70 text-left text-xs">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
            Nombres
          </span>
          <p className="mt-0.5 font-medium text-content-main text-sm">{profile.firstName}</p>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
            Apellidos
          </span>
          <p className="mt-0.5 font-medium text-content-main text-sm">{profile.lastName}</p>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
            RUT
          </span>
          <div className="mt-0.5 flex items-center justify-between">
            <p className="font-medium text-content-main text-sm">
              {profile.rut || 'No registrado'}
            </p>
            {profile.isVerified && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                Validado
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
            Número Telefónico
          </span>
          <p className="mt-0.5 font-medium text-content-main text-sm">
            {profile.phone || 'No registrado'}
          </p>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
            Correo Electrónico
          </span>
          <p className="mt-0.5 font-medium text-content-main text-sm truncate">{profile.email}</p>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
            Ubicación
          </span>
          <p className="mt-0.5 font-medium text-content-main text-sm">
            {profile.city ? `${profile.city}, ${profile.region}` : 'Chile'}
          </p>
        </div>

        {profile.bio && (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
              Biografía / Presentación
            </span>
            <p className="mt-0.5 text-content-main text-xs leading-relaxed bg-surface-base p-2.5 rounded-lg border border-border-base">
              {profile.bio}
            </p>
          </div>
        )}
      </div>

      {/* Botón Editar Datos */}
      <div className="pt-2">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={onEditClick}
          leftIcon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          }
        >
          Editar Datos Personales
        </Button>
      </div>
    </div>
  );
}
