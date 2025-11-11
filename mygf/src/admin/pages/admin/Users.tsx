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
            // Error handling is in the modal component
            // The modal will only call onClose() on success (or show invitation link)
            try {
              if (open.mode === 'create') {
                const result = await createOne(payload)
                // Return result so modal can check for invitation link
                return result
              } else if (open.initial?.id) {
                await updateOne(open.initial.id, payload)
                return null
              }
            } catch (error) {
              // Re-throw error so modal can handle it
              // Modal will display error and prevent closing
              throw error
            }
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
  onSubmit: (payload: { name?:string; email:string; role:AdminUserRole; mfa?:{required:boolean; method:'otp'|'totp'|null}; sendMethod?:'credentials'|'invitation'; generateOnly?:boolean })=>Promise<any>
}) {
  const [name, setName]   = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [role, setRole]   = useState<AdminUserRole>((initial?.role as AdminUserRole) || 'student')
  const [mfaRequired, setMfaRequired] = useState<boolean>(initial?.mfa?.required ?? (role === 'student'))
  const [mfaMethod, setMfaMethod] = useState<'otp'|'totp'|null>((initial?.mfa?.method as any) ?? (role === 'student' ? 'otp' : null))
  const [sendMethod, setSendMethod] = useState<'credentials' | 'invitation'>('credentials')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitationLink, setInvitationLink] = useState<string | null>(null)

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
          <Input value={name} onChange={e=> {
            setName(e.target.value);
            if (error) setError(null); // Clear error when user starts typing
          }}/>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e=> {
            setEmail(e.target.value);
            if (error) setError(null); // Clear error when user starts typing
          }} disabled={mode==='edit'}/>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={e=> {
            setRole(e.target.value as AdminUserRole);
            if (error) setError(null); // Clear error when user changes role
          }} disabled={mode==='edit'}>
            <option value="student">Student</option>
            <option value="vendor">Vendor</option>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            {sendMethod === 'credentials' 
              ? `Students will receive login credentials by email, and must complete MFA (${mfaRequired ? (mfaMethod?.toUpperCase() || 'OTP') : 'optional'}). No Sign Up needed.`
              : `Invitation link will be sent to the user. They will set their own password and create their account.`}
          </p>
        </div>

        {mode === 'create' && (
          <div>
            <Label>Send Method</Label>
            <Select 
              value={sendMethod || 'credentials'} 
              onChange={e=> {
                setSendMethod(e.target.value as 'credentials' | 'invitation');
                setInvitationLink(null); // Clear invitation link when method changes
                if (error) setError(null);
              }}
            >
              <option value="credentials">Send Credentials (Auto-create account)</option>
              <option value="invitation">Send Invitation Link (User sets password)</option>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {sendMethod === 'credentials' 
                ? 'User account will be created immediately with auto-generated password sent via email.'
                : 'User will receive an invitation link to set their own password. Link expires in 24 hours.'}
            </p>
            
            {sendMethod === 'invitation' && !invitationLink && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    setError(null);
                    
                    // Client-side validation
                    if (!email || !email.trim()) {
                      setError("Email address is required. Please enter a valid email address.");
                      return;
                    }
                    
                    // Basic email format validation
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email.trim())) {
                      setError("Please enter a valid email address (e.g., user@example.com).");
                      return;
                    }
                    
                    setSaving(true);
                    try {
                      const result = await onSubmit({
                        name: name || undefined,
                        email: email.trim(),
                        role,
                        mfa: { required: mfaRequired, method: mfaRequired ? (mfaMethod || 'otp') : null },
                        sendMethod: 'invitation',
                        generateOnly: true, // Only generate link, don't send email
                      });
                      
                      // If invitation was created, show the link
                      if (result?.invitation?.invitationLink) {
                        setInvitationLink(result.invitation.invitationLink);
                      } else {
                        setError("Failed to generate invitation link. Please try again.");
                      }
                    } catch (err: any) {
                      console.error("[EditUserModal] Generate link error:", err);
                      const errorData = err?.data || err?.response?.data || {};
                      setError(errorData?.message || err?.message || "Failed to generate invitation link. Please try again.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || !email.trim()}
                  className="w-full"
                >
                  {saving ? 'Generating...' : 'Generate Link'}
                </Button>
                <p className="text-xs text-gray-500 mt-1">
                  Click to generate invitation link. You can copy it and send manually, or click Create to also send via email.
                </p>
              </div>
            )}
            
            {sendMethod === 'invitation' && invitationLink && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Label>Invitation Link (Generated)</Label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={invitationLink}
                    className="flex-1 px-3 py-2 border border-blue-300 rounded bg-white font-mono text-xs"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(invitationLink);
                      alert('Invitation link copied to clipboard!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  ✅ Link generated! You can copy and send it manually, or click "Send Email" below to send it via email.
                </p>
              </div>
            )}
          </div>
        )}

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

        {invitationLink && sendMethod === 'invitation' && (
          <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-green-900 mb-2 text-base">
                  ✅ Invitation Link Ready
                </h4>
                <p className="text-green-800 text-sm mb-3">
                  The invitation link has been generated successfully. You can copy it and share manually (via email, social media, etc.), or click "Send Email" below to send it automatically via email.
                </p>
                <div className="mb-3">
                  <Label>Invitation Link</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      readOnly
                      value={invitationLink}
                      className="flex-1 px-3 py-2 border border-green-300 rounded bg-white font-mono text-xs"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(invitationLink);
                        alert('Invitation link copied to clipboard!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-green-700">
                  This link will expire in 24 hours. The user can use it to set their password and create their account.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-red-900 mb-2 text-base">
                  {mode === 'create' ? 'Unable to Create User' : 'Unable to Update User'}
                </h4>
                <div className="text-red-800 text-sm leading-relaxed whitespace-pre-line space-y-2">
                  {error.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className={idx > 0 ? 'mt-2' : ''}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => {
            setInvitationLink(null)
            onClose()
          }}>{invitationLink && sendMethod === 'invitation' ? 'Close' : 'Cancel'}</Button>
          <Button
            onClick={async ()=>{
              setError(null); // Clear previous errors
              
              // Client-side validation
              if (!email || !email.trim()) {
                setError("Email address is required. Please enter a valid email address.");
                return;
              }
              
              // Basic email format validation
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(email.trim())) {
                setError("Please enter a valid email address (e.g., user@example.com).");
                return;
              }
              
              // For invitation method:
              // - If link is already generated, this sends the email
              // - If link is not generated, this creates invitation + sends email
              // For credentials method, this creates user + sends credentials
              
              setSaving(true)
              try {
                const result = await onSubmit({
                  name: name || undefined,
                  email: email.trim(),
                  role,
                  mfa: { required: mfaRequired, method: mfaRequired ? (mfaMethod || 'otp') : null },
                  sendMethod: mode === 'create' ? sendMethod : undefined,
                  generateOnly: false, // This is the create action
                })
                
                // If invitation was created, show the link
                if (result?.invitation?.invitationLink) {
                  setInvitationLink(result.invitation.invitationLink);
                  // For invitation method, show success message
                  // If email was sent, show success message; modal stays open so admin can copy the link
                  if (result.invitation.emailSent && sendMethod === 'invitation') {
                    // Email sent successfully - show success but keep modal open for copying
                    // Modal will stay open so admin can copy the link
                  }
                  // Don't close modal for invitation method - let admin copy link
                  // For credentials method, close modal
                  if (sendMethod !== 'invitation') {
                    onClose();
                  }
                } else {
                  // Normal user creation (credentials method) - close modal
                  onClose();
                }
              } catch (err: any) {
                console.error("[EditUserModal] Error:", err);
                
                // Extract error details from the backend response
                const errorData = err?.data || err?.response?.data || {};
                const errorDetails = errorData?.details || {};
                const statusCode = err?.status || err?.response?.status;
                const isNetworkError = !statusCode && err?.message?.includes('Network');
                const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');
                
                // Build a comprehensive, user-friendly error message based on error type
                let errorMessage = errorData?.message || err?.message || "An unexpected error occurred.";
                
                // Handle different error scenarios
                if (isNetworkError) {
                  errorMessage = "Network connection error. Please check your internet connection and try again.";
                } else if (isTimeout) {
                  errorMessage = "Request timed out. The server is taking too long to respond. Please try again.";
                } else if (statusCode === 409) {
                  // User already exists - already handled by backend message, but enhance it
                  errorMessage = errorData?.message || "This email address is already registered in the system.";
                } else if (statusCode === 400) {
                  errorMessage = errorData?.message || "Invalid input. Please check your entries and try again.";
                } else if (statusCode === 403) {
                  errorMessage = errorData?.message || "You do not have permission to perform this action.";
                } else if (statusCode === 404) {
                  errorMessage = errorData?.message || "The requested resource was not found.";
                } else if (statusCode === 500) {
                  errorMessage = errorData?.message || "A server error occurred. Please try again later or contact support.";
                } else if (statusCode && statusCode >= 500) {
                  errorMessage = errorData?.message || "Server error. Please try again later or contact support if the issue persists.";
                }
                
                // Build a comprehensive error message
                const errorParts: string[] = [errorMessage];
                
                // Add existing user details if available (for 409 conflicts)
                if (errorDetails?.existingEmail && statusCode === 409) {
                  const details: string[] = [];
                  if (errorDetails.existingUserRoleDisplay) {
                    details.push(`Role: ${errorDetails.existingUserRoleDisplay}`);
                  }
                  if (errorDetails.existingUserStatusDisplay) {
                    details.push(`Status: ${errorDetails.existingUserStatusDisplay}`);
                  }
                  if (errorDetails.existingUserId && errorDetails.existingUserId !== 'Unknown') {
                    details.push(`User ID: ${errorDetails.existingUserId}`);
                  }
                  
                  if (details.length > 0) {
                    errorParts.push(`\nExisting Account Details:\n${details.map(d => `• ${d}`).join('\n')}`);
                  }
                }
                
                // Add suggestion if available
                if (errorDetails?.suggestion) {
                  errorParts.push(`\n\n${errorDetails.suggestion}`);
                } else if (!errorDetails?.suggestion && statusCode === 409) {
                  errorParts.push(`\n\nPlease use a different email address or update the existing user if you intended to modify their account.`);
                }
                
                setError(errorParts.join('\n'));
                
                // Log detailed error for debugging
                console.error("[EditUserModal] Full error details:", {
                  error: err,
                  status: statusCode,
                  statusText: err?.statusText || err?.response?.statusText,
                  data: errorData,
                  details: errorDetails,
                  errorCode: errorData?.errorCode,
                  isNetworkError,
                  isTimeout,
                });
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            aria-busy={saving}
          >
            {saving 
              ? 'Saving…' 
              : (sendMethod === 'invitation' && invitationLink 
                ? 'Send Email' 
                : (mode==='create' ? 'Create' : 'Save'))}
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
