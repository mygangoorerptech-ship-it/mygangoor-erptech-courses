// src/admin/api/orders.ts
import { api } from './client'

export async function listOrders(params?: { q?: string; status?: 'all'|'pending'|'paid'|'failed'|'refunded'|'partial_refund'; method?: 'all'|'razorpay'|'stripe'|'paypal'|'manual'; dateFrom?: string; dateTo?: string }){
  const { data } = await api.get('/orders', { params })
  return data
}
export async function getOrder(id: string){
  const { data } = await api.get(`/orders/${id}`)
  return data
}
 export async function refundOrder(id: string, amount: number, reason?: string){ 
   const { data } = await api.post(`/orders/${id}/refund`, { amount, reason })
  return data
}