//src/pages/admin/AssessmentQuestions.tsx
import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AssessmentQuestion, QuestionType, MCQQuestion, MCQOption } from '../../types/assessmentQuestion'
import { listAssessmentQuestions, createAssessmentQuestion, updateAssessmentQuestion, deleteAssessmentQuestion, reorderAssessmentQuestions, attachQuestionFile, removeQuestionAttachment } from '../../api/assessmentQuestions'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { fileToDataURL, blobFromDataURL } from '../../utils/file'
import { GripVertical, Plus, Pencil, Trash2, Upload, Download, Shuffle } from 'lucide-react'

function useDrag(list: AssessmentQuestion[], onReorder:(ids:string[])=>void){
  const [dragId, setDragId] = useState<string|null>(null)
  const handleDragStart = (id:string)=> (e:React.DragEvent)=> { setDragId(id); e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (id:string)=> (e:React.DragEvent)=> { e.preventDefault(); if(dragId===id) return }
  const handleDrop = (id:string)=> (e:React.DragEvent)=> {
    e.preventDefault()
    if (!dragId || dragId===id) return
    const ids = list.map(q=> q.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(id)
    ids.splice(to, 0, ids.splice(from,1)[0])
    onReorder(ids)
    setDragId(null)
  }
  return { handleDragStart, handleDragOver, handleDrop }
}

export default function ADAssessmentQuestions(){
  const { id: assessmentId } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey:['assessment-questions', assessmentId], queryFn: ()=> listAssessmentQuestions(assessmentId as string), enabled: !!assessmentId })
  const reorderMut = useMutation({ mutationFn: (ids:string[])=> reorderAssessmentQuestions(assessmentId as string, ids), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessment-questions', assessmentId] }) })
  const createMut = useMutation({ mutationFn: createAssessmentQuestion, onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessment-questions', assessmentId] }) })
  const updateMut = useMutation({ mutationFn: ({id, patch}:{id:string, patch: Partial<AssessmentQuestion>})=> updateAssessmentQuestion(id, patch), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessment-questions', assessmentId] }) })
  const deleteMut = useMutation({ mutationFn: deleteAssessmentQuestion, onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessment-questions', assessmentId] }) })
  const attachMut = useMutation({ mutationFn: ({id, file}:{id:string, file: File})=> fileToDataURL(file).then(dataUrl => attachQuestionFile(id, { id: crypto.randomUUID(), name: file.name, mime: file.type, size: file.size, dataUrl } as any)), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessment-questions', assessmentId] }) })
  const removeAttachMut = useMutation({ mutationFn: ({id, attId}:{id:string, attId:string})=> removeQuestionAttachment(id, attId), onSuccess: ()=> qc.invalidateQueries({ queryKey:['assessment-questions', assessmentId] }) })

  const rows: AssessmentQuestion[] = (q.data as AssessmentQuestion[]) ?? []
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: AssessmentQuestion}|null>(null)

  const { handleDragStart, handleDragOver, handleDrop } = useDrag(rows, (ids)=> reorderMut.mutate(ids))
  type AttachmentLite = { id: string; name: string; dataUrl: string } // minimal fields we use here
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Link to="/admin/assessments" className="text-blue-600 hover:underline">← Back to assessments</Link>
        </div>
        <Button onClick={()=> setOpen({ mode:'create' })}><Plus size={16}/> Add question</Button>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 w-8"></th>
              <th className="text-left p-2">Prompt</th>
              <th className="text-left p-2">Type</th>
              <th className="text-right p-2">Points</th>
              <th className="text-left p-2">Attachments</th>
              <th className="text-left p-2 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q: AssessmentQuestion) => (
              <tr key={q.id} className="border-b" draggable onDragStart={handleDragStart(q.id)} onDragOver={handleDragOver(q.id)} onDrop={handleDrop(q.id)}>
                <td className="p-2 text-slate-400 cursor-grab align-top"><GripVertical size={16}/></td>
                <td className="p-2 align-top">
                  <div className="font-medium">{q.prompt}</div>
                  {q.type==='mcq' && (
                    <div className="text-xs text-slate-600 flex items-center gap-2 mt-1">
                      {(q as any).shuffleOptions ? <span className="inline-flex items-center gap-1"><Shuffle size={14}/> shuffled</span> : null}
                      <span>{(q as MCQQuestion).options.filter((o: MCQOption)=>o.correct).length} correct</span>
                      <span>• {(q as MCQQuestion).options.length} options</span>
                    </div>
                  )}
                </td>
                <td className="p-2 align-top uppercase">{q.type}</td>
                <td className="p-2 text-right align-top">{q.points}</td>
                <td className="p-2 align-top">
                  <div className="flex flex-wrap gap-2">

{(q.attachments || []).map((att: AttachmentLite) => (
                      <div key={att.id} className="rounded border px-2 py-1 text-xs flex items-center gap-2">
                        <span className="truncate max-w-[160px]">{att.name}</span>
                        <button className="underline" onClick={()=>{
                          const blob = blobFromDataURL(att.dataUrl)
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a'); a.href=url; a.download=att.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
                        }}><Download size={12}/></button>
                        <button className="text-red-600" onClick={()=> removeAttachMut.mutate({ id: q.id, attId: att.id })}>✕</button>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-2 align-top">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer">
                      <Upload size={16}/> Attach PDF
                      <input type="file" accept="application/pdf" className="hidden" onChange={(e)=> { const f=e.target.files?.[0]; if(f) attachMut.mutate({ id: q.id, file: f }) }}/>
                    </label>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setOpen({ mode:'edit', initial: q })}><Pencil size={16}/> Edit</button>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> { if(confirm('Delete question?')) deleteMut.mutate(q.id) }}><Trash2 size={16}/> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={6}>No questions yet</td></tr>}
          </tbody>
        </table>
      </div>

      <QuestionModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        assessmentId={assessmentId as string}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') createMut.mutate(payload as any, { onSuccess: ()=> setOpen(null) })
          else if (open?.initial) updateMut.mutate({ id: open.initial.id, patch: payload as any }, { onSuccess: ()=> setOpen(null) })
        }}
      />
    </div>
  )
}

function QuestionModal({ open, mode, initial, assessmentId, onClose, onSubmit }:{
  open:boolean, mode:'create'|'edit', initial?: AssessmentQuestion, assessmentId:string,
  onClose:()=>void,
  onSubmit:(payload: Partial<AssessmentQuestion> & { assessmentId: string })=> void
}){
  const [type, setType] = useState<QuestionType>(initial?.type || 'mcq')
  const [prompt, setPrompt] = useState(initial?.prompt || '')
  const [points, setPoints] = useState(String(initial?.points ?? 1))
  const [shuffle, setShuffle] = useState((initial as any)?.shuffleOptions ?? true)
  const [multiple, setMultiple] = useState((initial as any)?.multipleCorrect ?? false)
  const [answerTF, setAnswerTF] = useState((initial as any)?.answer ?? false)
  const [options, setOptions] = useState<MCQOption[]>(
    (initial as MCQQuestion | undefined)?.options ?? [
      { id: crypto.randomUUID(), text: '', correct: true },
      { id: crypto.randomUUID(), text: '', correct: false },
    ]
  )
  const [instructions, setInstructions] = useState((initial as any)?.instructions || '')

  React.useEffect(()=>{
    setType(initial?.type || 'mcq')
    setPrompt(initial?.prompt || '')
    setPoints(String(initial?.points ?? 1))
    setShuffle((initial as any)?.shuffleOptions ?? true)
    setMultiple((initial as any)?.multipleCorrect ?? false)
    setAnswerTF((initial as any)?.answer ?? false)
    setOptions(
      (initial as MCQQuestion | undefined)?.options ?? [
        { id: crypto.randomUUID(), text: '', correct: true },
        { id: crypto.randomUUID(), text: '', correct: false },
      ]
    )
    setInstructions((initial as any)?.instructions || '')
  }, [initial, open])

  const canSubmit =
    prompt.trim().length > 0 &&
    parseInt(points || '0',10) >= 0 &&
    (type !== 'mcq' || options.every((o: MCQOption)=> o.text.trim().length>0))

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'Add question' : 'Edit question'}>
      <form className="space-y-3" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return
        const payload: any = { assessmentId, type, prompt: prompt.trim(), points: parseInt(points,10) }
        if (type==='mcq') payload.options = options
        if (type==='mcq') payload.shuffleOptions = !!shuffle
        if (type==='mcq') payload.multipleCorrect = !!multiple
        if (type==='true_false') payload.answer = !!answerTF
        if (type==='assignment') payload.instructions = instructions.trim() || undefined
        onSubmit(payload)
      }}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onChange={(e)=> setType(e.target.value as QuestionType)}>
              <option value="mcq">MCQ</option>
              <option value="true_false">True / False</option>
              <option value="assignment">Assignment (PDF)</option>
            </Select>
          </div>
          <div>
            <Label>Points</Label>
            <Input type="number" min="0" value={points} onChange={(e)=> setPoints(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Prompt</Label>
          <Input value={prompt} onChange={(e)=> setPrompt(e.target.value)} placeholder="Enter the question text"/>
        </div>

        {type==='mcq' && (
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={shuffle} onChange={(e)=> setShuffle(e.target.checked)} /> Shuffle options</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={multiple} onChange={(e)=> setMultiple(e.target.checked)} /> Multiple correct</label>
            </div>
            <div className="rounded-lg border divide-y">
              {options.map((opt: MCQOption, idx: number)=> (
                <div key={opt.id} className="p-2 flex items-center gap-2">
                  <input type={multiple ? 'checkbox' : 'radio'} name="correct" checked={opt.correct} onChange={(e)=> {
                    const checked = e.currentTarget.checked
                    setOptions((prev: MCQOption[])=> prev.map((o: MCQOption): MCQOption =>
                      o.id===opt.id
                        ? { ...o, correct: multiple ? checked : true }
                        : { ...o, correct: multiple ? o.correct : false }
                    ))
                  }} />
                  <Input className="flex-1" value={opt.text} onChange={(e)=> setOptions((prev: MCQOption[])=> prev.map((o: MCQOption): MCQOption => o.id===opt.id ? { ...o, text: e.target.value } : o))} placeholder={`Option ${idx+1}`} />
                  <button type="button" className="text-sm text-red-600 px-2 py-1" onClick={()=> setOptions((prev: MCQOption[])=> prev.filter((o: MCQOption)=> o.id!==opt.id))}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={()=> setOptions((prev: MCQOption[])=> [...prev, { id: crypto.randomUUID(), text: '', correct: false }])}>Add option</button>
          </div>
        )}

        {type==='true_false' && (
          <div className="space-y-2">
            <Label>Answer</Label>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="tf" checked={answerTF===true} onChange={()=> setAnswerTF(true)} /> True</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="tf" checked={answerTF===false} onChange={()=> setAnswerTF(false)} /> False</label>
            </div>
          </div>
        )}

        {type==='assignment' && (
          <div className="space-y-2">
            <Label>Instructions (shown to students)</Label>
            <Input value={instructions} onChange={(e)=> setInstructions(e.target.value)} placeholder="e.g., Read the PDF and implement the API endpoints." />
            <div className="text-xs text-slate-600">You can attach the assignment PDF after saving the question.</div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>{mode==='create' ? 'Add' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}