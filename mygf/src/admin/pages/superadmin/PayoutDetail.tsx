// mygf/src/admin/pages/superadmin/PayoutDetail.tsx
//
// Displays details for a specific payout. Shows the basic information
// about the payout and lists the payments included in it.

import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPayout } from '../../api/payouts'
import { formatINR } from '../../utils/format'

export default function PayoutDetail() {
  const { id } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['payout', id], queryFn: () => getPayout(id as string), enabled: !!id })
  if (isLoading) return <div>Loading…</div>
  if (!data) return <div className="p-4 text-slate-500">Payout not found</div>
  const p = data
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Payout ID</div>
          <div className="mt-1 text-sm font-mono break-all">{p.id}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Organisation</div>
          <div className="mt-1 text-sm">{p.orgId}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Total Amount</div>
          <div className="mt-1 text-xl font-semibold">{formatINR(p.totalAmount)}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Payments Count</div>
          <div className="mt-1 text-xl font-semibold">{p.paymentCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Method</div>
          <div className="mt-1 text-sm">{p.method}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-slate-500">Reference</div>
          <div className="mt-1 text-sm">{p.reference || '-'}</div>
        </div>
        {p.note && (
          <div className="rounded-xl border bg-white p-4 sm:col-span-2">
            <div className="text-xs text-slate-500">Note</div>
            <div className="mt-1 text-sm whitespace-pre-wrap">{p.note}</div>
          </div>
        )}
      </div>
      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 font-medium">Payment ID</th>
              <th className="text-left p-2 font-medium">Course ID</th>
              <th className="text-left p-2 font-medium">Student ID</th>
              <th className="text-right p-2 font-medium">Amount (₹)</th>
              <th className="text-left p-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {p.payments.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="p-2 font-mono text-xs">{l.id}</td>
                <td className="p-2 text-xs">{l.courseId || '-'}</td>
                <td className="p-2 text-xs">{l.studentId || '-'}</td>
                <td className="p-2 text-right">{formatINR(l.amount)}</td>
                <td className="p-2 text-xs">{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {p.payments.length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={5}>
                  No payments included
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}