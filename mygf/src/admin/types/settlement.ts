export type Gateway = 'razorpay' | 'stripe' | 'paypal'

export interface Settlement {
  id: string
  gateway: Gateway
  gross: number   // paise
  fee: number     // paise
  tax: number     // paise (GST/VAT on fees if applicable)
  net: number     // paise (what was actually settled to bank)
  currency: string
  settledAt: string
  reference: string
  notes?: string
}