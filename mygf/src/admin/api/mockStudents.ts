import type { Student, StudentFilters, StudentStatus } from '../types/student'

const KEY = 'mock:students'

function nowISO(){ return new Date().toISOString() }

function seed(): Student[] {
  const t = nowISO()
  const orgs = [
    { id: 'org-101', name: 'Alpha Academy' },
    { id: 'org-202', name: 'Beta Learning' },
  ]
  const rows: Student[] = [
    {
      id: crypto.randomUUID(), orgId: orgs[0].id, orgName: orgs[0].name,
      username: 'ava', email: 'ava@alpha.example', name: 'Ava Shah',
      status: 'active', provider: 'password', createdAt: t, updatedAt: t
    },
    {
      id: crypto.randomUUID(), orgId: orgs[0].id, orgName: orgs[0].name,
      username: 'rahul', email: 'rahul@alpha.example', name: 'Rahul Menon',
      status: 'active', provider: 'google', createdAt: t, updatedAt: t
    },
    {
      id: crypto.randomUUID(), orgId: orgs[1].id, orgName: orgs[1].name,
      username: 'mei', email: 'mei@beta.example', name: 'Mei Lin',
      status: 'inactive', provider: 'password', createdAt: t, updatedAt: t
    },
  ]
  localStorage.setItem(KEY, JSON.stringify(rows))
  return rows
}

function read(): Student[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    return JSON.parse(raw)
  } catch {
    return seed()
  }
}

function write(rows: Student[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }

function upsertOne(all: Student[], incoming: Partial<Student>): { all: Student[]; created: boolean } {
  const key = (incoming.email || incoming.username || '').toLowerCase()
  let i = all.findIndex(s => (s.email || '').toLowerCase() === key || (s.username || '').toLowerCase() === key)
  const t = nowISO()
  if (i === -1) {
    const rec: Student = {
      id: crypto.randomUUID(),
      username: incoming.username?.trim() || (incoming.email?.split('@')[0] ?? 'user'),
      email: (incoming.email ?? '').trim(),
      name: incoming.name?.trim() || undefined,
      orgId: incoming.orgId,
      orgName: incoming.orgName,
      status: (incoming.status as StudentStatus) || 'active',
      provider: incoming.provider || 'password',
      createdAt: t,
      updatedAt: t,
    }
    all.unshift(rec)
    i = 0
    return { all, created: true }
  } else {
    const cur = all[i]
    all[i] = {
      ...cur,
      ...incoming,
      username: (incoming.username ?? cur.username).trim(),
      email: (incoming.email ?? cur.email).trim(),
      name: incoming.name?.trim() ?? cur.name,
      updatedAt: t,
    }
    return { all, created: false }
  }
}

export const StudentsDB = {
  list(filters: StudentFilters){
    let rows = read()

    if (filters.orgId) rows = rows.filter(s => s.orgId === filters.orgId)
    if (filters.status && filters.status !== 'all') rows = rows.filter(s => s.status === filters.status)

    if (filters.q) {
      const q = filters.q.toLowerCase()
      rows = rows.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.orgName || '').toLowerCase().includes(q)
      )
    }

    rows.sort((a,b)=> (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    return Promise.resolve(rows)
  },

  create(payload: Omit<Student,'id'|'createdAt'|'updatedAt'>){
    const t = nowISO()
    const rec: Student = { ...payload, id: crypto.randomUUID(), createdAt: t, updatedAt: t }
    const all = read(); all.unshift(rec); write(all)
    return Promise.resolve(rec)
  },

  update(id: string, patch: Partial<Omit<Student,'id'|'createdAt'>>){
    const all = read()
    const i = all.findIndex(s => s.id === id)
    if (i === -1) return Promise.reject(new Error('Student not found'))
    all[i] = { ...all[i], ...patch, updatedAt: nowISO() }
    write(all); return Promise.resolve(all[i])
  },

  delete(id: string){
    const all = read().filter(s => s.id !== id)
    write(all); return Promise.resolve({ id })
  },

  setStatus(id: string, status: StudentStatus){
    const all = read()
    const i = all.findIndex(s => s.id === id)
    if (i === -1) return Promise.reject(new Error('Student not found'))
    all[i].status = status
    all[i].updatedAt = nowISO()
    write(all); return Promise.resolve(all[i])
  },

  /** Bulk upsert by email/username. Returns counts. */
  bulkUpsert(rows: Array<Partial<Student> & { email?: string; username?: string }>) {
    let all = read()
    let created = 0, updated = 0
    for (const r of rows) {
      const before = JSON.stringify(all)
      const res = upsertOne(all, r)
      all = res.all
      if (res.created) created++
      else if (before !== JSON.stringify(all)) updated++
    }
    write(all)
    return Promise.resolve({ created, updated, total: rows.length })
  }
}
