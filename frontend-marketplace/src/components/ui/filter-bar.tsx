'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  tabs?: FilterTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  rightAction?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchPlaceholder = 'Buscar por título, oficio o ubicación...',
  searchValue = '',
  onSearchChange,
  tabs = [],
  activeTab,
  onTabChange,
  rightAction,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'bg-surface-main border border-border-base rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs',
        className,
      )}
    >
      {/* Fila Superior: Buscador y Acción Derecha */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 flex items-center">
          <svg
            className="absolute left-3.5 w-4 h-4 text-content-muted pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm bg-surface-base border border-border-base rounded-xl focus:outline-hidden focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-content-muted"
          />
        </div>

        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>

      {/* Fila Inferior: Pestañas de Filtro (Tabs) */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-border-base/60 pt-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer',
                  isActive
                    ? 'bg-brand text-surface-main shadow-xs'
                    : 'text-content-muted hover:text-content-main hover:bg-surface-base',
                )}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-base text-content-muted',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
