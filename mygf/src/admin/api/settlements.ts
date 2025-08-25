import { api } from './client'
import { SettlementsDB } from './mockSettlements'
import type { Settlement } from '../types/settlement'

const useMock = (import.meta.env.VITE_API_URL ?? '/mock') === '/mock'

export async function listSettlements(params?: { gateway?: 'all'|'razorpay'|'stripe'|'paypal'; dateFrom?: string; dateTo?: string }): Promise<Settlement[]> {
  if (useMock) return SettlementsDB.list(params as any)
  const { data } = await api.get('/settlements', { params })
  return data
}