// superadmin-admin-dashboard/src/api/mockOrders.ts
import type { Order, OrderItem, Refund } from '../types/order'

const KEY = 'mock:orders'
function read(): Order[] { try{ const raw = localStorage.getItem(KEY); if(!raw) return seed(); return JSON.parse(raw) }catch{ return seed() } }
function write(orders: Order[]) { localStorage.setItem(KEY, JSON.stringify(orders)) }
function makeNumber(){ return 'INV-' + Math.random().toString(36).slice(2,8).toUpperCase() }
function nowISO(){ return new Date().toISOString() }

// ✅ define args WITHOUT Order.items to avoid intersection conflict
type MkArgs = Partial<Omit<Order, 'items' | 'id' | 'number' | 'subtotal' | 'tax' | 'total' | 'currency' | 'createdAt' | 'updatedAt'>> & {
  items?: Partial<OrderItem>[];
  refunds?: Refund[];
};

function seed(): Order[] {
  const orders: Order[] = []

  // ⬇️ use MkArgs (no conflicting items type)
  const mk = (args: MkArgs) => {
    const items: OrderItem[] = (args.items ?? []).map((it, i) => ({
      id: crypto.randomUUID(),
      sku: it.sku ?? `COURSE-${i+1}`,
      name: it.name ?? `Course ${i+1}`,
      quantity: it.quantity ?? 1,
      amount: it.amount ?? 199900,
      taxRate: it.taxRate ?? 0.18
    }))

    const subtotal = items.reduce((s, it) => s + it.amount * it.quantity, 0)
    const tax = Math.round(items.reduce((s, it) => s + (it.amount * it.quantity) * (it.taxRate ?? 0), 0))
    const total = subtotal + tax
    const createdAt = nowISO()

    orders.push({
      id: crypto.randomUUID(),
      number: makeNumber(),
      userName: args.userName ?? 'Student',
      userEmail: args.userEmail ?? 'student@example.com',
      items, subtotal, tax, total, currency: 'INR',
      status: args.status ?? 'paid',
      paymentMethod: args.paymentMethod ?? 'razorpay',
      createdAt, updatedAt: createdAt,
      payments: args.payments ?? [],
      refunds: args.refunds ?? []
    })
  }

  mk({ userName:'Asha Rao', items:[{sku:'REACT-101', name:'React Fundamentals', amount:149900}] })
  mk({ userName:'Vikram Singh', items:[{sku:'TS-201', name:'TypeScript Deep Dive', amount:129900}], paymentMethod:'stripe' })
  mk({ userName:'Neha Gupta', items:[{sku:'NODE-301', name:'Node API Mastery', amount:199900}] })
  mk({ userName:'Rohan Verma', items:[{sku:'BUNDLE-DEV', name:'Fullstack Bundle', amount:349900}], paymentMethod:'paypal' })
  mk({ userName:'Priya Sharma', items:[{sku:'REACT-101', name:'React Fundamentals', amount:149900}], status:'pending' })
  mk({ userName:'Arjun Patel', items:[{sku:'TS-201', name:'TypeScript Deep Dive', amount:129900}], status:'partial_refund', refunds:[{id:crypto.randomUUID(), amount:20000, createdAt: nowISO(), reason:'Coupon error'}] })

  write(orders); return orders
}

export const OrdersDB = {
list(params?: { q?: string; status?: string; method?: string; dateFrom?: string; dateTo?: string }) {
  let all = read();

  const q = params?.q?.toLowerCase();
  const status = params?.status;
  const method = params?.method;
  const dateFrom = params?.dateFrom; // ✅ hoisted (narrowed)
  const dateTo   = params?.dateTo;   // ✅ hoisted (narrowed)

  if (q) {
    all = all.filter(o =>
      o.number.toLowerCase().includes(q) ||
      o.userName.toLowerCase().includes(q) ||
      o.userEmail.toLowerCase().includes(q) ||
      o.items.some(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
    );
  }

  if (status && status !== 'all') all = all.filter(o => o.status === status);
  if (method && method !== 'all') all = all.filter(o => o.paymentMethod === method);

  if (dateFrom) {
    all = all.filter(o => o.createdAt >= dateFrom); // ✅ no TS18048
  }
  if (dateTo) {
    const end = dateTo.endsWith('Z') ? dateTo : `${dateTo}T23:59:59.999Z`;
    all = all.filter(o => o.createdAt <= end);      // ✅ no TS18048
  }

  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Promise.resolve(all);
},

  get(id: string) {
    const o = read().find(o => o.id === id)
    if (!o) return Promise.reject(new Error('Order not found'))
    return Promise.resolve(o)
  },
  refund(id: string, amount: number, reason?: string) {
    const all = read()
    const i = all.findIndex(o => o.id === id)
    if (i === -1) return Promise.reject(new Error('Order not found'))
    const o = all[i]
    const refundedSoFar = o.refunds.reduce((s, r) => s + r.amount, 0)
    if (amount <= 0 || amount > (o.total - refundedSoFar)) return Promise.reject(new Error('Invalid refund amount'))
    const refund: Refund = { id: crypto.randomUUID(), amount, reason, createdAt: nowISO() }
    o.refunds.push(refund)
    const totalRefunded = refundedSoFar + amount
    o.status = totalRefunded === o.total ? 'refunded' : 'partial_refund'
    o.updatedAt = nowISO()
    write(all)
    return Promise.resolve(o)
  }
}