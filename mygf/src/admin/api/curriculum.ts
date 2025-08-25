import { api } from './client'
import { CurriculumDB } from './mockCurriculum'
import type { Lesson, Module } from '../types/curriculum'

const useMock = (import.meta.env.VITE_API_URL ?? '/mock') === '/mock'

export async function listModules(): Promise<Module[]> {
  if (useMock) return CurriculumDB.listModules()
  const { data } = await api.get('/modules')
  return data
}
export async function listLessons(moduleId: string): Promise<Lesson[]> {
  if (useMock) return CurriculumDB.listLessons(moduleId)
  const { data } = await api.get(`/modules/${moduleId}/lessons`)
  return data
}
export async function createModule(payload: Omit<Module,'id'|'order'>): Promise<Module> {
  if (useMock) return CurriculumDB.createModule(payload)
  const { data } = await api.post('/modules', payload)
  return data
}
export async function updateModule(id: string, patch: Partial<Omit<Module,'id'>>): Promise<Module> {
  if (useMock) return CurriculumDB.updateModule(id, patch)
  const { data } = await api.patch(`/modules/${id}`, patch)
  return data
}
export async function deleteModule(id: string): Promise<{id:string}> {
  if (useMock) return CurriculumDB.deleteModule(id)
  const { data } = await api.delete(`/modules/${id}`)
  return data
}
export async function reorderModules(idsInOrder: string[]) {
  if (useMock) return CurriculumDB.reorderModules(idsInOrder)
  const { data } = await api.post('/modules/reorder', { ids: idsInOrder })
  return data
}

export async function createLesson(payload: Omit<Lesson,'id'|'order'>): Promise<Lesson> {
  if (useMock) return CurriculumDB.createLesson(payload)
  const { data } = await api.post(`/modules/${payload.moduleId}/lessons`, payload)
  return data
}
export async function updateLesson(id: string, patch: Partial<Omit<Lesson,'id'>>): Promise<Lesson> {
  if (useMock) return CurriculumDB.updateLesson(id, patch)
  const { data } = await api.patch(`/lessons/${id}`, patch)
  return data
}
export async function deleteLesson(id: string): Promise<{id:string}> {
  if (useMock) return CurriculumDB.deleteLesson(id)
  const { data } = await api.delete(`/lessons/${id}`)
  return data
}
export async function reorderLessons(moduleId: string, idsInOrder: string[]) {
  if (useMock) return CurriculumDB.reorderLessons(moduleId, idsInOrder)
  const { data } = await api.post(`/modules/${moduleId}/lessons/reorder`, { ids: idsInOrder })
  return data
}