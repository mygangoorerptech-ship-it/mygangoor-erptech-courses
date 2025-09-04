// mygf/src/admin/types/course.ts
export type CourseStatus = 'draft' | 'published' | 'archived'
export type CourseVisibility = 'public' | 'private' | 'unlisted'
export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number }
export type CourseType = 'free' | 'paid'

export type ChapterAssignment = {
  id?: string
  title: string
  link?: string
}

export type Chapter = {
  id?: string
  title: string
  subtitle?: string
  description?: string
  youtubeUrl?: string
  videoUrl?: string
  coverUrl?: string
  avgRating?: number
  reviewsCount?: number
  assignments?: ChapterAssignment[]
}

export type CourseLevel = 'all' | 'beginner' | 'intermediate' | 'advanced'

export interface Course {
  id: string
  title: string
  slug?: string
  description?: string
  category?: string
  price?: number                 // paise
  visibility?: CourseVisibility
  status: CourseStatus
    courseType?: CourseType   // NEW
  durationText?: string     // NEW e.g., "6hr 30min"
  teacherId?: string | null // NEW (vendor treated as teacher)

  // bundle info
  isBundled?: boolean
  chapters?: Chapter[]
  demoVideoUrl?: string
  createdById?: string

  // org/admin ownership
  orgId?: string
  orgName?: string
  ownerId?: string
  ownerName?: string
  ownerEmail?: string
  tags?: string[]
  createdAt: string
  updatedAt: string

  // ── NEW bundle-level extras ──
  discountPercent?: number       // 0..100
  level?: CourseLevel            // all|beginner|intermediate|advanced
  bundleCoverUrl?: string | null
  platformFee?: number           // paise
  // server-computed helpers
  priceAfterDiscount?: number    // paise
  totalWithFees?: number         // paise
}

export type CourseFilters = {
  q?: string
  status?: 'all' | CourseStatus
  orgId?: string
  ownerEmail?: string
  page?: number
  limit?: number
}

