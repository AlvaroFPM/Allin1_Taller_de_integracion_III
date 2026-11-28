'use client';

import * as React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { orderExtrasService } from '@/services/orderExtrasService';
import { chatService } from '@/services/chatService';

export interface PendingBadges {
  pendingOrdersCount: number;
  unreadMessagesCount: number;
  totalCount: number;
}

const POLL_INTERVAL_MS = 30000;

export function usePendingBadges(): PendingBadges {
  const userId = useAuthStore((state) => state.user?.id);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [badges, setBadges] = React.useState<PendingBadges>({
    pendingOrdersCount: 0,
    unreadMessagesCount: 0,
    totalCount: 0,
  });

  React.useEffect(() => {
    if (!isAuthenticated || !userId || !token) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller = new AbortController();

    async function refresh() {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;

      const [ordersSummary, chatRooms] = await Promise.all([
        orderExtrasService.getPendingSummary(signal).catch(() => null),
        chatService.listRooms(signal).catch(() => null),
      ]);

      if (cancelled || signal.aborted) return;

      const pendingOrdersCount =
        (ordersSummary?.pendingSalesCount ?? 0) + (ordersSummary?.deliveredAwaitingBuyerCount ?? 0);
      const unreadMessagesCount = (chatRooms?.salas ?? []).reduce(
        (sum, room) => sum + (room.mensajesNoLeidos ?? 0),
        0,
      );

      setBadges({
        pendingOrdersCount,
        unreadMessagesCount,
        totalCount: pendingOrdersCount + unreadMessagesCount,
      });

      timer = setTimeout(() => {
        void refresh();
      }, POLL_INTERVAL_MS);
    }

    void refresh();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, userId, token]);

  if (!isAuthenticated || !userId || !token) {
    return { pendingOrdersCount: 0, unreadMessagesCount: 0, totalCount: 0 };
  }

  return badges;
}
