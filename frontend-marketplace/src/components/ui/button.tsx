import * as React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses = {
  primary:
    'bg-brand text-surface-main hover:bg-brand-hover shadow-xs active:bg-brand-dark focus-visible:ring-brand',
  secondary:
    'bg-surface-main text-content-main border border-border-base hover:bg-surface-base hover:border-gray-400 active:bg-border-base/70 focus-visible:ring-brand',
  outline:
    'border-2 border-brand text-brand bg-transparent hover:bg-brand-light active:bg-brand-light/80 focus-visible:ring-brand',
  ghost:
    'text-content-main bg-transparent hover:bg-surface-base hover:text-brand-dark active:bg-border-base/50 focus-visible:ring-brand',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600',
  warning:
    'bg-status-warning text-white hover:bg-amber-700 active:bg-amber-800 focus-visible:ring-status-warning',
};

const sizeClasses = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-150 cursor-pointer select-none',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2',
          'active:scale-[0.98]',
          'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:scale-100',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Spinner
            size={size === 'lg' ? 'md' : 'sm'}
            variant={
              variant === 'primary' || variant === 'danger' || variant === 'warning'
                ? 'white'
                : 'brand'
            }
          />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
