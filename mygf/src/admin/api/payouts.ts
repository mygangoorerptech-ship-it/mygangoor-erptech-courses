import { api } from './client'
import { PayoutsDB } from './mockPayouts'
import type { Payout } from '../types/payout'

const useMock = (import.meta.env.VITE_API_URL ?? '/mock') === '/mock'

export async function listPayouts(params?: { q?: string; status?: string; dateFrom?: string; dateTo?: string }): Promise<Payout[]> {
  if (useMock) return PayoutsDB.list(params as any)
  const { data } = await api.get('/payouts', { params })
  return data
}
export async function getPayout(id: string): Promise<Payout> {
  if (useMock) return PayoutsDB.get(id)
  const { data } = await api.get(`/payouts/${id}`)
  return data
}
export async function approvePayout(id: string): Promise<Payout> {
  if (useMock) return PayoutsDB.approve(id)
  const { data } = await api.post(`/payouts/${id}/approve`, {})
  return data
}
export async function markPayoutPaid(id: string, reference: string, paidAt?: string): Promise<Payout> {
  if (useMock) return PayoutsDB.markPaid(id, reference, paidAt)
  const { data } = await api.post(`/payouts/${id}/pay`, { reference, paidAt })
  return data
}
export async function failPayout(id: string, reason: string): Promise<Payout> {
  if (useMock) return PayoutsDB.fail(id, reason)
  const { data } = await api.post(`/payouts/${id}/fail`, { reason })
  return data
}