import { api } from './client'
import { USE_MOCK } from './env'
import { PaymentsDB } from './mockPayments'
import type { Payment, PaymentFilters } from '../types/payment'
import { logAudit } from '../api/audit'

export function listPayments(filters: PaymentFilters){
  if (USE_MOCK) return PaymentsDB.list(filters)
  return api.get('/payments', { params: filters }).then(r => r.data as Payment[])
}

export function refundPayment(paymentId: string){
  if (USE_MOCK) {
    return PaymentsDB.refund(paymentId).then(rec => {
      logAudit({
        action: 'update',
        resource: 'payment',
        resourceId: rec.id,
        orgId: rec.orgId,
        message: `Refunded payment ${rec.id}`,
        after: rec
      })
      return rec
    })
  }
  return api.post(`/payments/${paymentId}/refund`).then(r => r.data as Payment)
}
