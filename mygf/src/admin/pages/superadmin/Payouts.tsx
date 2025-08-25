
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPayouts, approvePayout, markPayoutPaid, failPayout } from '../../api/payouts'
import type { Payout } from '../../types/payout'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { formatINR } from '../../utils/format'
import { Link } from 'react-router-dom'
import { downloadCSV } from '../../utils/csv'
import { Check, X, ReceiptIndianRupee, ExternalLink } from 'lucide-react'

type Filters = { q: string; status: 'all'|'pending'|'in_review'|'approved'|'paid'|'failed'; dateFrom?: string; dateTo?: string }

export default function Payouts(){
  const [filters,setFilters] = useState<Filters>({ q:'', status:'all' })
  const [payTarget, setPayTarget] = useState<Payout|null>(null)
  const [failTarget, setFailTarget] = useState<Payout|null>(null)
  const qc = useQueryClient()
  const query = useQuery({ queryKey:['payouts',filters], queryFn:()=> listPayouts(filters) })
  const approveMut = useMutation({ mutationFn: approvePayout, onSuccess: ()=> qc.invalidateQueries({ queryKey:['payouts'] }) })
  const payMut = useMutation({ mutationFn: ({id,ref,paidAt}:{id:string,ref:string,paidAt?:string})=> markPayoutPaid(id, ref, paidAt), onSuccess: ()=> qc.invalidateQueries({ queryKey:['payouts'] }) })
  const failMut = useMutation({ mutationFn: ({id,reason}:{id:string,reason:string})=> failPayout(id, reason), onSuccess: ()=> qc.invalidateQueries({ queryKey:['payouts'] }) })

  const rows = query.data ?? []

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Org name, reference, ID..." value={filters.q} onChange={(e)=>setFilters(f=>({...f,q:e.target.value}))}/>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=>setFilters(f=>({...f,status:e.target.value as Filters['status']}))}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_review">In review</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Period end</Label>
          <div className="flex gap-2">
            <Input type="date" value={filters.dateFrom||''} onChange={(e)=>setFilters(f=>({...f,dateFrom:e.target.value||undefined}))}/>
            <Input type="date" value={filters.dateTo||''} onChange={(e)=>setFilters(f=>({...f,dateTo:e.target.value||undefined}))}/>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-end gap-2">
        <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={()=>{
          const rows = (query.data||[]).map(p=> ({ id:p.id, org:p.orgName, period:`${new Date(p.periodStart).toISOString().slice(0,10)}→${new Date(p.periodEnd).toISOString().slice(0,10)}`, gross:(p.gross/100).toFixed(2), fees:(p.fees/100).toFixed(2), tax:(p.tax/100).toFixed(2), net:(p.net/100).toFixed(2), status:p.status }))
          downloadCSV('payouts-summary.csv', rows as any)
        }}>Export summary CSV</button>
        <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={()=>{
          const rows = (query.data||[]).flatMap(p=> (p.lines||[]).map(l=> ({ payoutId:p.id, org:p.orgName, order:l.orderNumber, course:l.course, gross:(l.gross/100).toFixed(2), fee:(l.fee/100).toFixed(2), tax:(l.tax/100).toFixed(2), net:(l.net/100).toFixed(2) })))
          downloadCSV('payouts-lines.csv', rows as any)
        }}>Export lines CSV</button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Org</th>
              <th className="text-left font-medium p-3">Period</th>
              <th className="text-left font-medium p-3">Totals</th>
              <th className="text-left font-medium p-3">Method</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
          {rows.map(p => (
            <tr key={p.id} className="border-t">
              <td className="p-3">
                <div className="font-medium">{p.orgName}</div>
                <div className="text-xs text-slate-500">{p.reference || 'No ref'}</div>
              </td>
              <td className="p-3">
                <div>{new Date(p.periodStart).toLocaleDateString()} → {new Date(p.periodEnd).toLocaleDateString()}</div>
                <div className="text-xs text-slate-500">Updated {new Date(p.updatedAt).toLocaleString()}</div>
              </td>
              <td className="p-3">
                <div>Gross {formatINR(p.gross)}</div>
                <div className="text-xs text-slate-600">Fees {formatINR(p.fees)} • Tax {formatINR(p.tax)}</div>
                <div className="font-medium">Net {formatINR(p.net)}</div>
              </td>
              <td className="p-3 capitalize">{p.method.replace('_',' ')}</td>
              <td className="p-3">
                <span className={
                  p.status==='paid' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                  p.status==='approved' ? 'text-blue-700 bg-blue-50 rounded px-2 py-0.5' :
                  p.status==='in_review' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                  p.status==='failed' ? 'text-red-700 bg-red-50 rounded px-2 py-0.5' :
                  'text-slate-700 bg-slate-100 rounded px-2 py-0.5'
                }>{p.status.replace('_',' ')}</span>
              </td>
              <td className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/superadmin/payouts/${p.id}`} className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"><ExternalLink size={16}/> View</Link>
                  {(p.status==='pending'||p.status==='in_review') && <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> approveMut.mutate(p.id)}><Check size={16}/> Approve</button>}
                  {(p.status==='approved') && <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setPayTarget(p)}><ReceiptIndianRupee size={16}/> Mark paid</button>}
                  {p.status!=='paid' && <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setFailTarget(p)}><X size={16}/> Fail</button>}
                </div>
              </td>
            </tr>
          ))}
          {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={6}>No payouts</td></tr>}
          </tbody>
        </table>
      </div>

      <MarkPaidModal open={!!payTarget} payout={payTarget!} onClose={()=> setPayTarget(null)} onSubmit={(ref, paidAt)=> { if(!payTarget) return; payMut.mutate({ id: payTarget.id, ref, paidAt }, { onSuccess: ()=> setPayTarget(null) }) }}/>
      <FailModal open={!!failTarget} payout={failTarget!} onClose={()=> setFailTarget(null)} onSubmit={(reason)=> { if(!failTarget) return; failMut.mutate({ id: failTarget.id, reason }, { onSuccess: ()=> setFailTarget(null) }) }}/>
    </div>
  )
}

function MarkPaidModal({ open, payout, onClose, onSubmit }:{ open:boolean, payout:Payout, onClose:()=>void, onSubmit:(reference:string, paidAt?:string)=>void }){
  const [ref, setRef] = useState(payout?.reference || 'NEFT-' + Math.random().toString(36).slice(2,8).toUpperCase())
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0,16))
  React.useEffect(()=>{ setRef(payout?.reference || 'NEFT-' + Math.random().toString(36).slice(2,8).toUpperCase()); setPaidAt(new Date().toISOString().slice(0,16)) }, [open])
  const canSubmit = ref.trim().length > 2
  return (
    <Modal open={open} onClose={onClose} title={`Mark paid — ${payout?.orgName || ''}`}>
      <div className="space-y-3">
        <div>
          <Label>Reference</Label>
          <Input value={ref} onChange={(e)=> setRef(e.target.value)} placeholder="Bank ref / UTR / Gateway ID" />
        </div>
        <div>
          <Label>Paid at</Label>
          <Input type="datetime-local" value={paidAt} onChange={(e)=> setPaidAt(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button onClick={()=> canSubmit && onSubmit(ref, paidAt ? new Date(paidAt).toISOString() : undefined)} disabled={!canSubmit}>Confirm</Button>
        </div>
      </div>
    </Modal>
  )
}

function FailModal({ open, payout, onClose, onSubmit }:{ open:boolean, payout:Payout, onClose:()=>void, onSubmit:(reason:string)=>void }){
  const [reason, setReason] = useState(payout?.failureReason || 'Bank details invalid')
  React.useEffect(()=>{ setReason(payout?.failureReason || 'Bank details invalid') }, [open])
  const canSubmit = reason.trim().length > 2
  return (
    <Modal open={open} onClose={onClose} title={`Mark failed — ${payout?.orgName || ''}`}>
      <div className="space-y-3">
        <div>
          <Label>Reason</Label>
          <Input value={reason} onChange={(e)=> setReason(e.target.value)} placeholder="Why did the payout fail?" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button onClick={()=> canSubmit && onSubmit(reason)} disabled={!canSubmit}>Confirm</Button>
        </div>
      </div>
    </Modal>
  )
}
