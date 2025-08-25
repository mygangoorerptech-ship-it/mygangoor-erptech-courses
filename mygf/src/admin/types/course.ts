export type CourseStatus = 'draft' | 'published' | 'archived'
export type CourseVisibility = 'public' | 'private' | 'unlisted'

export interface Course {
  id: string
  title: string
  slug?: string
  description?: string
  category?: string
  price?: number
  visibility?: CourseVisibility
  status: CourseStatus
  // Superadmin extras
  orgId?: string
  orgName?: string
  ownerId?: string          // admin user id (optional)
  ownerName?: string
  ownerEmail?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export type CourseFilters = {
  q?: string
  status?: 'all' | CourseStatus
  orgId?: string
  ownerEmail?: string
}
