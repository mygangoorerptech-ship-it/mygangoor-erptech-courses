import type { Subscription, SubscriptionFilters, SubscriptionStatus } from '../types/subscription'
import { OrgsDB } from './mockOrgs'
import { SaUsersDB } from './mockSaUsers'
import { SaCoursesDB } from './mockSaCourses'
import { StudentsDB } from './mockStudents'

const KEY = 'mock:subscriptions'
const now = () => new Date().toISOString()

function seed(): Subscription[] {
  const t = now()
  const rows: Subscription[] = [
    {
      id: crypto.randomUUID(),
      studentEmail: 'ava@alpha.example',
      studentName: 'Ava Shah',
      courseId: (SaCoursesDB as any)._pickFirst?.() || 'react-fundamentals', // safe fallback; not required
      courseTitle: 'React Fundamentals',
      orgId: 'org-101',
      orgName: 'Alpha Academy',
      ownerEmail: 'priya@alpha.example',
      ownerName: 'Priya Admin',
      amount: 49, currency: 'USD', status: 'paid', method: 'card', gateway: 'stripe', txnId: 'tx_1001',
      purchasedAt: t,
      createdAt: t, updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      studentEmail: 'new@beta.example',
      studentName: 'New User',
      courseId: 'advanced-node',
      courseTitle: 'Advanced Node.js',
      orgId: 'org-202',
      orgName: 'Beta Learning',
      ownerEmail: 'ben@beta.example',
      ownerName: 'Ben Admin',
      amount: 79, currency: 'USD', status: 'paid', method: 'upi', gateway: 'razorpay', txnId: 'rzp_2002',
      purchasedAt: t,
      createdAt: t, updatedAt: t,
    },
  ]
  localStorage.setItem(KEY, JSON.stringify(rows))
  return rows
}
function read(): Subscription[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    return JSON.parse(raw)
  } catch { return seed() }
}
function write(rows: Subscription[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }

/** Enrich display names from latest orgs/users/courses/students */
async function enrich(rows: Subscription[]): Promise<Subscription[]> {
  const [orgs, admins, courses, students] = await Promise.all([
    OrgsDB.list({}),
    SaUsersDB.list({ role: 'admin' } as any),
    SaCoursesDB.list({} as any),
    StudentsDB.list({} as any),
  ])
  const orgById = new Map(orgs.map(o => [o.id, o]))
  const adminByEmail = new Map(admins.map(a => [a.email.toLowerCase(), a]))
  const courseById = new Map(courses.map(c => [c.id, c]))
  const studentByEmail = new Map(students.map(s => [s.email.toLowerCase(), s]))
  return rows.map(s => {
    const o = s.orgId ? orgById.get(s.orgId) : undefined
    const a = s.ownerEmail ? adminByEmail.get(s.ownerEmail.toLowerCase()) : undefined
    const c = courseById.get(s.courseId)
    const u = s.studentEmail ? studentByEmail.get(s.studentEmail.toLowerCase()) : undefined
    return {
      ...s,
      orgName: o?.name || s.orgName,
      ownerName: a?.name || s.ownerName,
      courseTitle: c?.title || s.courseTitle,
      studentName: u?.name || s.studentName,
    }
  })
}

export const SubscriptionsDB = {
  async list(filters: SubscriptionFilters){
    let rows = read()
    if (filters.status && filters.status !== 'all') rows = rows.filter(r => r.status === filters.status)
    if (filters.orgId) rows = rows.filter(r => (r.orgId || '') === filters.orgId)
    if (filters.ownerEmail) rows = rows.filter(r => (r.ownerEmail || '').toLowerCase() === filters.ownerEmail!.toLowerCase())
    if (filters.courseId) rows = rows.filter(r => r.courseId === filters.courseId)
    if (filters.studentEmail) rows = rows.filter(r => (r.studentEmail || '').toLowerCase() === filters.studentEmail!.toLowerCase())
    if (filters.q) {
      const q = filters.q.toLowerCase()
      rows = rows.filter(r =>
        (r.studentName||'').toLowerCase().includes(q) ||
        (r.studentEmail||'').toLowerCase().includes(q) ||
        (r.courseTitle||'').toLowerCase().includes(q) ||
        (r.orgName||'').toLowerCase().includes(q) ||
        (r.ownerName||'').toLowerCase().includes(q)
      )
    }
    rows.sort((a,b)=> (b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))
    return enrich(rows)
  },

  async create(payload: Omit<Subscription,'id'|'createdAt'|'updatedAt'>){
    const t = now()
    const rec: Subscription = { ...payload, id: crypto.randomUUID(), createdAt: t, updatedAt: t }
    const all = read(); all.unshift(rec); write(all)
    return (await enrich([rec]))[0]
  },

  async update(id: string, patch: Partial<Omit<Subscription,'id'|'createdAt'>>){
    const all = read()
    const i = all.findIndex(x => x.id === id)
    if (i === -1) throw new Error('Subscription not found')
    all[i] = { ...all[i], ...patch, updatedAt: now() }
    write(all)
    return (await enrich([all[i]]))[0]
  },

  async delete(id: string){
    const all = read().filter(x => x.id !== id)
    write(all); return { id }
  },

  async setStatus(id: string, status: SubscriptionStatus){
    return this.update(id, { status })
  },

  async refund(id: string){
    return this.update(id, { status: 'refunded' })
  },

  async cancel(id: string){
    return this.update(id, { status: 'canceled' })
  }
}
