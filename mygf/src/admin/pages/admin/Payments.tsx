// mygf/src/admin/pages/admin/Payments.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPayments, refundPayment, createOfflinePayment, verifyPayment } from '../../../api/payments'
import { useAuth } from '../../auth/store'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import OfflinePaymentModal from '../../features/payments/OfflinePaymentModal'
import { RotateCcw, Search, CheckCircle2, Plus } from 'lucide-react'

// include 'submitted' so offline flow can be verified
type PaymentStatus = 'initiated' | 'submitted' | 'captured' | 'refunded' | 'failed' | 'pending' | 'verified'
type Filters = { q?: string; status: 'all' | PaymentStatus }

export default function ADPayments() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>({ q: '', status: 'all' })
  const [target, setTarget] = useState<any | null>(null)
  const [openOffline, setOpenOffline] = useState(false)

  const query = useQuery({
    queryKey: ['admin-payments', filters],
    queryFn: () => listPayments({ q: filters.q || undefined, status: filters.status })
  })

  const refundMut = useMutation({
    mutationFn: (id: string) => refundPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payments'] })
  })

  // create offline payment
  const createOfflineMut = useMutation({
    mutationFn: createOfflinePayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payments'] })
      setOpenOffline(false)
    }
  })

  // verify submitted offline payment
  const verifyMut = useMutation({
    mutationFn: (id: string) => verifyPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payments'] })
  })

  const rows = query.data ?? []

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input className="pl-8" placeholder="Email, order id, method..." value={filters.q || ''} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as Filters['status'] }))}>
            <option value="all">All</option>
            <option value="initiated">Initiated</option>
            <option value="submitted">Submitted</option>
            <option value="captured">Captured</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
        <div className="flex items-end justify-end md:col-span-2 gap-2">
          <Button onClick={() => setOpenOffline(true)}><Plus size={16} /> Record Offline</Button>
          <Button variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['admin-payments'] })}>Refresh</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">When</th>
              <th className="text-left font-medium p-3">Order / Sub</th>
              <th className="text-left font-medium p-3">Student</th>
              <th className="text-left font-medium p-3">Amount</th>
              <th className="text-left font-medium p-3">Method</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{new Date(p.createdAt).toLocaleString()}</td>
                <td className="p-3">
                  <div className="font-mono text-xs">{p.orderId || p.subscriptionId || '—'}</div>
                </td>
                <td className="p-3">{p.studentEmail || p.student?.email || '—'}</td>
                <td className="p-3">₹{((p.amount || 0) / 100).toFixed(2)}</td>
                <td className="p-3">{p.method || '—'}</td>
                <td className="p-3">
                  <span className={
                    p.status === 'captured' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                      p.status === 'initiated' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                        p.status === 'submitted' ? 'text-indigo-700 bg-indigo-50 rounded px-2 py-0.5' :
                          p.status === 'refunded' ? 'text-slate-700 bg-slate-100 rounded px-2 py-0.5' :
                            'text-red-700 bg-red-50 rounded px-2 py-0.5'
                  }>{p.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {p.status === 'submitted' && (
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => verifyMut.mutate(p.id)}
                        disabled={verifyMut.isPending}
                        title="Verify offline payment"
                      >
                        <CheckCircle2 size={16} /> Verify
                      </Button>
                    )}
                    {p.status === 'captured' && (
                      <Button variant="danger" onClick={() => setTarget(p)}><RotateCcw size={16} /> Refund</Button>
                    )}
                    <Button variant="ghost" onClick={() => setTarget(p)}>View</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="p-6 text-center text-slate-500" colSpan={7}>No payments</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title="Payment details">
        {target && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-slate-500">ID</div><div className="font-mono text-sm">{target.id}</div></div>
              <div><div className="text-xs text-slate-500">Status</div><div className="text-sm">{target.status}</div></div>
              <div><div className="text-xs text-slate-500">Amount</div><div className="text-sm">₹{((target.amount || 0) / 100).toFixed(2)}</div></div>
              <div><div className="text-xs text-slate-500">Method</div><div className="text-sm">{target.method || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Order/Sub</div><div className="text-sm">{target.orderId || target.subscriptionId || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Student</div><div className="text-sm">{target.studentEmail || '—'}</div></div>
            </div>
            {(() => {
              let form = null

              try {
                form = target.notes ? JSON.parse(target.notes) : null
              } catch {
                form = { error: 'Invalid data' }
              }

              if (!form) return null

              if (form.error) {
                return (
                  <div className="mt-4 border-t pt-3 text-xs text-red-500">
                    Invalid join form data
                  </div>
                )
              }

              const f = form?.joinForm || {};

              const fields: [string, any][] = [
                ['Full Name', f.fullName],
                ['Age', f.age],
                ['Gender', f.gender],
                ['Date of Birth', f.birth],
                ['Mobile', f.mobile],
                ['Email', f.email],
                ['Address', f.address],
              ];

              return (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs text-slate-500 mb-2 font-medium">
                    Join Form Details
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map(([label, val]) =>
                      val != null ? (
                        <div key={label}>
                          <div className="text-xs text-slate-500">{label}</div>
                          <div className="text-sm">{String(val)}</div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )
            })()}
            <div className="flex justify-end gap-2 pt-2">
              {target.status === 'captured' && (
                <Button
                  variant="danger"
                  onClick={() => {
                    refundMut.mutate(target.id, { onSuccess: () => setTarget((p: any) => ({ ...p, status: 'refunded' })) })
                  }}
                  disabled={refundMut.isPending}
                >
                  {refundMut.isPending ? 'Refunding…' : 'Refund'}
                </Button>
              )}
              <Button onClick={() => setTarget(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Offline payment entry */}
      <OfflinePaymentModal
        open={openOffline}
        onClose={() => setOpenOffline(false)}
        onSubmit={(payload) => createOfflineMut.mutateAsync(payload).then(() => { })}
      />
    </div>
  )
}
