import { api } from './client'
import { USE_MOCK } from './env'
import { SubscriptionsDB } from './mockSubscriptions'
import type { Subscription, SubscriptionFilters } from '../types/subscription'
import { logAudit } from '../api/audit'

export function listSubscriptions(filters: SubscriptionFilters){
  if (USE_MOCK) return SubscriptionsDB.list(filters)
  return api.get('/subscriptions', { params: filters }).then(r => r.data as Subscription[])
}

export function createSubscription(payload: Omit<Subscription,'id'|'createdAt'|'updatedAt'>){
  if (USE_MOCK) {
    return SubscriptionsDB.create(payload).then(rec => {
      logAudit({ action:'create', resource:'subscription', resourceId:rec.id, orgId:rec.orgId, message:`New subscription ${rec.studentEmail} -> ${rec.courseId}`, after:rec })
      return rec
    })
  }
  return api.post('/subscriptions', payload).then(r => r.data as Subscription)
}

export function updateSubscription(id: string, patch: Partial<Subscription>){
  if (USE_MOCK) {
    return SubscriptionsDB.update(id, patch).then(rec => {
      logAudit({ action:'update', resource:'subscription', resourceId:id, orgId:rec.orgId, message:`Updated subscription ${id}`, after:rec })
      return rec
    })
  }
  return api.patch(`/subscriptions/${id}`, patch).then(r => r.data as Subscription)
}

export function deleteSubscription(id: string){
  if (USE_MOCK) {
    return SubscriptionsDB.delete(id).then(res => {
      logAudit({ action:'delete', resource:'subscription', resourceId:id, message:`Deleted subscription ${id}` })
      return res
    })
  }
  return api.delete(`/subscriptions/${id}`).then(r => r.data as any)
}

export function refundSubscription(id: string){
  if (USE_MOCK) {
    return SubscriptionsDB.refund(id).then(rec => {
      logAudit({ action:'refund', resource:'subscription', resourceId:id, orgId:rec.orgId, message:`Refunded subscription ${id}`, after:rec })
      return rec
    })
  }
  return api.post(`/subscriptions/${id}/refund`, {}).then(r => r.data as Subscription)
}

export function cancelSubscription(id: string){
  if (USE_MOCK) {
    return SubscriptionsDB.cancel(id).then(rec => {
      logAudit({ action:'cancel', resource:'subscription', resourceId:id, orgId:rec.orgId, message:`Canceled subscription ${id}`, after:rec })
      return rec
    })
  }
  return api.post(`/subscriptions/${id}/cancel`, {}).then(r => r.data as Subscription)
}
