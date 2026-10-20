'use client';

import * as React from 'react';
import { Button } from '@/components/ui';

export interface PublicProfileHeaderProps {
  firstName: string;
  lastName: string;
  bio?: string;
  isVerified?: boolean;
  avatarUrl?: string;
  memberSince?: string;
  city?: string;
  onContact?: () => void;
}

export function PublicProfileHeader({
  firstName,
  lastName,
  bio,
  isVerified = false,
  avatarUrl,
  memberSince = '2024',
  city = 'Santiago, RM',
  onContact,
}: PublicProfileHeaderProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`;

  return (
    <div className="bg-surface-main rounded-3xl border border-border-base p-6 sm:p-8 shadow-xs space-y-6">
      {/* Avatar + Nombre */}
      <div className="flex flex-col items-center text-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName}
            className="w-24 h-24 rounded-full object-cover ring-4 ring-brand/20"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-brand flex items-center justify-center ring-4 ring-brand/20">
            <span className="text-2xl font-black text-white">{initials}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-content-main tracking-tight">{fullName}</h1>

          {isVerified && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Identidad Verificada
            </span>
          )}
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-sm text-content-muted leading-relaxed text-center border-t border-border-base/60 pt-4">
          {bio}
        </p>
      )}

      {/* Meta info */}
      <div className="flex justify-center gap-6 text-[11px] text-content-muted font-medium border-t border-border-base/60 pt-4">
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5 text-brand"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>{city}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5 text-brand"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>Miembro desde {memberSince}</span>
        </div>
      </div>

      {/* Botón Contactar */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={onContact}
        className="py-3.5 text-sm font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        Contactar →
      </Button>
    </div>
  );
}
