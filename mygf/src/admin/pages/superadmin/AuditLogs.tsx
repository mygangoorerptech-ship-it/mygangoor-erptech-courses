import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { keepPreviousData } from '@tanstack/react-query'
import { listAuditLogsPaged } from '../../api/audit'
import type { AuditLog, AuditParams } from '../../api/audit'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

// Action values that the backend now supports (union of old + new enum values)
const ACTIONS = [
  'all',
  'login', 'logout',
  'create', 'update', 'delete', 'status_change', 'role_change',
  'PASSWORD_CHANGE', 'EMAIL_CHANGE_REQUEST', 'EMAIL_CHANGE_VERIFY',
  '2FA_ENABLE', '2FA_DISABLE', 'BACKUP_CODES_GENERATED',
  'SESSION_REVOKED', 'SESSION_REVOKED_ALL', 'SUSPICIOUS_LOGIN',
] as const

type FilterState = {
  action: string
  userId: string
  from: string
  to: string
}

export default function SAAuditLogs() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({ action: 'all', userId: '', from: '', to: '' })
  const [view, setView] = useState<AuditLog | null>(null)

  const params: AuditParams = {
    page,
    limit: PAGE_SIZE,
    ...(filters.action && filters.action !== 'all' ? { action: filters.action } : {}),
    ...(filters.userId.trim() ? { userId: filters.userId.trim() } : {}),
    ...(filters.from ? { from: new Date(filters.from).toISOString() } : {}),
    ...(filters.to   ? { to:   new Date(filters.to).toISOString()   } : {}),
  }

  const query = useQuery({
    queryKey: ['sa-audit', params],
    queryFn: () => listAuditLogsPaged(params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  const data  = query.data
  const rows  = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Reset to page 1 whenever filters change
  function applyFilter(patch: Partial<FilterState>) {
    setFilters(f => ({ ...f, ...patch }))
    setPage(1)
    qc.invalidateQueries({ queryKey: ['sa-audit'] })
  }

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <header className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-1">
          <Label>Action</Label>
          <Select
            value={filters.action}
            onChange={e => applyFilter({ action: e.target.value })}
          >
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>

        <div className="space-y-1">
          <Label>User ID</Label>
          <Input
            placeholder="MongoDB ObjectId…"
            value={filters.userId}
            onChange={e => applyFilter({ userId: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label>From</Label>
          <Input
            type="datetime-local"
            value={filters.from}
            onChange={e => applyFilter({ from: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label>To</Label>
          <Input
            type="datetime-local"
            value={filters.to}
            onChange={e => applyFilter({ to: e.target.value })}
          />
        </div>
      </header>

      {/* ── Error banner ── */}
      {query.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load audit logs. Check your connection and try again.
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3 whitespace-nowrap">Time</th>
              <th className="text-left font-medium p-3 whitespace-nowrap">Actor</th>
              <th className="text-left font-medium p-3 whitespace-nowrap">Role</th>
              <th className="text-left font-medium p-3 whitespace-nowrap">Action</th>
              <th className="text-left font-medium p-3 whitespace-nowrap">IP</th>
              <th className="text-left font-medium p-3 w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {/* Skeleton rows while loading */}
            {query.isFetching && rows.length === 0 &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t animate-pulse">
                  <td className="p-3"><div className="h-4 w-36 rounded bg-slate-200" /></td>
                  <td className="p-3"><div className="h-4 w-40 rounded bg-slate-200" /></td>
                  <td className="p-3"><div className="h-4 w-20 rounded bg-slate-200" /></td>
                  <td className="p-3"><div className="h-4 w-28 rounded bg-slate-200" /></td>
                  <td className="p-3"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                  <td className="p-3"><div className="h-4 w-8  rounded bg-slate-200" /></td>
                </tr>
              ))
            }

            {/* Data rows */}
            {rows.map(r => (
              <tr key={r.id} className="border-t hover:bg-slate-50 transition-colors">
                <td className="p-3 whitespace-nowrap text-slate-500">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                </td>
                <td className="p-3">
                  <div className="font-medium">{r.actorName || '—'}</div>
                  <div className="text-xs text-slate-400">{r.actorEmail || ''}</div>
                </td>
                <td className="p-3 text-slate-500">{r.actorRole || '—'}</td>
                <td className="p-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{r.action}</span>
                </td>
                <td className="p-3 text-slate-400 font-mono text-xs">{r.ip || '—'}</td>
                <td className="p-3">
                  <Button variant="ghost" onClick={() => setView(r)}>
                    <Eye size={14} />
                  </Button>
                </td>
              </tr>
            ))}

            {/* Empty state — only when not loading */}
            {!query.isFetching && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total > 0
            ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`
            : 'No results'}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} /> Prev
          </Button>
          <span className="px-2">Page {page} / {totalPages}</span>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <ViewModal open={!!view} log={view} onClose={() => setView(null)} />
    </div>
  )
}

function ViewModal({ open, log, onClose }: { open: boolean; log: AuditLog | null; onClose: () => void }) {
  if (!log) return null
  const pretty = (v: any) => JSON.stringify(v, null, 2)
  return (
    <Modal open={open} onClose={onClose} title="Audit details">
      <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4">
        <pre className="text-xs rounded border bg-slate-50 p-3 overflow-auto whitespace-pre-wrap">
          {pretty({
            id:        log.id,
            createdAt: log.createdAt,
            action:    log.action,
            actor: {
              id:    log.actorId,
              email: log.actorEmail,
              name:  log.actorName,
              role:  log.actorRole,
            },
            ip:   log.ip,
            ua:   log.ua,
            meta: log.meta,
          })}
        </pre>
      </div>
      <div className="flex justify-end mt-3">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
