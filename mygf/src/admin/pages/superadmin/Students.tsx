//mygf/src/pages/superadmin/Students.tsx
import React, { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Student, StudentFilters, StudentStatus } from '../../types/student'
import { listStudents, createStudent, updateStudent, deleteStudent, setStudentStatus, bulkUpsertStudents } from '../../api/students'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Plus, Pencil, Trash2, UserPlus, Upload, CheckCircle2, XCircle } from 'lucide-react'

type Filters = { q: string; status: 'all'|StudentStatus; orgId?: string }

export default function SAStudents(){
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q:'', status:'all' })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: Student}|null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  const query = useQuery({
    queryKey:['sa-students', filters],
    queryFn: ()=> listStudents(filters as StudentFilters)
  })

  const createMut = useMutation({ mutationFn: createStudent, onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-students'] }) })
  const updateMut = useMutation({ mutationFn: ({id, patch}:{id:string, patch: Partial<Student>})=> updateStudent(id, patch), onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-students'] }) })
  const deleteMut = useMutation({ mutationFn: deleteStudent, onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-students'] }) })
  const statusMut = useMutation({ mutationFn: ({id, status}:{id:string, status:StudentStatus})=> setStudentStatus(id, status), onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-students'] }) })
  const bulkMut   = useMutation({ mutationFn: bulkUpsertStudents, onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-students'] }) })

  const rows = query.data ?? []
  const orgs = useMemo(()=>{
    const m = new Map<string, { id?:string; name?:string }>()
    rows.forEach(r => {
      const key = r.orgId || 'unassigned'
      if (!m.has(key)) m.set(key, { id: r.orgId, name: r.orgName || (r.orgId ? r.orgId : 'Unassigned') })
    })
    return Array.from(m.values())
  }, [rows])

  const grouped = useMemo(()=>{
    const g: Record<string, Student[]> = {}
    rows.forEach(s => {
      const key = s.orgId || 'unassigned'
      g[key] = g[key] || []
      g[key].push(s)
    })
    return g
  }, [rows])

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Name, username, email, org..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q: e.target.value}))} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=> setFilters(f=> ({...f, status: e.target.value as Filters['status']}))}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Organization</Label>
          <Select value={filters.orgId||''} onChange={(e)=> setFilters(f=> ({...f, orgId: e.target.value || undefined}))}>
            <option value="">Any</option>
            {orgs.map(o => <option key={o.id||'unassigned'} value={o.id||''}>{o.name}</option>)}
          </Select>
        </div>
        <div className="flex items-end justify-end gap-2">
          <Button variant="secondary" onClick={()=> setCsvOpen(true)}><Upload size={16}/> Bulk CSV</Button>
          <Button onClick={()=> setOpen({ mode: 'create' })}><UserPlus size={16}/> New</Button>
        </div>
      </header>

      {/* Bundled by organization */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([key, list])=> (
          <div key={key} className="rounded-xl border bg-white overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-sm font-medium border-b">
              {list[0]?.orgName || (list[0]?.orgId ? list[0].orgId : 'Unassigned')} — {list.length} students
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left font-medium p-3">Name</th>
                  <th className="text-left font-medium p-3">Username</th>
                  <th className="text-left font-medium p-3">Email</th>
                  <th className="text-left font-medium p-3">Status</th>
                  <th className="text-left font-medium p-3 w-[320px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{s.name || '—'}</div>
                      {s.orgName && <div className="text-xs text-slate-500">{s.orgName}</div>}
                    </td>
                    <td className="p-3">{s.username}</td>
                    <td className="p-3">{s.email}</td>
                    <td className="p-3">
                      <span className={
                        s.status==='active' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                        s.status==='inactive' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                        'text-red-700 bg-red-50 rounded px-2 py-0.5'
                      }>{s.status}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.status!=='active' && (
                          <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                            onClick={()=> statusMut.mutate({ id:s.id, status:'active' })}>
                            <CheckCircle2 size={16}/> Activate
                          </button>
                        )}
                        {s.status==='active' && (
                          <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                            onClick={()=> statusMut.mutate({ id:s.id, status:'inactive' })}>
                            <XCircle size={16}/> Deactivate
                          </button>
                        )}
                        <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setOpen({ mode:'edit', initial: s })}>
                          <Pencil size={16}/> Edit
                        </button>
                        <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> { if(confirm('Delete student?')) deleteMut.mutate(s.id) }}>
                          <Trash2 size={16}/> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>No students</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
        {rows.length===0 && <div className="text-center text-slate-500">No students</div>}
      </div>

      <StudentModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') createMut.mutate(payload as any, { onSuccess: ()=> setOpen(null) })
          else if (open?.initial) updateMut.mutate({ id: open.initial.id, patch: payload as any }, { onSuccess: ()=> setOpen(null) })
        }}
      />

      <CSVModal
        open={csvOpen}
        onClose={()=> setCsvOpen(false)}
        onImport={(rows)=> bulkMut.mutate(rows, { onSuccess: ()=> setCsvOpen(false) })}
      />
    </div>
  )
}

/* Reuse the modals from Admin, but Superadmin version exposes org fields */
function StudentModal({ open, mode, initial, onClose, onSubmit }:{
  open:boolean
  mode:'create'|'edit'
  initial?: Student
  onClose:()=>void
  onSubmit: (payload: Omit<Student,'id'|'createdAt'|'updatedAt'>)=> void
}){
  const [username, setUsername] = useState(initial?.username || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [name, setName] = useState(initial?.name || '')
  const [status, setStatus] = useState<StudentStatus>(initial?.status || 'active')
  const [orgId, setOrgId] = useState(initial?.orgId || '')
  const [orgName, setOrgName] = useState(initial?.orgName || '')

  React.useEffect(()=>{
    setUsername(initial?.username || '')
    setEmail(initial?.email || '')
    setName(initial?.name || '')
    setStatus(initial?.status || 'active')
    setOrgId(initial?.orgId || '')
    setOrgName(initial?.orgName || '')
  }, [initial, open])

  const canSubmit = username.trim().length>1 && /\S+@\S+\.\S+/.test(email)

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'Add student' : 'Edit student'}>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return
        onSubmit({
          username: username.trim(),
          email: email.trim(),
          name: name.trim() || undefined,
          status,
          orgId: orgId.trim() || undefined,
          orgName: orgName.trim() || undefined,
        } as any)
      }}>
        <div>
          <Label>Username</Label>
          <Input value={username} onChange={(e)=> setUsername(e.target.value)} placeholder="jane.doe" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e)=> setEmail(e.target.value)} placeholder="jane@example.com" />
        </div>
        <div className="sm:col-span-2">
          <Label>Name (optional)</Label>
          <Input value={name} onChange={(e)=> setName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e)=> setStatus(e.target.value as StudentStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </Select>
        </div>
        <div>
          <Label>Org ID</Label>
          <Input value={orgId} onChange={(e)=> setOrgId(e.target.value)} placeholder="org-101" />
        </div>
        <div className="sm:col-span-2">
          <Label>Org Name</Label>
          <Input value={orgName} onChange={(e)=> setOrgName(e.target.value)} placeholder="Alpha Academy" />
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
  onImport:(rows: Array<Partial<Student> & { email?:string; username?:string }>)=>void
}){
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function parseCSV(raw: string): Array<Partial<Student> & { email?: string; username?: string }> {
    const lines = raw.replace(/\r/g,'').split('\n').filter(l => l.trim().length > 0)
    if (lines.length === 0) return []
    const header = split(lines[0]).map(h => h.trim().toLowerCase())

    const map: Record<string,string> = {
      username: 'username',
      email: 'email',
      name: 'name',
      orgid: 'orgId',
      orgname: 'orgName',
      status: 'status',
    }

    const out: Array<Partial<Student> & { email?: string; username?: string }> = []
    for (let i = 1; i < lines.length; i++) {
      const cells = split(lines[i])
      const obj: any = {}
      header.forEach((h, j) => {
        const key = map[h] || h
        obj[key] = (cells[j] ?? '').trim()
      })
      // Skip rows without identifier
      if (!obj.email && !obj.username) continue
      // Normalize status
      if (obj.status && !['active','inactive','blocked'].includes(obj.status)) delete obj.status
      out.push(obj)
    }
    return out
  }

  function split(line:string): string[] {
    const out: string[] = []
    let cur = '', q = false
    for (let i=0;i<line.length;i++){
      const ch = line[i]
      if (ch === '"'){
        if (q && line[i+1] === '"'){ cur += '"'; i++ } else { q = !q }
      } else if (ch === ',' && !q){
        out.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk import via CSV (Superadmin)">
      <div className="space-y-3">
        <div className="text-sm text-slate-600">
          Headers: <code>username,email,name,status,orgId,orgName</code>. Matches by <b>email or username</b>.
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={()=> fileRef.current?.click()}><Upload size={16}/> Upload CSV</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e)=>{
              const f = e.target.files?.[0]; if(!f) return
              setText(await f.text())
            }}
          />
          <Button variant="ghost" onClick={()=> {
            const sample = `username,email,name,status,orgId,orgName
ava,ava@alpha.example,Ava Shah,active,org-101,Alpha Academy
newuser,new@beta.example,New User,active,org-202,Beta Learning`
            setText(sample)
          }}>Load sample</Button>
        </div>
        <div>
          <Label>CSV content</Label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm min-h-[160px]"
            value={text}
            onChange={(e)=> setText(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button onClick={()=> {
            const out = parseCSV(text) // <- always an array now
            if (!out.length) { alert('No valid rows parsed.'); return }
            onImport(out)
          }}>Import</Button>
        </div>
      </div>
    </Modal>
  )
}

