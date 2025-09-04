// mygf/src/admin/pages/superadmin/Payouts.tsx
//
// Superadmin payouts listing screen. Shows past payout transactions grouped
// by organisation. Allows optional filtering by date range and organisation.
// Payouts are created via the Reconciliation page when the superadmin
// settles payments. This page provides a read-only summary.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listPayouts, type PayoutSummary } from '../../api/payouts'
import { Input, Label } from '../../components/Input'
import Button from '../../components/Button'
import { formatINR } from '../../utils/format'

export default function Payouts() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<{ orgId?: string; dateFrom?: string; dateTo?: string }>({})
  const { data = [], isLoading } = useQuery<PayoutSummary[]>({
    queryKey: ['payouts', filters],
    queryFn: () => listPayouts(filters),
  })

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['payouts'] })
  }

  return (
    <div className="space-y-6">
      <header className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Organisation ID (optional)</Label>
          <Input
            value={filters.orgId || ''}
            onChange={(e) => setFilters((f) => ({ ...f, orgId: e.target.value || undefined }))}
            placeholder="orgId"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Date range</Label>
          <div className="flex gap-2">
            <Input type="date" value={filters.dateFrom || ''} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))} />
            <Input type="date" value={filters.dateTo || ''} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))} />
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          <Button variant="ghost" onClick={handleRefresh}>Refresh</Button>
        </div>
      </header>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Payout ID</th>
              <th className="text-left font-medium p-3">Organisation</th>
              <th className="text-right font-medium p-3">Amount (₹)</th>
              <th className="text-left font-medium p-3">Method</th>
              <th className="text-left font-medium p-3">Reference</th>
              <th className="text-right font-medium p-3">Payments</th>
              <th className="text-left font-medium p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 text-xs font-mono">{p.id}</td>
                <td className="p-3">
                  <div className="font-medium">{p.orgName}</div>
                  {p.orgCode && <div className="text-xs text-slate-500">{p.orgCode}</div>}
                </td>
                <td className="p-3 text-right">{formatINR(p.totalAmount)}</td>
                <td className="p-3">{p.method}</td>
                <td className="p-3 truncate max-w-xs" title={p.reference || ''}>{p.reference || '-'}</td>
                <td className="p-3 text-right">{p.paymentCount}</td>
                <td className="p-3">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={7}>
                  {isLoading ? 'Loading…' : 'No payouts found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}