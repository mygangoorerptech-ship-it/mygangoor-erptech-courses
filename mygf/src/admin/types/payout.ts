export type PayoutStatus = 'pending' | 'in_review' | 'approved' | 'paid' | 'failed'
export type PayoutMethod = 'bank_transfer' | 'razorpay' | 'stripe'

export interface PayoutLine {
  id: string
  orderNumber: string
  course: string
  gross: number   // paise
  fee: number     // paise (gateway or platform)
  tax: number     // paise
  net: number     // paise
}

export interface Payout {
  id: string
  orgId: string
  orgName: string
  currency: string
  periodStart: string
  periodEnd: string
  method: PayoutMethod
  status: PayoutStatus
  gross: number
  fees: number
  tax: number
  adjustments: number
  net: number
  createdAt: string
  updatedAt: string
  reference?: string
  paidAt?: string
  failureReason?: string
  notes?: string
  lines?: PayoutLine[]
}