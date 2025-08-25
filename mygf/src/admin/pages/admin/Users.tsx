// src/admin/pages/admin/Users.tsx
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/store'
import type { UserStatus } from '../../types/user'
import {
  listAdUsers, createAdUser, updateAdUser, deleteAdUser,
  setAdUserStatus, bulkUpsertAdUsers, type AdminUser, type AdminUserRole, type AdminUserFilters
} from '../../api/adUsers'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Crown, UserCog, UserPlus, Upload, Pencil, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type Filters = { q: string; role: 'all' | AdminUserRole; status: 'all' | UserStatus; showUnverified?: boolean }

export default function ADUsers(){
  const qc = useQueryClient()
  const { user } = useAuth() as any
  const orgId: string | undefined = user?.orgId

  const [filters, setFilters] = useState<Filters>({ q:'', role:'all', status:'all', showUnverified:false })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: AdminUser}|null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  const query = useQuery({
    queryKey:['ad-users', { ...filters, orgId }],
    queryFn: ()=> listAdUsers({
      q: filters.q || undefined,
      role: filters.role,
      status: filters.status,
      showUnverified: filters.showUnverified,
    } as AdminUserFilters),
  })

  const createMut = useMutation({
    mutationFn: createAdUser,
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-users'] })
  })
  const updateMut = useMutation({
    mutationFn: ({id, patch}:{id:string; patch:any}) => updateAdUser({ id, patch }),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-users'] })
  })
  const statusMut = useMutation({
    mutationFn: ({id, status}:{id:string; status:UserStatus}) => setAdUserStatus(id, status),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-users'] })
  })
  const deleteMut = useMutation({
    mutationFn: deleteAdUser,
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-users'] })
  })
  const importMut = useMutation({
    mutationFn: bulkUpsertAdUsers,
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-users'] })
  })

  const data = query.data || []
  const loading = query.isLoading

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
            {!loading && data.length === 0 && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={5}>No users</td></tr>
            )}
            {data.map(u => (
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
                  {/* no `size` prop; use className for compact buttons */}
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={()=> setOpen({mode:'edit', initial:u})}>
                    <Pencil size={14}/>
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={()=> statusMut.mutate({id:u.id, status: u.status==='active'?'disabled':'active'})}
                  >
                    {u.status==='active' ? <XCircle size={14}/> : <CheckCircle2 size={14}/>}
                  </Button>
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={()=> deleteMut.mutate(u.id)}>
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
              await createMut.mutateAsync(payload)
            } else if (open.initial?.id) {
              await updateMut.mutateAsync({ id: open.initial.id, patch: payload })
            }
          }}
        />
      )}

      {csvOpen && (
        <CsvImportModal
          onClose={()=> setCsvOpen(false)}
          onImport={async (rows)=> importMut.mutateAsync(rows)}
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
  const [text, setText] = useState('email,role,name\nalice@example.com,student,Alice\nvendor1@acme.com,vendor,Vendor 1')
  const [importing, setImporting] = useState(false)

  return (
    <Modal open title="Import CSV" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Paste rows (headers required): <code>email,role,name</code>. Roles allowed: <code>student</code> or <code>vendor</code>.
          Students will receive an invite; vendors receive credentials by email.
        </p>
        <textarea className="w-full h-40 rounded border p-2 font-mono text-xs" value={text} onChange={e=> setText(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            onClick={()=>{
              setImporting(true)
              const rows = parseCsv(text)
              Promise.resolve(onImport(rows)).finally(()=> setImporting(false))
            }}
            disabled={importing}
            aria-busy={importing}
          >
            {importing ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16}/> Importing…</span> : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function parseCsv(s: string) {
  const [head, ...rest] = s.trim().split(/\r?\n/)
  const headers = head.split(',').map(h=> h.trim().toLowerCase())
  return rest.map(line=>{
    const cols = line.split(',').map(x=> x.trim())
    const row:any = {}
    headers.forEach((h,i)=> row[h] = cols[i])
    return row
  })
}
