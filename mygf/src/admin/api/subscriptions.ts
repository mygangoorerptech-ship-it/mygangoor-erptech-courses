// src/admin/api/subscriptions.ts
import { api } from './client'
import type { Subscription, SubscriptionFilters } from '../types/subscription'

export async function listSubscriptions(filters: SubscriptionFilters){
  const r = await api.get('/subscriptions', { params: filters })
  return r.data as Subscription[]
}
export async function createSubscription(payload: Omit<Subscription,'id'|'createdAt'|'updatedAt'>){
  const r = await api.post('/subscriptions', payload)
  return r.data as Subscription
}
export async function updateSubscription(id:string, patch: Partial<Subscription>){
  const r = await api.post(`/subscriptions/${id}`, patch)
  return r.data as Subscription
}
export async function refundSubscription(id: string){
  const r = await api.post(`/subscriptions/${id}/refund`, {})
  return r.data as Subscription
}
export async function cancelSubscription(id: string){
  const r = await api.post(`/subscriptions/${id}/cancel`, {})
  return r.data as Subscription
}

export async function deleteSubscription(id: string){
  const r = await api.delete(`/subscriptions/${id}/delete`, {})
  return r.data as any
}