'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type RatingSize = 'sm' | 'md' | 'lg';

export interface RatingProps {
  value?: number;
  defaultValue?: number;
  max?: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  disabled?: boolean;
  size?: RatingSize;
  showValue?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

const sizeClasses: Record<RatingSize, { icon: string; text: string; padding: string }> = {
  sm: { icon: 'w-4 h-4', text: 'text-xs', padding: 'p-0.5' },
  md: { icon: 'w-5 h-5', text: 'text-sm', padding: 'p-1' },
  lg: { icon: 'w-7 h-7', text: 'text-base', padding: 'p-1.5' },
};

export const Rating = React.forwardRef<HTMLDivElement, RatingProps>(
  (
    {
      value: controlledValue,
      defaultValue = 0,
      max = 5,
      onChange,
      readOnly = false,
      disabled = false,
      size = 'md',
      showValue = false,
      className,
      id,
      'aria-label': ariaLabel,
    },
    ref,
  ) => {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = React.useState<number>(defaultValue);
    const [hoverValue, setHoverValue] = React.useState<number | null>(null);

    const currentValue = isControlled ? controlledValue : internalValue;
    const displayValue = hoverValue !== null && !readOnly && !disabled ? hoverValue : currentValue;

    const handleClick = (rating: number) => {
      if (readOnly || disabled) return;
      if (!isControlled) {
        setInternalValue(rating);
      }
      onChange?.(rating);
    };

    const handleMouseEnter = (rating: number) => {
      if (readOnly || disabled) return;
      setHoverValue(rating);
    };

    const handleMouseLeave = () => {
      if (readOnly || disabled) return;
      setHoverValue(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, rating: number) => {
      if (readOnly || disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(rating);
      }
    };

    const stars = Array.from({ length: max }, (_, index) => index + 1);

    return (
      <div
        ref={ref}
        id={id}
        className={cn(
          'inline-flex items-center gap-1.5 select-none',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className,
        )}
        role={readOnly ? 'img' : 'radiogroup'}
        aria-label={ariaLabel || `Calificación: ${currentValue} de ${max} estrellas`}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center gap-0.5">
          {stars.map((starIndex) => {
            const isFilled = displayValue >= starIndex;
            const isHalf =
              readOnly && !isFilled && displayValue >= starIndex - 0.75 && displayValue < starIndex;

            const starIcon = (
              <svg
                className={cn(
                  sizeClasses[size].icon,
                  'transition-colors duration-150 shrink-0',
                  isFilled
                    ? 'fill-amber-400 text-amber-400'
                    : isHalf
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-border-base text-border-base',
                )}
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                {isHalf ? (
                  <>
                    <defs>
                      <linearGradient id={`star-half-${starIndex}`}>
                        <stop offset="50%" stopColor="currentColor" />
                        <stop offset="50%" stopColor="#e5e7eb" stopOpacity="1" />
                      </linearGradient>
                    </defs>
                    <path
                      fill={`url(#star-half-${starIndex})`}
                      d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                    />
                  </>
                ) : (
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                )}
              </svg>
            );

            if (readOnly) {
              return (
                <span key={starIndex} className="inline-flex">
                  {starIcon}
                </span>
              );
            }

            return (
              <button
                key={starIndex}
                type="button"
                role="radio"
                aria-checked={currentValue === starIndex}
                aria-label={`${starIndex} de ${max} estrellas`}
                disabled={disabled}
                onClick={() => handleClick(starIndex)}
                onMouseEnter={() => handleMouseEnter(starIndex)}
                onKeyDown={(e) => handleKeyDown(e, starIndex)}
                className={cn(
                  sizeClasses[size].padding,
                  'rounded-md transition-transform duration-100 cursor-pointer',
                  'hover:scale-115 active:scale-95',
                  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
                )}
              >
                {starIcon}
              </button>
            );
          })}
        </div>

        {showValue && (
          <span
            className={cn(sizeClasses[size].text, 'font-bold text-content-main tabular-nums ml-1')}
          >
            {currentValue > 0 ? currentValue.toFixed(1) : '0.0'}
          </span>
        )}
      </div>
    );
  },
);

Rating.displayName = 'Rating';
