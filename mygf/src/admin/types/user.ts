//mygf/src/admin/types/user.ts
export type UserRole = 'superadmin' | 'admin' | 'vendor' | 'student'
export type UserStatus = 'active' | 'disabled'

export type MfaMethod = 'otp' | 'totp' | null
export interface MfaConfig {
  required: boolean
  method: MfaMethod
}

export interface SAUser {
  id: string
  name?: string
  email: string
  role: UserRole
  status: UserStatus
  orgId?: string
  orgName?: string
  provider?: 'password' | 'google'
  createdAt: string
  updatedAt: string
  isVerified?: boolean
  mfa?: MfaConfig
}

export type SAUserFilters = {
  q?: string
  role?: 'all' | UserRole
  status?: 'all' | UserStatus
  orgId?: string
  verified?: 'all'
}
