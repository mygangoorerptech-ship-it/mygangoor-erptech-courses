// mygf/src/admin/pages/superadmin/Users.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useAuth } from '../../auth/store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SAUser, SAUserFilters, UserRole, UserStatus } from '../../types/user'
import {
  listSaUsers, createSaUser, updateSaUser, deleteSaUser,
  setSaUserStatus, setSaUserRole, bulkUpsertSaUsers
} from '../../api/saUsers'
import { listOrganizations, type Organization } from '../../api/organizations'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Crown, UserCog, UserMinus, ShieldAlert, Upload, UserPlus, Pencil, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type Filters = { q: string; role: 'all'|UserRole; status: 'all'|UserStatus; orgId?: string; showUnverified?: boolean; }
type OrgOption = { id: string; name: string }

export default function SAUsers(){
  const qc = useQueryClient()
  const { user } = useAuth() as any
  const myEmail = user?.email?.toLowerCase?.()

  const [filters, setFilters] = useState<Filters>({ q:'', role:'all', status:'all', showUnverified:false })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: SAUser}|null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  // Users (server-side filtering)
  const query = useQuery({
    queryKey:['sa-users', filters],
    queryFn: ()=> {
      const { showUnverified, ...rest } = filters
      const params: SAUserFilters = { ...rest }
      if (showUnverified) params.verified = 'all'   // include unverified
      return listSaUsers(params)
    }
  })
  const rows = query.data ?? []

  // Orgs for dropdown (real backend; note suspended must be "true"/"false" string)
  const orgQ = useQuery<Organization[]>({
    queryKey:['orgs-lite'],
    queryFn: async ()=> {
      const res = await listOrganizations({ q:'', status:'active', suspended:'false' })
      return res?.items ?? []
    }
  })
  const orgOptions: OrgOption[] = useMemo(
    () => (orgQ.data ?? []).map((o: Organization) => ({ id: o._id, name: o.name })),
    [orgQ.data]
  )

  // Admins by org (for vendor "Under Admin", and for student admin selection)
  const adminsByOrg = useMemo(()=>{
    const map = new Map<string, SAUser[]>()
    rows.filter(r => r.role==='admin' && r.status==='active').forEach(r=>{
      const key = r.orgId || 'unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [rows])

  const createMut = useMutation({
    mutationFn: createSaUser,
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-users'] })
  })
  const updateMut = useMutation({
    mutationFn: ({id, patch}:{id:string, patch: Partial<SAUser> & any})=> updateSaUser(id, patch),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-users'] })
  })
  const deleteMut = useMutation({
    mutationFn: deleteSaUser,
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-users'] })
  })
  const statusMut = useMutation({
    mutationFn: ({id, status}:{id:string, status:UserStatus})=> setSaUserStatus(id, status),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-users'] })
  })
  const roleMut = useMutation({
    mutationFn: ({id, role}:{id:string, role:UserRole})=> setSaUserRole(id, role),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-users'] })
  })
  const bulkMut = useMutation({
    mutationFn: bulkUpsertSaUsers,
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-users'] })
  })

  const stats = useMemo(()=> ({
    total: rows.length,
    supers: rows.filter(r=> r.role==='superadmin').length,
    admins: rows.filter(r=> r.role==='admin').length,
    vendors: rows.filter(r=> r.role==='vendor').length,
    students: rows.filter(r=> r.role==='student').length,
    active: rows.filter(r=> r.status==='active').length,
  }), [rows])

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Name, email, org..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q: e.target.value}))} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={filters.role} onChange={(e)=> setFilters(f=> ({...f, role: e.target.value as Filters['role']}))}>
            <option value="all">All</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="vendor">Vendor</option>
            <option value="student">Student</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=> setFilters(f=> ({...f, status: e.target.value as Filters['status']}))}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Organization</Label>
          <Select
            value={filters.orgId||''}
            onChange={(e)=> setFilters(f=> ({...f, orgId: e.target.value || undefined}))}
          >
            <option value="">Any</option>
            {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
        <div className="md:col-span-2 flex items-end justify-end gap-2">
          <Button variant="secondary" onClick={()=> setCsvOpen(true)}><Upload size={16}/> Bulk CSV</Button>
          <Button onClick={()=> setOpen({ mode: 'create' })}><UserPlus size={16}/> New</Button>
        </div>
      </header>

      <div className="text-sm text-slate-600">
        <span className="font-medium">{stats.total}</span> users •
        {' '}<span className="font-medium">{stats.supers}</span> superadmins •
        {' '}<span className="font-medium">{stats.admins}</span> admins •
        {' '}<span className="font-medium">{stats.vendors}</span> vendors •
        {' '}<span className="font-medium">{stats.students}</span> students •
        {' '}<span className="font-medium">{stats.active}</span> active
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">User</th>
              <th className="text-left font-medium p-3">Role</th>
              <th className="text-left font-medium p-3">Organization</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-[360px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => {
              const isMe = myEmail && u.email.toLowerCase() === myEmail
              return (
                <tr key={u.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{u.name || '—'} {isMe && <span className="text-xs rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 ml-1">You</span>}</div>
                    {/* NEW: email + tiny verified pill */}
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{u.email}</span>
                      {u.isVerified === false ? (
                        <span className="rounded px-1.5 py-0.5 bg-amber-50 text-amber-700">Unverified</span>
                      ) : (
                        <span className="rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700">Verified</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={
                      u.role==='superadmin'
                        ? 'inline-flex items-center gap-1 text-purple-700 bg-purple-50 rounded px-2 py-0.5'
                        : u.role==='admin'
                          ? 'inline-flex items-center gap-1 text-slate-700 bg-slate-100 rounded px-2 py-0.5'
                          : u.role==='vendor'
                            ? 'inline-flex items-center gap-1 text-amber-700 bg-amber-50 rounded px-2 py-0.5'
                            : 'inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 rounded px-2 py-0.5'
                    }>
                      {u.role==='superadmin' ? <Crown size={14}/> : <UserCog size={14}/>}
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3">{u.orgName || '—'}</td>
                  <td className="p-3">
                    <span className={
                      u.status==='active' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                      'text-red-700 bg-red-50 rounded px-2 py-0.5'
                    }>{u.status}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {u.status!=='active' && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> statusMut.mutate({ id:u.id, status:'active' })}
                        >
                          <CheckCircle2 size={16}/> Activate
                        </button>
                      )}
                      {u.status==='active' && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> statusMut.mutate({ id:u.id, status:'disabled' })}
                          disabled={u.role==='superadmin' && rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1}
                          title={(u.role==='superadmin' && rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1) ? 'Cannot disable the last active superadmin' : undefined}
                        >
                          <XCircle size={16}/> Disable
                        </button>
                      )}
                      {u.role==='admin' && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> roleMut.mutate({ id:u.id, role:'superadmin' })}
                        >
                          <ShieldAlert size={16}/> Promote
                        </button>
                      )}
                      {u.role==='superadmin' && !isMe && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> roleMut.mutate({ id:u.id, role:'admin' })}
                          disabled={rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1}
                          title={rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1 ? 'Cannot demote the last active superadmin' : undefined}
                        >
                          <UserMinus size={16}/> Demote
                        </button>
                      )}
                      <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setOpen({ mode:'edit', initial: u })}>
                        <Pencil size={16}/> Edit
                      </button>
                      <button
                        className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                        onClick={()=> { if(confirm('Delete user?')) deleteMut.mutate(u.id) }}
                        disabled={(u.role==='superadmin' && rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1) || isMe}
                        title={isMe ? 'You cannot delete yourself' : (u.role==='superadmin' && rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1 ? 'Cannot delete the last active superadmin' : undefined)}
                      >
                        <Trash2 size={16}/> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>No users</td></tr>}
          </tbody>
        </table>
      </div>

      <UserModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        orgOptions={orgOptions}
        adminsByOrg={adminsByOrg}
        submitting={open?.mode === 'create' ? createMut.isPending : updateMut.isPending}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') {
            // Admin/Vendor: direct account (with password)
            // Student: direct account too (password generated server-side; email credentials)
            createMut.mutate(payload as any, { onSuccess: ()=> setOpen(null) })
          } else if (open?.initial) {
            updateMut.mutate({ id: open.initial.id, patch: payload as any }, { onSuccess: ()=> setOpen(null) })
          }
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

function UserModal({ open, mode, initial, orgOptions, adminsByOrg, submitting=false, onClose, onSubmit }:{
  open:boolean
  mode:'create'|'edit'
  initial?: SAUser
  orgOptions: Array<{id:string; name:string}>
  adminsByOrg: Map<string, SAUser[]>
  submitting?: boolean
  onClose:()=>void
  onSubmit:(payload: Omit<SAUser,'id'|'createdAt'|'updatedAt'> & {
    orgId?: string
    password?: string               // for admin/vendor creation; student password generated server-side
    mfa?: { required:boolean; method:'otp'|'totp'|null }
    managerId?: string              // vendor -> admin; student -> chosen admin (superadmin flow)
  })=> void
}){
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [role, setRole] = useState<UserRole>(initial?.role || 'admin')
  const [status, setStatus] = useState<UserStatus>(initial?.status || 'active')
  const [orgId, setOrgId] = useState<string>(initial?.orgId || '')
  const [managerId, setManagerId] = useState<string>('') // vendor → admin; student (superadmin) → admin

  // MFA:
  // - Admin/Vendor: required
  // - Student (superadmin flow): default ON (can be toggled off if policy allows)
  const [mfa, setMfa] = useState<{required:boolean; method:'otp'|'totp'|null}>(
    initial?.role
      ? { required: initial.role!=='student' ? true : !!initial?.mfa?.required, method: (initial as any)?.mfa?.method || (initial.role==='vendor' ? 'totp' : 'otp') }
      : { required: true, method: 'otp' }
  )

  // Password for Admin/Vendor creation; optional in edit (reset)
  const [password, setPassword] = useState<string>('')
  const [confirm, setConfirm]   = useState<string>('')

  useEffect(()=>{
    setName(initial?.name || '')
    setEmail(initial?.email || '')
    setRole(initial?.role || 'admin')
    setStatus(initial?.status || 'active')
    setOrgId(initial?.orgId || '')
    setManagerId('')
    setMfa(initial?.role
      ? { required: initial.role!=='student' ? true : !!(initial as any)?.mfa?.required, method: (initial as any)?.mfa?.method || (initial.role==='vendor' ? 'totp' : 'otp') }
      : { required: true, method: 'otp' })
    setPassword('')
    setConfirm('')
  }, [initial, open])

  // Default MFA ON for students during creation
  useEffect(()=>{
    if (mode==='create' && role==='student' && !initial) {
      setMfa(prev => ({ required: true, method: prev?.method || 'otp' }))
    }
  }, [mode, role, initial])

  const emailOk = /\S+@\S+\.\S+/.test(email)

  const requireOrg = role==='admin' || role==='vendor' || role==='student'
  // SUPERADMIN student flow: require an admin; vendor also requires admin
  const requireManager = role==='vendor' || role==='student'

  // For vendor, list admins by selected org; for student we’ll list ALL admins
  const orgAdmins = orgId ? (adminsByOrg.get(orgId) || []) : []
  const allAdmins: SAUser[] = React.useMemo(
    () => Array.from(adminsByOrg.values()).flatMap(arr => arr),
    [adminsByOrg]
  )

  const needsPassword = mode==='create' && (role==='admin' || role==='vendor')
  const allowPasswordEdit = mode==='edit' && (role==='admin' || role==='vendor') // optional reset
  const passwordOk = !needsPassword || (password.length >= 8 && password === confirm)

  const mfaForcedRequired = role==='admin' || role==='vendor'
  const canSubmit =
    emailOk &&
    (!requireOrg || !!orgId) &&
    (!requireManager || !!managerId) &&
    passwordOk

  // When student admin is chosen, auto-set orgId to admin's org and lock org select
  useEffect(()=>{
    if (role!=='student' || !managerId) return
    const admin = allAdmins.find(a => String(a.id) === String(managerId))
    if (admin?.orgId && admin.orgId !== orgId) setOrgId(admin.orgId)
  }, [role, managerId, allAdmins, orgId])

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New user' : 'Edit user'}>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1"
        onSubmit={(e)=>{
          e.preventDefault(); if(!canSubmit || submitting) return
          const base:any = {
            name: name.trim() || undefined,
            email: email.trim(),
            role,
            status,
            orgId: (role==='admin' || role==='vendor' || role==='student') ? (orgId || undefined) : undefined,
            managerId: (role==='vendor' || role==='student') ? (managerId || undefined) : undefined,
          }

          // MFA policy
          base.mfa = mfaForcedRequired ? { required:true, method: mfa.method || 'otp' } : {
            required: !!mfa?.required,
            method: mfa?.required ? (mfa.method || 'otp') : null
          }

          // Direct account creation for admin/vendor (password present)
          if ((role==='admin' || role==='vendor') && password) {
            base.password = password
          }
          // Student: server generates password & emails credentials (no password field here)

          onSubmit(base)
        }}>

        <div className="sm:col-span-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e)=> setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="sm:col-span-2">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e)=> setEmail(e.target.value)} placeholder="user@example.com" />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(e)=> setRole(e.target.value as UserRole)}>
            <option value="admin">Admin</option>
            <option value="vendor">Vendor</option>
            <option value="student">Student</option>
            <option value="superadmin">Superadmin</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e)=> setStatus(e.target.value as UserStatus)}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>

        {(role==='admin' || role==='vendor' || role==='student') && (
          <>
            {/* Organization */}
            <div>
              <Label>Organization</Label>
              <Select
                value={orgId}
                onChange={(e)=> setOrgId(e.target.value)}
                disabled={role==='student'}  // student org auto-derives from selected admin
              >
                <option value="">Select organization</option>
                {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </div>

            {/* Under Admin */}
            <div>
              <Label>Under Admin</Label>
              {role==='vendor' ? (
                <Select value={managerId} onChange={(e)=> setManagerId(e.target.value)} disabled={!orgId}>
                  <option value="">Select admin</option>
                  {orgAdmins.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                </Select>
              ) : role==='student' ? (
                <Select value={managerId} onChange={(e)=> setManagerId(e.target.value)}>
                  <option value="">Select admin</option>
                  {allAdmins.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.email}
                    </option>
                  ))}
                </Select>
              ) : null}
              {role==='student' && (
                <p className="text-xs text-slate-500 mt-1">
                  Pick the Admin; the Organization will be set automatically from that admin.
                </p>
              )}
            </div>
          </>
        )}

        {/* Password (Admin/Vendor creation; optional reset in edit) */}
        {(needsPassword || allowPasswordEdit) && (
          <>
            <div>
              <Label>{mode==='create' ? 'Password' : 'New Password (optional)'}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e)=> setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <Label>{mode==='create' ? 'Confirm Password' : 'Confirm New Password'}</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e)=> setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            {password && password.length < 8 && (
              <div className="sm:col-span-2 text-xs text-red-600">Password must be at least 8 characters.</div>
            )}
            {password && confirm && password !== confirm && (
              <div className="sm:col-span-2 text-xs text-red-600">Passwords do not match.</div>
            )}
          </>
        )}

        {/* MFA config */}
        <div className="sm:col-span-2 border-t pt-3 mt-2">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <Label>Multi-Factor Authentication</Label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mfaForcedRequired ? true : !!mfa?.required}
                onChange={(e)=> setMfa(prev => ({ required: e.target.checked, method: e.target.checked ? (prev?.method || 'otp') : null }))}
                disabled={mfaForcedRequired}
              />
              <span>
                {mfaForcedRequired
                  ? 'MFA is required for Admin/Vendor'
                  : 'Students: MFA is enabled by default (you can toggle if needed)'}
              </span>
            </label>
            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  name="mfaMethod"
                  type="radio"
                  checked={(mfa?.method||'otp')==='otp'}
                  onChange={()=> setMfa(p=> ({ ...(p||{required:true,method:'otp'}), method:'otp' }))}
                  disabled={mfaForcedRequired ? false : !mfa?.required}
                />
                <span>Email OTP</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  name="mfaMethod"
                  type="radio"
                  checked={mfa?.method==='totp'}
                  onChange={()=> setMfa(p=> ({ ...(p||{required:true,method:'totp'}), method:'totp' }))}
                  disabled={mfaForcedRequired ? false : !mfa?.required}
                />
                <span>Authenticator (TOTP)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                {mode==='create' ? 'Creating user…' : 'Saving…'}
              </span>
            ) : (
              mode==='create' ? 'Create' : 'Save'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CSVModal({ open, onClose, onImport }:{
  open:boolean
  onClose:()=>void
  onImport:(rows: Array<Partial<SAUser> & { email?:string }>)=>void
}){
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

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
  function parseCSV(raw: string): Array<Partial<SAUser> & { email?:string }> {
    const lines = raw.replace(/\r/g,'').split('\n').filter(l => l.trim().length>0)
    if (!lines.length) return []
    const header = split(lines[0]).map(h => h.trim().toLowerCase())
    const map: Record<string,string> = { email:'email', name:'name', role:'role', status:'status', orgid:'orgId', orgname:'orgName', password:'password' }
    const out: any[] = []
    for (let i=1;i<lines.length;i++){
      const cells = split(lines[i]); const obj: any = {}
      header.forEach((h,j)=> { const key = map[h] || h; obj[key] = (cells[j] ?? '').trim() })
      if (!obj.email) continue
      if (obj.role && !['admin','superadmin','vendor','student'].includes(obj.role)) delete obj.role
      if (obj.status && !['active','disabled'].includes(obj.status)) delete obj.status
      // For admin/vendor via CSV, if password provided use direct account flow.
      // For students, server should generate password and email credentials.
      out.push(obj)
    }
    return out
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk import users (CSV)">
      <div className="space-y-3">
        <div className="text-sm text-slate-600">
          Headers: <code>email,name,role,status,orgId,password</code>. Admin/Vendor rows with a <code>password</code> create direct accounts. <strong>Students</strong> are created immediately and emailed credentials (no invite screen).
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={()=> fileRef.current?.click()}><Upload size={16}/> Upload CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e)=>{
            const f = e.target.files?.[0]; if(!f) return
            setText(await f.text())
          }}/>
          <Button variant="ghost" onClick={()=> {
            const sample = `email,name,role,status,orgId,password
admin1@alpha.example,Alpha Admin,admin,active,ORG_ID,StrongPass1!
vendor1@alpha.example,Alpha Vendor,vendor,active,ORG_ID,AnotherPass2!
student1@alpha.example,Alpha Student,student,active,ORG_ID,`
            setText(sample)
          }}>Load sample</Button>
        </div>
        <div>
          <Label>CSV content</Label>
          <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[160px]" value={text} onChange={(e)=> setText(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button
            onClick={()=> {
              const rows = parseCSV(text)
              if (!rows.length) { alert('No valid rows parsed.'); return }
              setImporting(true)
              Promise.resolve(onImport(rows)).finally(()=> setImporting(false))
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
