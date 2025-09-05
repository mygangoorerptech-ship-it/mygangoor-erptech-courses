// src/hooks/useNotifications.tsx
import React from 'react';
import { useAuth } from '../auth/store';
import { listNotifications, markRead, dismiss, type NotificationItem } from '../api/notifications';

type Ctx = {
  items: NotificationItem[];
  unread: number;
  lastPopup: NotificationItem | null;
  read: (id: string) => Promise<void>;
  close: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const NotificationsContext = React.createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  console.debug('[notify] provider mount');

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [lastPopup, setLastPopup] = React.useState<NotificationItem | null>(null);
  const esRef = React.useRef<EventSource | null>(null);

  // --- auth state (wait for this before opening SSE) ---
  const { user } = useAuth();                 // <- full store
  const isAuthenticated = !!user;             // <- derive here
  const userId = (user as any)?._id || (user as any)?.id || null;

  const refresh = React.useCallback(async () => {
    console.debug('[notify] refresh: start');
    try {
      const list = await listNotifications({ unreadOnly: true, limit: 20 });
      console.debug('[notify] refresh: ok items=', list.length);
      setItems(list);
    } catch (err) {
      console.error('[notify] refresh: error', err);
    }
  }, []);

  const read = React.useCallback(async (id: string) => {
    try {
      console.debug('[notify] markRead', id);
      await markRead(id);
      setItems(prev => prev.map(it => it._id === id ? { ...it, readAt: new Date().toISOString() } : it));
    } catch (err) {
      console.error('[notify] markRead error', err);
    }
  }, []);

  const close = React.useCallback(async (id: string) => {
    try {
      console.debug('[notify] dismiss', id);
      await dismiss(id);
      setItems(prev => prev.filter(it => it._id !== id));
    } catch (err) {
      console.error('[notify] dismiss error', err);
    }
  }, []);

  React.useEffect(() => {
    let interval: any;

    const stopSSE = () => {
      try { esRef.current?.close(); } catch {}
      esRef.current = null;
      if (interval) clearInterval(interval);
    };

    // ❗ Don’t open SSE until user is authenticated
    if (!isAuthenticated || !userId) {
      console.debug('[notify] skip opening SSE: not authenticated yet');
      stopSSE();
      return;
    }

    // First sync once the user is known
    refresh();

    if (typeof EventSource !== 'undefined') {
      const envBase = (import.meta as any)?.env?.VITE_API_URL;
      const apiBase = envBase ? `${envBase}/api` : '/api';
      const sseUrl = `${apiBase}/notifications/stream`;

      console.debug('[notify] transport=SSE', { sseUrl, userId });
      const es = envBase
        ? new EventSource(sseUrl, { withCredentials: true } as any)
        : new EventSource(sseUrl);
      esRef.current = es;

      es.addEventListener('open', () => console.debug('[notify][sse] open'));
      es.addEventListener('hello', (ev: MessageEvent) => console.debug('[notify][sse] hello', ev.data));

      // Normalize any SSE payload into our NotificationItem shape
      const upsertFromEvent = async (ev: MessageEvent, label = 'message') => {
        try {
          const payload = JSON.parse(ev.data || '{}');
          console.debug(`[notify][sse] ${label} event:`, payload);

          const id = String(payload._id || payload.id || '');
          const item: NotificationItem = {
            _id: id || `tmp-${Date.now()}`,
            userId: payload.userId || String(userId),
            orgId: payload.orgId ?? null,
            type: payload.type || payload.event || 'reminder',
            title: payload.title || 'Reminder',
            body: payload.body || '',
            data: payload.data || {},
            readAt: payload.readAt ?? null,
            resolvedAt: payload.resolvedAt ?? null,
            createdAt: payload.createdAt || new Date().toISOString(),
            updatedAt: payload.updatedAt || new Date().toISOString(),
          };

          // Deduplicate by _id and keep newest first
          setItems(prev => {
            const merged = id ? prev.filter(p => p._id !== id) : prev;
            const seen = new Set<string>();
            return [item, ...merged].filter(p => {
              if (seen.has(p._id)) return false;
              seen.add(p._id);
              return true;
            });
          });
          setLastPopup(item);

          // Sync canonical IDs/state from server
          refresh();
        } catch (e) {
          console.error('[notify][sse] parse error', e);
        }
      };

      // Handle all reasonable server event names
      es.addEventListener('reminder', (ev: MessageEvent) => upsertFromEvent(ev, 'reminder'));
      es.addEventListener('notification', (ev: MessageEvent) => upsertFromEvent(ev, 'notification'));
      es.onmessage = (ev: MessageEvent) => upsertFromEvent(ev, 'message');

      es.onerror = (e: any) => {
        console.warn('[notify][sse] error — falling back to polling', e);
        stopSSE();
        if (!interval) interval = setInterval(refresh, 60_000);
      };

      return () => stopSSE();
    } else {
      console.debug('[notify] transport=polling (no EventSource)');
      interval = setInterval(refresh, 60_000);
      return () => clearInterval(interval);
    }
  }, [refresh, isAuthenticated, userId]);

  const unread = items.filter(it => !it.readAt).length;

  const value: Ctx = { items, unread, lastPopup, read, close, refresh };
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = React.useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
