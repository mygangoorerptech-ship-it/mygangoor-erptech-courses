// src/api/wishlist.ts
import { api } from '../config/api';

export async function getWishlistIds(): Promise<string[]> {
  const { data } = await api.get('/student/wishlist');
  // backend returns { items: [...] } not { ids: [...] }
  return data?.items ?? [];
}

export async function addWishlist(id: string) {
  // backend expects POST /student/wishlist/toggle with { courseId }
  await api.post('/student/wishlist/toggle', { courseId: id });
}

export async function removeWishlist(id: string) {
  // toggling again removes it
  await api.post('/student/wishlist/toggle', { courseId: id });
}