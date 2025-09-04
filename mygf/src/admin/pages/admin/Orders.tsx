// mygf/src/admin/pages/admin/Orders.tsx
import React, { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listOrders, refundOrder, getOrder } from '../../api/orders'
import type { Order } from '../../types/order'
import { formatINR, shortId } from '../../utils/format'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Receipt, RotateCcw } from 'lucide-react'
import { downloadCSV } from '../../utils/csv'
import { useAuth } from '../../auth/store'

type Filters = {
  q: string
  status: 'all'|'pending'|'paid'|'failed'|'refunded'|'partial_refund'
  method: 'all'|'razorpay'|'stripe'|'paypal'|'manual'
  dateFrom?: string
  dateTo?: string
}

/** Extra fields the invoice view needs (added by GET /orders/:id) */
type InvoiceOrder = Order & {
  payments: (Order['payments'][number] & { status?: string })[]
  org?: {
    id: string; code?: string; name?: string; address?: string
    city?: string; state?: string; country?: string; postal?: string
    contactEmail?: string; phone?: string
  }
  admin?: { id: string; name?: string; email?: string }
  course?: { id: string; title: string }
  student?: { id: string; name: string; email: string }
  enrollment?: { id: string; status: 'premium'|'free'|'trial'|'revoked'; source?: string; createdAt?: string }
}

export default function Orders(){
  const [filters,setFilters] = useState<Filters>({ q:'', status:'all', method:'all' })
  const [refundTarget, setRefundTarget] = useState<Order|null>(null)
  const qc = useQueryClient()

  // Type the orders list
  const query = useQuery<Order[]>({
    queryKey:['orders',filters],
    queryFn:()=> listOrders(filters)
  })

  const refundMut = useMutation({
    mutationFn: ({ id, amount, reason }:{ id:string, amount:number, reason?:string }) => refundOrder(id, amount, reason),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['orders'] })
  })

  const rows: Order[] = query.data ?? []
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const allSelected = rows.length>0 && rows.every((o: Order)=> selected[o.id])

  const toggleAll = ()=> setSelected(prev=>{
    const next:Record<string,boolean> = {}
    if(!allSelected){
      for(const o of rows) next[o.id]=true
    }
    return next
  })

  const selectedIds = rows.filter((o: Order)=> selected[o.id]).map((o: Order)=>o.id)

  const [invoiceId, setInvoiceId] = useState<string|null>(null)

  const exportSelected = ()=> {
    const data = rows
      .filter((o: Order)=> selected[o.id])
      .map((o: Order)=>({
        order:o.number,
        customer:o.userName,
        email:o.userEmail,
        items:o.items.map(i=>i.name).join('; '),
        total:(o.total/100).toFixed(2),
        method:o.paymentMethod,
        status:o.status,
        date:new Date(o.createdAt).toISOString()
      }))
    downloadCSV('orders-selected.csv', data as any)
  }

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Order #, name, email, course..." value={filters.q} onChange={(e)=>setFilters(f=>({...f,q:e.target.value}))}/>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=>setFilters(f=>({...f,status:e.target.value as Filters['status']}))}>
            <option value="all">All</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="partial_refund">Partial refund</option><option value="refunded">Refunded</option><option value="failed">Failed</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Method</Label>
          <Select value={filters.method} onChange={(e)=>setFilters(f=>({...f,method:e.target.value as Filters['method']}))}>
            <option value="all">All</option><option value="razorpay">Razorpay</option><option value="stripe">Stripe</option><option value="paypal">PayPal</option><option value="manual">Manual</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <div className="flex gap-2">
            <Input type="date" value={filters.dateFrom||''} onChange={(e)=>setFilters(f=>({...f,dateFrom:e.target.value||undefined}))}/>
            <Input type="date" value={filters.dateTo||''} onChange={(e)=>setFilters(f=>({...f,dateTo:e.target.value||undefined}))}/>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Selected: {selectedIds.length}</div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={exportSelected} disabled={selectedIds.length===0}>Export CSV</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3 w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="text-left font-medium p-3">Order</th>
              <th className="text-left font-medium p-3">Customer</th>
              <th className="text-left font-medium p-3">Items</th>
              <th className="text-left font-medium p-3">Amount</th>
              <th className="text-left font-medium p-3">Method</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-48 md:w-56">Date</th>
              <th className="text-left font-medium p-3 w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o: Order) => {
              const refunded = o.refunds.reduce(
                (s: number, r: Order['refunds'][number])=> s + r.amount,
                0
              )
              return (
                <tr key={o.id} className="border-t">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={!!selected[o.id]}
                      onChange={(e)=> setSelected(s=> ({...s, [o.id]: e.target.checked}))}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{o.number}</div>
                    <div className="text-xs text-slate-500">{shortId(o.id)}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{o.userName}</div>
                    <div className="text-xs text-slate-500">{o.userEmail}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-xs text-slate-600 line-clamp-2">{o.items.map(i=>i.name).join(', ')}</div>
                  </td>
                  <td className="p-3">
                    <div>{formatINR(o.total)}</div>
                    {refunded>0 && <div className="text-xs text-red-600">Refunded {formatINR(refunded)}</div>}
                  </td>
                  <td className="p-3">{o.paymentMethod}</td>
                  <td className="p-3">
                    <span className={
                      o.status==='paid' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                      o.status==='pending' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                      o.status==='failed' ? 'text-red-700 bg-red-50 rounded px-2 py-0.5' :
                      o.status==='partial_refund' ? 'text-violet-700 bg-violet-50 rounded px-2 py-0.5' :
                      'text-slate-700 bg-slate-100 rounded px-2 py-0.5'
                    }>{o.status}</span>
                  </td>
                   <td className="p-3 w-48 md:w-56"> 
   <div className="truncate whitespace-nowrap">{new Date(o.createdAt).toLocaleString()}</div> 
 </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                        onClick={()=> setInvoiceId(o.id)}
                        title="View invoice"
                      >
                        <Receipt size={16}/> Invoice
                      </button>
                      {(o.status==='paid' || o.status==='partial_refund') && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> setRefundTarget(o)}
                        >
                          <RotateCcw size={16}/> Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={8}>No orders</td></tr>}
          </tbody>
        </table>
      </div>

      {refundTarget && (
        <RefundModal
          open={!!refundTarget}
          order={refundTarget}
          onClose={()=> setRefundTarget(null)}
          onSubmit={(amount, reason)=> {
            refundMut.mutate({ id: refundTarget.id, amount, reason }, { onSuccess: ()=> setRefundTarget(null) })
          }}
        />
      )}

      {invoiceId && <InvoiceModal orderId={invoiceId} onClose={()=> setInvoiceId(null)} />}
    </div>
  )
}

function RefundModal({ open, order, onClose, onSubmit }:{
  open:boolean, order:Order, onClose:()=>void, onSubmit:(amount:number, reason?:string)=>void
}){
  const refunded = order ? order.refunds.reduce(
    (s: number, r: Order['refunds'][number])=> s + r.amount, 0
  ) : 0
  const remaining = Math.max(0, order.total - refunded)
  const [amount, setAmount] = useState(String(remaining/100))
  const [reason, setReason] = useState('')
  React.useEffect(()=>{ setAmount(String(remaining/100)); setReason('') }, [open])
  const canSubmit = parseFloat(amount) > 0 && parseFloat(amount) <= (remaining/100)
  return (
    <Modal open={open} onClose={onClose} title={`Refund ${order?.number}`}>
      <div className="space-y-3">
        <div className="text-sm text-slate-600">Remaining refundable: <b>{formatINR(remaining)}</b></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Refund amount (INR)</Label><Input type="number" step="0.01" min="0" value={amount} onChange={(e)=> setAmount(e.target.value)} /></div>
          <div><Label>Reason (optional)</Label><Input value={reason} onChange={(e)=> setReason(e.target.value)} placeholder="e.g., duplicate order" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button onClick={()=> canSubmit && onSubmit(Math.round(parseFloat(amount||'0')*100), reason)} disabled={!canSubmit}>Refund</Button>
        </div>
      </div>
    </Modal>
  )
}

function InvoiceModal({ orderId, onClose }:{ orderId:string, onClose:()=>void }){
  const { user } = useAuth() as any

  // Type the single order returned by GET /orders/:id
  const q = useQuery<InvoiceOrder>({
    queryKey:['order:invoice', orderId],
    queryFn: ()=> getOrder(orderId),
    enabled: !!orderId
  })

  const ref = useRef<HTMLDivElement>(null)

  const printOrDownload = ()=>{
    if (!ref.current) return
    const w = window.open('', '_blank', 'width=900,height=1000')
    if (!w) return
    const styles = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin:0; padding:24px; color:#0f172a; }
        .muted { color:#64748b }
        .h1 { font-size:22px; font-weight:700; }
        .grid { display:grid; gap:16px; grid-template-columns: 1fr 1fr; }
        .right { text-align:right }
        table { width:100%; border-collapse:collapse; font-size:14px; }
        th, td { padding:10px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
        tfoot td { border-bottom:none }
        .badge { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:12px; }
        .badge.paid { background:#ecfdf5; color:#065f46 }
        .badge.refunded { background:#f1f5f9; color:#334155 }
        .badge.pending { background:#fffbeb; color:#92400e }
        .badge.failed { background:#fef2f2; color:#991b1b }
        .card { border:1px solid #e2e8f0; border-radius:12px; padding:16px; }
        .small { font-size:12px; }
      </style>
    `;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Invoice ${orderId}</title>${styles}</head><body>${ref.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const copyLink = ()=>{
    const url = `${location.origin}/admin/orders/${orderId}/invoice`;
    navigator.clipboard?.writeText(url);
  }

  const o = q.data
  return (
    <Modal open={true} onClose={onClose} title="Invoice">
      {q.isLoading && <div className="p-6">Loading…</div>}
      {!q.isLoading && !o && <div className="p-6">Not found</div>}

      {o && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <button className="rounded-md border px-3 py-2 text-sm" onClick={copyLink} title="Copy invoice link">Copy link</button>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={printOrDownload} title="Download PDF">Download PDF</button>
            <Button onClick={onClose}>Close</Button>
          </div>

          <div ref={ref} className="bg-white rounded-xl border p-6">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="text-2xl font-semibold tracking-tight">INVOICE</div>
                <div className="text-sm text-slate-600">{o.number}</div>
              </div>
              <div className="text-right">
                <div className={
                  `badge ${o.status==='paid' ? 'paid' :
                          o.status==='refunded' || o.status==='partial_refund' ? 'refunded' :
                          o.status==='failed' ? 'failed' : 'pending'}`
                }>{o.status.replace('_',' ')}</div>
                <div className="text-xs text-slate-500 mt-2">Issued</div>
                <div className="text-sm">{new Date(o.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mt-6">
              <div className="card">
                <div className="text-xs text-slate-500">Billed To</div>
                <div className="font-medium">{o.userName}</div>
                <div className="text-sm text-slate-600">{o.userEmail}</div>
                {o.student?.id && <div className="text-xs mt-2 muted">Student ID: {o.student.id}</div>}
                {o.enrollment?.status && (
                  <div className="text-xs mt-2">
                    Enrollment: <b className={o.enrollment.status==='premium' ? 'text-green-700' : 'text-slate-700'}>
                      {o.enrollment.status}
                    </b>
                    {o.enrollment?.createdAt && <> • since {new Date(o.enrollment.createdAt).toLocaleDateString()}</>}
                  </div>
                )}
              </div>
              <div className="card">
                <div className="text-xs text-slate-500">From</div>
                <div className="font-medium">{o.org?.name || 'Organization'}</div>
                <div className="text-sm text-slate-600">{o.org?.address}</div>
                <div className="text-sm text-slate-600">{[o.org?.city,o.org?.state,o.org?.postal].filter(Boolean).join(', ')}</div>
                <div className="text-sm text-slate-600">{o.org?.country}</div>
                <div className="text-xs mt-2 muted">Org Code: {o.org?.code} • Org ID: {o.org?.id}</div>
                {o.admin && <div className="text-xs mt-2">Admin: <b>{o.admin.name}</b> ({o.admin.email})</div>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mt-2">
              <div className="card">
                <div className="text-xs text-slate-500">Course</div>
                <div className="font-medium">{o.course?.title || o.items[0]?.name}</div>
                <div className="text-xs muted mt-1">Course ID: {o.course?.id || o.items[0]?.id}</div>
              </div>
              <div className="card">
                <div className="text-xs text-slate-500">Order & Payment</div>
                <div className="text-sm">Order ID: <span className="font-mono">{o.id}</span></div>
                <div className="text-sm">Method: <span className="capitalize">{o.paymentMethod}</span></div>
                <div className="text-xs muted mt-1">Payments:</div>
                <div className="text-xs muted">
                  {o.payments.map((p: InvoiceOrder['payments'][number])=> (
                    <div key={p.id}>• {p.id} — {p.status} — {new Date(p.createdAt).toLocaleString()}</div>
                  ))}
                </div>
              </div>
            </div>

            <section className="mt-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2 font-medium">Item</th>
                    <th className="text-right p-2 font-medium">Qty</th>
                    <th className="text-right p-2 font-medium">Price</th>
                    <th className="text-right p-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it: InvoiceOrder['items'][number])=>(
                    <tr key={it.id} className="border-b">
                      <td className="p-2">
                        <div className="font-medium">{it.name}</div>
                        <div className="text-xs text-slate-500">SKU: {it.sku}</div>
                      </td>
                      <td className="p-2 text-right">{it.quantity}</td>
                      <td className="p-2 text-right">{formatINR(it.amount)}</td>
                      <td className="p-2 text-right">{formatINR(it.amount * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} className="p-2 text-right">Subtotal</td><td className="p-2 text-right">{formatINR(o.subtotal)}</td></tr>
                  <tr><td colSpan={3} className="p-2 text-right">Tax</td><td className="p-2 text-right">{formatINR(o.tax)}</td></tr>
                  <tr><td colSpan={3} className="p-2 text-right font-semibold">Total</td><td className="p-2 text-right font-semibold">{formatINR(o.total)}</td></tr>
                  {Array.isArray(o.refunds) && o.refunds.length>0 && (
                    <tr>
                      <td colSpan={3} className="p-2 text-right text-red-700">Refunded</td>
                      <td className="p-2 text-right text-red-700">
                        - {formatINR(o.refunds.reduce((s: number, r: InvoiceOrder['refunds'][number])=> s + r.amount, 0))}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </section>

            <div className="mt-6 small muted">
              <div>Thank you for your purchase. Access to the course is provisioned via your enrollment.</div>
              {o.enrollment?.status === 'premium' && (
                <div className="mt-1">Status: <b>Enrolled as PREMIUM member</b> for this course.</div>
              )}
              <div className="mt-2">This is a computer-generated invoice. If you have questions, contact {o.org?.contactEmail || o.admin?.email || (user?.email as string | undefined)}.</div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
