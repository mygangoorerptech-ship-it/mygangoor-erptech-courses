import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Module, Lesson, ContentType } from '../../types/curriculum'
import { listModules, listLessons, createModule, updateModule, deleteModule, reorderModules, createLesson, updateLesson, deleteLesson, reorderLessons } from '../../api/curriculum'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Input, Label, Select } from '../../components/Input'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'

export default function Curriculum(){
  const qc = useQueryClient()
  const [selected, setSelected] = React.useState<string|null>(null)

  const modulesQ = useQuery({ queryKey:['modules'], queryFn: listModules })
  const selectedId = selected ?? modulesQ.data?.[0]?.id ?? null
  const lessonsQ = useQuery({ queryKey:['lessons', selectedId], queryFn: ()=> selectedId ? listLessons(selectedId) : Promise.resolve([] as Lesson[]), enabled: !!selectedId })

  // mutations
  const createMod = useMutation({ mutationFn: createModule, onSuccess: ()=> qc.invalidateQueries({queryKey:['modules']}) })
  const updateMod = useMutation({ mutationFn: ({id,patch}:{id:string,patch:Partial<Module>})=> updateModule(id, patch), onSuccess: ()=> qc.invalidateQueries({queryKey:['modules']}) })
  const deleteMod = useMutation({ mutationFn: deleteModule, onSuccess: ()=> { qc.invalidateQueries({queryKey:['modules']}); qc.invalidateQueries({queryKey:['lessons']}) } })
  const reorderMods = useMutation({ mutationFn: reorderModules, onSuccess: ()=> qc.invalidateQueries({queryKey:['modules']}) })

  const createLes = useMutation({ mutationFn: createLesson, onSuccess: ()=> qc.invalidateQueries({queryKey:['lessons']}) })
  const updateLes = useMutation({ mutationFn: ({id,patch}:{id:string,patch:Partial<Lesson>})=> updateLesson(id, patch), onSuccess: ()=> qc.invalidateQueries({queryKey:['lessons']}) })
  const deleteLes = useMutation({ mutationFn: deleteLesson, onSuccess: ()=> qc.invalidateQueries({queryKey:['lessons']}) })
  const reorderLes = useMutation({ mutationFn: ({moduleId, ids}:{moduleId:string, ids:string[]})=> reorderLessons(moduleId, ids), onSuccess: ()=> qc.invalidateQueries({queryKey:['lessons']}) })

  // Create/Edit state
  const [openMod, setOpenMod] = React.useState<{mode:'create'|'edit', mod?: Module}|null>(null)
  const [openLes, setOpenLes] = React.useState<{mode:'create'|'edit', les?: Lesson}|null>(null)

  // DnD state
  const draggingModId = React.useRef<string|null>(null)
  const draggingLesId = React.useRef<string|null>(null)

  const modules = modulesQ.data ?? []
  const lessons = lessonsQ.data ?? []

  // Handlers: DnD for modules
  const onModDragStart = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    draggingModId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }
  const onModDragOver = (e: React.DragEvent<HTMLLIElement>) => { e.preventDefault() }
  const onModDrop = (e: React.DragEvent<HTMLLIElement>, overId: string) => {
    e.preventDefault()
    const from = modules.findIndex(m=> m.id === draggingModId.current)
    const to = modules.findIndex(m=> m.id === overId)
    if (from === -1 || to === -1 || from === to) return
    const ids = modules.map(m=>m.id)
    const [moved] = ids.splice(from,1)
    ids.splice(to,0,moved)
    reorderMods.mutate(ids)
  }

  // Handlers: DnD for lessons
  const onLesDragStart = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    draggingLesId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }
  const onLesDragOver = (e: React.DragEvent<HTMLLIElement>) => { e.preventDefault() }
  const onLesDrop = (e: React.DragEvent<HTMLLIElement>, overId: string) => {
    e.preventDefault()
    if (!selectedId) return
    const from = lessons.findIndex(l=> l.id === draggingLesId.current)
    const to = lessons.findIndex(l=> l.id === overId)
    if (from === -1 || to === -1 || from === to) return
    const ids = lessons.map(l=>l.id)
    const [moved] = ids.splice(from,1)
    ids.splice(to,0,moved)
    reorderLes.mutate({ moduleId: selectedId, ids })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[20rem,1fr] gap-6">
      {/* Modules column */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between p-3 border-b">
          <h2 className="font-semibold">Modules</h2>
          <Button onClick={()=> setOpenMod({mode:'create'})}><Plus size={16}/> New</Button>
        </div>
        <ul>
          {modules.map(m => (
            <li key={m.id}
                className={"flex items-center gap-2 px-3 py-2 border-b cursor-move " + (selectedId===m.id ? "bg-slate-50" : "")}
                draggable
                onDragStart={(e)=> onModDragStart(e, m.id)}
                onDragOver={onModDragOver}
                onDrop={(e)=> onModDrop(e, m.id)}
                onClick={()=> setSelected(m.id)}>
              <GripVertical size={16} className="text-slate-400" />
              <div className="flex-1">
                <div className="font-medium">{m.title}</div>
                {m.description && <div className="text-xs text-slate-500">{m.description}</div>}
              </div>
              <button className="px-2 py-1 rounded border hover:bg-slate-50" onClick={(e)=>{ e.stopPropagation(); setOpenMod({mode:'edit', mod:m}) }}><Pencil size={16}/></button>
              <button className="px-2 py-1 rounded border hover:bg-slate-50" onClick={(e)=>{ e.stopPropagation(); if(confirm('Delete module and all its lessons?')) deleteMod.mutate(m.id) }}><Trash2 size={16}/></button>
            </li>
          ))}
          {modules.length===0 && <li className="p-4 text-sm text-slate-500">No modules yet.</li>}
        </ul>
      </div>

      {/* Lessons column */}
      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Lessons</h2>
            {selectedId && <span className="text-xs text-slate-500">in “{modules.find(m=>m.id===selectedId)?.title}”</span>}
          </div>
          <Button onClick={()=> selectedId && setOpenLes({mode:'create'})} disabled={!selectedId}><Plus size={16}/> New</Button>
        </div>
        <ul>
          {lessons.map(l => (
            <li key={l.id}
                className="flex items-center gap-2 px-3 py-2 border-b cursor-move"
                draggable
                onDragStart={(e)=> onLesDragStart(e, l.id)}
                onDragOver={onLesDragOver}
                onDrop={(e)=> onLesDrop(e, l.id)}>
              <GripVertical size={16} className="text-slate-400" />
              <div className="flex-1">
                <div className="font-medium">{l.title}</div>
                <div className="text-xs text-slate-500">
                  {l.contentType} • {l.durationMin ?? '—'} min
                  {l.preview ? ' • Preview' : ''}
                  {l.downloadable ? ' • Download' : ''}
                  {(l.releaseAt || l.releaseAfterDays!==undefined) ? ' • Drip' : ''}
                </div>
              </div>
              <button className="px-2 py-1 rounded border hover:bg-slate-50" onClick={()=> setOpenLes({mode:'edit', les: l})}><Pencil size={16}/></button>
              <button className="px-2 py-1 rounded border hover:bg-slate-50" onClick={()=> { if(confirm('Delete lesson?')) deleteLes.mutate(l.id) }}><Trash2 size={16}/></button>
            </li>
          ))}
          {lessons.length===0 && <li className="p-4 text-sm text-slate-500">No lessons in this module.</li>}
        </ul>
      </div>

      {/* Modals */}
      <ModuleModal
        open={!!openMod}
        mode={openMod?.mode ?? 'create'}
        initial={openMod?.mod}
        onClose={()=> setOpenMod(null)}
        onSubmit={(payload)=> openMod?.mode==='create' ? createMod.mutate(payload, { onSuccess: (m)=> setSelected(m.id) }) : openMod?.mod && updateMod.mutate({ id: openMod.mod.id, patch: payload })}
      />
      <LessonModal
        open={!!openLes}
        mode={openLes?.mode ?? 'create'}
        initial={openLes?.les}
        moduleId={selectedId ?? undefined}
        onClose={()=> setOpenLes(null)}
        onSubmit={(payload)=> {
          if (openLes?.mode === 'create') { if (!selectedId) return; createLes.mutate({ ...payload, moduleId: selectedId }) }
          else if (openLes?.les) { updateLes.mutate({ id: openLes.les.id, patch: payload }) }
        }}
      />
    </div>
  )
}

function ModuleModal({ open, onClose, mode, initial, onSubmit }:{ 
  open:boolean, onClose:()=>void, mode:'create'|'edit', initial?: Module,
  onSubmit:(payload: Omit<Module,'id'|'order'>)=>void
}){
  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [desc, setDesc] = React.useState(initial?.description ?? '')

  React.useEffect(()=>{
    setTitle(initial?.title ?? ''); setDesc(initial?.description ?? '')
  }, [initial, open])

  const canSubmit = title.trim().length > 1

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New module' : 'Edit module'}>
      <form className="space-y-3" onSubmit={(e)=>{ e.preventDefault(); if(!canSubmit) return; onSubmit({ title: title.trim(), description: desc.trim() || undefined }) }}>
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="Module title" />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={desc} onChange={(e)=> setDesc(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

function LessonModal({ open, onClose, mode, initial, moduleId, onSubmit }:{ 
  open:boolean, onClose:()=>void, mode:'create'|'edit', initial?: Lesson, moduleId?: string,
  onSubmit:(payload: Omit<Lesson,'id'|'order'|'moduleId'> & { moduleId?: string })=>void
}){
  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [duration, setDuration] = React.useState(initial?.durationMin ? String(initial.durationMin) : '10')
  const [contentType, setContentType] = React.useState<ContentType>(initial?.contentType ?? 'video')
  const [preview, setPreview] = React.useState<boolean>(!!initial?.preview)
  const [downloadable, setDownloadable] = React.useState<boolean>(!!initial?.downloadable)
  const [releaseAt, setReleaseAt] = React.useState<string>(initial?.releaseAt ? initial.releaseAt.slice(0,16) : '')
  const [releaseAfterDays, setReleaseAfterDays] = React.useState<string>(initial?.releaseAfterDays !== undefined ? String(initial.releaseAfterDays) : '')

  React.useEffect(()=>{
    setTitle(initial?.title ?? '')
    setDuration(initial?.durationMin ? String(initial.durationMin) : '10')
    setContentType(initial?.contentType ?? 'video')
    setPreview(!!initial?.preview)
    setDownloadable(!!initial?.downloadable)
    setReleaseAt(initial?.releaseAt ? initial.releaseAt.slice(0,16) : '')
    setReleaseAfterDays(initial?.releaseAfterDays !== undefined ? String(initial.releaseAfterDays) : '')
  }, [initial, open])

  const canSubmit = title.trim().length > 1 && (!!moduleId || !!initial)

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New lesson' : 'Edit lesson'}>
      <form className="space-y-3" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return;
        onSubmit({
          moduleId,
          title: title.trim(),
          durationMin: duration ? parseInt(duration,10) : undefined,
          contentType,
          preview,
          downloadable,
          releaseAt: releaseAt ? new Date(releaseAt).toISOString() : undefined,
          releaseAfterDays: releaseAfterDays ? parseInt(releaseAfterDays,10) : undefined,
        })
      }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Title</Label><Input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="Lesson title" /></div>
          <div><Label>Duration (min)</Label><Input type="number" min="0" value={duration} onChange={(e)=> setDuration(e.target.value)} /></div>
          <div>
            <Label>Content type</Label>
            <Select value={contentType} onChange={(e)=> setContentType(e.target.value as ContentType)}>
              <option value="video">Video</option>
              <option value="text">Text</option>
              <option value="pdf">PDF</option>
              <option value="audio">Audio</option>
              <option value="quiz">Quiz</option>
              <option value="link">Link</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="preview" type="checkbox" checked={preview} onChange={(e)=> setPreview(e.target.checked)} />
            <Label>Preview</Label>
            <input id="download" type="checkbox" className="ml-4" checked={downloadable} onChange={(e)=> setDownloadable(e.target.checked)} />
            <Label>Downloadable</Label>
          </div>
          <div>
            <Label>Release at (date & time)</Label>
            <Input type="datetime-local" value={releaseAt} onChange={(e)=> setReleaseAt(e.target.value)} />
          </div>
          <div>
            <Label>Or release after N days</Label>
            <Input type="number" min="0" value={releaseAfterDays} onChange={(e)=> setReleaseAfterDays(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}