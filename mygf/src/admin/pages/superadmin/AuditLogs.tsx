import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuditDB } from '../../api/mockAudit'
import type { AuditLog, AuditFilters, AuditAction, AuditResource, AuditStatus } from '../../types/audit'
import { listOrgs } from '../../../api/orgs'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Download, Trash2, Eye } from 'lucide-react'

const ACTIONS: Array<AuditAction|'all'> = ['all','create','update','delete','status_change','publish','unpublish','refund','cancel','bulk_upsert','reorder','attach','detach','login','logout','other']
const RESOURCES: Array<AuditResource|'all'> = ['all','student','organization','user','course','subscription','assessment','assignment','certificate','question','payout','payment','cms','integration','other']
const STATUSES: Array<AuditStatus|'all'>   = ['all','success','failure']

export default function SAAuditLogs(){
  const qc = useQueryClient()
  const [filters, setFilters] = useState<AuditFilters>({ action:'all', resource:'all', status:'all' })
  const [view, setView] = useState<AuditLog|null>(null)

  const orgsQ = useQuery({ queryKey:['sa-orgs:lookup'], queryFn: ()=> listOrgs({}) })
  const query = useQuery({ queryKey:['audit', filters], queryFn: ()=> AuditDB.list(filters) })

  const clearMut = useMutation({ mutationFn: ()=> AuditDB.clear(), onSuccess: ()=> qc.invalidateQueries({ queryKey:['audit'] }) })
  const exportMut = useMutation({
    mutationFn: ()=> AuditDB.exportCSV(filters),
    onSuccess: (csv)=> {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `audit-logs.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  })

  const rows = query.data ?? []
  const orgs = orgsQ.data ?? []

  const countBy = useMemo(()=>{
    const c: Record<string, number> = {}
    rows.forEach(r => { c[r.action] = (c[r.action]||0) + 1 })
    return c
  }, [rows])

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Actor, message, path…" value={filters.q||''} onChange={(e)=> setFilters(f=> ({...f, q:e.target.value||undefined}))} />
        </div>
        <div className="space-y-2">
          <Label>Action</Label>
          <Select value={(filters.action||'all') as any} onChange={(e)=> setFilters(f=> ({...f, action: e.target.value as any}))}>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Resource</Label>
          <Select value={(filters.resource||'all') as any} onChange={(e)=> setFilters(f=> ({...f, resource: e.target.value as any}))}>
            {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={(filters.status||'all') as any} onChange={(e)=> setFilters(f=> ({...f, status: e.target.value as any}))}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Organization</Label>
          <Select value={filters.orgId||''} onChange={(e)=> setFilters(f=> ({...f, orgId: e.target.value || undefined}))}>
            <option value="">Any</option>
            {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Actor (email)</Label>
          <Input value={filters.actorEmail||''} onChange={(e)=> setFilters(f=> ({...f, actorEmail: e.target.value || undefined}))} />
        </div>

        <div className="space-y-2">
          <Label>From</Label>
          <Input type="datetime-local" value={(filters.from||'').slice(0,16)} onChange={(e)=> setFilters(f=> ({...f, from: e.target.value ? new Date(e.target.value).toISOString() : undefined}))}/>
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <Input type="datetime-local" value={(filters.to||'').slice(0,16)} onChange={(e)=> setFilters(f=> ({...f, to: e.target.value ? new Date(e.target.value).toISOString() : undefined}))}/>
        </div>
        <div className="md:col-span-2 flex items-end justify-end gap-2">
          <Button variant="ghost" onClick={()=> exportMut.mutate()}><Download size={16}/> Export CSV</Button>
          <Button variant="danger" onClick={()=> { if(confirm('Clear all audit logs?')) clearMut.mutate() }}><Trash2 size={16}/> Clear</Button>
        </div>
      </header>

      {/* quick counts bar */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        {Object.entries(countBy).map(([k,v])=> (
          <span key={k} className="rounded px-2 py-1 bg-slate-100">{k}: {v}</span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Time</th>
              <th className="text-left font-medium p-3">Actor</th>
              <th className="text-left font-medium p-3">Action</th>
              <th className="text-left font-medium p-3">Resource</th>
              <th className="text-left font-medium p-3">Org</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3">Message</th>
              <th className="text-left font-medium p-3 w-[180px]">Inspect</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{new Date(r.ts).toLocaleString()}</td>
                <td className="p-3">{r.actorName || r.actorEmail || '—'}</td>
                <td className="p-3">{r.action}</td>
                <td className="p-3">{r.resource}{r.resourceId ? ` (${r.resourceId})` : ''}</td>
                <td className="p-3">{r.orgId || '—'}</td>
                <td className="p-3">
                  <span className={
                    r.status==='success' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                    'text-red-700 bg-red-50 rounded px-2 py-0.5'
                  }>{r.status}</span>
                </td>
                <td className="p-3">{r.message || '—'}</td>
                <td className="p-3">
                  <Button variant="ghost" onClick={()=> setView(r)}><Eye size={16}/> View</Button>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={8}>No logs</td></tr>}
          </tbody>
        </table>
      </div>

      <ViewModal open={!!view} log={view} onClose={()=> setView(null)} />
    </div>
  )
}

function ViewModal({ open, log, onClose }:{ open:boolean; log: AuditLog|null; onClose:()=>void }){
  if (!log) return null
  const pretty = (v:any)=> JSON.stringify(v, null, 2)
  return (
    <Modal open={open} onClose={onClose} title="Audit details">
      <div className="grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Meta</div>
          <pre className="text-xs rounded border bg-slate-50 p-2 overflow-auto">{pretty({
            ts: log.ts, action: log.action, status: log.status,
            actor: { email: log.actorEmail, name: log.actorName, role: log.actorRole },
            resource: { type: log.resource, id: log.resourceId, orgId: log.orgId },
            http: { method: log.method, path: log.path },
            message: log.message
          })}</pre>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Diff (shallow)</div>
          <pre className="text-xs rounded border bg-slate-50 p-2 overflow-auto">{pretty(log.diff)}</pre>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <div className="text-xs text-slate-500">Before / After</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <pre className="text-xs rounded border bg-slate-50 p-2 overflow-auto">{pretty(log.before)}</pre>
            <pre className="text-xs rounded border bg-slate-50 p-2 overflow-auto">{pretty(log.after)}</pre>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
