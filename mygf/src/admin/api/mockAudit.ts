import type { AuditLog, AuditFilters } from '../types/audit'

const KEY = 'mock:audit'
const MAX = 2000 // rolling window
const now = () => new Date().toISOString()

function read(): AuditLog[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
function write(rows: AuditLog[]) { localStorage.setItem(KEY, JSON.stringify(rows)) }

function shallowDiff(a: any, b: any) {
  if (!a && !b) return undefined
  const keys = new Set([...(Object.keys(a||{})), ...(Object.keys(b||{}))])
  const out: Record<string, { before: any; after: any }> = {}
  keys.forEach(k => {
    const av = a?.[k]; const bv = b?.[k]
    if (JSON.stringify(av) !== JSON.stringify(bv)) out[k] = { before: av, after: bv }
  })
  return Object.keys(out).length ? out : undefined
}

export const AuditDB = {
  async log(partial: Omit<AuditLog, 'id'|'ts'|'diff'> & { before?: any; after?: any }): Promise<AuditLog> {
    const rec: AuditLog = {
      id: crypto.randomUUID(),
      ts: now(),
      ...partial,
      diff: shallowDiff(partial.before, partial.after),
    }
    const all = read()
    all.unshift(rec)
    if (all.length > MAX) all.splice(MAX)
    write(all)
    return rec
  },

  async list(filters: AuditFilters): Promise<AuditLog[]> {
    let rows = read()
    const { q, action, resource, status, orgId, actorEmail, from, to } = filters || {}
    if (action && action !== 'all') rows = rows.filter(r => r.action === action)
    if (resource && resource !== 'all') rows = rows.filter(r => r.resource === resource)
    if (status && status !== 'all') rows = rows.filter(r => r.status === status)
    if (orgId) rows = rows.filter(r => r.orgId === orgId)
    if (actorEmail) rows = rows.filter(r => (r.actorEmail||'').toLowerCase() === actorEmail.toLowerCase())
    if (from) rows = rows.filter(r => r.ts >= from)
    if (to) rows = rows.filter(r => r.ts <= to)
    if (q) {
      const s = q.toLowerCase()
      rows = rows.filter(r =>
        (r.message||'').toLowerCase().includes(s) ||
        (r.actorEmail||'').toLowerCase().includes(s) ||
        (r.resource||'').toLowerCase().includes(s) ||
        (r.path||'').toLowerCase().includes(s)
      )
    }
    rows.sort((a,b)=> b.ts.localeCompare(a.ts))
    return rows
  },

  async clear() { write([]); return { ok: true } },

  async exportCSV(filters: AuditFilters): Promise<string> {
    const rows = await this.list(filters)
    const header = [
      'ts','action','status',
      'actorEmail','actorName','actorRole',
      'resource','resourceId','orgId',
      'message','method','path'
    ]
    const esc = (v:any) => {
      const s = v==null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
    }
    const lines = [header.join(',')]
    rows.forEach(r => {
      lines.push([
        r.ts, r.action, r.status,
        r.actorEmail||'', r.actorName||'', r.actorRole||'',
        r.resource, r.resourceId||'', r.orgId||'',
        r.message||'', r.method||'', r.path||''
      ].map(esc).join(','))
    })
    return lines.join('\n')
  }
}
