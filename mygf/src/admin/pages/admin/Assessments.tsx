import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Assessment, AssessmentStatus } from '../../types/assessment'
import { listAssessments, createAssessment, updateAssessment, deleteAssessment, setAssessmentStatus } from '../../api/assessments'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Plus, Pencil, Trash2, Rocket, Archive } from 'lucide-react'
import { Link } from 'react-router-dom'

type Filters = { q: string; status: 'all'|AssessmentStatus; courseId?: string }

export default function Assessments(){
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q:'', status:'all' })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: Assessment}|null>(null)

  const query = useQuery({ queryKey:['assessments', filters], queryFn: ()=> listAssessments(filters) })

  const createMut = useMutation({ mutationFn: createAssessment, onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessments'] }) })
  const updateMut = useMutation({ mutationFn: ({id, patch}:{id:string, patch: Partial<Assessment>})=> updateAssessment(id, patch), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessments'] }) })
  const deleteMut = useMutation({ mutationFn: deleteAssessment, onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessments'] }) })
  const statusMut = useMutation({ mutationFn: ({id, status}:{id:string, status:AssessmentStatus})=> setAssessmentStatus(id, status), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessments'] }) })

  const rows = query.data ?? []

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Title, course..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q: e.target.value}))} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=> setFilters(f=> ({...f, status: e.target.value as Filters['status']}))}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Course ID (optional)</Label>
          <Input placeholder="e.g., REACT-101" value={filters.courseId||''} onChange={(e)=> setFilters(f=> ({...f, courseId: e.target.value || undefined}))} />
        </div>
        <div className="flex items-end justify-end">
          <Button onClick={()=> setOpen({ mode: 'create' })}><Plus size={16}/> New</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Title</th>
              <th className="text-left font-medium p-3">Course</th>
              <th className="text-left font-medium p-3">Questions</th>
              <th className="text-left font-medium p-3">Passing</th>
              <th className="text-left font-medium p-3">Time</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{a.title}</div>
                  {a.description && <div className="text-xs text-slate-500">{a.description}</div>}
                </td>
                <td className="p-3">
                  <div className="text-sm">{a.courseTitle || '—'}</div>
                  {a.courseId && <div className="text-xs text-slate-500">{a.courseId}</div>}
                </td>
                <td className="p-3">{a.totalQuestions}</td>
                <td className="p-3">{a.passingScore ?? '—'}%</td>
                <td className="p-3">{a.timeLimitMin ?? '—'} min</td>
                <td className="p-3">
                  <span className={
                    a.status==='published' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                    a.status==='draft' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                    'text-slate-700 bg-slate-100 rounded px-2 py-0.5'
                  }>{a.status}</span>
                </td>
<td className="p-3">
  <div className="flex flex-wrap items-center gap-2">
    {a.status!=='published' && (
      <button
        className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
        onClick={()=> statusMut.mutate({ id:a.id, status:'published' })}
      >
        <Rocket size={16}/> Publish
      </button>
    )}
    {a.status==='published' && (
      <button
        className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
        onClick={()=> statusMut.mutate({ id:a.id, status:'draft' })}
      >
        <Archive size={16}/> Unpublish
      </button>
    )}

    {/* 👉 NEW: link to questions for this assessment */}
    <Link
      to={`/admin/assessments/${a.id}/questions`}
      className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
    >
      Questions
    </Link>

    <button
      className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
      onClick={()=> setOpen({ mode:'edit', initial: a })}
    >
      <Pencil size={16}/> Edit
    </button>
    <button
      className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
      onClick={()=> { if(confirm('Delete assessment?')) deleteMut.mutate(a.id) }}
    >
      <Trash2 size={16}/> Delete
    </button>
  </div>
</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={7}>No assessments</td></tr>}
          </tbody>
        </table>
      </div>

      <AssessmentModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') createMut.mutate(payload as any, { onSuccess: ()=> setOpen(null) })
          else if (open?.initial) updateMut.mutate({ id: open.initial.id, patch: payload as any }, { onSuccess: ()=> setOpen(null) })
        }}
      />
    </div>
  )
}

function AssessmentModal({ open, mode, initial, onClose, onSubmit }:{
  open:boolean, mode:'create'|'edit', initial?: Assessment,
  onClose:()=>void,
  onSubmit: (payload: Omit<Assessment,'id'|'createdAt'|'updatedAt'>)=> void
}){
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [courseId, setCourseId] = useState(initial?.courseId || '')
  const [courseTitle, setCourseTitle] = useState(initial?.courseTitle || '')
  const [totalQuestions, setTotalQuestions] = useState(String(initial?.totalQuestions ?? 10))
  const [passingScore, setPassingScore] = useState(String(initial?.passingScore ?? 70))
  const [timeLimitMin, setTimeLimitMin] = useState(String(initial?.timeLimitMin ?? 30))
  const [status, setStatus] = useState<AssessmentStatus>(initial?.status || 'draft')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))

  React.useEffect(()=>{
    setTitle(initial?.title || '')
    setDescription(initial?.description || '')
    setCourseId(initial?.courseId || '')
    setCourseTitle(initial?.courseTitle || '')
    setTotalQuestions(String(initial?.totalQuestions ?? 10))
    setPassingScore(String(initial?.passingScore ?? 70))
    setTimeLimitMin(String(initial?.timeLimitMin ?? 30))
    setStatus(initial?.status || 'draft')
    setTags((initial?.tags || []).join(', '))
  }, [initial, open])

  const canSubmit = title.trim().length > 1 && parseInt(totalQuestions||'0',10) > 0

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New assessment' : 'Edit assessment'}>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          courseId: courseId.trim() || undefined,
          courseTitle: courseTitle.trim() || undefined,
          totalQuestions: parseInt(totalQuestions,10),
          passingScore: passingScore ? parseInt(passingScore,10) : undefined,
          timeLimitMin: timeLimitMin ? parseInt(timeLimitMin,10) : undefined,
          status,
          tags: tags ? tags.split(',').map(s=> s.trim()).filter(Boolean) : undefined
        } as any)
      }}>
        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="Assessment title" />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Input value={description} onChange={(e)=> setDescription(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <Label>Course ID</Label>
          <Input value={courseId} onChange={(e)=> setCourseId(e.target.value)} placeholder="REACT-101" />
        </div>
        <div>
          <Label>Course title</Label>
          <Input value={courseTitle} onChange={(e)=> setCourseTitle(e.target.value)} placeholder="React Fundamentals" />
        </div>
        <div>
          <Label>Total questions</Label>
          <Input type="number" min="1" value={totalQuestions} onChange={(e)=> setTotalQuestions(e.target.value)} />
        </div>
        <div>
          <Label>Passing score (%)</Label>
          <Input type="number" min="0" max="100" value={passingScore} onChange={(e)=> setPassingScore(e.target.value)} />
        </div>
        <div>
          <Label>Time limit (min)</Label>
          <Input type="number" min="0" value={timeLimitMin} onChange={(e)=> setTimeLimitMin(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e)=> setStatus(e.target.value as AssessmentStatus)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Tags (comma separated)</Label>
          <Input value={tags} onChange={(e)=> setTags(e.target.value)} placeholder="quiz, fundamentals" />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}