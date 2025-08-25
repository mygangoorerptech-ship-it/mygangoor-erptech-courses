export type PaymentStatus = 'initiated' | 'captured' | 'refunded' | 'failed'

export interface Payment {
  id: string
  orderId?: string
  subscriptionId?: string
  studentEmail?: string
  orgId?: string
  amount: number            // in minor units (e.g., paise)
  method?: string           // e.g., 'card', 'upi'
  status: PaymentStatus
  createdAt: string
  updatedAt: string
}

export type PaymentFilters = {
  orgId?: string
  orderId?: string
  subscriptionId?: string
  q?: string
  status?: 'all' | PaymentStatus
  since?: string            // ISO date; filters createdAt >= since
}
