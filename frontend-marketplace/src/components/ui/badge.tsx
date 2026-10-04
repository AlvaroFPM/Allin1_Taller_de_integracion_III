import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'warning' | 'success' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
}

const variantClasses = {
  brand: 'bg-brand-light text-brand-dark border-brand/30 font-semibold',
  warning: 'bg-status-warning-bg text-amber-900 border-amber-300 font-semibold',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
  danger: 'bg-red-50 text-red-800 border-red-300 font-semibold',
  neutral: 'bg-surface-base text-content-muted border-border-base font-semibold',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs font-medium',
  md: 'px-2.5 py-1 text-xs font-semibold',
};

export function Badge({
  className,
  variant = 'brand',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border tracking-tight',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
