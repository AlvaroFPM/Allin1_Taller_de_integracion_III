import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      required,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-content-main flex items-center gap-1"
          >
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-content-muted">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={type}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full h-10 px-3.5 text-sm bg-surface-main text-content-main rounded-lg border transition-colors',
              'placeholder:text-content-muted/60',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1',
              'disabled:bg-surface-base disabled:text-content-muted disabled:cursor-not-allowed disabled:border-border-base',
              error
                ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500'
                : 'border-border-base focus-visible:ring-brand focus-visible:border-brand',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className,
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-content-muted">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p id={errorId} className="text-xs font-medium text-red-600">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-content-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
