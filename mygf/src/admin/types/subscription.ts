export type SubscriptionStatus = 'paid' | 'refunded' | 'canceled'

export interface Subscription {
  id: string

  // student
  studentId?: string
  studentEmail: string
  studentName?: string

  // course
  courseId: string
  courseTitle?: string

  // org / owner (admin)
  orgId?: string
  orgName?: string
  ownerEmail?: string
  ownerName?: string

  // payment
  amount: number
  currency: string
  status: SubscriptionStatus
  method?: string       // e.g. card, upi
  gateway?: string      // stripe, razorpay...
  txnId?: string

  purchasedAt: string
  expiresAt?: string

  createdAt: string
  updatedAt: string
}

export type SubscriptionFilters = {
  q?: string
  status?: 'all' | SubscriptionStatus
  orgId?: string
  ownerEmail?: string
  courseId?: string
  studentEmail?: string
}
