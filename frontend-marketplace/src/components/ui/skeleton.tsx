import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rounded' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rounded', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-gray-200',
        variant === 'rounded' && 'rounded-xl',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-none',
        className,
      )}
      {...props}
    />
  );
}
