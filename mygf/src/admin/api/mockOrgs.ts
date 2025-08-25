//src/api/mockOrgs.ts
import type { Organization, OrgFilters, OrgStatus } from '../types/org'
import { StudentsDB } from './mockStudents'
import { logAudit } from '../api/audit'

const KEY = 'mock:orgs'
const now = () => new Date().toISOString()

function seed(): Organization[] {
  const t = now()
  const rows: Organization[] = [
    { id: 'org-101', code: 'org-101', name: 'Alpha Academy', domain: 'alpha.example', status: 'active', createdAt: t, updatedAt: t, contactName: 'Alpha Owner', contactEmail: 'owner@alpha.example' },
    { id: 'org-202', code: 'org-202', name: 'Beta Learning', domain: 'beta.example', status: 'active', createdAt: t, updatedAt: t, contactName: 'Beta Owner', contactEmail: 'owner@beta.example' },
  ]
  localStorage.setItem(KEY, JSON.stringify(rows))
  return rows
}

function read(): Organization[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    return JSON.parse(raw)
  } catch {
    return seed()
  }
}
function write(rows: Organization[]) { localStorage.setItem(KEY, JSON.stringify(rows)) }

async function syncStudentsOrgName(orgId: string, orgName?: string) {
  // Load all students, update orgName for those matching orgId
  const students = await StudentsDB.list({})
  const updates = students
    .filter(s => s.orgId === orgId)
    .map(s => StudentsDB.update(s.id, { orgName }))
  await Promise.all(updates)
}

async function clearStudentsOrg(orgId: string) {
  const students = await StudentsDB.list({})
  const updates = students
    .filter(s => s.orgId === orgId)
    .map(s => StudentsDB.update(s.id, { orgId: undefined, orgName: undefined }))
  await Promise.all(updates)
}

export const OrgsDB = {
  list(filters: OrgFilters) {
    let rows = read()
    if (filters.status && filters.status !== 'all') rows = rows.filter(o => o.status === filters.status)
    if (filters.q) {
      const q = filters.q.toLowerCase()
      rows = rows.filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        (o.domain || '').toLowerCase().includes(q) ||
        (o.contactName || '').toLowerCase().includes(q) ||
        (o.contactEmail || '').toLowerCase().includes(q)
      )
    }
    rows.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    return Promise.resolve(rows)
  },

create(payload: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>) {
  const all = read()
  const code = (payload.code || '').trim()
  if (!code) {
    return Promise.reject(new Error('Organization code is required'))
  }
  if (all.some(o => o.code.toLowerCase() === code.toLowerCase())) {
    return Promise.reject(new Error('Organization code already exists'))
  }
  const t = now()
  const id = code // keep id === code for stability
  const rec: Organization = { ...payload, id, createdAt: t, updatedAt: t }
  all.unshift(rec); write(all)
  return Promise.resolve(rec)
},

  async update(id: string, patch: Partial<Omit<Organization, 'id' | 'createdAt'>>) {
    const all = read()
    const i = all.findIndex(o => o.id === id)
    if (i === -1) return Promise.reject(new Error('Organization not found'))

    const prev = all[i]
    // prevent code collisions if code changes
    if (patch.code && patch.code.toLowerCase() !== prev.code.toLowerCase()) {
      if (all.some(o => o.code.toLowerCase() === patch.code!.toLowerCase())) {
        return Promise.reject(new Error('Organization code already exists'))
      }
    }

    all[i] = { ...prev, ...patch, updatedAt: now() }
    write(all)

    // propagate name changes to students
    if (patch.name !== undefined && patch.name !== prev.name) {
      await syncStudentsOrgName(all[i].id, all[i].name)
    }
    return all[i]
  },

  async delete(id: string) {
    await clearStudentsOrg(id)
    const all = read().filter(o => o.id !== id)
    write(all)
    return { id }
  },

  async setStatus(id: string, status: OrgStatus) {
    return this.update(id, { status })
  },

  /** Upsert by code (preferred) or by domain or by name (last resort) */
  async bulkUpsert(rows: Array<Partial<Organization> & { code?: string; name?: string }>) {
    let all = read()
    let created = 0, updated = 0
    for (const r of rows) {
      const code = (r.code || '').trim()
      const domain = (r.domain || '').trim().toLowerCase()
      const name = (r.name || '').trim()
      let i = -1
      if (code) i = all.findIndex(o => o.code.toLowerCase() === code.toLowerCase())
      if (i === -1 && domain) i = all.findIndex(o => (o.domain || '').toLowerCase() === domain)
      if (i === -1 && name) i = all.findIndex(o => o.name.toLowerCase() === name.toLowerCase())

      if (i === -1) {
        const t = now()
        const id = code || crypto.randomUUID()
        const rec: Organization = {
          id,
          code: code || id.slice(0, 8),
          name: name || `Org ${id.slice(0, 4)}`,
          domain: r.domain?.trim() || undefined,
          contactName: r.contactName?.trim() || undefined,
          contactEmail: r.contactEmail?.trim() || undefined,
          status: (r.status as OrgStatus) || 'active',
          createdAt: t,
          updatedAt: t,
        }
        all.unshift(rec); created++
      } else {
        const before = all[i]
        all[i] = {
          ...all[i],
          name: name || all[i].name,
          code: code || all[i].code,
          domain: r.domain?.trim() ?? all[i].domain,
          contactName: r.contactName?.trim() ?? all[i].contactName,
          contactEmail: r.contactEmail?.trim() ?? all[i].contactEmail,
          status: (r.status as OrgStatus) || all[i].status,
          updatedAt: now(),
        }
        // propagate name change
        if (before.name !== all[i].name) await syncStudentsOrgName(all[i].id, all[i].name)
        updated++
      }
    }
    write(all)
    return { created, updated, total: rows.length }
  }
}
