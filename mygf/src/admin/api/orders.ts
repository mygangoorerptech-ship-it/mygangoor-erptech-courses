import { api } from './client'
import { OrdersDB } from './mockOrders'
import type { Order } from '../types/order'

const useMock = (import.meta.env.VITE_API_URL ?? '/mock') === '/mock'

export async function listOrders(params?: { q?: string; status?: string; method?: string; dateFrom?: string; dateTo?: string }): Promise<Order[]> {
  if (useMock) return OrdersDB.list(params as any)
  const { data } = await api.get('/orders', { params })
  return data
}
export async function getOrder(id: string): Promise<Order> {
  if (useMock) return OrdersDB.get(id)
  const { data } = await api.get(`/orders/${id}`)
  return data
}
export async function refundOrder(id: string, amount: number, reason?: string): Promise<Order> {
  if (useMock) return OrdersDB.refund(id, amount, reason)
  const { data } = await api.post(`/orders/${id}/refunds`, { amount, reason })
  return data
}