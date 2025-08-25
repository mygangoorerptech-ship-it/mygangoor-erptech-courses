import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listOrders, refundOrder } from '../../api/orders'
import type { Order } from '../../types/order'
import { formatINR, shortId } from '../../utils/format'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Link } from 'react-router-dom'
import { Receipt, RotateCcw } from 'lucide-react'
import { downloadCSV } from '../../utils/csv'

type Filters = { q: string; status: 'all'|'pending'|'paid'|'failed'|'refunded'|'partial_refund'; method: 'all'|'razorpay'|'stripe'|'paypal'|'manual'; dateFrom?: string; dateTo?: string }

export default function Orders(){
  const [filters,setFilters] = useState<Filters>({ q:'', status:'all', method:'all' })
  const [refundTarget, setRefundTarget] = useState<Order|null>(null)
  const qc = useQueryClient()
  const query = useQuery({ queryKey:['orders',filters], queryFn:()=> listOrders(filters) })
  const refundMut = useMutation({ mutationFn: ({ id, amount, reason }:{ id:string, amount:number, reason?:string }) => refundOrder(id, amount, reason), onSuccess: ()=> qc.invalidateQueries({ queryKey:['orders'] }) })
  const rows = query.data ?? []
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const allSelected = rows.length>0 && rows.every(o=> selected[o.id])
  const toggleAll = ()=> setSelected(prev=>{ const next:Record<string,boolean> = {}; if(!allSelected){ for(const o of rows) next[o.id]=true } return next })
  const selectedIds = rows.filter(o=> selected[o.id]).map(o=>o.id)
  const exportSelected = ()=> {
    const data = rows.filter(o=> selected[o.id]).map(o=>({ order:o.number, customer:o.userName, email:o.userEmail, items:o.items.map(i=>i.name).join('; '), total:(o.total/100).toFixed(2), method:o.paymentMethod, status:o.status, date:new Date(o.createdAt).toISOString() }))
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
          <div className="flex gap-2"><Input type="date" value={filters.dateFrom||''} onChange={(e)=>setFilters(f=>({...f,dateFrom:e.target.value||undefined}))}/><Input type="date" value={filters.dateTo||''} onChange={(e)=>setFilters(f=>({...f,dateTo:e.target.value||undefined}))}/></div>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Selected: {selectedIds.length}</div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={exportSelected} disabled={selectedIds.length===0}>Export CSV</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3 w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="text-left font-medium p-3">Order</th>
              <th className="text-left font-medium p-3">Customer</th>
              <th className="text-left font-medium p-3">Items</th>
              <th className="text-left font-medium p-3">Amount</th>
              <th className="text-left font-medium p-3">Method</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3">Date</th>
              <th className="text-left font-medium p-3 w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(o => {
              const refunded = o.refunds.reduce((s,r)=> s+r.amount, 0)
              return (
                <tr key={o.id} className="border-t">
                  <td className="p-3"><input type="checkbox" checked={!!selected[o.id]} onChange={(e)=> setSelected(s=> ({...s, [o.id]: e.target.checked}))} /></td>
                  <td className="p-3"><div className="font-medium">{o.number}</div><div className="text-xs text-slate-500">{shortId(o.id)}</div></td>
                  <td className="p-3"><div className="font-medium">{o.userName}</div><div className="text-xs text-slate-500">{o.userEmail}</div></td>
                  <td className="p-3"><div className="text-xs text-slate-600 line-clamp-2">{o.items.map(i=>i.name).join(', ')}</div></td>
                  <td className="p-3"><div>{formatINR(o.total)}</div>{refunded>0 && <div className="text-xs text-red-600">Refunded {formatINR(refunded)}</div>}</td>
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
                  <td className="p-3">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/orders/${o.id}/invoice`} className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"><Receipt size={16}/> Invoice</Link>
                      {(o.status==='paid' || o.status==='partial_refund') && (
                        <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setRefundTarget(o)}><RotateCcw size={16}/> Refund</button>
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

      {refundTarget && <RefundModal open={!!refundTarget} order={refundTarget} onClose={()=> setRefundTarget(null)} onSubmit={(amount, reason)=> { refundMut.mutate({ id: refundTarget.id, amount, reason }, { onSuccess: ()=> setRefundTarget(null) }) }}/>}    
    </div>
  )
}

function RefundModal({ open, order, onClose, onSubmit }:{ open:boolean, order:Order, onClose:()=>void, onSubmit:(amount:number, reason?:string)=>void }){
  const refunded = order ? order.refunds.reduce((s,r)=>s+r.amount,0) : 0
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