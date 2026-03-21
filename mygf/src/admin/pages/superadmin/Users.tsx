// mygf/src/admin/pages/superadmin/Users.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useAuth } from '../../auth/store'
import { useSaUsers } from '../../store/saUsers'
import { useSaOrgs } from '../../store/saOrganizations'
import type { SAUser, SAUserFilters, UserRole, UserStatus } from '../../types/user'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Crown, UserCog, UserMinus, ShieldAlert, Upload, UserPlus, Pencil, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type Filters = { q: string; role: 'all'|UserRole; status: 'all'|UserStatus; orgId?: string; showUnverified?: boolean; }
type OrgOption = { id: string; name: string }

export default function SAUsers(){
  const { user } = useAuth() as any
  const myEmail = user?.email?.toLowerCase?.()

  const [filters, setFilters] = useState<Filters>({ q:'', role:'all', status:'all', showUnverified:false })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: SAUser}|null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Users via Zustand store (ETag-aware)
  const rows         = useSaUsers(s => s.items)
  const loading      = useSaUsers(s => s.loading)
  const error        = useSaUsers(s => s.error)
  const fetchIfStale = useSaUsers(s => s.fetchIfStale)
  const createOne    = useSaUsers(s => s.createOne)
  const updateOne    = useSaUsers(s => s.updateOne)
  const deleteOne    = useSaUsers(s => s.deleteOne)
  const setUserStatus= useSaUsers(s => s.setStatus)
  const setUserRole  = useSaUsers(s => s.setRole)
  const bulkUpsert   = useSaUsers(s => s.bulkUpsert)

  useEffect(() => {
    const params: SAUserFilters = {
      q: filters.q || undefined,
      role: filters.role,
      status: filters.status,
      orgId: filters.orgId,
      verified: filters.showUnverified ? 'all' : undefined as any
    }
    fetchIfStale(params)
  }, [filters.q, filters.role, filters.status, filters.orgId, filters.showUnverified])

  // Orgs for dropdown: reuse saOrganizations store (cached)
  const orgRows  = useSaOrgs(s => s.items)
  const orgFetch = useSaOrgs(s => s.fetchIfStale)
  useEffect(() => { orgFetch({ status: 'active' as any }) }, [])
  const orgOptions: OrgOption[] = useMemo(
    () => (orgRows || [])
      .filter((o: any) => o.status === 'active' && !o.suspended)
      .map((o: any) => ({ id: o.id, name: o.name })),
    [orgRows]
  )

  // Admins by org (for teacher "Under Admin", and for student admin selection)
  const adminsByOrg = useMemo(() => {
    const map = new Map<string, SAUser[]>()
    rows.filter(r => r.role === 'admin' && r.status === 'active').forEach(r => {
      const key = r.orgId || 'unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [rows])

  const stats = useMemo(() => ({
    total: rows.length,
    supers: rows.filter(r=> r.role==='superadmin').length,
    admins: rows.filter(r=> r.role==='admin').length,
    teachers: rows.filter(r=> r.role==='teacher').length,
    students: rows.filter(r=> r.role==='student').length,
    active: rows.filter(r=> r.status==='active').length,
  }), [rows])

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading users…</div>
  if (error)   return <div className="p-6 text-sm text-red-600">Failed to load users: {String(error)}</div>

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
            <option value="teacher">Teacher</option>
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
        <span className="font-medium">{stats.total}</span> users •{' '}
        <span className="font-medium">{stats.supers}</span> superadmins •{' '}
        <span className="font-medium">{stats.admins}</span> admins •{' '}
        <span className="font-medium">{stats.teachers}</span> teachers •{' '}
        <span className="font-medium">{stats.students}</span> students •{' '}
        <span className="font-medium">{stats.active}</span> active
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
            {rows.map((u: SAUser) => {
              const isMe = myEmail && u.email.toLowerCase() === myEmail
              return (
                <tr key={u.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">
                      {u.name || '—'} {isMe && <span className="text-xs rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 ml-1">You</span>}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{u.email}</span>
                      {u.isVerified === false
                        ? <span className="rounded px-1.5 py-0.5 bg-amber-50 text-amber-700">Unverified</span>
                        : <span className="rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700">Verified</span>}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={
                      u.role==='superadmin'
                        ? 'inline-flex items-center gap-1 text-purple-700 bg-purple-50 rounded px-2 py-0.5'
                        : u.role==='admin'
                          ? 'inline-flex items-center gap-1 text-slate-700 bg-slate-100 rounded px-2 py-0.5'
                          : u.role==='teacher'
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
                          onClick={()=> setUserStatus(u.id, 'active')}
                        >
                          <CheckCircle2 size={16}/> Activate
                        </button>
                      )}
                      {u.status==='active' && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> setUserStatus(u.id, 'disabled')}
                          disabled={u.role==='superadmin' && rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1}
                          title={(u.role==='superadmin' && rows.filter(x=> x.role==='superadmin' && x.status==='active').length<=1) ? 'Cannot disable the last active superadmin' : undefined}
                        >
                          <XCircle size={16}/> Disable
                        </button>
                      )}
                      {u.role==='admin' && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> setUserRole(u.id, 'superadmin')}
                        >
                          <ShieldAlert size={16}/> Promote
                        </button>
                      )}
                      {u.role==='superadmin' && !isMe && (
                        <button
                          className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                          onClick={()=> setUserRole(u.id, 'admin')}
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
                        onClick={()=> { if (confirm('Delete user?')) deleteOne(u.id) }}
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
        submitting={submitting}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          setSubmitting(true)
          const promise =
            open?.mode === 'create'
              ? createOne(payload as any)
              : open?.initial
                ? updateOne(open.initial.id, payload as any)
                : Promise.resolve()
          promise
            .then(()=> setOpen(null))
            .finally(()=> setSubmitting(false))
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
    password?: string
    mfa?: { required:boolean; method:'otp'|'totp'|null }
    managerId?: string
  })=> void
}){
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [role, setRole] = useState<UserRole>(initial?.role || 'admin')
  const [status, setStatus] = useState<UserStatus>(initial?.status || 'active')
  const [orgId, setOrgId] = useState<string>(initial?.orgId || '')
  const [managerId, setManagerId] = useState<string>('')

  const [mfa, setMfa] = useState<{required:boolean; method:'otp'|'totp'|null}>(
    initial?.role
      ? { required: initial.role!=='student' ? true : !!initial?.mfa?.required, method: (initial as any)?.mfa?.method || (initial.role==='teacher' ? 'totp' : 'otp') }
      : { required: true, method: 'otp' }
  )

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
      ? { required: initial.role!=='student' ? true : !!(initial as any)?.mfa?.required, method: (initial as any)?.mfa?.method || (initial.role==='teacher' ? 'totp' : 'otp') }
      : { required: true, method: 'otp' })
    setPassword('')
    setConfirm('')
  }, [initial, open])

  useEffect(()=>{
    if (mode==='create' && role==='student' && !initial) {
      setMfa(prev => ({ required: true, method: prev?.method || 'otp' }))
    }
  }, [mode, role, initial])

  const emailOk = /\S+@\S+\.\S+/.test(email)
  const requireOrg = role==='admin' || role==='teacher' || role==='student'
  const requireManager = role==='teacher' || role==='student'

  const orgAdmins = orgId ? (adminsByOrg.get(orgId) || []) : []
  const allAdmins: SAUser[] = React.useMemo(
    () => Array.from(adminsByOrg.values()).flatMap(arr => arr),
    [adminsByOrg]
  )

  const needsPassword = mode==='create' && (role==='admin' || role==='teacher')
  const allowPasswordEdit = mode==='edit' && (role==='admin' || role==='teacher')
  const passwordOk = !needsPassword || (password.length >= 8 && password === confirm)

  const mfaForcedRequired = role==='admin' || role==='teacher'
  const canSubmit =
    emailOk &&
    (!requireOrg || !!orgId) &&
    (!requireManager || !!managerId) &&
    passwordOk

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
            orgId: (role==='admin' || role==='teacher' || role==='student') ? (orgId || undefined) : undefined,
            managerId: (role==='teacher' || role==='student') ? (managerId || undefined) : undefined,
          }

          base.mfa = mfaForcedRequired ? { required:true, method: mfa.method || 'otp' } : {
            required: !!mfa?.required,
            method: mfa?.required ? (mfa.method || 'otp') : null
          }

          if ((role==='admin' || role==='teacher') && password) {
            base.password = password
          }

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
            <option value="teacher">Teacher</option>
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

        {(role==='admin' || role==='teacher' || role==='student') && (
          <>
            <div>
              <Label>Organization</Label>
              <Select
                value={orgId}
                onChange={(e)=> setOrgId(e.target.value)}
                disabled={role==='student'}
              >
                <option value="">Select organization</option>
                {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </div>

            <div>
              <Label>Under Admin</Label>
              {role==='teacher' ? (
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
                  ? 'MFA is required for Admin/Teacher'
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

  // tiny helpers
  const isEmail = (v:string) => /\S+@\S+\.\S+/.test(v || '')
  const truthy = (v:string) => /^(true|1|yes|y)$/i.test((v||'').trim())
  const normRole = (v:string) => {
    const r = (v||'').toLowerCase().trim()
    if (r === 'orguser') return 'student'
    return (['superadmin','admin','teacher','student'] as const).includes(r as any) ? r as any : 'student'
  }
  const normStatus = (v:string) => (['active','disabled'].includes((v||'').toLowerCase())) ? (v as any) : undefined
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

  function parseCSV(raw: string): Array<Partial<SAUser> & { email?:string }> {
    const lines = raw.replace(/\r/g,'').split('\n').filter(l => l.trim().length>0)
    if (!lines.length) return []

    const alias: Record<string,string> = {
      // core
      email:'email', name:'name', role:'role', status:'status', password:'password',
      // org variants
      orgid:'orgId', 'org_id':'orgId',
      org:'org', orgcode:'orgCode', 'org_code':'orgCode', orgname:'orgName', 'org_name':'orgName',
      orgdomain:'orgDomain', 'org_domain':'orgDomain',
      // admin / manager refs
      admin:'adminRef', adminemail:'adminRef', 'admin_email':'adminRef', adminid:'adminRef', 'admin_id':'adminRef',
      manager:'managerRef', manageremail:'managerRef', 'manager_email':'managerRef', managerid:'managerRef', 'manager_id':'managerRef',
      // MFA
      mfa:'mfa', mfarequired:'mfa.required', 'mfa_required':'mfa.required',
      mfamethod:'mfa.method', 'mfa_method':'mfa.method',
    }

    const header = split(lines[0]).map(h => h.trim().toLowerCase())
    const normHeader = header.map(h => alias[h] || h)

    const out: any[] = []
    for (let i=1;i<lines.length;i++){
      const cells = split(lines[i])
      const obj: any = {}
      normHeader.forEach((h, j) => {
        const rawv = (cells[j] ?? '').trim()
        if (!h) return
        if (h === 'mfa.required') setDeep(obj, h, truthy(rawv))
        else if (h === 'mfa.method') setDeep(obj, h, normMethod(rawv))
        else if (h === 'role') obj.role = normRole(rawv)
        else if (h === 'status') { const s = normStatus(rawv); if (s) obj.status = s }
        else if (h === 'orgId' || h === 'org' || h === 'orgCode' || h === 'orgName' || h === 'orgDomain' ||
                 h === 'adminRef' || h === 'managerRef' || h === 'password' || h === 'name' || h === 'email') {
          if (rawv !== '') setDeep(obj, h, rawv)
        } else {
          // unknown columns: store as-is (ignored by server if not recognized)
          if (rawv !== '') setDeep(obj, h, rawv)
        }
      })

      // sanity
      if (!obj.email || !isEmail(obj.email)) continue
      if (!obj.role) obj.role = 'student'
      // normalize MFA root if present
      if (obj.mfa && typeof obj.mfa === 'object') {
        if (obj.mfa.required === undefined) obj.mfa.required = (obj.role !== 'student') // default: admins/teachers require MFA
        if (obj.mfa.method && !['otp','totp'].includes(obj.mfa.method)) delete obj.mfa.method
      }

      out.push(obj)
    }
    return out
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk import users (CSV)">
      <div className="space-y-3">
        <div className="text-sm text-slate-600 space-y-1">
          <p className="font-medium">Accepted headers (use any subset):</p>
          <div className="text-xs grid gap-1">
            <div><code>email</code> (required), <code>name</code>, <code>role</code> (<code>superadmin|admin|teacher|student</code>), <code>status</code> (<code>active|disabled</code>), <code>password</code> (admin/teacher only)</div>
            <div><code>orgId</code> <em>or</em> <code>org</code>/<code>orgCode</code>/<code>orgName</code>/<code>orgDomain</code> (any one to identify org)</div>
            <div><code>adminRef</code> (admin email or id; used to set manager and derive <code>orgId</code> for students; also allowed for teachers)</div>
            <div><code>managerRef</code> (admin email or id; teacher’s supervising admin; if missing and org is present, the first active admin in that org is used)</div>
            <div><code>mfaRequired</code> (<code>true|false</code>), <code>mfaMethod</code> (<code>otp|totp</code>)</div>
          </div>
          <p className="text-xs">
            Tip: For students, **prefer** <code>adminRef</code> (admin email) so the org is auto-set. If only org is given, importer will pick the first active admin in that org.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={()=> fileRef.current?.click()}><Upload size={16}/> Upload CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e)=>{
            const f = e.target.files?.[0]; if(!f) return
            setText(await f.text())
          }}/>
          <Button variant="ghost" onClick={()=> {
            const sample =
`email,name,role,status,orgCode,adminRef,managerRef,password,mfaRequired,mfaMethod
super1@example.com,Global Super,superadmin,active,,,,StrongP@ssw0rd,true,otp
alpha-admin@example.com,Alpha Admin,admin,active,ALPHA,,,StrongP@ss1!,true,totp
alpha-teacher1@example.com,Alpha Teacher A,teacher,active,ALPHA,alpha-admin@example.com,,Teach#Pass1,true,totp
alpha-stu1@example.com,Alpha Student A,student,active,ALPHA,alpha-admin@example.com,,,
beta-admin@example.com,Beta Admin,admin,active,BETA,,,StrongP@ss2!,true,otp
beta-teacher1@example.com,Beta Teacher A,teacher,active,,beta-admin@example.com,,Teach#Two,true,totp
beta-stu1@example.com,Beta Student A,student,active,,beta-admin@example.com,,,
sales-stu@example.com,Sales Student,student,active,,sales-admin@example.com,,,otp
d-portal-teacher@example.com,Domain Teacher,teacher,active,,domain-admin@example.com,,Teach#Z,true,otp
`
            setText(sample)
          }}>Load sample</Button>
        </div>

        <div>
          <Label>CSV content</Label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm min-h-[220px]"
            value={text}
            onChange={(e)=> setText(e.target.value)}
            placeholder="Paste CSV rows here or click Upload CSV / Load sample"
          />
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