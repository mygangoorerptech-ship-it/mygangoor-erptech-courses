


//mygf/src/pages/superadmin/Organizations.tsx
import React, { useRef, useState } from 'react'
import { useSaOrgs } from '../../store/saOrganizations'
import type { Organization, OrgStatus } from '../../types/org'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Building2, Globe, Mail, User, Upload, Plus, Pencil, Trash2, CheckCircle2, XCircle, ShieldOff } from '../../../icons';
import { useAuth } from '../../auth/store';
import * as XLSX from 'xlsx';

type Filters = { q: string; status: 'all' | OrgStatus }

export default function SAOrganizations(){
  const [filters, setFilters] = useState<Filters>({ q:'', status:'all' })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: Organization}|null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const { user, status } = useAuth();

  // Zustand-backed cache & actions (ETag-aware)
const rows = useSaOrgs(s => s.items);
const loading = useSaOrgs(s => s.loading);
const error = useSaOrgs(s => s.error);
// const total = useSaOrgs(s => s.total); // keep commented if unused
const fetchIfStale = useSaOrgs(s => s.fetchIfStale);
const createOne = useSaOrgs(s => s.createOne);
const updateOne = useSaOrgs(s => s.updateOne);
const deleteOne = useSaOrgs(s => s.deleteOne);
const setStatusAction = useSaOrgs(s => s.setStatus);
const bulkUpsert = useSaOrgs(s => s.bulkUpsert);


  const isReady = status === 'ready' && !!user && user.role === 'superadmin';

  React.useEffect(()=>{
    if(isReady) fetchIfStale({ q: filters.q, status: filters.status as any });
  }, [isReady, filters.q, filters.status, fetchIfStale]);

  // Loading/error states
  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading organizations…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-red-600">Failed to load organizations: {String(error)}</div>;
  }

  // 🔒 GUARD (after hooks, before UI)
  if (status !== 'ready') {
    return <div className="p-6 text-sm text-slate-500">Checking permissions…</div>;
  }
  if (user?.role !== 'superadmin') {
    return <div className="p-6 text-sm text-red-600">Forbidden: superadmin only.</div>;
  }

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Name, code, domain, contact..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q: e.target.value}))} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=> setFilters(f=> ({...f, status: e.target.value as Filters['status']}))}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
        <div className="md:col-span-2 flex items-end justify-end gap-2">
          <Button variant="secondary" onClick={()=> setCsvOpen(true)}><Upload size={16}/> Bulk CSV</Button>
          <Button onClick={()=> setOpen({ mode: 'create' })}><Plus size={16}/> New</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Organization</th>
              <th className="text-left font-medium p-3">Code / Domain</th>
              <th className="text-left font-medium p-3">Contact</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-[360px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o: Organization) => (
              <tr key={o.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium flex items-center gap-2"><Building2 size={16}/> {o.name}</div>
                </td>
                <td className="p-3">
                  <div className="text-sm">{o.code}</div>
                  {o.domain && <div className="text-xs text-slate-500 flex items-center gap-1"><Globe size={14}/> {o.domain}</div>}
                </td>
                <td className="p-3">
                  <div className="text-sm flex items-center gap-1"><User size={14}/> {o.contactName || '—'}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1"><Mail size={14}/> {o.contactEmail || '—'}</div>
                </td>
                <td className="p-3">
                  <span className={
                    o.status==='active' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                    o.status==='inactive' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                    'text-red-700 bg-red-50 rounded px-2 py-0.5'
                  }>{o.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {o.status!=='active' && (
                      <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                        onClick={()=> setStatusAction(o.id, 'active').catch(()=>{})}>
                        <CheckCircle2 size={16}/> Activate
                      </button>
                    )}
                    {o.status==='active' && (
                      <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                        onClick={()=> setStatusAction(o.id, 'inactive').catch(()=>{})}>
                        <XCircle size={16}/> Deactivate
                      </button>
                    )}
                    {o.status!=='suspended' && (
                      <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                        onClick={()=> setStatusAction(o.id, 'suspended').catch(()=>{})}>
                        <ShieldOff size={16}/> Suspend
                      </button>
                    )}
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setOpen({ mode:'edit', initial: o })}>
                      <Pencil size={16}/> Edit
                    </button>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> { if(confirm('Delete organization? This will unassign its students.')) deleteOne(o.id).catch(()=>{}) }}>
                      <Trash2 size={16}/> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>No organizations</td></tr>}
          </tbody>
        </table>
      </div>

      <OrgModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') createOne(payload as any).then(()=> setOpen(null)).catch(()=>{})
          else if (open?.initial) updateOne(open.initial.id, payload as any).then(()=> setOpen(null)).catch(()=>{})
        }}
      />

      <CSVModal
        open={csvOpen}
        onClose={()=> setCsvOpen(false)}
        onImport={(rows)=> bulkUpsert(rows).then(()=> setCsvOpen(false))}
      />
    </div>
  )
}

function OrgModal({ open, mode, initial, onClose, onSubmit }:{
  open:boolean
  mode:'create'|'edit'
  initial?: Organization
  onClose:()=>void
  onSubmit:(payload: Omit<Organization,'id'|'createdAt'|'updatedAt'>)=> void
}){
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [domain, setDomain] = useState(initial?.domain || '')
  const [contactName, setContactName] = useState(initial?.contactName || '')
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail || '')
  const [status, setStatus] = useState<OrgStatus>(initial?.status || 'active')

  React.useEffect(()=>{
    setCode(initial?.code || '')
    setName(initial?.name || '')
    setDomain(initial?.domain || '')
    setContactName(initial?.contactName || '')
    setContactEmail(initial?.contactEmail || '')
    setStatus(initial?.status || 'active')
  }, [initial, open])

  const canSubmit = code.trim().length>0 && name.trim().length>1

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New organization' : 'Edit organization'}>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return
        onSubmit({
          code: code.trim(),
          name: name.trim(),
          domain: domain.trim() || undefined,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          status,
        } as any)
      }}>
        <div>
          <Label>Code</Label>
          <Input value={code} onChange={(e)=> setCode(e.target.value)} placeholder="org-101" />
        </div>
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e)=> setName(e.target.value)} placeholder="Alpha Academy" />
        </div>
        <div>
          <Label>Domain</Label>
          <Input value={domain} onChange={(e)=> setDomain(e.target.value)} placeholder="alpha.example" />
        </div>
        <div>
          <Label>Contact name</Label>
          <Input value={contactName} onChange={(e)=> setContactName(e.target.value)} placeholder="Owner name" />
        </div>
        <div className="sm:col-span-2">
          <Label>Contact email</Label>
          <Input type="email" value={contactEmail} onChange={(e)=> setContactEmail(e.target.value)} placeholder="owner@alpha.example" />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e)=> setStatus(e.target.value as OrgStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>{mode==='create' ? 'Create' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function CSVModal({ open, onClose, onImport }:{
  open:boolean
  onClose:()=>void
  onImport:(rows: Array<Partial<Organization> & { code?: string; name?: string }>)=>void
}){
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function split(line:string): string[] {
    const out: string[] = []; let cur = '', q = false
    for (let i=0;i<line.length;i++){
      const ch = line[i]
      if (ch === '"'){ if (q && line[i+1] === '"'){ cur+='"'; i++ } else q = !q }
      else if (ch === ',' && !q){ out.push(cur); cur='' }
      else cur += ch
    }
    out.push(cur); return out
  }
  function parseCSV(raw: string): Array<Partial<Organization> & { code?: string; name?: string }> {
    const lines = raw.replace(/\r/g,'').split('\n').filter(l => l.trim().length>0)
    if (!lines.length) return []
    const header = split(lines[0]).map(h => h.trim().toLowerCase())
    const map: Record<string,string> = {
      code:'code', name:'name', domain:'domain',
      contactname:'contactName', contactemail:'contactEmail', status:'status'
    }
    const out: any[] = []
    for (let i=1;i<lines.length;i++){
      const cells = split(lines[i]); const obj: any = {}
      header.forEach((h,j)=> { const key = map[h] || h; obj[key] = (cells[j] ?? '').trim() })
      if (!obj.code && !obj.name && !obj.domain) continue
      if (obj.status && !['active','inactive','suspended'].includes(obj.status)) delete obj.status
      out.push(obj)
    }
    return out
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk import organizations (CSV)">
      <div className="space-y-3">
        <div className="text-sm text-slate-600">
          Headers: <code>code,name,domain,contactName,contactEmail,status</code>. Upserts by <b>code</b> (preferred), else by <b>domain</b>, else by <b>name</b>.
          Renaming will auto-sync the <i>students</i> list’s org names.
        </div>
       <div className="flex flex-wrap items-center gap-2">
         <a className="px-2 py-1 text-sm rounded border hover:bg-slate-50" href="/api/organizations/template.csv">
           Download CSV template
         </a>
         <a className="px-2 py-1 text-sm rounded border hover:bg-slate-50" href="/api/organizations/template.xlsx">
           Download Excel template
         </a>
       </div>
        <div className="flex items-center gap-2">
         <Button variant="secondary" onClick={()=> fileRef.current?.click()}><Upload size={16}/> Upload CSV/Excel</Button>
         <input
           ref={fileRef}
           type="file"
           accept=".csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .xlsx"
           className="hidden"
           onChange={async (e)=>{
             const f = e.target.files?.[0]; if(!f) return
             const name = f.name.toLowerCase();
             if (name.endsWith('.xlsx')) {
               // Read Excel → convert to CSV so UI stays consistent
               const buf = await f.arrayBuffer();
               const wb = XLSX.read(buf, { type: 'array' });
               const ws = wb.Sheets[wb.SheetNames[0]];
               const csv = XLSX.utils.sheet_to_csv(ws); // first sheet only
               setText(csv);
             } else {
               setText(await f.text()); // csv
             }
           }}
         />
          <Button variant="ghost" onClick={()=> {
            const sample = `code,name,domain,contactName,contactEmail,status
org-101,Alpha Academy,alpha.example,Alpha Owner,owner@alpha.example,active
org-202,Beta Learning,beta.example,Beta Owner,owner@beta.example,active
org-303,Gamma School,gamma.example,Gamma Owner,owner@gamma.example,active`
            setText(sample)
          }}>Load sample</Button>
        </div>
        <div>
          <Label>CSV content</Label>
          <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[160px]" value={text} onChange={(e)=> setText(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button onClick={()=> {
            const rows = parseCSV(text)
            if (!rows.length) { alert('No valid rows parsed.'); return }
            onImport(rows)
          }}>Import</Button>
        </div>
      </div>
    </Modal>
  )
}
