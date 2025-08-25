import type { Submission, SubmissionFilters, SubmissionStatus } from '../types/submission'
import type { Attachment } from '../types/assessmentQuestion'

const KEY = 'mock:submissions'

function nowISO(){ return new Date().toISOString() }
function read(): Submission[] {
  try { const raw = localStorage.getItem(KEY); if(!raw) return seed(); return JSON.parse(raw) } catch { return seed() }
}
function write(rows: Submission[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }

function seed(): Submission[] {
  const t = nowISO()
  const rows: Submission[] = [
    {
      id: crypto.randomUUID(),
      assignmentId: 'seed-assignment-1',
      studentId: 'stu-001',
      studentName: 'Ava Shah',
      studentEmail: 'ava@example.com',
      attempt: 1,
      submittedAt: t,
      status: 'submitted',
      maxPoints: 100,
      files: [],
      textEntry: 'Attached is my project report (mock).',
    },
    {
      id: crypto.randomUUID(),
      assignmentId: 'seed-assignment-1',
      studentId: 'stu-002',
      studentName: 'Rahul Menon',
      studentEmail: 'rahul@example.com',
      attempt: 1,
      submittedAt: new Date(Date.now() - 2*60*60*1000).toISOString(),
      status: 'graded',
      score: 85,
      maxPoints: 100,
      feedback: 'Great work overall. Consider handling edge cases.',
      gradedBy: 'Instructor A',
      files: [],
      url: 'https://example.com/demo'
    }
  ]
  write(rows); return rows
}

export const SubmissionsDB = {
  list(assignmentId: string, filters: SubmissionFilters){
    let rows = read().filter(s => s.assignmentId === assignmentId)

    if (filters.q){
      const q = filters.q.toLowerCase()
      rows = rows.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        (s.studentEmail||'').toLowerCase().includes(q)
      )
    }
    if (filters.status && filters.status !== 'all'){
      rows = rows.filter(s => s.status === filters.status)
    }
    if (typeof filters.minAttempt === 'number'){
      rows = rows.filter(s => s.attempt >= (filters.minAttempt as number))
    }
    if (typeof filters.maxAttempt === 'number'){
      rows = rows.filter(s => s.attempt <= (filters.maxAttempt as number))
    }

    rows.sort((a,b)=> b.submittedAt.localeCompare(a.submittedAt))
    return Promise.resolve(rows)
  },

  add(assignmentId: string, payload: Omit<Submission,'id'|'assignmentId'|'submittedAt'|'status'> & { status?: SubmissionStatus }){
    const t = nowISO()
    const rec: Submission = {
      id: crypto.randomUUID(),
      assignmentId,
      submittedAt: t,
      status: payload.status || 'submitted',
      ...payload
    }
    const all = read(); all.unshift(rec); write(all)
    return Promise.resolve(rec)
  },

  grade(id: string, score: number, feedback?: string, gradedBy?: string){
    const all = read()
    const i = all.findIndex(s => s.id === id)
    if (i === -1) return Promise.reject(new Error('Submission not found'))
    all[i].score = score
    all[i].feedback = feedback
    all[i].gradedBy = gradedBy || 'Grader'
    all[i].status = 'graded'
    write(all); return Promise.resolve(all[i])
  },

  setStatus(id: string, status: SubmissionStatus){
    const all = read()
    const i = all.findIndex(s => s.id === id)
    if (i === -1) return Promise.reject(new Error('Submission not found'))
    all[i].status = status
    write(all); return Promise.resolve(all[i])
  },

  delete(id: string){
    const all = read().filter(s => s.id !== id)
    write(all); return Promise.resolve({ id })
  },

  attachFile(id: string, file: Attachment){
    const all = read()
    const i = all.findIndex(s => s.id === id)
    if (i === -1) return Promise.reject(new Error('Submission not found'))
    const sub = all[i]
    sub.files = sub.files || []
    sub.files.push(file)
    write(all); return Promise.resolve(sub)
  },

  removeFile(id: string, attachmentId: string){
    const all = read()
    const i = all.findIndex(s => s.id === id)
    if (i === -1) return Promise.reject(new Error('Submission not found'))
    const sub = all[i]
    sub.files = (sub.files || []).filter(a => a.id !== attachmentId)
    write(all); return Promise.resolve(sub)
  }
}