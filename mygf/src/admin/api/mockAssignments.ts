import type { Assignment, AssignmentFilters, AssignmentStatus } from '../types/assignment'

const KEY = 'mock:assignments'

function nowISO(){ return new Date().toISOString() }
function read(): Assignment[] {
  try { const raw = localStorage.getItem(KEY); if(!raw) return seed(); return JSON.parse(raw) } catch { return seed() }
}
function write(rows: Assignment[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }

function seed(): Assignment[] {
  const t = nowISO()
  const rows: Assignment[] = [
    {
      id: crypto.randomUUID(),
      courseId: 'REACT-101',
      courseTitle: 'React Fundamentals',
      title: 'Project 1: Todo App',
      description: 'Build a Todo app with add/toggle/delete and localStorage persistence.',
      maxPoints: 100,
      submissionType: 'file',
      allowedFileTypes: 'zip, pdf',
      allowMultipleAttempts: false,
      dueAt: new Date(Date.now() + 7*24*60*60*1000).toISOString(), // +7 days
      status: 'draft',
      createdAt: t,
      updatedAt: t,
      tags: ['project', 'intro']
    },
    {
      id: crypto.randomUUID(),
      courseId: 'REACT-201',
      courseTitle: 'React Advanced',
      title: 'Hooks Deep Dive Notes',
      description: 'Submit a link to your notes or a markdown file as PDF.',
      maxPoints: 40,
      submissionType: 'url',
      allowMultipleAttempts: true,
      status: 'published',
      createdAt: t,
      updatedAt: t,
      tags: ['notes']
    }
  ]
  write(rows); return rows
}

export const AssignmentsDB = {
  list(filters: AssignmentFilters){
    const all = read()
    let rows = all.slice()

    if (filters.q){
      const q = filters.q.toLowerCase()
      rows = rows.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description||'').toLowerCase().includes(q) ||
        (a.courseTitle||'').toLowerCase().includes(q) ||
        (a.courseId||'').toLowerCase().includes(q)
      )
    }
    if (filters.status && filters.status !== 'all'){
      rows = rows.filter(a => a.status === filters.status)
    }
    if (filters.courseId){
      rows = rows.filter(a => a.courseId === filters.courseId)
    }
    if (filters.due && filters.due !== 'all'){
      const now = Date.now()
      if (filters.due === 'overdue'){
        rows = rows.filter(a => !!a.dueAt && new Date(a.dueAt).getTime() < now)
      } else if (filters.due === 'upcoming'){
        rows = rows.filter(a => !!a.dueAt && new Date(a.dueAt).getTime() >= now)
      }
    }

    rows.sort((a,b)=> (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    return Promise.resolve(rows)
  },

  create(payload: Omit<Assignment,'id'|'createdAt'|'updatedAt'>){
    const t = nowISO()
    const rec: Assignment = { ...payload, id: crypto.randomUUID(), createdAt: t, updatedAt: t }
    const all = read(); all.unshift(rec); write(all)
    return Promise.resolve(rec)
  },

  update(id: string, patch: Partial<Omit<Assignment,'id'|'createdAt'>>){
    const all = read()
    const i = all.findIndex(a => a.id === id)
    if (i === -1) return Promise.reject(new Error('Assignment not found'))
    all[i] = { ...all[i], ...patch, updatedAt: nowISO() }
    write(all); return Promise.resolve(all[i])
  },

  delete(id: string){
    const all = read().filter(a => a.id !== id)
    write(all); return Promise.resolve({ id })
  },

  setStatus(id: string, status: AssignmentStatus){
    const all = read()
    const i = all.findIndex(a => a.id === id)
    if (i === -1) return Promise.reject(new Error('Assignment not found'))
    all[i].status = status
    all[i].updatedAt = nowISO()
    write(all); return Promise.resolve(all[i])
  }
}