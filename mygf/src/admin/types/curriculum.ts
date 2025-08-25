export type ContentType = 'video' | 'text' | 'pdf' | 'audio' | 'quiz' | 'link'

export interface Lesson {
  id: string
  moduleId: string
  title: string
  durationMin?: number
  contentType: ContentType
  preview?: boolean
  downloadable?: boolean
  releaseAt?: string         // ISO datetime
  releaseAfterDays?: number  // relative from enrollment
  order: number
}

export interface Module {
  id: string
  courseId?: string
  title: string
  description?: string
  order: number
}