// mygf/src/admin/pages/admin/Payments.tsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { formatINRFromPaise } from '../../utils/currency'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPayments, refundPayment, createOfflinePayment, verifyPayment } from '../../../api/payments'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import OfflinePaymentModal from '../../features/payments/OfflinePaymentModal'
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Plus,
  Loader2
} from 'lucide-react'

import toast from 'react-hot-toast'
import { updateCourse } from '../../api/courses'
import { listAdUsers } from '../../api/adUsers'
import { useAuth } from '../../auth/store'

type PaymentStatus =
  | 'pending_verification'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'rejected'
  | 'reconciled'
type Filters = { q?: string; status: 'all' | PaymentStatus }

export default function ADPayments() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q: '', status: 'all' })
  const [target, setTarget] = useState<any | null>(null)
  const [teacherModal, setTeacherModal] = useState<any | null>(null)
  const [openOffline, setOpenOffline] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [teacherEditMode, setTeacherEditMode] = useState(false)
  const [editCenterAssignments, setEditCenterAssignments] = useState<
    Array<{ centerId: string; teacherIds: string[]; teacherId?: string }>
  >([])
  const [teachersByCenterEdit, setTeachersByCenterEdit] = useState<
    Record<string, Array<{ value: string; label: string }>>
  >({})
  const [openEditDropdown, setOpenEditDropdown] = useState<string | null>(null)
  const [savingTeachers, setSavingTeachers] = useState(false)
  const editDropdownRef = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: ['admin-payments', filters],
    queryFn: () => listPayments({ q: filters.q || undefined, status: filters.status })
  })

  const refundMut = useMutation({
    mutationFn: (id: string) =>
      refundPayment(id),

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['admin-payments'],
        type: 'active',
      });

      toast.success(
        'Payment refunded successfully'
      );
    },

    onError: (err: any) => {
      console.error(err);

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to refund payment'
      );
    },
  })

  // create offline payment
  const createOfflineMut = useMutation({
    mutationFn: createOfflinePayment,

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['admin-payments'],
        type: 'active',
      });

      setOpenOffline(false);

      toast.success(
        'Offline payment recorded successfully'
      );
    },

    onError: (err: any) => {
      console.error(err);

      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to record offline payment'
      );
    },
  })

  // verify submitted offline payment
  const verifyMut = useMutation({
    mutationFn: async (id: string) => {
      setVerifyingId(id);

      return verifyPayment(id);
    },

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['admin-payments'],
        type: 'active',
      });

      toast.success(
        'Payment verified successfully'
      );
    },

    onError: async (err: any) => {

      console.error(err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to verify payment';

      if (
        message.includes('already verified') ||
        message.includes('already enrolled') ||
        message.includes('already purchased')
      ) {

        toast.success(
          'Payment already verified'
        );

        await qc.refetchQueries({
          queryKey: ['admin-payments'],
          type: 'active',
        });

        return;
      }

      toast.error(message);
    },

    onSettled: () => {
      setVerifyingId(null);
    },
  })

  const rows = query.data ?? []

  const { user } = useAuth()
  const actorOrgId = user?.orgId ? String(user.orgId) : ''

  const centerIdsKey = useMemo(
    () => [...editCenterAssignments.map(a => a.centerId)].sort().join(','),
    [editCenterAssignments]
  )

  function enterEditMode() {
    const assignments = (teacherModal?.courseTeacherAssignments || []).map((a) => ({
      centerId: a.centerId,
      teacherIds: a.teacherIds?.length
        ? a.teacherIds.map(String)
        : (a.teacherId ? [String(a.teacherId)] : []),
      teacherId: a.teacherId ? String(a.teacherId) : '',
    }))
    setEditCenterAssignments(assignments)
    setTeacherEditMode(true)
  }

  useEffect(() => {
    if (!teacherEditMode) return
    let cancelled = false
    const centerIds = centerIdsKey ? centerIdsKey.split(',').filter(Boolean) : []
    if (centerIds.length === 0) { setTeachersByCenterEdit({}); return }

    async function run() {
      try {
        const results = await Promise.all(
          centerIds.map(async (centerId) => {
            const users = await listAdUsers({ role: 'teacher', status: 'all', orgId: centerId } as any)
            const opts = (users || []).map((u: any) => ({
              value: String(u.id || u._id),
              label: `${u.name || u.email} (${u.email})`,
            }))
            return [centerId, opts] as const
          })
        )
        if (!cancelled) setTeachersByCenterEdit(Object.fromEntries(results))
      } catch {
        if (!cancelled) setTeachersByCenterEdit({})
      }
    }
    run()
    return () => { cancelled = true }
  }, [teacherEditMode, centerIdsKey])

  useEffect(() => {
    if (!teacherEditMode) return
    function handleClick(e: MouseEvent) {
      if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) {
        setOpenEditDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [teacherEditMode])

  async function saveTeacherAssignments() {
    if (!teacherModal?.courseId) return
    setSavingTeachers(true)
    try {
      await updateCourse(teacherModal.courseId, {
        centerTeacherAssignments: editCenterAssignments.map(a => ({
          centerId: a.centerId,
          teacherIds: a.teacherIds ?? (a.teacherId ? [a.teacherId] : []),
        })),
        teacherId: editCenterAssignments[0]?.teacherIds?.[0]
          ?? editCenterAssignments[0]?.teacherId
          ?? undefined,
      })
      await qc.refetchQueries({ queryKey: ['admin-payments'], type: 'active' })
      setTeacherEditMode(false)
      setEditCenterAssignments([])
      setTeachersByCenterEdit({})
      setOpenEditDropdown(null)
      setTeacherModal(null)
      toast.success('Teacher assignments updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update teacher assignments')
    } finally {
      setSavingTeachers(false)
    }
  }

  const teacherSummary = (p: any) => {
    const rows =
      Array.isArray(p?.courseTeacherAssignments)
        ? p.courseTeacherAssignments
        : []

    if (!rows.length) {
      return '—'
    }

    const uniqueTeachers =
      [...new Set(
        rows
          .map((x: any) => x?.teacherName)
          .filter(Boolean)
      )]

    if (uniqueTeachers.length === 0) {
      return 'Teacher Assigned'
    }

    if (uniqueTeachers.length === 1) {
      return uniqueTeachers[0]
    }

    return `${uniqueTeachers[0]} +${uniqueTeachers.length - 1}`
  }

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input className="pl-8" placeholder="Email, order id, method..." value={filters.q || ''} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={filters.status}
            onChange={e =>
              setFilters(f => ({
                ...f,
                status: e.target.value as Filters['status']
              }))
            }
          >
            <option value="all">All</option>

            <option value="pending">
              Pending
            </option>

            <option value="pending_verification">
              Pending Verification
            </option>

            <option value="captured">
              Captured
            </option>

            <option value="refunded">
              Refunded
            </option>

            <option value="failed">
              Failed
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="reconciled">
              Reconciled
            </option>
          </Select>
        </div>
        <div className="flex items-end justify-end md:col-span-2 gap-2">
          <Button onClick={() => setOpenOffline(true)}><Plus size={16} /> Record Offline</Button>
          <Button
            variant="ghost"
            disabled={query.isFetching}
            onClick={async () => {
              try {
                await qc.refetchQueries({
                  queryKey: ['admin-payments'],
                  type: 'active',
                });

                toast.success(
                  'Payments refreshed successfully'
                );
              } catch (err: any) {
                console.error(err);

                toast.error(
                  'Failed to refresh payments'
                );
              }
            }}
          >
            {
              query.isFetching
                ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={16}
                    />

                    Refreshing...
                  </>
                )
                : 'Refresh'
            }
          </Button>
        </div>
      </header>

      <div className="w-full rounded-xl border bg-white overflow-hidden">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
          <table className="min-w-[1200px] text-sm">
            <thead className="bg-slate-50 text-slate-600 whitespace-nowrap">
              <tr>
                <th className="text-left font-medium p-3">When</th>
                <th className="text-left font-medium p-3">Order / Sub</th>
                <th className="text-left font-medium p-3">Student</th>

                {/* NEW */}
                <th className="text-left font-medium p-3 w-[180px]">
                  Center
                </th>

                {/* NEW */}
                <th className="text-left font-medium p-3 w-[220px]">
                  Course
                </th>

                <th className="text-left font-medium p-3 w-[220px]">
                  Assigned Teachers
                </th>

                <th className="text-left font-medium p-3">
                  Amount
                </th>

                <th className="text-left font-medium p-3">
                  Method
                </th>

                <th className="text-left font-medium p-3">
                  Status
                </th>

                <th className="text-left font-medium p-3 w-40">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((p: any) => (
                <tr key={p.id} className="border-t align-top">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>

                  <td className="p-3">
                    <div className="font-mono text-xs break-all leading-relaxed">
                      {
                        p.providerOrderId
                          ? `ONLINE_${p.providerOrderId}`

                          : p.providerPaymentId
                            ? `PAY_${p.providerPaymentId}`

                            : p.receiptNo
                              ? `CASH_${p.receiptNo}`

                              : p.referenceId
                                ? `REF_${p.referenceId}`

                                : p.id
                                  ? `${(p.method || 'PAY').toUpperCase()}_${String(p.id).slice(-6)}`

                                  : '—'
                      }
                    </div>
                  </td>

                  <td className="p-3 break-words max-w-[220px]">
                    {p.studentEmail || p.student?.email || '—'}
                  </td>

                  {/* CENTER */}
                  <td className="p-3">
                    <div className="whitespace-normal break-words leading-relaxed max-w-[180px]">
                      {p.orgName || '—'}
                    </div>
                  </td>

                  {/* COURSE */}
                  <td className="p-3">
                    <div className="whitespace-normal break-words leading-relaxed max-w-[220px]">
                      {p.courseTitle || '—'}
                    </div>
                  </td>

                  <td className="p-3">
                    {
                      Array.isArray(p.courseTeacherAssignments) &&
                        p.courseTeacherAssignments.length > 0
                        ? (
                          <button
                            type="button"
                            onClick={() => setTeacherModal(p)}
                            className="
            text-left
            w-full
            rounded-lg
            border
            border-slate-200
            px-3
            py-2
            hover:border-indigo-300
            hover:bg-indigo-50/40
            transition
          "
                          >
                            <div className="font-medium text-slate-800">
                              {teacherSummary(p)}
                            </div>

                            <div className="text-xs text-slate-500 mt-1">
                              View center-wise assignments
                            </div>
                          </button>
                        )
                        : (
                          <span className="text-slate-400">
                            —
                          </span>
                        )
                    }
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {
                      typeof formatINRFromPaise === 'function'
                        ? formatINRFromPaise(p.amount || 0)
                        : `₹${((p.amount || 0) / 100).toFixed(2)}`
                    }
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {p.method || '—'}
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={
                        p.status === 'captured'
                          ? 'text-green-700 bg-green-50 rounded px-2 py-0.5'

                          : p.status === 'pending'
                            ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5'

                            : p.status === 'pending_verification'
                              ? 'text-indigo-700 bg-indigo-50 rounded px-2 py-0.5'

                              : p.status === 'refunded'
                                ? 'text-slate-700 bg-slate-100 rounded px-2 py-0.5'

                                : p.status === 'rejected'
                                  ? 'text-rose-700 bg-rose-50 rounded px-2 py-0.5'

                                  : p.status === 'reconciled'
                                    ? 'text-cyan-700 bg-cyan-50 rounded px-2 py-0.5'

                                    : 'text-red-700 bg-red-50 rounded px-2 py-0.5'
                      }
                    >
                      {p.status.replaceAll('_', ' ')}
                    </span>
                  </td>

                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {p.status === 'pending_verification' && (
                        <Button
                          variant="ghost"
                          className="h-8 px-2 text-xs disabled:opacity-60"
                          onClick={() => {

                            if (
                              verifyingId === p.id ||
                              verifyMut.isPending
                            ) {
                              return;
                            }
                            const ok = window.confirm(
                              'Verify this offline payment and enroll the student into the course?'
                            );

                            if (!ok) return;

                            verifyMut.mutate(p.id);
                          }}
                          disabled={verifyingId === p.id}
                          title="Verify offline payment"
                        >
                          {
                            verifyingId === p.id
                              ? (
                                <Loader2
                                  className="animate-spin"
                                  size={16}
                                />
                              )
                              : (
                                <CheckCircle2 size={16} />
                              )
                          }

                          {
                            verifyingId === p.id
                              ? 'Verifying...'
                              : 'Verify & Enroll'
                          }
                        </Button>
                      )}

                      {p.status === 'captured' && (
                        <Button
                          variant="danger"
                          disabled={refundMut.isPending}
                          onClick={() => setTarget(p)}
                        >
                          <RotateCcw size={16} /> Refund
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        onClick={() => setTarget(p)}
                      >
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center text-slate-500"
                    colSpan={10}
                  >
                    No payments
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title="Payment details">
        {target && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-slate-500">ID</div><div className="font-mono text-sm">{target.id}</div></div>
              <div><div className="text-xs text-slate-500">Status</div><div className="text-sm">{target.status}</div></div>
              <div><div className="text-xs text-slate-500">Amount</div><div className="text-sm">₹{((target.amount || 0) / 100).toFixed(2)}</div></div>
              <div><div className="text-xs text-slate-500">Method</div><div className="text-sm">{target.method || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Order/Sub</div><div className="text-sm">{target.providerOrderId
                ? `ONLINE_${target.providerOrderId}`
                : target.providerPaymentId
                  ? `PAY_${target.providerPaymentId}`
                  : target.receiptNo
                    ? `CASH_${target.receiptNo}`
                    : target.referenceId
                      ? `REF_${target.referenceId}`
                      : target.id
                        ? `${(target.method || 'PAY').toUpperCase()}_${String(target.id).slice(-6)}`
                        : '—'
              }</div></div>
              <div><div className="text-xs text-slate-500">Student</div><div className="text-sm">{target.studentEmail || '—'}</div></div>
              <div>
                <div className="text-xs text-slate-500">
                  Course
                </div>

                <div className="text-sm">
                  {target.courseTitle || '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  Organization / Center
                </div>

                <div className="text-sm">
                  {target.orgName || '—'}
                </div>
              </div>
            </div>
            {(() => {
              let form = null

              try {

                if (!target.notes) {

                  form = null;

                } else {

                  const parsed =
                    JSON.parse(target.notes);

                  form =
                    typeof parsed === "object"
                      ? parsed
                      : null;
                }

              } catch {

                // plain text note
                form = null;
              }

              if (!form) return null

              if (form.error) {
                return (
                  <div className="mt-4 border-t pt-3 text-xs text-red-500">
                    Invalid join form data
                  </div>
                )
              }

              //edited 0000
              const f =
                form?.joinForm &&
                  typeof form.joinForm === "object"
                  ? form.joinForm
                  : form || {};

              const fields: [string, any][] = [
                ['Full Name', f.fullName],
                ['Age', f.age],
                ['Gender', f.gender],
                ['Date of Birth', f.birth],
                ['Mobile', f.mobile],
                ['Email', f.email],
                ['Address', f.address],
              ];

              return (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs text-slate-500 mb-2 font-medium">
                    Join Form Details
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map(([label, val]) =>
                      val != null ? (
                        <div key={label}>
                          <div className="text-xs text-slate-500">{label}</div>
                          <div className="text-sm">{String(val)}</div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )
            })()}
            <div className="flex justify-end gap-2 pt-2">
              {target.status === 'captured' && (
                <Button
                  variant="danger"
                  disabled={refundMut.isPending}
                  onClick={() => {
                    refundMut.mutate(target.id, {
                      onSuccess: () => {
                        setTarget((p: any) => ({
                          ...p,
                          status: 'refunded'
                        }));
                      }
                    })
                  }}
                >
                  {
                    refundMut.isPending
                      ? (
                        <>
                          <Loader2
                            className="animate-spin"
                            size={16}
                          />

                          Refunding...
                        </>
                      )
                      : (
                        <>
                          <RotateCcw size={16} />

                          Refund
                        </>
                      )
                  }
                </Button>
              )}
              <Button
                onClick={() => setTarget(null)}
                disabled={refundMut.isPending}
              >
                Close
              </Button>
            </div>
            {
              target.status === 'pending_verification' && (
                <div className="text-xs text-amber-600 mt-1">
                  Waiting for admin verification and enrollment.
                </div>
              )
            }
          </div>
        )}
      </Modal>

      {/* Offline payment entry */}
      <OfflinePaymentModal
        open={openOffline}
        onClose={() => setOpenOffline(false)}
        onSubmit={async (payload) => {
          await createOfflineMut.mutateAsync(
            payload
          );
        }}
      />

      <Modal
        open={!!teacherModal}
        onClose={() => {
          setTeacherModal(null)
          setTeacherEditMode(false)
          setEditCenterAssignments([])
          setTeachersByCenterEdit({})
          setOpenEditDropdown(null)
        }}
        title="Assigned Teachers"
      >
        {teacherModal && (
          <div className="space-y-4">
            {!teacherEditMode ? (
              <>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 font-medium">Center</th>
                        <th className="text-left p-3 font-medium">Teacher</th>
                        <th className="text-left p-3 font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(teacherModal.courseTeacherAssignments)
                        ? teacherModal.courseTeacherAssignments
                        : []
                      ).map((x, idx: number) => (
                        <tr key={`${x.centerId}-${idx}`} className="border-t">
                          <td className="p-3">
                            <div className="space-y-1">
                              <div>{x.centerName || 'Center'}</div>
                              <div className="text-[11px] text-slate-400 font-mono break-all">
                                {x.centerId || '—'}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-medium">{x.teacherName || '—'}</td>
                          <td className="p-3 text-slate-600">{x.teacherEmail || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  {teacherModal.courseId && (
                    <Button variant="ghost" onClick={enterEditMode}>
                      Edit Assignments
                    </Button>
                  )}
                  <Button onClick={() => {
                    setTeacherModal(null)
                    setTeacherEditMode(false)
                  }}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <div ref={editDropdownRef}>
                <div className="space-y-3">
                  {editCenterAssignments.length === 0 ? (
                    <div className="text-sm text-slate-500 p-3">No center assignments to edit.</div>
                  ) : (
                    editCenterAssignments.map((assignment) => {
                      const centerId = assignment.centerId
                      const isExternal = centerId !== actorOrgId
                      const centerName = (teacherModal.courseTeacherAssignments || [])
                        .find((a) => a.centerId === centerId)?.centerName || centerId
                      const selected = assignment.teacherIds || []
                      const options = teachersByCenterEdit[centerId] || []
                      const isOpen = openEditDropdown === centerId
                      return (
                        <div
                          key={centerId}
                          className={`grid md:grid-cols-2 gap-3 border rounded-lg p-3${isExternal ? ' opacity-60 bg-slate-50' : ''}`}
                        >
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-slate-700">
                              {centerName}
                              {isExternal && (
                                <span className="ml-2 text-xs font-normal text-slate-400">(read-only)</span>
                              )}
                            </div>
                          </div>
                          <div className="relative" data-teacher-dropdown>
                            <button
                              type="button"
                              disabled={isExternal}
                              onClick={() => setOpenEditDropdown(isOpen ? null : centerId)}
                              className="w-full text-left border rounded px-3 py-2 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              {selected.length === 0
                                ? <span className="text-slate-400">Select Teachers…</span>
                                : <span>{selected.length} teacher{selected.length > 1 ? 's' : ''} selected</span>
                              }
                            </button>
                            {isOpen && !isExternal && (
                              <div className="absolute z-20 mt-1 w-full border rounded bg-white shadow-lg max-h-48 overflow-y-auto">
                                {options.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-slate-400">No teachers available</div>
                                ) : (
                                  options.map((t) => (
                                    <label key={t.value} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={selected.includes(t.value)}
                                        onChange={(e) => {
                                          const next = e.target.checked
                                            ? [...selected, t.value]
                                            : selected.filter((id) => id !== t.value)
                                          setEditCenterAssignments((prev) =>
                                            prev.map((a) => a.centerId === centerId
                                              ? { ...a, teacherIds: next, teacherId: next[0] ?? '' }
                                              : a
                                            )
                                          )
                                        }}
                                      />
                                      {t.label}
                                    </label>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTeacherEditMode(false)
                      setTeachersByCenterEdit({})
                      setOpenEditDropdown(null)
                    }}
                    disabled={savingTeachers}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveTeacherAssignments} disabled={savingTeachers}>
                    {savingTeachers
                      ? <><Loader2 className="animate-spin" size={16} /> Saving...</>
                      : 'Save Changes'
                    }
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
