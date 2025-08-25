// src/api/mockAssessments.ts
import type { Assessment, AssessmentFilters, AssessmentStatus } from '../types/assessment'

const KEY = 'mock:assessments'
const nowISO = () => new Date().toISOString()

function read(): Assessment[] {
  try { const raw = localStorage.getItem(KEY); if (!raw) return seed(); return JSON.parse(raw) } catch { return seed() }
}
function write(rows: Assessment[]) { localStorage.setItem(KEY, JSON.stringify(rows)) }

function seed(): Assessment[] {
  const t = nowISO()
  const rows: Assessment[] = [
    { id: crypto.randomUUID(), title:'React Fundamentals — Quiz 1', description:undefined, courseId:'REACT-101', courseTitle:'React Fundamentals', orgId: undefined, orgName: undefined, timeLimitMin:30, passingScore:70, totalQuestions:12, status:'published', tags:[], createdAt:t, updatedAt:t },
    { id: crypto.randomUUID(), title:'TypeScript Deep Dive — Assessment', description:undefined, courseId:'TS-201',    courseTitle:'TS Deep Dive',           orgId: undefined, orgName: undefined, timeLimitMin:45, passingScore:70, totalQuestions:10, status:'draft',     tags:[], createdAt:t, updatedAt:t },
    { id: crypto.randomUUID(), title:'Node API Mastery — Final',        description:undefined, courseId:'NODE-301', courseTitle:'Node API Mastery',       orgId: undefined, orgName: undefined, timeLimitMin:30, passingScore:80, totalQuestions:10, status:'archived',  tags:[], createdAt:t, updatedAt:t },
  ]
  write(rows); return rows
}

export const AssessmentsDB = {
  async list(filters: AssessmentFilters = {}) {
    let rows = read()
    if (filters.status && filters.status !== 'all') rows = rows.filter(a => a.status === filters.status)
    if (filters.courseId) rows = rows.filter(a => (a.courseId || '') === filters.courseId)
    if (filters.orgId)    rows = rows.filter(a => (a.orgId    || '') === filters.orgId)
    if (filters.q) {
      const q = filters.q.toLowerCase()
      rows = rows.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.courseTitle || '').toLowerCase().includes(q) ||
        (a.orgName || '').toLowerCase().includes(q)
      )
    }
    rows.sort((a,b)=> (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    return rows
  },

  get(id: string) {
    const a = read().find(a=> a.id===id)
    if (!a) return Promise.reject(new Error('Assessment not found'))
    return Promise.resolve(a)
  },

  create(payload: Omit<Assessment, 'id'|'createdAt'|'updatedAt'>) {
    const all = read()
    const t = nowISO()
    const rec: Assessment = { ...payload, id: crypto.randomUUID(), createdAt: t, updatedAt: t }
    all.push(rec); write(all); return Promise.resolve(rec)
  },

  update(id: string, patch: Partial<Omit<Assessment,'id'|'createdAt'|'updatedAt'>>) {
    const all = read()
    const i = all.findIndex(a=> a.id===id)
    if (i===-1) return Promise.reject(new Error('Assessment not found'))
    all[i] = { ...all[i], ...patch, updatedAt: nowISO() }
    write(all)
    return Promise.resolve(all[i])
  },

  delete(id: string) {
    const all = read()
    if (!all.some(a=> a.id===id)) return Promise.reject(new Error('Assessment not found'))
    write(all.filter(a=> a.id!==id))
    return Promise.resolve({ id })
  },

  setStatus(id: string, status: AssessmentStatus) {
    return this.update(id, { status })
  }
}
