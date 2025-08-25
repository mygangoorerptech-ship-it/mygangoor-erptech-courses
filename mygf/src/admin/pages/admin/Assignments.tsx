//mygf/src/pages/admin/Assignments.tsx
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Assignment, AssignmentStatus } from '../../types/assignment'
import { listAssignments, createAssignment, updateAssignment, deleteAssignment, setAssignmentStatus } from '../../api/assignments'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Plus, Pencil, Trash2, Rocket, Archive, Calendar as Cal } from 'lucide-react'
import { Link } from 'react-router-dom'

type Filters = { q: string; status: 'all'|AssignmentStatus; courseId?: string; due?: 'all'|'overdue'|'upcoming' }

export default function ADAssignments(){
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q:'', status:'all', due:'all' })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: Assignment}|null>(null)

  const query = useQuery({ queryKey:['assignments', filters], queryFn: ()=> listAssignments(filters) })

  const createMut = useMutation({ mutationFn: createAssignment, onSuccess: ()=> qc.invalidateQueries({ queryKey:['assignments'] }) })
  const updateMut = useMutation({ mutationFn: ({id, patch}:{id:string, patch: Partial<Assignment>})=> updateAssignment(id, patch), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assignments'] }) })
  const deleteMut = useMutation({ mutationFn: deleteAssignment, onSuccess: ()=> qc.invalidateQueries({ queryKey:['assignments'] }) })
  const statusMut = useMutation({ mutationFn: ({id, status}:{id:string, status:AssignmentStatus})=> setAssignmentStatus(id, status), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assignments'] }) })

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
        <div className="space-y-2">
          <Label>Due filter</Label>
          <Select value={(filters.due||'all')} onChange={(e)=> setFilters(f=> ({...f, due: (e.target.value as Filters['due'])}))}>
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
          </Select>
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
              <th className="text-left font-medium p-3">Type</th>
              <th className="text-left font-medium p-3">Max points</th>
              <th className="text-left font-medium p-3">Due</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-[320px]">Actions</th>
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
                <td className="p-3 uppercase">{a.submissionType}</td>
                <td className="p-3">{a.maxPoints}</td>
                <td className="p-3">
                  {a.dueAt ? (
                    <span className="inline-flex items-center gap-1"><Cal size={14}/> {new Date(a.dueAt).toLocaleString()}</span>
                  ) : '—'}
                </td>
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

    {/* ⬇️ Add this */}
    <Link
      to={`/admin/assignments/${a.id}/submissions`}
      className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
    >
      Submissions
    </Link>
    {/* ⬆️ Add this */}

    <button
      className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
      onClick={()=> setOpen({ mode:'edit', initial: a })}
    >
      <Pencil size={16}/> Edit
    </button>
    <button
      className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
      onClick={()=> { if(confirm('Delete assignment?')) deleteMut.mutate(a.id) }}
    >
      <Trash2 size={16}/> Delete
    </button>
  </div>
</td>

              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={7}>No assignments</td></tr>}
          </tbody>
        </table>
      </div>

      <AssignmentModal
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

function AssignmentModal({ open, mode, initial, onClose, onSubmit }:{
  open:boolean, mode:'create'|'edit', initial?: Assignment,
  onClose:()=>void,
  onSubmit: (payload: Omit<Assignment,'id'|'createdAt'|'updatedAt'>)=> void
}){
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [courseId, setCourseId] = useState(initial?.courseId || '')
  const [courseTitle, setCourseTitle] = useState(initial?.courseTitle || '')
  const [maxPoints, setMaxPoints] = useState(String(initial?.maxPoints ?? 100))
  const [submissionType, setSubmissionType] = useState<Assignment['submissionType']>(initial?.submissionType || 'file')
  const [allowedFileTypes, setAllowedFileTypes] = useState(initial?.allowedFileTypes || 'pdf, zip')
  const [allowMultipleAttempts, setAllowMultipleAttempts] = useState<boolean>(!!initial?.allowMultipleAttempts)
  const [dueAt, setDueAt] = useState<string>(initial?.dueAt ? initial.dueAt.slice(0,16) : '') // HTML datetime-local format
  const [status, setStatus] = useState<AssignmentStatus>(initial?.status || 'draft')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))

  React.useEffect(()=>{
    setTitle(initial?.title || '')
    setDescription(initial?.description || '')
    setCourseId(initial?.courseId || '')
    setCourseTitle(initial?.courseTitle || '')
    setMaxPoints(String(initial?.maxPoints ?? 100))
    setSubmissionType(initial?.submissionType || 'file')
    setAllowedFileTypes(initial?.allowedFileTypes || 'pdf, zip')
    setAllowMultipleAttempts(!!initial?.allowMultipleAttempts)
    setDueAt(initial?.dueAt ? initial.dueAt.slice(0,16) : '')
    setStatus(initial?.status || 'draft')
    setTags((initial?.tags || []).join(', '))
  }, [initial, open])

  const canSubmit = title.trim().length > 1 && parseInt(maxPoints||'0',10) >= 0

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New assignment' : 'Edit assignment'}>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          courseId: courseId.trim() || undefined,
          courseTitle: courseTitle.trim() || undefined,
          maxPoints: parseInt(maxPoints,10),
          submissionType,
          allowedFileTypes: submissionType==='file' ? (allowedFileTypes.trim() || undefined) : undefined,
          allowMultipleAttempts,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          status,
          tags: tags ? tags.split(',').map(s=> s.trim()).filter(Boolean) : undefined
        })
      }}>
        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="Assignment title" />
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
          <Label>Max points</Label>
          <Input type="number" min="0" value={maxPoints} onChange={(e)=> setMaxPoints(e.target.value)} />
        </div>
        <div>
          <Label>Submission type</Label>
          <Select value={submissionType} onChange={(e)=> setSubmissionType(e.target.value as Assignment['submissionType'])}>
            <option value="file">File upload</option>
            <option value="text">Text entry</option>
            <option value="url">URL</option>
          </Select>
        </div>
        {submissionType==='file' && (
          <div className="sm:col-span-2">
            <Label>Allowed file types</Label>
            <Input value={allowedFileTypes} onChange={(e)=> setAllowedFileTypes(e.target.value)} placeholder="pdf, zip, docx" />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowMultipleAttempts} onChange={(e)=> setAllowMultipleAttempts(e.target.checked)} /> Allow multiple attempts
          </label>
        </div>
        <div>
          <Label>Due date & time</Label>
          <Input type="datetime-local" value={dueAt} onChange={(e)=> setDueAt(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e)=> setStatus(e.target.value as AssignmentStatus)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Tags (comma separated)</Label>
          <Input value={tags} onChange={(e)=> setTags(e.target.value)} placeholder="project, fundamentals" />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}