import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, disabled, required, rows = 4, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-semibold text-content-main flex items-center gap-1"
          >
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'w-full px-3.5 py-2.5 text-sm bg-surface-main text-content-main rounded-lg border transition-colors resize-y',
            'placeholder:text-content-muted/60',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1',
            'disabled:bg-surface-base disabled:text-content-muted disabled:cursor-not-allowed disabled:border-border-base',
            error
              ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500'
              : 'border-border-base focus-visible:ring-brand focus-visible:border-brand',
            className,
          )}
          {...props}
        />

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

Textarea.displayName = 'Textarea';
