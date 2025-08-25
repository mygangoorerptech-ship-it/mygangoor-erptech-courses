// mockAssessmentQuestions.ts
import type { AssessmentQuestion, MCQQuestion, TrueFalseQuestion, AssignmentQuestion, Attachment } from '../types/assessmentQuestion'

const KEY = 'mock:assessmentQuestions'

function nowISO(){ return new Date().toISOString() }
function read(): AssessmentQuestion[] {
  try { const raw = localStorage.getItem(KEY); if(!raw) return seed(); return JSON.parse(raw) } catch { return seed() }
}
function write(rows: AssessmentQuestion[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }

function seed(): AssessmentQuestion[] {
  const rows: AssessmentQuestion[] = []
  const mkMCQ = (p: Partial<MCQQuestion>) => {
    const t = nowISO()
    const q: MCQQuestion = {
      id: crypto.randomUUID(),
      assessmentId: (p.assessmentId || 'seed-assessment-1') as string,
      type: 'mcq',
      prompt: p.prompt || 'What does JSX stand for?',
      points: p.points ?? 5,
      options: p.options || [
        { id: crypto.randomUUID(), text: 'JavaScript XML', correct: true },
        { id: crypto.randomUUID(), text: 'JSON eXtended', correct: false },
        { id: crypto.randomUUID(), text: 'Java Syntax eXtra', correct: false },
      ],
      shuffleOptions: true,
      multipleCorrect: false,
      attachments: [],
      order: 1,
      createdAt: t,
      updatedAt: t
    }
    rows.push(q)
  }
  const mkTF = (p: Partial<TrueFalseQuestion>) => {
    const t = nowISO()
    const q: TrueFalseQuestion = {
      id: crypto.randomUUID(),
      assessmentId: (p.assessmentId || 'seed-assessment-1') as string,
      type: 'true_false',
      prompt: p.prompt || 'React is a framework.',
      points: p.points ?? 2,
      answer: false,
      attachments: [],
      order: 2,
      createdAt: t,
      updatedAt: t
    }
    rows.push(q)
  }
  const mkAssign = (p: Partial<AssignmentQuestion>) => {
    const t = nowISO()
    const q: AssignmentQuestion = {
      id: crypto.randomUUID(),
      assessmentId: (p.assessmentId || 'seed-assessment-1') as string,
      type: 'assignment',
      prompt: p.prompt || 'Download the PDF and implement the assignment.',
      points: p.points ?? 20,
      expectedUploadType: 'pdf',
      instructions: p.instructions || 'Follow the steps described in the document.',
      attachments: [],
      order: 3,
      createdAt: t,
      updatedAt: t
    }
    rows.push(q)
  }
  mkMCQ({}); mkTF({}); mkAssign({})
  write(rows); return rows
}

export const AssessmentQuestionsDB = {
  list(assessmentId: string){
    const rows = read().filter(q => q.assessmentId === assessmentId).sort((a,b)=> a.order - b.order)
    return Promise.resolve(rows)
  },
  create(payload: Omit<AssessmentQuestion,'id'|'createdAt'|'updatedAt'|'order'>){
    const all = read()
    const t = nowISO()
    const maxOrder = Math.max(0, ...all.filter(q=> q.assessmentId === payload.assessmentId).map(q=> q.order||0))
    const rec = { ...payload, id: crypto.randomUUID(), createdAt: t, updatedAt: t, order: maxOrder + 1 } as AssessmentQuestion
    all.push(rec); write(all); return Promise.resolve(rec)
  },
  update(id: string, patch: Partial<Omit<AssessmentQuestion,'id'|'assessmentId'|'createdAt'|'order'>>){
    const all = read()
    const i = all.findIndex(q=> q.id === id)
    if (i === -1) return Promise.reject(new Error('Question not found'))
    all[i] = { ...all[i], ...patch, updatedAt: nowISO() } as AssessmentQuestion
    write(all); return Promise.resolve(all[i])
  },
  delete(id: string){
    const all = read().filter(q=> q.id !== id)
    write(all); return Promise.resolve({ id })
  },
  reorder(assessmentId: string, orderedIds: string[]){
    const all = read()
    let order = 1
    for (const id of orderedIds){
      const i = all.findIndex(q=> q.id===id && q.assessmentId===assessmentId)
      if (i !== -1) { (all[i] as any).order = order++; (all[i] as any).updatedAt = nowISO() }
    }
    write(all); return Promise.resolve(all.filter(q=> q.assessmentId===assessmentId).sort((a,b)=> a.order - b.order))
  },
  attachFile(id: string, file: Attachment){
    const all = read()
    const i = all.findIndex(q=> q.id===id)
    if (i === -1) return Promise.reject(new Error('Question not found'))
    const q = all[i]
    q.attachments = q.attachments || []
    q.attachments.push(file);
    (q as any).updatedAt = nowISO()
    write(all); return Promise.resolve(q)
  },
  removeAttachment(id: string, attachmentId: string){
    const all = read()
    const i = all.findIndex(q=> q.id===id)
    if (i === -1) return Promise.reject(new Error('Question not found'))
    const q = all[i]
    q.attachments = (q.attachments || []).filter(a => a.id !== attachmentId);
    (q as any).updatedAt = nowISO()
    write(all); return Promise.resolve(q)
  }
}
export { AssessmentQuestionsDB as QuestionsDB };
export default AssessmentQuestionsDB;