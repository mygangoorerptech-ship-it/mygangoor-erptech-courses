// mygf/src/admin/pages/superadmin/Reconciliation.tsx
//
// Superadmin reconciliation screen. Shows a summary of captured online
// payments per organisation and allows the superadmin to mark
// outstanding amounts as settled. This page replaces the previous
// mock-based settlements view and integrates with the real backend
// via the reconciliation API added in this task.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// Use the admin API helpers relative to the pages directory. The correct path
// is two levels up (../../) to reach src/admin/api, not three levels.
import { listReconciliation, settleOrganisation, type ReconciliationSummary } from '../../api/reconciliation'
import { createPayout } from '../../api/payouts'
import { Input, Label } from '../../components/Input'
import Button from '../../components/Button'
import { formatINR } from '../../utils/format'

export default function Reconciliation() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<{ dateFrom?: string; dateTo?: string }>({})
  const { data = [], isLoading } = useQuery<ReconciliationSummary[]>({
    queryKey: ['reconciliation', filters],
    queryFn: () => listReconciliation(filters)
  })

  const settleMut = useMutation({
    // When settling, we create a payout record for the organisation. If paymentIds
    // are omitted all captured unsettled payments in the optional date range
    // will be included. After completion we refresh both reconciliation and
    // payouts queries.
    mutationFn: async (orgId: string) => {
      // call createPayout to generate a payout and mark payments as settled
      await createPayout({ orgId });
      // Also call settleOrganisation to ensure any outstanding unsettled offline flows
      // This retains backwards compatibility with older API; but createPayout
      // already marks as settled, so this call is idempotent.
      return await settleOrganisation(orgId, undefined, filters);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] })
      qc.invalidateQueries({ queryKey: ['payouts'] })
    }
  })

  const handleSettle = (orgId: string) => {
    settleMut.mutate(orgId)
  }

  const rows = data

  return (
    <div className="space-y-6">
      <header className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Label>Date range</Label>
          <div className="flex gap-2">
            <Input type="date" value={filters.dateFrom || ''} onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))} />
            <Input type="date" value={filters.dateTo || ''} onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))} />
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          <Button variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['reconciliation'] })}>Refresh</Button>
        </div>
      </header>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Organisation</th>
              <th className="text-right font-medium p-3">Total (₹)</th>
              <th className="text-right font-medium p-3">Settled (₹)</th>
              <th className="text-right font-medium p-3">Unsettled (₹)</th>
              <th className="text-right font-medium p-3">Unsettled Count</th>
              <th className="text-left font-medium p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.orgId} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{r.orgName}</div>
                  {r.orgCode && <div className="text-xs text-slate-500">{r.orgCode}</div>}
                </td>
                <td className="p-3 text-right">{formatINR(r.totalCaptured)}</td>
                <td className="p-3 text-right">{formatINR(r.settledAmount)}</td>
                <td className="p-3 text-right">{formatINR(r.unsettledAmount)}</td>
                <td className="p-3 text-right">{r.unsettledCount}</td>
                <td className="p-3">
                  <Button
                    onClick={() => handleSettle(r.orgId)}
                    disabled={r.unsettledCount === 0 || settleMut.isPending}
                    className="h-8 px-3 text-xs"
                  >
                    {settleMut.isPending ? 'Settling…' : 'Settle All'}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={6}>
                  {isLoading ? 'Loading…' : 'No captured payments'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}