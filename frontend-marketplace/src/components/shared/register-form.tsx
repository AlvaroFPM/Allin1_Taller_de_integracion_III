'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { registerSchema, type RegisterFormData } from '@/types/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { mapProfileToUser } from '@/lib/mappers/auth';
import api from '@/lib/axios';
import { setAuthTokens } from '@/lib/authCookies';

export interface RegisterFormProps {
  onSuccess?: (data: RegisterFormData) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      rut: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  });

  const passwordValue = useWatch({ control, name: 'password' }) || '';

  const passwordRules = [
    { label: '8 a 64 caracteres', valid: passwordValue.length >= 8 && passwordValue.length <= 64 },
    { label: 'Una mayúscula', valid: /[A-Z]/.test(passwordValue) },
    { label: 'Una minúscula', valid: /[a-z]/.test(passwordValue) },
    { label: 'Un número', valid: /[0-9]/.test(passwordValue) },
    { label: 'Un carácter especial (@#$%)', valid: /[^A-Za-z0-9]/.test(passwordValue) },
  ];

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setErrorMessage(null);

      const registerResponse = await api.post('/v1/auth/register', {
        first_name: data.firstName,
        last_name: data.lastName,
        rut: data.rut,
        phone: data.phone,
        email: data.email,
        password: data.password,
      });

      const token = registerResponse.data.token;

      if (token) {
        setAuthTokens(token);
      }

      const profileResponse = await api.get('/v1/auth/profile');
      const profile = profileResponse.data;

      const realUser = mapProfileToUser(profile);

      useAuthStore.getState().setAuth(realUser, token);
      onSuccess?.(data);
    } catch (err: unknown) {
      console.error('Error en registro:', err);
      const error = err as AxiosError<{ message?: string }>;
      setErrorMessage(
        error.response?.data?.message ||
          'Error al registrar la cuenta. Es posible que el correo o RUT ya existan.',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left" noValidate>
      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold text-content-main">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Juan"
            {...register('firstName')}
            className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border rounded-xl transition-all focus:outline-hidden ${
              errors.firstName
                ? 'border-red-500 ring-2 ring-red-500/10'
                : 'border-border-base focus:border-brand focus:ring-2 focus:ring-brand/20'
            }`}
          />
          {errors.firstName && (
            <p className="text-[11px] font-medium text-red-600 mt-1">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold text-content-main">
            Apellido <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Pérez"
            {...register('lastName')}
            className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border rounded-xl transition-all focus:outline-hidden ${
              errors.lastName
                ? 'border-red-500 ring-2 ring-red-500/10'
                : 'border-border-base focus:border-brand focus:ring-2 focus:ring-brand/20'
            }`}
          />
          {errors.lastName && (
            <p className="text-[11px] font-medium text-red-600 mt-1">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold text-content-main">RUT (opcional)</label>
          <input
            type="text"
            placeholder="12.345.678-9"
            {...register('rut')}
            className="w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border border-border-base rounded-xl transition-all focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {errors.rut && (
            <p className="text-[11px] font-medium text-red-600 mt-1">{errors.rut.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold text-content-main">Teléfono (opcional)</label>
          <input
            type="tel"
            placeholder="+56912345678"
            {...register('phone')}
            className="w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border border-border-base rounded-xl transition-all focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {errors.phone && (
            <p className="text-[11px] font-medium text-red-600 mt-1">{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold text-content-main">
          Correo electrónico <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          placeholder="nombre@ejemplo.com"
          {...register('email')}
          className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border rounded-xl transition-all focus:outline-hidden ${
            errors.email
              ? 'border-red-500 ring-2 ring-red-500/10'
              : 'border-border-base focus:border-brand focus:ring-2 focus:ring-brand/20'
          }`}
        />
        {errors.email && (
          <p className="text-[11px] font-medium text-red-600 mt-1">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold text-content-main">
            Contraseña <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              className={`w-full h-10 pl-3.5 pr-10 text-xs sm:text-sm bg-surface-base border rounded-xl transition-all focus:outline-hidden ${
                errors.password
                  ? 'border-red-500 ring-2 ring-red-500/10'
                  : 'border-border-base focus:border-brand focus:ring-2 focus:ring-brand/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-content-muted hover:text-content-main transition-colors cursor-pointer"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showPassword ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                )}
              </svg>
            </button>
          </div>
          {errors.password && (
            <p className="text-[11px] font-medium text-red-600 mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold text-content-main">
            Confirmar contraseña <span className="text-red-500">*</span>
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            {...register('confirmPassword')}
            className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-surface-base border rounded-xl transition-all focus:outline-hidden ${
              errors.confirmPassword
                ? 'border-red-500 ring-2 ring-red-500/10'
                : 'border-border-base focus:border-brand focus:ring-2 focus:ring-brand/20'
            }`}
          />
          {errors.confirmPassword && (
            <p className="text-[11px] font-medium text-red-600 mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      {/* Reglas de Seguridad Visuales */}
      <div className="p-2.5 rounded-xl bg-surface-subtle border border-border-base/50 text-[11px] space-y-1">
        <p className="font-semibold text-content-main mb-1">Requisitos de contraseña:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-content-muted">
          {passwordRules.map((rule) => (
            <div
              key={rule.label}
              className={`flex items-center gap-1.5 transition-colors ${
                rule.valid ? 'text-emerald-600 font-medium' : ''
              }`}
            >
              <span>{rule.valid ? '✓' : '○'}</span>
              <span>{rule.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Checkbox Términos */}
      <div className="space-y-1 pt-1">
        <label className="flex items-center gap-2 text-xs text-content-muted cursor-pointer select-none">
          <input
            type="checkbox"
            {...register('terms')}
            className="w-3.5 h-3.5 rounded border-border-base text-brand focus:ring-brand accent-brand cursor-pointer"
          />
          <span>
            Acepto los{' '}
            <Link
              href="/terminos"
              className="font-medium text-brand hover:text-brand-hover underline transition-colors"
            >
              términos y condiciones
            </Link>
          </span>
        </label>
        {errors.terms && (
          <p className="text-[11px] font-medium text-red-600 mt-1">{errors.terms.message}</p>
        )}
      </div>

      {/* Botón Submit */}
      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="md"
          fullWidth
          isLoading={isSubmitting}
          className="font-bold shadow-md hover:shadow-lg transition-all"
        >
          Registrarse →
        </Button>
      </div>
    </form>
  );
}
