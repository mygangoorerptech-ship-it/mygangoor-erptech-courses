//mockPayouts.ts
import type { Payout, PayoutLine, PayoutStatus } from '../types/payout'

const KEY = 'mock:payouts'

function read(): Payout[] {
  try { const raw = localStorage.getItem(KEY); if(!raw) return seed(); return JSON.parse(raw) } catch { return seed() }
}
function write(list: Payout[]) { localStorage.setItem(KEY, JSON.stringify(list)) }
function nowISO(){ return new Date().toISOString() }

function seed(): Payout[] {
  const mkLines = (count: number): PayoutLine[] => {
    const arr: PayoutLine[] = []
    for (let i=0;i<count;i++){
      const gross = 100000 + Math.round(Math.random()*200000) // ₹1000–₹3000
      const fee = Math.round(gross * 0.02)
      const tax = Math.round(gross * 0.18)
      const net = gross - fee - tax
      arr.push({
        id: crypto.randomUUID(),
        orderNumber: 'INV-' + Math.random().toString(36).slice(2,8).toUpperCase(),
        course: ['React Fundamentals','TS Deep Dive','Node API Mastery'][i%3],
        gross, fee, tax, net
      })
    }
    return arr
  }

  const mk = (args: Partial<Payout> & { lines?: PayoutLine[] }) => {
    const lines = args.lines ?? mkLines(5 + Math.floor(Math.random()*3))
    const gross = lines.reduce((s,l)=>s+l.gross,0)
    const fees = lines.reduce((s,l)=>s+l.fee,0)
    const tax = lines.reduce((s,l)=>s+l.tax,0)
    const adjustments = 0
    const net = gross - fees - tax + adjustments
    const createdAt = nowISO()
    const p: Payout = {
      id: crypto.randomUUID(),
      orgId: args.orgId ?? 'org-' + Math.random().toString(36).slice(2,6),
      orgName: args.orgName ?? 'Demo Academy',
      currency: 'INR',
      periodStart: args.periodStart ?? new Date(Date.now()-14*86400000).toISOString(),
      periodEnd: args.periodEnd ?? new Date().toISOString(),
      method: args.method ?? 'bank_transfer',
      status: args.status ?? 'in_review',
      gross, fees, tax, adjustments, net,
      createdAt, updatedAt: createdAt,
      reference: args.reference,
      paidAt: args.paidAt,
      failureReason: args.failureReason,
      notes: args.notes,
      lines
    }
    list.push(p)
  }

  const list: Payout[] = []
  mk({ orgName: 'Alpha Academy', status: 'pending' })
  mk({ orgName: 'Beta Courses', status: 'in_review' })
  mk({ orgName: 'Gamma Learning', status: 'approved' })
  mk({ orgName: 'Delta EdTech', status: 'paid', reference: 'NEFT-12345', paidAt: nowISO() })
  mk({ orgName: 'Omega School', status: 'failed', failureReason: 'Bank account mismatch' })

  write(list); return list
}

export const PayoutsDB = {
  list(params?: { q?: string; status?: PayoutStatus | 'all'; dateFrom?: string; dateTo?: string }) {
    let all = read();

    const q = params?.q?.toLowerCase();
    const status = params?.status;
    const dateFrom = params?.dateFrom; // ✅ hoisted -> safely narrowed
    const dateTo   = params?.dateTo;   // ✅ hoisted -> safely narrowed

    if (q) {
      all = all.filter(p =>
        p.orgName.toLowerCase().includes(q) ||
        (p.reference?.toLowerCase().includes(q) ?? false) ||
        p.id.toLowerCase().includes(q)
      );
    }

    if (status && status !== 'all') {
      all = all.filter(p => p.status === status);
    }

    if (dateFrom) {
      all = all.filter(p => p.periodEnd >= dateFrom);
    }
    if (dateTo) {
      const end = dateTo.endsWith('Z') ? dateTo : `${dateTo}T23:59:59.999Z`;
      all = all.filter(p => p.periodEnd <= end);
    }

    all.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
    return Promise.resolve(all);
  },
  get(id: string) {
    const p = read().find(p=> p.id===id)
    if (!p) return Promise.reject(new Error('Payout not found'))
    return Promise.resolve(p)
  },
  approve(id: string) {
    const all = read()
    const i = all.findIndex(p=> p.id===id)
    if (i===-1) return Promise.reject(new Error('Payout not found'))
    all[i].status = 'approved'
    all[i].updatedAt = nowISO()
    write(all)
    return Promise.resolve(all[i])
  },
  markPaid(id: string, reference: string, paidAt?: string) {
    const all = read()
    const i = all.findIndex(p=> p.id===id)
    if (i===-1) return Promise.reject(new Error('Payout not found'))
    all[i].status = 'paid'
    all[i].reference = reference
    all[i].paidAt = paidAt || nowISO()
    all[i].updatedAt = nowISO()
    write(all)
    return Promise.resolve(all[i])
  },
  fail(id: string, reason: string) {
    const all = read()
    const i = all.findIndex(p=> p.id===id)
    if (i===-1) return Promise.reject(new Error('Payout not found'))
    all[i].status = 'failed'
    all[i].failureReason = reason
    all[i].updatedAt = nowISO()
    write(all)
    return Promise.resolve(all[i])
  }
}