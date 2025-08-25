// src/api/overview.ts
import { api } from './client'
import { USE_MOCK } from './env'

// Reuse the same APIs your sidebars use
import { listStudents } from './students'
import { listSubscriptions } from './subscriptions'
import { listPayouts } from './payouts'
import { listCourses } from './courses'
import { listSaUsers } from './saUsers'
import { listAssessments } from './assessments'
import { listAssignments } from './assignments'

// Optional modules (payments, audit, saCourses) — try/catch so nothing breaks
async function tryListPayments(params:any){ try{ const m:any = await import('./payments'); return await m.listPayments(params) }catch{ return [] } }
async function tryListAudit(params:any){ try{ const m:any = await import('./audit'); return await (m.listAudit?.(params) ?? []) }catch{ return [] } }
// If you have a dedicated SA courses API
async function tryListSaCourses(params:any){ try{ const m:any = await import('./saCourses'); return await (m.listSaCourses?.(params) ?? []) }catch{ return [] } }

const sum = (xs:number[]) => xs.reduce((a,b)=>a+b,0)
const sinceDays = (n:number) => new Date(Date.now() - n*86400000).toISOString()

// -------- Types you consume in pages --------
type AdminOverviewTotals = {
  courses: number
  students: number
  activeSubs: number
  mrr: number
  revenue30d: number
  assignmentsDue7d: number
  assessments: number
}
export type AdminOverviewData = {
  totals: AdminOverviewTotals
  recent: {
    newStudents: any[]
    subscriptions: any[]
    audit: any[]
  }
}

type SuperadminOverviewTotals = {
  // kept for compatibility; will be 0
  orgs: number
  admins: number
  courses: number
  students: number
  activeSubs: number
  gmv30d: number
  payouts30d: number
  outstandingPayouts: number
}
export type SuperadminOverviewData = {
  totals: SuperadminOverviewTotals
  // kept for compatibility; now computed as an empty list
  topOrgs: Array<{ orgId?: string; orgName?: string; revenue30d: number; students: number; courses: number }>
  recentAudit: any[]
}

// ---------------- ADMIN OVERVIEW ----------------
export async function getAdminOverview(_orgId?: string): Promise<AdminOverviewData>{
  if (!USE_MOCK){
    const { data } = await api.get('/overview/admin', { params:{ /* orgId removed */ } })
    return data as AdminOverviewData
  }

  // Pull from the same sources as the sidebars (no org filtering)
  const [courses, students, subs, assignments, assessments, payments, audit] = await Promise.all([
    listCourses({ status:'all' }),
    listStudents({ status:'all' }),
    listSubscriptions({ status:'all' }),
    listAssignments({ status:'all' }),
    listAssessments({ status:'all' }),
    tryListPayments({ since: sinceDays(30) }),
    tryListAudit({ limit: 10 }),
  ])

  const activeSubs = subs.filter((s:any)=> s.status==='active')
  const mrr = sum(activeSubs.map((s:any)=> Number(s.amount ?? s.price ?? 0)))

  const revBase = (payments.length ? payments : subs).filter((r:any)=>{
    const t = new Date(r.createdAt || r.paidAt || Date.now()).toISOString()
    return t >= sinceDays(30)
  })
  const revenue30d = sum(revBase.map((r:any)=> Number(r.amount ?? r.price ?? 0)))

  const dueSoon = assignments.filter((a:any)=>{
    if (!a?.dueAt) return false
    const d = +new Date(a.dueAt)
    const now = Date.now()
    return d >= now && d <= now + 7*86400000
  })

  return {
    totals: {
      courses: courses.length,
      students: students.length,
      activeSubs: activeSubs.length,
      mrr,
      revenue30d,
      assignmentsDue7d: dueSoon.length,
      assessments: assessments.length,
    },
    recent: {
      newStudents: students.slice(0,5),
      subscriptions: subs.slice(0,5),
      audit: audit.slice(0,10),
    }
  }
}

// -------------- SUPERADMIN OVERVIEW --------------
export async function getSuperadminOverview(): Promise<SuperadminOverviewData>{
  if (!USE_MOCK){
    const { data } = await api.get('/overview/superadmin')
    return data as SuperadminOverviewData
  }

  const [/* orgs removed */, admins, saCourses, fallbackCourses, students, subs, payments, payouts, audit] = await Promise.all([
    // listOrgs({ status:'all' }),
    listSaUsers({ role:'admin' } as any),
    tryListSaCourses({ status:'all' }),
    listCourses({ status:'all' }),
    listStudents({ status:'all' }),
    listSubscriptions({ status:'all' }),
    tryListPayments({ since: sinceDays(30) }),
    listPayouts({ since: sinceDays(30) } as any),
    tryListAudit({ limit: 20 }),
  ])

  const courses = (saCourses.length ? saCourses : fallbackCourses)

  const gmv30d = sum(payments.map((p:any)=> Number(p.amount ?? p.price ?? 0)))
  const payouts30d = sum(payouts.filter((p:any)=> (p.status ?? 'processed')==='processed').map((p:any)=> Number(p.amount ?? 0)))
  const outstandingPayouts = sum(payouts.filter((p:any)=> (p.status ?? 'processed')!=='processed').map((p:any)=> Number(p.amount ?? 0)))

  // Org-based aggregation removed; return empty list for compatibility
  const topOrgs: Array<{ orgId?: string; orgName?: string; revenue30d: number; students: number; courses: number }> = []

  return {
    totals: {
      orgs: 0,
      admins: admins.length,
      courses: courses.length,
      students: students.length,
      activeSubs: subs.filter((s:any)=> s.status==='active').length,
      gmv30d,
      payouts30d,
      outstandingPayouts,
    },
    topOrgs,
    recentAudit: audit.slice(0,20),
  }
}
