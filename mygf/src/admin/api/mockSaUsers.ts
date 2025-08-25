import type { SAUser, SAUserFilters, UserRole, UserStatus } from '../types/user'

const KEY = 'mock:sa-users'
const now = () => new Date().toISOString()

function seed(): SAUser[] {
  const t = now()
  const rows: SAUser[] = [
    { id: crypto.randomUUID(), name: 'Owner', email: 'owner@platform.local', role: 'superadmin', status: 'active', createdAt: t, updatedAt: t, provider: 'password' },
    { id: crypto.randomUUID(), name: 'Priya Admin', email: 'priya@alpha.example', role: 'admin', status: 'active', orgId: 'org-101', orgName: 'Alpha Academy', createdAt: t, updatedAt: t, provider: 'password' },
    { id: crypto.randomUUID(), name: 'Ben Admin', email: 'ben@beta.example', role: 'admin', status: 'disabled', orgId: 'org-202', orgName: 'Beta Learning', createdAt: t, updatedAt: t, provider: 'google' },
  ]
  localStorage.setItem(KEY, JSON.stringify(rows))
  return rows
}

function read(): SAUser[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    return JSON.parse(raw)
  } catch { return seed() }
}
function write(rows: SAUser[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }

function countSuperadmins(list: SAUser[]) {
  return list.filter(u => u.role === 'superadmin' && u.status === 'active').length
}

export const SaUsersDB = {
  list(filters: SAUserFilters){
    let rows = read()
    if (filters.role && filters.role !== 'all') rows = rows.filter(u => u.role === filters.role)
    if (filters.status && filters.status !== 'all') rows = rows.filter(u => u.status === filters.status)
    if (filters.orgId) rows = rows.filter(u => (u.orgId || '') === filters.orgId)
    if (filters.q) {
      const q = filters.q.toLowerCase()
      rows = rows.filter(u =>
        (u.name||'').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.orgName||'').toLowerCase().includes(q)
      )
    }
    rows.sort((a,b)=> (b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))
    return Promise.resolve(rows)
  },

  create(payload: Omit<SAUser,'id'|'createdAt'|'updatedAt'>){
    const t = now()
    const rec: SAUser = { ...payload, id: crypto.randomUUID(), createdAt: t, updatedAt: t }
    const all = read()
    // prevent creating disabled superadmin if it would be the only one active (not applicable here)
    all.unshift(rec); write(all)
    return Promise.resolve(rec)
  },

  update(id: string, patch: Partial<Omit<SAUser,'id'|'createdAt'>>){
    const all = read()
    const i = all.findIndex(u => u.id === id)
    if (i === -1) return Promise.reject(new Error('User not found'))

    // guard: cannot demote/disable/delete last active superadmin
    const nextRole = (patch.role ?? all[i].role) as UserRole
    const nextStatus = (patch.status ?? all[i].status) as UserStatus
    const cur = all[i]
    if (cur.role === 'superadmin') {
      const supCount = countSuperadmins(all)
      const willStaySuper = nextRole === 'superadmin' && nextStatus === 'active'
      if (!willStaySuper && supCount <= 1) {
        return Promise.reject(new Error('Cannot demote/disable the last active superadmin'))
      }
    }

    all[i] = { ...all[i], ...patch, updatedAt: now() }
    write(all); return Promise.resolve(all[i])
  },

  delete(id: string){
    let all = read()
    const me = all.find(u => u.id === id)
    if (!me) return Promise.resolve({ id })
    if (me.role === 'superadmin' && countSuperadmins(all) <= 1) {
      return Promise.reject(new Error('Cannot delete the last active superadmin'))
    }
    all = all.filter(u => u.id !== id)
    write(all); return Promise.resolve({ id })
  },

  setStatus(id: string, status: UserStatus){
    return this.update(id, { status })
  },

  setRole(id: string, role: UserRole){
    return this.update(id, { role })
  },

  /** Bulk upsert by email. Only 'admin' role allowed here for safety. */
  bulkUpsert(rows: Array<Partial<SAUser> & { email?: string }>) {
    const all = read()
    const t = now()
    let created = 0, updated = 0
    for (const r of rows) {
      if (!r.email) continue
      const email = r.email.trim().toLowerCase()
      const i = all.findIndex(u => u.email.toLowerCase() === email)
      if (i === -1) {
        all.unshift({
          id: crypto.randomUUID(),
          email,
          name: (r.name||'').trim() || undefined,
          role: (r.role === 'superadmin' ? 'admin' : (r.role as UserRole)) || 'admin', // force admin
          status: (r.status as UserStatus) || 'active',
          orgId: r.orgId, orgName: r.orgName,
          provider: r.provider || 'password',
          createdAt: t, updatedAt: t,
        })
        created++
      } else {
        all[i] = {
          ...all[i],
          name: (r.name ?? all[i].name),
          role: (r.role === 'superadmin' ? 'admin' : (r.role as UserRole)) || all[i].role,
          status: (r.status as UserStatus) || all[i].status,
          orgId: r.orgId ?? all[i].orgId,
          orgName: r.orgName ?? all[i].orgName,
          updatedAt: t,
        }
        updated++
      }
    }
    write(all); return Promise.resolve({ created, updated, total: rows.length })
  }
}
