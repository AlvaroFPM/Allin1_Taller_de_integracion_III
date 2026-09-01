import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "brand" | "warning" | "success" | "danger" | "neutral";
  size?: "sm" | "md";
}

const variantClasses = {
  brand: "bg-brand-light text-brand-dark border-brand/20",
  warning: "bg-status-warning-bg text-status-warning border-status-warning/20",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  neutral: "bg-surface-base text-content-muted border-border-base",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs font-medium",
  md: "px-2.5 py-1 text-xs font-semibold",
};

export function Badge({
  className,
  variant = "brand",
  size = "sm",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border tracking-tight",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
