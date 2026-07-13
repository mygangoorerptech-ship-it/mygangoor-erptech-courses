//path mygf/src/admin/pages/teacher/Payments.tsx
import { useState } from 'react'
import { formatINRFromPaise } from '../../utils/currency'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPayments, refundPayment, createOfflinePayment } from '../../api/payments'
import { useAuth } from '../../auth/store'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import OfflinePaymentModal from '../../features/payments/OfflinePaymentModal'
import {
  RotateCcw,
  Search,
  Plus,
  Loader2
} from 'lucide-react'

import toast from 'react-hot-toast'

type PaymentStatus =
  | 'pending_verification'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'rejected'
  | 'reconciled'
type Filters = { q?: string; status: 'all' | PaymentStatus }

export default function VEPayments() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const orgId = (user as any)?.orgId
  const [filters, setFilters] = useState<Filters>({ q: '', status: 'all' })
  const [target, setTarget] = useState<any | null>(null)
  const [teacherModal, setTeacherModal] = useState<any | null>(null)
  const [openOffline, setOpenOffline] = useState(false)

  const query = useQuery({
    queryKey: ['teacher-payments', filters, orgId],
    // teacher is org-scoped server-side; orgId included for cache segmentation
    queryFn: () => listPayments({ orgId, q: filters.q || undefined, status: filters.status })
  })

  const refundMut = useMutation({
    mutationFn: (id: string) =>
      refundPayment(id),

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['teacher-payments'],
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

  const createOfflineMut = useMutation({
    mutationFn: createOfflinePayment,

    onSuccess: async () => {
      await qc.refetchQueries({
        queryKey: ['teacher-payments'],
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

  // const verifyMut = useMutation({
  //   mutationFn: (id: string) =>
  //     verifyPayment(id),

  //   onSuccess: async () => {
  //     await qc.refetchQueries({
  //       queryKey: ['teacher-payments'],
  //       type: 'active',
  //     });

  //     toast.success(
  //       'Payment verified successfully'
  //     );
  //   },

  //   onError: (err: any) => {
  //     console.error(err);

  //     toast.error(
  //       err?.response?.data?.message ||
  //       err?.message ||
  //       'Failed to verify payment'
  //     );
  //   },
  // })

  const rows = query.data ?? []

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
    <div className="space-y-4 w-full min-w-0 overflow-x-hidden">
      <header className="grid gap-3 md:grid-cols-5 w-full min-w-0 overflow-hidden">
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
                  queryKey: ['teacher-payments'],
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

      <div className="w-full min-w-0 rounded-xl border bg-white overflow-hidden">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
          <table className="min-w-[1200px] text-sm">
            <thead className="bg-slate-50 text-slate-800 whitespace-nowrap">
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
                      {
                        p.status === 'pending_verification' && (
                          <span className="text-xs text-amber-600 whitespace-nowrap">
                            Waiting for admin verification
                          </span>
                        )
                      }
                      {/* {p.status === 'pending_verification' && (
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs disabled:opacity-60"
                        onClick={() => verifyMut.mutate(p.id)}
                        disabled={verifyMut.isPending}
                        title="Verify offline payment"
                      >
                        {
                          verifyMut.isPending
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
                          verifyMut.isPending
                            ? 'Verifying...'
                            : 'Verify'
                        }
                      </Button>
                    )} */}

                      {/* {p.status === 'captured' && (
                        <Button
                          variant="danger"
                          disabled={refundMut.isPending}
                          onClick={() => setTarget(p)}
                        >
                          <RotateCcw size={16} /> Refund
                        </Button>
                      )} */}

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
              <div><div className="text-xs text-slate-500">Amount</div><div className="text-sm">{formatINRFromPaise(target.amount || 0)}</div></div>
              <div><div className="text-xs text-slate-500">Method</div><div className="text-sm">{target.method || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Order/Sub</div><div className="text-sm">{
                target.providerOrderId
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
              // Step 1: try to extract joinForm from notes
              let joinFormData: Record<string, unknown> | null = null;
              let notesHasError = false;

              try {
                if (target.notes) {
                  const parsed = JSON.parse(target.notes);
                  if (typeof parsed === 'object' && parsed !== null) {
                    if (parsed.error) {
                      notesHasError = true;
                    } else if (parsed.joinForm && typeof parsed.joinForm === 'object') {
                      joinFormData = parsed.joinForm;
                    }
                  }
                }
              } catch { /* plain-text note — not JSON */ }

              if (notesHasError) {
                return (
                  <div className="mt-4 border-t pt-3 text-xs text-red-500">
                    Invalid join form data
                  </div>
                );
              }

              // Step 2: fallback to formProfile attached by the backend
              // (present for offline payments where notes has no joinForm)
              if (!joinFormData && target.formProfile) {
                joinFormData = target.formProfile;
              }

              if (!joinFormData) return null;

              const f = joinFormData;
              const fields: [string, unknown][] = [
                ['Full Name', f.fullName],
                ['Age', f.age],
                ['Gender', f.gender],
                ['Date of Birth', f.birth],
                ['Mobile', f.mobile],
                ['Email', f.email],
                ['Address', f.address],
              ];

              if (!fields.some(([, val]) => val != null)) return null;

              return (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs text-slate-500 mb-2 font-medium">
                    Join Form Details
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map(([label, val]) =>
                      val != null ? (
                        <div key={label as string}>
                          <div className="text-xs text-slate-500">{label as string}</div>
                          <div className="text-sm">{String(val)}</div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="flex justify-end gap-2 pt-2">
              {/* {target.status === 'captured' && (
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
              )} */}
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
        onClose={() => setTeacherModal(null)}
        title="Assigned Teachers"
      >
        {
          teacherModal && (
            <div className="space-y-4">
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 font-medium">
                        Center
                      </th>

                      <th className="text-left p-3 font-medium">
                        Teacher
                      </th>

                      <th className="text-left p-3 font-medium">
                        Email
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {
                      (
                        Array.isArray(
                          teacherModal.courseTeacherAssignments
                        )
                          ? teacherModal.courseTeacherAssignments
                          : []
                      ).map(
                        (x: any, idx: number) => (
                          <tr
                            key={`${x.centerId}-${idx}`}
                            className="border-t"
                          >
                            <td className="p-3">
                              <div className="space-y-1">
                                <div>
                                  {x.centerName || 'Center'}
                                </div>

                                <div className="text-[11px] text-slate-400 font-mono break-all">
                                  {x.centerId || '—'}
                                </div>
                              </div>
                            </td>

                            <td className="p-3 font-medium">
                              {x.teacherName || '—'}
                            </td>

                            <td className="p-3 text-slate-800">
                              {x.teacherEmail || '—'}
                            </td>
                          </tr>
                        )
                      )
                    }
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setTeacherModal(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )
        }
      </Modal>
    </div>
  )
}
