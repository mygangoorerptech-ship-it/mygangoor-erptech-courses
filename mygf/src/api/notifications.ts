// src/api/notifications.ts
import { api } from '../api/client';

export type NotificationItem = {
  _id: string;
  userId: string;
  orgId?: string | null;
  type: 'certificate_available' | 'course_incomplete' | 'wishlist_reminder' | 'new_course' | string;
  title: string;
  body: string;
  data?: Record<string, any>;
  readAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listNotifications({ unreadOnly = true, limit = 20 } = {}) {
  console.debug('[notify][api] list', { unreadOnly, limit });
  const { data } = await api.get('/notifications', { params: { unreadOnly, limit } });
  const items = (data?.items || []) as NotificationItem[];
  console.debug('[notify][api] list: got', items.length);
  return items;
}

export async function markRead(id: string) {
  console.debug('[notify][api] read', id);
  await api.post(`/notifications/${id}/read`);
}

export async function dismiss(id: string) {
  console.debug('[notify][api] dismiss', id);
  await api.post(`/notifications/${id}/dismiss`);
}

export function isSameOriginApi(): boolean {
  const base = (import.meta as any)?.env?.VITE_API_URL;
  return !base;
}
