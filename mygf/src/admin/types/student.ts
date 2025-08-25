//mygf/src/types/student.ts
export type StudentStatus = 'active' | 'inactive' | 'blocked'

export interface Student {
  id: string
  orgId?: string
  orgName?: string
  username: string
  email: string
  name?: string
  status: StudentStatus
  provider?: 'password' | 'google'
  createdAt: string
  updatedAt: string
}

export type StudentFilters = {
  q?: string
  status?: 'all' | StudentStatus
  orgId?: string
}
