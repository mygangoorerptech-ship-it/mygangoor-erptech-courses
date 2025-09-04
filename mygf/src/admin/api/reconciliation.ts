// src/admin/api/reconciliation.ts
// API helpers for reconciliation and settlement. These functions call
// the backend endpoints to list summary information and settle
// captured payments for organisations.

import { api } from './client'

export type ReconciliationSummary = {
  orgId: string;
  orgName: string;
  orgCode: string | null;
  totalCaptured: number;     // total captured (in paise)
  settledAmount: number;      // amount already settled (in paise)
  unsettledAmount: number;    // outstanding amount to settle (in paise)
  unsettledCount: number;     // number of unsettled payment records
}

/**
 * Fetch aggregated reconciliation data across all organisations. Optional
 * date range parameters can be provided. Returns a list of summaries.
 */
export async function listReconciliation(params?: { dateFrom?: string; dateTo?: string }): Promise<ReconciliationSummary[]> {
  const { data } = await api.get('/sa/reconciliation', { params })
  return data || []
}

/**
 * Mark payments for a specific organisation as settled. If paymentIds is
 * omitted or empty, all unsettled payments in the optional date range
 * will be settled. Returns the updated summary list for all organisations.
 */
export async function settleOrganisation(orgId: string, paymentIds?: string[], options?: { dateFrom?: string; dateTo?: string }): Promise<ReconciliationSummary[]> {
  const { data } = await api.post(`/sa/reconciliation/${orgId}/settle`, {
    paymentIds,
    ...(options || {})
  })
  return data || []
}