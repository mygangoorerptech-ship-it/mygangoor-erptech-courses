import React, { useMemo, useState } from 'react'
import { useAuth } from '../../auth/store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Subscription, SubscriptionStatus } from '../../types/subscription'
import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription, refundSubscription, cancelSubscription } from '../../api/subscriptions'
import { listSaCourses } from '../../api/saCourses' // use mock courses lookups
import { listStudents } from '../../api/students'
import type { Course } from '../../types/course'
import type { Student } from '../../types/student'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { DollarSign, BookOpen, User, RefreshCcw, XOctagon, Pencil, Trash2, Plus, Calendar as Cal } from 'lucide-react'

type Filters = { q:string; status:'all'|SubscriptionStatus; courseId?:string }

export default function ADSubscriptions(){
  const qc = useQueryClient()
  const { user } = useAuth() as any
  const myOrgId = user?.orgId // scope to admin's org

  const [filters, setFilters] = useState<Filters>({ q:'', status:'all' })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: Subscription}|null>(null)

  const subsQ = useQuery({
    queryKey:['ad-subs', filters, myOrgId],
    queryFn: ()=> listSubscriptions({ ...filters, orgId: myOrgId })
  })
  const coursesQ = useQuery({ queryKey:['ad-courses:lookup', myOrgId], queryFn: ()=> listSaCourses({ orgId: myOrgId } as any) })
  const studentsQ = useQuery({ queryKey:['ad-students:lookup', myOrgId], queryFn: ()=> listStudents({ orgId: myOrgId } as any) })

  const rows = subsQ.data ?? []
  const courses = (coursesQ.data ?? []) as Course[]
  const students = (studentsQ.data ?? []) as Student[]

  const createMut = useMutation({ mutationFn: createSubscription, onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-subs'] }) })
  const updateMut = useMutation({ mutationFn: ({id, patch}:{id:string, patch: Partial<Subscription>})=> updateSubscription(id, patch), onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-subs'] }) })
  const deleteMut = useMutation({ mutationFn: deleteSubscription, onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-subs'] }) })
  const refundMut = useMutation({ mutationFn: refundSubscription, onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-subs'] }) })
  const cancelMut = useMutation({ mutationFn: cancelSubscription, onSuccess: ()=> qc.invalidateQueries({ queryKey:['ad-subs'] }) })

  const courseOptions = useMemo(()=> courses.map(c => ({ label: c.title, value: c.id })), [courses])
  const studentOptions = useMemo(()=> students.map(s => ({ label: s.name ? `${s.name} (${s.email})` : s.email, value: s.email })), [students])

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Student, course..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q:e.target.value}))}/>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=> setFilters(f=> ({...f, status: e.target.value as Filters['status']}))}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="canceled">Canceled</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Course</Label>
          <Select value={filters.courseId||''} onChange={(e)=> setFilters(f=> ({...f, courseId: e.target.value || undefined}))}>
            <option value="">Any</option>
            {courseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <Button onClick={()=> setOpen({ mode:'create' })}><Plus size={16}/> Add</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Student</th>
              <th className="text-left font-medium p-3">Course</th>
              <th className="text-left font-medium p-3">Amount</th>
              <th className="text-left font-medium p-3">Purchased</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-[360px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2"><User size={16} className="text-slate-500"/><span>{s.studentName || '—'}</span></div>
                  <div className="text-xs text-slate-500">{s.studentEmail}</div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2"><BookOpen size={16} className="text-slate-500"/><span>{s.courseTitle || s.courseId}</span></div>
                </td>
                <td className="p-3">
                  <div className="inline-flex items-center gap-1"><DollarSign size={14}/>{s.amount.toFixed(2)} {s.currency}</div>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1"><Cal size={14}/> {new Date(s.purchasedAt).toLocaleString()}</span>
                </td>
                <td className="p-3">
                  <span className={
                    s.status==='paid' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                    s.status==='refunded' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                    'text-red-700 bg-red-50 rounded px-2 py-0.5'
                  }>{s.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.status==='paid' && (
                      <>
                        <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> refundMut.mutate(s.id)}><RefreshCcw size={16}/> Refund</button>
                        <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> cancelMut.mutate(s.id)}><XOctagon size={16}/> Cancel</button>
                      </>
                    )}
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setOpen({ mode:'edit', initial: s })}><Pencil size={16}/> Edit</button>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> { if(confirm('Delete subscription?')) deleteMut.mutate(s.id) }}><Trash2 size={16}/> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={6}>No subscriptions</td></tr>}
          </tbody>
        </table>
      </div>

      <SubModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        courses={courses}
        students={students}
        orgId={myOrgId}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') createMut.mutate(payload as any, { onSuccess: ()=> setOpen(null) })
          else if (open?.initial) updateMut.mutate({ id: open.initial.id, patch: payload as any }, { onSuccess: ()=> setOpen(null) })
        }}
      />
    </div>
  )
}

function SubModal({
  open, mode, initial, courses, students, orgId, onClose, onSubmit
}:{
  open:boolean
  mode:'create'|'edit'
  initial?: Subscription
  courses: Course[]
  students: Student[]
  orgId?: string
  onClose:()=>void
  onSubmit:(payload: Omit<Subscription,'id'|'createdAt'|'updatedAt'>)=> void
}){
  const [studentEmail, setStudentEmail] = useState(initial?.studentEmail || (students[0]?.email || ''))
  const [courseId, setCourseId] = useState(initial?.courseId || (courses[0]?.id || ''))
  const [amount, setAmount] = useState(String(initial?.amount ?? ''))
  const [currency, setCurrency] = useState(initial?.currency || 'USD')
  const [status, setStatus] = useState<SubscriptionStatus>(initial?.status || 'paid')
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ? initial.purchasedAt.slice(0,16) : new Date().toISOString().slice(0,16))
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ? initial.expiresAt.slice(0,16) : '')

  React.useEffect(()=>{
    setStudentEmail(initial?.studentEmail || (students[0]?.email || ''))
    setCourseId(initial?.courseId || (courses[0]?.id || ''))
    setAmount(String(initial?.amount ?? ''))
    setCurrency(initial?.currency || 'USD')
    setStatus(initial?.status || 'paid')
    setPurchasedAt(initial?.purchasedAt ? initial.purchasedAt.slice(0,16) : new Date().toISOString().slice(0,16))
    setExpiresAt(initial?.expiresAt ? initial.expiresAt.slice(0,16) : '')
  }, [initial, open, students, courses])

  const canSubmit = !!studentEmail && !!courseId && (amount==='' || parseFloat(amount) >= 0)

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'Add subscription' : 'Edit subscription'}>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return
        onSubmit({
          studentEmail,
          courseId,
          amount: amount ? parseFloat(amount) : 0,
          currency,
          status,
          purchasedAt: new Date(purchasedAt).toISOString(),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          orgId, // from admin’s org
        } as any)
      }}>
        <div className="sm:col-span-2">
          <Label>Student</Label>
          <Select value={studentEmail} onChange={(e)=> setStudentEmail(e.target.value)}>
            {students.map(s => <option key={s.email} value={s.email}>{s.name ? `${s.name} (${s.email})` : s.email}</option>)}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Course</Label>
          <Select value={courseId} onChange={(e)=> setCourseId(e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e)=> setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Currency</Label>
          <Input value={currency} onChange={(e)=> setCurrency(e.target.value)} placeholder="USD" />
        </div>
        <div>
          <Label>Purchased at</Label>
          <Input type="datetime-local" value={purchasedAt} onChange={(e)=> setPurchasedAt(e.target.value)} />
        </div>
        <div>
          <Label>Expires at</Label>
          <Input type="datetime-local" value={expiresAt} onChange={(e)=> setExpiresAt(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e)=> setStatus(e.target.value as SubscriptionStatus)}>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="canceled">Canceled</option>
          </Select>
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>{mode==='create' ? 'Create' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}
