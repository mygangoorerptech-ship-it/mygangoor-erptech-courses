// src/admin/pages/admin/Users.tsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../../auth/store'
import type { UserStatus } from '../../types/user'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Crown, UserCog, UserPlus, Upload, Pencil, Trash2, CheckCircle2, XCircle, Loader2, Download } from 'lucide-react'
import type { AdminUser, AdminUserRole } from '../../api/adUsers'
import { useAdUsers } from '../../store/adUsers'   // ← NEW

type Filters = { q: string; role: 'all' | AdminUserRole; status: 'all' | UserStatus; showUnverified?: boolean }

export default function ADUsers(){
  const { user } = useAuth() as any
  const orgId: string | undefined = user?.orgId

  const [filters, setFilters] = useState<Filters>({ q:'', role:'all', status:'all', showUnverified:false })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: AdminUser}|null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  // Zustand store hooks
  const rows        = useAdUsers(s => s.items)
  const loading     = useAdUsers(s => s.loading)
  const fetchIfStale= useAdUsers(s => s.fetchIfStale)
  const createOne   = useAdUsers(s => s.createOne)
  const updateOne   = useAdUsers(s => s.updateOne)
  const deleteOne   = useAdUsers(s => s.deleteOne)
  const setStatus   = useAdUsers(s => s.setStatus)
  const bulkUpsert  = useAdUsers(s => s.bulkUpsert)

  // ETag-aware fetch
  useEffect(() => {
    fetchIfStale({
      q: filters.q || undefined,
      role: filters.role,
      status: filters.status,
      showUnverified: filters.showUnverified,
      // org scope is enforced server-side; superadmins can pass ?orgId via admin UI if needed
    })
  }, [filters.q, filters.role, filters.status, filters.showUnverified, orgId])

  return (
    <div className="space-y-6">
      <header className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Search</Label>
          <Input placeholder="name or email…" value={filters.q} onChange={e=> setFilters(s=> ({...s, q:e.target.value}))}/>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={filters.role} onChange={e=> setFilters(s => ({...s, role: e.target.value as any}))}>
            <option value="all">All</option>
            <option value="vendor">Vendor</option>
            <option value="student">Student</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={filters.status} onChange={e=> setFilters(s => ({...s, status: e.target.value as any}))}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={()=> setOpen({mode:'create'})}><UserPlus size={16}/> Add User</Button>
          <Button variant="secondary" onClick={()=> setCsvOpen(true)}><Upload size={16}/> Import CSV</Button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={5}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={5}>No users</td></tr>
            )}
            {rows.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50/60">
                <td className="p-3 font-medium">{u.name || '—'}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <span className={
                    u.role==='vendor'
                      ? 'inline-flex items-center gap-1 text-amber-700 bg-amber-50 rounded px-2 py-0.5'
                      : 'inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 rounded px-2 py-0.5'
                  }>
                    {u.role==='vendor' ? <UserCog size={14}/> : <Crown size={14}/>}
                    {u.role}
                  </span>
                </td>
                <td className="p-3">
                  {u.status==='active'
                    ? <span className="rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700">Active</span>
                    : <span className="rounded px-1.5 py-0.5 bg-rose-50 text-rose-700">Disabled</span>}
                </td>
                <td className="p-3 whitespace-nowrap space-x-2">
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={()=> setOpen({mode:'edit', initial:u})}>
                    <Pencil size={14}/>
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={()=> setStatus(u.id, u.status==='active'?'disabled':'active')}
                  >
                    {u.status==='active' ? <XCircle size={14}/> : <CheckCircle2 size={14}/>}
                  </Button>
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={()=> deleteOne(u.id)}>
                    <Trash2 size={14}/>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!!open && (
        <EditUserModal
          mode={open.mode}
          initial={open.initial}
          onClose={()=> setOpen(null)}
          onSubmit={async (payload) => {
            if (open.mode === 'create') {
              await createOne(payload)
            } else if (open.initial?.id) {
              await updateOne(open.initial.id, payload)
            }
            setOpen(null)
          }}
        />
      )}

      {csvOpen && (
        <CsvImportModal
          onClose={()=> setCsvOpen(false)}
          onImport={async (data)=> bulkUpsert(data)}
        />
      )}
    </div>
  )
}

function EditUserModal({
  mode, initial, onClose, onSubmit
}: {
  mode: 'create' | 'edit'
  initial?: AdminUser
  onClose: ()=>void
  onSubmit: (payload: { name?:string; email:string; role:AdminUserRole; mfa?:{required:boolean; method:'otp'|'totp'|null} })=>Promise<any>
}) {
  const [name, setName]   = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [role, setRole]   = useState<AdminUserRole>((initial?.role as AdminUserRole) || 'student')
  const [mfaRequired, setMfaRequired] = useState<boolean>(initial?.mfa?.required ?? (role === 'student'))
  const [mfaMethod, setMfaMethod] = useState<'otp'|'totp'|null>((initial?.mfa?.method as any) ?? (role === 'student' ? 'otp' : null))
  const [saving, setSaving] = useState(false)

    // when role switches to student, default MFA ON
 React.useEffect(()=>{
   if (role === 'student' && !initial) {
     setMfaRequired(true);
     setMfaMethod('otp');
   }
 }, [role, initial]);

  return (
    <Modal open title={mode==='create'?'Add User':'Edit User'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={e=> setName(e.target.value)}/>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e=> setEmail(e.target.value)} disabled={mode==='edit'}/>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={e=> setRole(e.target.value as AdminUserRole)} disabled={mode==='edit'}>
            <option value="student">Student</option>
            <option value="vendor">Vendor</option>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Students will receive login credentials by email, and must complete MFA ({mfaRequired ? (mfaMethod?.toUpperCase() || 'OTP') : 'optional'}). No Sign Up needed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input id="mfa" type="checkbox" className="scale-110" checked={mfaRequired} onChange={e=> setMfaRequired(e.target.checked)}/>
          {/* Label component doesn't accept htmlFor: use native label for this inline control */}
          <label htmlFor="mfa" className="text-sm font-medium text-gray-700">Require MFA</label>
          {mfaRequired && (
            <Select className="ml-2" value={mfaMethod || 'otp'} onChange={e=> setMfaMethod(e.target.value as any)}>
              <option value="otp">Email OTP</option>
              <option value="totp">Authenticator (TOTP)</option>
            </Select>
          )}
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={async ()=>{
              setSaving(true)
              try {
                await onSubmit({
                  name: name || undefined,
                  email,
                  role,
                  mfa: { required: mfaRequired, method: mfaRequired ? (mfaMethod || 'otp') : null }
                })
                onClose()
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? 'Saving…' : (mode==='create' ? 'Create' : 'Save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CsvImportModal({ onClose, onImport }: { onClose: ()=>void; onImport: (rows:any[])=>Promise<any> }) {
  const [text, setText] = useState(
`email,role,name,status,managerRef,password,mfaRequired,mfaMethod
student1@acme.com,student,Student One,active,,,
vendor1@acme.com,vendor,Vendor One,active,admin1@acme.com,Vend0r#Pass,true,totp`
  )
  const [importing, setImporting] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  // --- helpers ---------------------------------------------------------------
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
  const truthy = (v:string) => /^(true|1|yes|y)$/i.test((v||'').trim())
  const normRole = (v:string) => {
    const r = (v||'').toLowerCase().trim()
    return (r==='vendor' || r==='student') ? r : 'student'
  }
  const normStatus = (v:string) => {
    const s = (v||'').toLowerCase().trim()
    return (s==='active' || s==='disabled') ? s : undefined
  }
  const normMethod = (v:string) => {
    const s = (v||'').toLowerCase().trim()
    if (!s) return undefined
    if (s === 'email' || s === 'email_otp' || s === 'otp') return 'otp'
    if (s === 'totp' || s === 'auth' || s === 'authenticator') return 'totp'
    return undefined
  }
  function setDeep(obj:any, path:string, val:any){
    const parts = path.split('.')
    let o = obj
    for (let i=0;i<parts.length-1;i++){
      const p = parts[i]
      if (!o[p] || typeof o[p] !== 'object') o[p] = {}
      o = o[p]
    }
    o[parts[parts.length-1]] = val
  }

  // Build/download the same template we show in the textarea
  function buildTemplate(): string {
    return (
`email,role,name,status,managerRef,password,mfaRequired,mfaMethod
student1@acme.com,student,Student One,active,,,
student2@acme.com,student,Student Two,active,admin1@acme.com,,true,otp
vendor1@acme.com,vendor,Vendor One,active,,Vend0r#Pass,true,totp
vendor2@acme.com,vendor,Vendor Two,active,admin2@acme.com,,true,otp`
    )
  }
  function downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Strong return type avoids any [] | undefined drift
  function parseCSV(raw: string): any[] {
    const lines = raw.replace(/\r/g,'').split('\n').filter(l => l.trim().length>0)
    if (!lines.length) return []

    const alias: Record<string,string> = {
      email:'email', role:'role', name:'name', status:'status', password:'password',
      // manager/admin ref in same org
      managerref:'managerRef', manager:'managerRef', manager_email:'managerRef', managerid:'managerRef', manager_id:'managerRef',
      adminref:'managerRef', admin:'managerRef', admin_email:'managerRef', adminid:'managerRef', admin_id:'managerRef',
      // MFA
      mfarequired:'mfa.required', 'mfa_required':'mfa.required',
      mfamethod:'mfa.method', 'mfa_method':'mfa.method',
    }

    const header = split(lines[0]).map(h => h.trim().toLowerCase())
    const normHeader = header.map(h => alias[h] || h)

    const out:any[] = []
    for (let i=1;i<lines.length;i++){
      const cells = split(lines[i])
      const row:any = {}
      normHeader.forEach((h,j) => {
        const v = (cells[j] ?? '').trim()
        if (!h) return
        if (h === 'mfa.required') setDeep(row, h, truthy(v))
        else if (h === 'mfa.method') setDeep(row, h, normMethod(v))
        else if (h === 'role') row.role = normRole(v)
        else if (h === 'status') { const s = normStatus(v); if (s) row.status = s }
        else if (['email','name','password','managerRef'].includes(h)) { if (v !== '') setDeep(row, h, v) }
        else { if (v !== '') setDeep(row, h, v) }
      })

      if (!row.email) continue
      if (!row.role) row.role = 'student'
      if (row.mfa && typeof row.mfa === 'object') {
        if (row.mfa.required === undefined) row.mfa.required = true     // default ON
        if (row.mfa.method && !['otp','totp'].includes(row.mfa.method)) delete row.mfa.method
      }
      out.push(row)
    }
    return out
  }

  // --- UI --------------------------------------------------------------------
  return (
    <Modal open title="Import CSV" onClose={onClose}>
      <div className="space-y-3">
        <div className="text-sm text-gray-600 space-y-1">
          <p className="font-medium">Accepted headers (org is auto-assigned to your org):</p>
          <div className="text-xs grid gap-1">
            <div><code>email</code> (required), <code>role</code> (<code>student|vendor</code>), <code>name</code>, <code>status</code> (<code>active|disabled</code>), <code>password</code> (vendor only)</div>
            <div><code>managerRef</code> (optional admin email or id; defaults to you)</div>
            <div><code>mfaRequired</code> (<code>true|false</code>), <code>mfaMethod</code> (<code>otp|totp</code>)</div>
          </div>
          <p className="text-xs">
            Students and vendors are created immediately and emailed credentials. MFA is ON by default (students: Email OTP, vendors: your chosen method).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="ghost" onClick={()=> setText(buildTemplate())}>
            Load sample
          </Button>
          <Button variant="ghost" onClick={()=> downloadCsv('users_template.csv', buildTemplate())}>
            <Download size={16}/> Download template
          </Button>
        </div>

        <textarea
          className="w-full h-48 rounded border p-2 font-mono text-xs"
          value={text}
          onChange={e=> setText(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            onClick={()=>{
              setImporting(true)
              const parsedRows = parseCSV(text)                 // ← don’t shadow “rows”
              Promise.resolve(onImport(parsedRows))             // ← param name in parent was changed, too
                .finally(()=> setImporting(false))
            }}
            disabled={importing}
            aria-busy={importing}
          >
            {importing
              ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16}/> Importing…</span>
              : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
