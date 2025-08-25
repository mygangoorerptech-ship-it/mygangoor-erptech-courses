import React, { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Submission, SubmissionStatus } from '../../types/submission'
import { listSubmissions, gradeSubmission, setSubmissionStatus, deleteSubmission, addSubmission, attachSubmissionFile, removeSubmissionFile } from '../../api/submissions'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { blobFromDataURL, fileToDataURL } from '../../utils/file'
import { CheckCircle2, Eye, Trash2, Reply, FileDown, Upload, ChevronLeft } from 'lucide-react'

type Filters = { q: string; status: 'all'|SubmissionStatus; minAttempt?: string; maxAttempt?: string }

export default function ADAssignmentSubmissions(){
  const { id: assignmentId } = useParams()
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q:'', status:'all' })
  const [view, setView] = useState<Submission|null>(null)
  const [grade, setGrade] = useState<Submission|null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const query = useQuery({
    queryKey: ['submissions', assignmentId, filters],
    queryFn: ()=> listSubmissions(assignmentId as string, {
      q: filters.q || undefined,
      status: filters.status === 'all' ? undefined : filters.status,
      minAttempt: filters.minAttempt ? parseInt(filters.minAttempt,10) : undefined,
      maxAttempt: filters.maxAttempt ? parseInt(filters.maxAttempt,10) : undefined,
    }),
    enabled: !!assignmentId
  })

  const rows = query.data ?? []
  const allSelected = useMemo(() => rows.length > 0 && rows.every(r => selected[r.id]), [rows, selected])

  const toggleAll = () => {
    if (allSelected) {
      setSelected({})
    } else {
      const next: Record<string, boolean> = {}
      rows.forEach(r => { next[r.id] = true })
      setSelected(next)
    }
  }

  const gradeMut = useMutation({
    mutationFn: ({id, score, feedback}:{id:string, score:number, feedback?:string})=> gradeSubmission(id, score, feedback, 'You'),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['submissions', assignmentId] })
  })
  const statusMut = useMutation({
    mutationFn: ({id, status}:{id:string, status:SubmissionStatus})=> setSubmissionStatus(id, status),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['submissions', assignmentId] })
  })
  const deleteMut = useMutation({
    mutationFn: deleteSubmission,
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['submissions', assignmentId] })
  })
  const attachMut = useMutation({
    mutationFn: async ({id, file}:{id:string, file:File}) => {
      const dataUrl = await fileToDataURL(file)
      return attachSubmissionFile(id, { id: crypto.randomUUID(), name: file.name, mime: file.type, size: file.size, dataUrl } as any)
    },
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['submissions', assignmentId] })
  })
  const removeFileMut = useMutation({
    mutationFn: ({id, attId}:{id:string, attId:string})=> removeSubmissionFile(id, attId),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['submissions', assignmentId] })
  })

  // mock helper to add a fake submission quickly
  const addFake = useMutation({
    mutationFn: ()=> addSubmission(assignmentId as string, {
      studentId: crypto.randomUUID(),
      studentName: 'Demo Student',
      studentEmail: 'demo@example.com',
      attempt: 1,
      maxPoints: 100,
      textEntry: 'My demo submission.',
    } as any),
    onSuccess: ()=> qc.invalidateQueries({ queryKey:['submissions', assignmentId] })
  })

  const bulkIds = useMemo(()=> Object.keys(selected).filter(id => selected[id]), [selected])

  function exportCSV(){
    const headers = ['Student Name','Email','Attempt','Submitted At','Status','Score','Max Points','Feedback']
    const lines = rows
      .filter(r => selected[r.id]) // only selected
      .map(r => [
        r.studentName,
        r.studentEmail||'',
        r.attempt,
        new Date(r.submittedAt).toLocaleString(),
        r.status,
        (typeof r.score==='number' ? r.score : ''),
        (typeof r.maxPoints==='number' ? r.maxPoints : ''),
        (r.feedback||'').replace(/\n/g,' '),
      ].map(String).map(s => '"' + s.replace(/"/g,'""') + '"').join(','))
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='submissions.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Link to="/admin/assignments" className="text-blue-600 hover:underline inline-flex items-center gap-1"><ChevronLeft size={16}/> Back to assignments</Link>
          <span>•</span>
          <span>Assignment ID: <span className="font-mono">{assignmentId}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={()=> addFake.mutate()} variant="secondary">Add demo submission</Button>
          <Button onClick={()=> exportCSV()}><FileDown size={16}/> Export CSV</Button>
        </div>
      </div>

      <header className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Student name or email..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q: e.target.value}))} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filters.status} onChange={(e)=> setFilters(f=> ({...f, status: e.target.value as Filters['status']}))}>
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
            <option value="returned">Returned</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Min attempt</Label>
          <Input type="number" min="1" value={filters.minAttempt||''} onChange={(e)=> setFilters(f=> ({...f, minAttempt: e.target.value}))} />
        </div>
        <div className="space-y-2">
          <Label>Max attempt</Label>
          <Input type="number" min="1" value={filters.maxAttempt||''} onChange={(e)=> setFilters(f=> ({...f, maxAttempt: e.target.value}))} />
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="text-left font-medium p-3">Student</th>
              <th className="text-left font-medium p-3">Attempt</th>
              <th className="text-left font-medium p-3">Submitted</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3">Score</th>
              <th className="text-left font-medium p-3 w-[360px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-3"><input type="checkbox" checked={!!selected[s.id]} onChange={(e)=> setSelected(prev=> ({...prev, [s.id]: e.target.checked}))} /></td>
                <td className="p-3">
                  <div className="font-medium">{s.studentName}</div>
                  {s.studentEmail && <div className="text-xs text-slate-500">{s.studentEmail}</div>}
                </td>
                <td className="p-3">#{s.attempt}</td>
                <td className="p-3">{new Date(s.submittedAt).toLocaleString()}</td>
                <td className="p-3">
                  <span className={
                    s.status==='graded' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                    s.status==='returned' ? 'text-indigo-700 bg-indigo-50 rounded px-2 py-0.5' :
                    'text-amber-700 bg-amber-50 rounded px-2 py-0.5'
                  }>{s.status}</span>
                </td>
                <td className="p-3">{typeof s.score==='number' ? `${s.score}/${s.maxPoints ?? ''}` : '—'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setView(s)}><Eye size={16}/> View</button>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setGrade(s)}><CheckCircle2 size={16}/> Grade</button>
                    {s.status!=='returned' && <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> statusMut.mutate({ id:s.id, status:'returned' })}><Reply size={16}/> Return</button>}
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> { if(confirm('Delete submission?')) deleteMut.mutate(s.id) }}><Trash2 size={16}/> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={7}>No submissions</td></tr>}
          </tbody>
        </table>
      </div>

      {bulkIds.length > 0 && (
        <div className="flex items-center justify-between border rounded-md p-3 bg-slate-50">
          <div className="text-sm">{bulkIds.length} selected</div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={()=> {
              bulkIds.forEach(id => statusMut.mutate({ id, status:'returned' }))
              setSelected({})
            }}><Reply size={16}/> Mark Returned</Button>
            <Button variant="secondary" onClick={exportCSV}><FileDown size={16}/> Export CSV</Button>
            <Button variant="danger" onClick={()=> {
              if(confirm('Delete selected submissions?')){
                bulkIds.forEach(id => deleteMut.mutate(id))
                setSelected({})
              }
            }}><Trash2 size={16}/> Delete</Button>
          </div>
        </div>
      )}

      <ViewModal open={!!view} sub={view} onClose={()=> setView(null)} onAttach={(file)=> attachMut.mutate({ id: view!.id, file })} onRemove={(attId)=> removeFileMut.mutate({ id: view!.id, attId })} />
      <GradeModal open={!!grade} sub={grade} onClose={()=> setGrade(null)} onSubmit={(score, feedback)=> gradeMut.mutate({ id: grade!.id, score, feedback })} />
    </div>
  )
}

function ViewModal({ open, sub, onClose, onAttach, onRemove }:{ open:boolean, sub: Submission|null, onClose:()=>void, onAttach:(file:File)=>void, onRemove:(attId:string)=>void }){
  if (!sub) return null
  return (
    <Modal open={open} onClose={onClose} title={`Submission by ${sub.studentName}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-xs text-slate-500">Email</span><div>{sub.studentEmail||'—'}</div></div>
          <div><span className="text-xs text-slate-500">Attempt</span><div>#{sub.attempt}</div></div>
          <div><span className="text-xs text-slate-500">Submitted</span><div>{new Date(sub.submittedAt).toLocaleString()}</div></div>
          <div><span className="text-xs text-slate-500">Status</span><div>{sub.status}</div></div>
          <div><span className="text-xs text-slate-500">Score</span><div>{typeof sub.score==='number' ? `${sub.score}/${sub.maxPoints ?? ''}` : '—'}</div></div>
          <div><span className="text-xs text-slate-500">Graded by</span><div>{sub.gradedBy||'—'}</div></div>
        </div>

        {sub.url && <div><span className="text-xs text-slate-500">URL</span><div><a href={sub.url} target="_blank" className="text-blue-600 underline">{sub.url}</a></div></div>}
        {sub.textEntry && <div><span className="text-xs text-slate-500">Text Entry</span><div className="whitespace-pre-wrap border rounded p-2 bg-slate-50">{sub.textEntry}</div></div>}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Files</span>
            <label className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer">
              <Upload size={16}/> Attach
              <input type="file" className="hidden" onChange={(e)=> { const f=e.target.files?.[0]; if(f) onAttach(f) }} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {(sub.files||[]).map(att => (
              <div key={att.id} className="rounded border px-2 py-1 text-xs flex items-center gap-2">
                <span className="truncate max-w-[200px]">{att.name}</span>
                <button className="underline" onClick={()=>{
                  const blob = blobFromDataURL(att.dataUrl)
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href=url; a.download=att.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
                }}>Download</button>
                <button className="text-red-600" onClick={()=> onRemove(att.id)}>✕</button>
              </div>
            ))}
            {(sub.files||[]).length===0 && <div className="text-xs text-slate-500">No files</div>}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

function GradeModal({ open, sub, onClose, onSubmit }:{ open:boolean, sub: Submission|null, onClose:()=>void, onSubmit:(score:number, feedback?:string)=>void }){
  const [score, setScore] = useState<string>(sub?.score != null ? String(sub.score) : '')
  const [feedback, setFeedback] = useState<string>(sub?.feedback || '')

  React.useEffect(()=>{
    setScore(sub?.score != null ? String(sub.score) : '')
    setFeedback(sub?.feedback || '')
  }, [sub, open])

  const canSubmit = score.trim() !== '' && !Number.isNaN(parseInt(score,10))

  if (!sub) return null
  return (
    <Modal open={open} onClose={onClose} title={`Grade: ${sub.studentName}`}>
      <form className="space-y-3" onSubmit={(e)=>{ e.preventDefault(); if(!canSubmit) return; onSubmit(parseInt(score,10), feedback || undefined) }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Score</Label>
            <Input type="number" min="0" value={score} onChange={(e)=> setScore(e.target.value)} />
          </div>
          <div>
            <Label>Max points</Label>
            <Input disabled value={sub.maxPoints ?? ''} />
          </div>
        </div>
        <div>
          <Label>Feedback</Label>
          <textarea className="w-full rounded-md border px-3 py-2" rows={4} value={feedback} onChange={(e)=> setFeedback(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}><CheckCircle2 size={16}/> Save grade</Button>
        </div>
      </form>
    </Modal>
  )
}