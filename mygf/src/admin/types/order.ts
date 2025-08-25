export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund'
export type PaymentMethod = 'razorpay' | 'stripe' | 'paypal' | 'manual'

export interface OrderItem {
  id: string
  sku: string
  name: string
  quantity: number
  amount: number
  taxRate?: number
}

export interface Payment {
  id: string
  gateway: PaymentMethod
  amount: number
  currency: string
  createdAt: string
  reference?: string
}

export interface Refund {
  id: string
  amount: number
  reason?: string
  createdAt: string
}

export interface Order {
  id: string
  number: string
  userName: string
  userEmail: string
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  currency: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  createdAt: string
  updatedAt: string
  payments: Payment[]
  refunds: Refund[]
}