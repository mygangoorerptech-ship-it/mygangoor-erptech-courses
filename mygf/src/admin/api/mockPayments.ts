import type { Payment, PaymentFilters, PaymentStatus } from '../types/payment'

const KEY = 'mock:payments'
const now = () => new Date().toISOString()

function seed(): Payment[] {
  const t = now()
  const rows: Payment[] = [
    {
      id: crypto.randomUUID(),
      orderId: 'order_1001',
      studentEmail: 'ava@alpha.example',
      orgId: 'org-101',
      amount: 4999,              // ₹49.99
      method: 'card',
      status: 'captured',
      createdAt: t, updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      subscriptionId: 'sub_2001',
      studentEmail: 'ben@beta.example',
      orgId: 'org-202',
      amount: 9999,              // ₹99.99
      method: 'upi',
      status: 'captured',
      createdAt: t, updatedAt: t,
    },
  ]
  localStorage.setItem(KEY, JSON.stringify(rows))
  return rows
}

function read(): Payment[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    return JSON.parse(raw)
  } catch {
    return seed()
  }
}
function write(rows: Payment[]) { localStorage.setItem(KEY, JSON.stringify(rows)) }

export const PaymentsDB = {
  async list(filters: PaymentFilters = {}): Promise<Payment[]> {
    let rows = read()

    if (filters.orgId) rows = rows.filter(p => (p.orgId || '') === filters.orgId)
    if (filters.orderId) rows = rows.filter(p => p.orderId === filters.orderId)
    if (filters.subscriptionId) rows = rows.filter(p => p.subscriptionId === filters.subscriptionId)

    if (filters.status && filters.status !== 'all') {
      rows = rows.filter(p => p.status === filters.status)
    }
    if (filters.since) {
      const sinceMs = +new Date(filters.since)
      rows = rows.filter(p => +new Date(p.createdAt) >= sinceMs)
    }
    if (filters.q) {
      const q = filters.q.toLowerCase()
      rows = rows.filter(p =>
        (p.studentEmail || '').toLowerCase().includes(q) ||
        (p.orderId || '').toLowerCase().includes(q) ||
        (p.subscriptionId || '').toLowerCase().includes(q) ||
        (p.method || '').toLowerCase().includes(q)
      )
    }

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return rows
  },

  async refund(id: string): Promise<Payment> {
    const all = read()
    const i = all.findIndex(p => p.id === id)
    if (i === -1) throw new Error('Payment not found')
    all[i] = { ...all[i], status: 'refunded' as PaymentStatus, updatedAt: now() }
    write(all)
    return all[i]
  },

  // helpers if you ever need to create additional rows
  async create(payload: Omit<Payment, 'id'|'createdAt'|'updatedAt'>): Promise<Payment> {
    const rec: Payment = { id: crypto.randomUUID(), createdAt: now(), updatedAt: now(), ...payload }
    const all = read(); all.unshift(rec); write(all); return rec
  }
}
