import type { Lesson, Module } from '../types/curriculum'

const MOD_KEY = 'mock:modules'
const LES_KEY = 'mock:lessons'

function readModules(): Module[] {
  try {
    const raw = localStorage.getItem(MOD_KEY)
    if (!raw) return seed().modules
    return JSON.parse(raw)
  } catch {
    return seed().modules
  }
}
function readLessons(): Lesson[] {
  try {
    const raw = localStorage.getItem(LES_KEY)
    if (!raw) return seed().lessons
    return JSON.parse(raw)
  } catch {
    return seed().lessons
  }
}
function write(mods: Module[], lessons: Lesson[]) {
  localStorage.setItem(MOD_KEY, JSON.stringify(mods))
  localStorage.setItem(LES_KEY, JSON.stringify(lessons))
}

function seed() {
  const m1: Module = { id: crypto.randomUUID(), title: 'Getting Started', description: 'Welcome and setup', order: 0 }
  const m2: Module = { id: crypto.randomUUID(), title: 'Core Concepts', description: 'Understand the basics', order: 1 }
  const l1: Lesson = { id: crypto.randomUUID(), moduleId: m1.id, title: 'Intro & Curriculum', durationMin: 5, contentType: 'video', preview: true, order: 0 }
  const l2: Lesson = { id: crypto.randomUUID(), moduleId: m1.id, title: 'Environment Setup', durationMin: 12, contentType: 'video', order: 1 }
  const l3: Lesson = { id: crypto.randomUUID(), moduleId: m2.id, title: 'State & Props', durationMin: 18, contentType: 'text', order: 0, releaseAfterDays: 2 }
  const mods = [m1, m2]
  const lessons = [l1, l2, l3]
  write(mods, lessons)
  return { modules: mods, lessons }
}

export const CurriculumDB = {
  listModules() {
    const mods = readModules().slice().sort((a,b)=> a.order - b.order)
    return Promise.resolve(mods)
  },
  listLessons(moduleId: string) {
    const lessons = readLessons().filter(l=> l.moduleId === moduleId).sort((a,b)=> a.order - b.order)
    return Promise.resolve(lessons)
  },
  createModule(input: Omit<Module, 'id'|'order'>) {
    const mods = readModules()
    const newM: Module = { ...input, id: crypto.randomUUID(), order: mods.length }
    const lessons = readLessons()
    write([...mods, newM], lessons)
    return Promise.resolve(newM)
  },
  updateModule(id: string, patch: Partial<Omit<Module,'id'>>) {
    const mods = readModules()
    const idx = mods.findIndex(m=> m.id===id)
    if (idx === -1) return Promise.reject(new Error('Module not found'))
    mods[idx] = { ...mods[idx], ...patch }
    const lessons = readLessons()
    write(mods, lessons)
    return Promise.resolve(mods[idx])
  },
  deleteModule(id: string) {
    let mods = readModules()
    let lessons = readLessons()
    const mod = mods.find(m=> m.id===id)
    if (!mod) return Promise.reject(new Error('Module not found'))
    // remove module & its lessons, then reindex orders
    mods = mods.filter(m=> m.id!==id).map((m,i)=> ({...m, order: i}))
    lessons = lessons.filter(l=> l.moduleId !== id)
    write(mods, lessons)
    return Promise.resolve({ id })
  },
  reorderModules(idsInOrder: string[]) {
    const mods = readModules()
    const map = new Map(mods.map(m=> [m.id, m]))
    const reordered = idsInOrder.map((id, i)=> ({ ...(map.get(id)!), order: i }))
    const lessons = readLessons()
    write(reordered, lessons)
    return Promise.resolve(reordered)
  },
  createLesson(input: Omit<Lesson, 'id'|'order'>) {
    const lessons = readLessons()
    const current = lessons.filter(l=> l.moduleId === input.moduleId)
    const newL: Lesson = { ...input, id: crypto.randomUUID(), order: current.length }
    const mods = readModules()
    write(mods, [...lessons, newL])
    return Promise.resolve(newL)
  },
  updateLesson(id: string, patch: Partial<Omit<Lesson,'id'>>) {
    const lessons = readLessons()
    const i = lessons.findIndex(l=> l.id===id)
    if (i === -1) return Promise.reject(new Error('Lesson not found'))
    lessons[i] = { ...lessons[i], ...patch }
    const mods = readModules()
    write(mods, lessons)
    return Promise.resolve(lessons[i])
  },
  deleteLesson(id: string) {
    let lessons = readLessons()
    const target = lessons.find(l=> l.id === id)
    if (!target) return Promise.reject(new Error('Lesson not found'))
    lessons = lessons.filter(l=> l.id !== id)
    // reindex orders within that module
    lessons = lessons
      .sort((a,b)=> a.moduleId.localeCompare(b.moduleId) || a.order - b.order)
      .map((l, idx, arr) => ({
        ...l,
        order: arr.filter(x=> x.moduleId === l.moduleId && x.order < l.order).length
      }))
    const mods = readModules()
    write(mods, lessons)
    return Promise.resolve({ id })
  },
  reorderLessons(moduleId: string, idsInOrder: string[]) {
    const lessons = readLessons()
    const others = lessons.filter(l=> l.moduleId !== moduleId)
    const inModule = lessons.filter(l=> l.moduleId === moduleId)
    const map = new Map(inModule.map(l=> [l.id, l]))
    const reordered = idsInOrder.map((id, i)=> ({ ...(map.get(id)!), order: i }))
    const mods = readModules()
    write(mods, [...others, ...reordered])
    return Promise.resolve(reordered)
  }
}