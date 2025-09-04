// src/admin/api/payouts.ts
//
// Client helper for payouts API. Provides functions to list and create
// payout records. A payout is created when the superadmin settles
// captured payments to an organisation.

import { api } from './client'

export interface PayoutSummary {
  id: string
  orgId: string
  orgName: string
  orgCode: string | null
  totalAmount: number
  status: string
  method: string
  reference: string | null
  note: string | null
  paymentCount: number
  createdAt: string
}

export async function listPayouts(params?: { orgId?: string; dateFrom?: string; dateTo?: string }): Promise<PayoutSummary[]> {
  const { data } = await api.get('/sa/payouts', { params })
  return data || []
}

// Create a payout for an organisation. paymentIds optional; if omitted all
// unsettled captured payments will be included. method can be 'manual' or
// 'razorpay', reference/note optional for bookkeeping.
export async function createPayout({
  orgId,
  paymentIds,
  method,
  reference,
  note,
  includeSettled,
  dateFrom,
  dateTo
}: {
  orgId: string
  paymentIds?: string[]
  method?: string
  reference?: string
  note?: string
  includeSettled?: boolean
  dateFrom?: string
  dateTo?: string
}): Promise<{ ok: boolean; id: string; totalAmount: number; paymentCount: number }> {
  const { data } = await api.post('/sa/payouts', {
    orgId, paymentIds, method, reference, note, includeSettled, dateFrom, dateTo
  })
  return data
}

// Get details of a specific payout by id. Returns the payout record with
// an array of payment details.
export async function getPayout(id: string): Promise<{
  id: string
  orgId: string
  paymentCount: number
  totalAmount: number
  status: string
  method: string
  reference: string | null
  note: string | null
  createdAt: string
  payments: { id: string; amount: number; courseId: string | null; studentId: string | null; createdAt: string }[]
}> {
  const { data } = await api.get(`/sa/payouts/${id}`)
  return data
}