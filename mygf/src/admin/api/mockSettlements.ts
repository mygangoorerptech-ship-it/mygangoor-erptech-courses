// mockSettlements.ts
import type { Settlement } from '../types/settlement'

const KEY = 'mock:settlements'
function read(): Settlement[] {
  try { const raw = localStorage.getItem(KEY); if(!raw) return seed(); return JSON.parse(raw) } catch { return seed() }
}
function write(rows: Settlement[]){ localStorage.setItem(KEY, JSON.stringify(rows)) }
function nowISO(){ return new Date().toISOString() }

function seed(): Settlement[] {
  const rows: Settlement[] = []
  const mk = (p: Partial<Settlement>) => {
    const gross = p.gross ?? (200000 + Math.round(Math.random()*200000)) // 2k–4k
    const fee = p.fee ?? Math.round(gross * 0.02)
    const tax = p.tax ?? Math.round(fee * 0.18)
    const net = p.net ?? (gross - fee - tax)
    rows.push({
      id: crypto.randomUUID(),
      gateway: (p.gateway ?? 'razorpay') as any,
      gross, fee, tax, net,
      currency: 'INR',
      settledAt: p.settledAt ?? new Date(Date.now() - Math.floor(Math.random()*12)*86400000).toISOString(),
      reference: p.reference ?? 'STL-' + Math.random().toString(36).slice(2,8).toUpperCase(),
      notes: p.notes
    })
  }
  mk({ gateway:'razorpay' }); mk({ gateway:'razorpay' }); mk({ gateway:'stripe' }); mk({ gateway:'stripe' })
  mk({ gateway:'paypal' }); mk({ gateway:'razorpay' }); mk({ gateway:'stripe' })
  write(rows); return rows
}

export const SettlementsDB = {
  list(params?: { gateway?: 'all' | 'razorpay' | 'stripe' | 'paypal'; dateFrom?: string; dateTo?: string }) {
    let all = read();

    const gateway  = params?.gateway;
    const dateFrom = params?.dateFrom; // ✅ hoisted
    const dateTo   = params?.dateTo;   // ✅ hoisted

    if (gateway && gateway !== 'all') {
      all = all.filter(s => s.gateway === gateway);
    }
    if (dateFrom) {
      all = all.filter(s => s.settledAt >= dateFrom);
    }
    if (dateTo) {
      const end = dateTo.endsWith('Z') ? dateTo : `${dateTo}T23:59:59.999Z`;
      all = all.filter(s => s.settledAt <= end);
    }

    all.sort((a, b) => b.settledAt.localeCompare(a.settledAt));
    return Promise.resolve(all);
  }
};
