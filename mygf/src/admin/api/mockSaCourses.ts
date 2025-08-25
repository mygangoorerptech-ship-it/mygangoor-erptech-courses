import type { Course, CourseFilters, CourseStatus } from '../types/course'
import { OrgsDB } from './mockOrgs'
import { SaUsersDB } from './mockSaUsers'

const KEY = 'mock:sa-courses'
const now = () => new Date().toISOString()

function seed(): Course[] {
  const t = now()
  const rows: Course[] = [
    {
      id: crypto.randomUUID(),
      title: 'React Fundamentals',
      slug: 'react-fundamentals',
      description: 'Learn the basics of React.',
      category: 'Web',
      price: 49,
      visibility: 'public',
      status: 'published',
      orgId: 'org-101',
      orgName: 'Alpha Academy',
      ownerEmail: 'priya@alpha.example',
      ownerName: 'Priya Admin',
      createdAt: t, updatedAt: t,
      tags: ['react', 'frontend']
    },
    {
      id: crypto.randomUUID(),
      title: 'Advanced Node.js',
      slug: 'advanced-node',
      description: 'Deep dive into Node.js internals',
      category: 'Backend',
      price: 79,
      visibility: 'unlisted',
      status: 'draft',
      orgId: 'org-202',
      orgName: 'Beta Learning',
      ownerEmail: 'ben@beta.example',
      ownerName: 'Ben Admin',
      createdAt: t, updatedAt: t,
      tags: ['node', 'backend']
    },
  ]
  localStorage.setItem(KEY, JSON.stringify(rows))
  return rows
}
function read(): Course[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    return JSON.parse(raw)
  } catch { return seed() }
}
function write(rows: Course[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }

/** best-effort enrichment with latest org/user names for display */
async function enrichDisplay(rows: Course[]): Promise<Course[]> {
  const [orgs, users] = await Promise.all([
    OrgsDB.list({}),
    // only admins are owners for courses
    SaUsersDB.list({ role: 'admin' } as any)
  ])
  const orgById = new Map(orgs.map(o => [o.id, o]))
  const userByEmail = new Map(users.map(u => [u.email.toLowerCase(), u]))
  return rows.map(c => {
    const o = c.orgId ? orgById.get(c.orgId) : undefined
    const u = c.ownerEmail ? userByEmail.get(c.ownerEmail.toLowerCase()) : undefined
    return {
      ...c,
      orgName: o?.name || c.orgName,
      ownerName: u?.name || c.ownerName,
      ownerId: u?.id || c.ownerId
    }
  })
}

export const SaCoursesDB = {
  async list(filters: CourseFilters){
    let rows = read()
    if (filters.status && filters.status !== 'all') rows = rows.filter(c => c.status === filters.status)
    if (filters.orgId) rows = rows.filter(c => (c.orgId || '') === filters.orgId)
    if (filters.ownerEmail) rows = rows.filter(c => (c.ownerEmail || '').toLowerCase() === filters.ownerEmail!.toLowerCase())
    if (filters.q) {
      const q = filters.q.toLowerCase()
      rows = rows.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.orgName || '').toLowerCase().includes(q) ||
        (c.ownerName || '').toLowerCase().includes(q) ||
        (c.ownerEmail || '').toLowerCase().includes(q)
      )
    }
    rows.sort((a,b)=> (b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))
    return enrichDisplay(rows)
  },

  async create(payload: Omit<Course,'id'|'createdAt'|'updatedAt'>){
    const t = new Date().toISOString()
    const rec: Course = { id: crypto.randomUUID(), createdAt: t, updatedAt: t, ...payload as any }
    const all = read(); all.unshift(rec); write(all)
    return (await enrichDisplay([rec]))[0]
  },

  async update(id: string, patch: Partial<Omit<Course,'id'|'createdAt'>>){
    const all = read()
    const i = all.findIndex(c => c.id === id)
    if (i === -1) throw new Error('Course not found')
    all[i] = { ...all[i], ...patch, updatedAt: now() }
    write(all)
    return (await enrichDisplay([all[i]]))[0]
  },

  async delete(id: string){
    const all = read().filter(c => c.id !== id)
    write(all); return { id }
  },

  async setStatus(id: string, status: CourseStatus){
    return this.update(id, { status })
  }
}
