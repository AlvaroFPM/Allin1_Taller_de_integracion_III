'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrdersStore } from '@/store/useOrdersStore';

export function OrdersSessionBoundary() {
  useEffect(() => {
    const resetOrders = () => useOrdersStore.getState().reset();

    resetOrders();

    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (
        state.user?.id !== previous.user?.id ||
        state.token !== previous.token ||
        state.isAuthenticated !== previous.isAuthenticated
      ) {
        resetOrders();
      }
    });

    return () => {
      unsubscribe();
      resetOrders();
    };
  }, []);

  return null;
}
