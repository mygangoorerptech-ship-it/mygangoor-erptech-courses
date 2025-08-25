//mygf/src/pages/admin/Certificates.tsx
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Certificate, CertificateStatus, CertificateTemplate, CertificateContent } from '../../types/certificate'
import {
  listCertificates, createCertificate, updateCertificate, deleteCertificate, setCertificateStatus,
  listCertificateTemplates, addDemoCertificate
} from '../../api/certificates'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Rocket, Archive, Pencil, Trash2, Image as Img, Eye, LayoutTemplate, Plus } from 'lucide-react'
import { fileToDataURL } from '../../utils/file'

type Filters = { q: string; status: 'all'|CertificateStatus; templateId?: string }

export default function ADCertificates(){
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q:'', status:'all' })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: Certificate}|null>(null)
  const [preview, setPreview] = useState<Certificate|null>(null)

  const templatesQ = useQuery({ queryKey:['certificate-templates'], queryFn: ()=> listCertificateTemplates() })
  const certsQ = useQuery({ queryKey:['certificates', filters], queryFn: ()=> listCertificates(filters) })

  const createMut = useMutation({ mutationFn: createCertificate, onSuccess: ()=> qc.invalidateQueries({ queryKey:['certificates'] }) })
  const updateMut = useMutation({ mutationFn: ({id, patch}:{id:string, patch: Partial<Certificate>})=> updateCertificate(id, patch), onSuccess: ()=> qc.invalidateQueries({ queryKey:['certificates'] }) })
  const deleteMut = useMutation({ mutationFn: deleteCertificate, onSuccess: ()=> qc.invalidateQueries({ queryKey:['certificates'] }) })
  const statusMut = useMutation({ mutationFn: ({id, status}:{id:string, status:CertificateStatus})=> setCertificateStatus(id, status), onSuccess: ()=> qc.invalidateQueries({ queryKey:['certificates'] }) })
  const demoMut = useMutation({ mutationFn: addDemoCertificate, onSuccess: ()=> qc.invalidateQueries({ queryKey:['certificates'] }) })

  const rows = certsQ.data ?? []
  const templates = templatesQ.data ?? []
  const templateById = useMemo(()=> Object.fromEntries(templates.map(t=> [t.id, t])), [templates])

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Title, description..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q: e.target.value}))} />
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
          <Label>Template</Label>
          <Select value={filters.templateId||''} onChange={(e)=> setFilters(f=> ({...f, templateId: e.target.value || undefined}))}>
            <option value="">Any</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div className="flex items-end justify-end gap-2">
          {templates.length>0 && (
            <Button variant="secondary" onClick={()=> demoMut.mutate(templates[0].id)}>
              <Img size={16}/> Add demo
            </Button>
          )}
          <Button onClick={()=> setOpen({ mode: 'create' })}><Plus size={16}/> New</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Title</th>
              <th className="text-left font-medium p-3">Template</th>
              <th className="text-left font-medium p-3">Preview</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-[360px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{c.title}</div>
                  {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-slate-500"/>
                    <span>{templateById[c.templateId]?.name || '—'}</span>
                  </div>
                </td>
                <td className="p-3">
                  {c.demoImageDataUrl ? (
                    <img
                      src={c.demoImageDataUrl}
                      alt="preview"
                      className="h-12 w-auto rounded border cursor-pointer"
                      onClick={()=> setPreview(c)}
                    />
                  ) : (
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                      onClick={()=> setPreview(c)}><Eye size={16}/> View</button>
                  )}
                </td>
                <td className="p-3">
                  <span className={
                    c.status==='published' ? 'text-green-700 bg-green-50 rounded px-2 py-0.5' :
                    c.status==='draft' ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5' :
                    'text-slate-700 bg-slate-100 rounded px-2 py-0.5'
                  }>{c.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.status!=='published' && (
                      <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                        onClick={()=> statusMut.mutate({ id:c.id, status:'published' })}>
                        <Rocket size={16}/> Publish
                      </button>
                    )}
                    {c.status==='published' && (
                      <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                        onClick={()=> statusMut.mutate({ id:c.id, status:'draft' })}>
                        <Archive size={16}/> Unpublish
                      </button>
                    )}
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                      onClick={()=> setOpen({ mode:'edit', initial: c })}>
                      <Pencil size={16}/> Edit
                    </button>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1"
                      onClick={()=> { if(confirm('Delete certificate?')) deleteMut.mutate(c.id) }}>
                      <Trash2 size={16}/> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>No certificates</td></tr>}
          </tbody>
        </table>
      </div>

      <CertModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        templates={templates}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') createMut.mutate(payload as any, { onSuccess: ()=> setOpen(null) })
          else if (open?.initial) updateMut.mutate({ id: open.initial.id, patch: payload as any }, { onSuccess: ()=> setOpen(null) })
        }}
      />

      <PreviewModal open={!!preview} cert={preview} tpl={preview ? templateById[preview.templateId] : undefined} onClose={()=> setPreview(null)} />
    </div>
  )
}

function CertModal({
  open, mode, initial, templates, onClose, onSubmit
}:{
  open:boolean
  mode:'create'|'edit'
  initial?: Certificate
  templates: CertificateTemplate[]
  onClose:()=>void
  onSubmit:(payload: Omit<Certificate,'id'|'createdAt'|'updatedAt'>)=> void
}){
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [templateId, setTemplateId] = useState(initial?.templateId || (templates[0]?.id || ''))
  const [content, setContent] = useState<CertificateContent>(initial?.content || {
    titleText: 'Certificate of Completion',
    subtitleText: 'Presented to {student_name}',
    bodyText: 'For completing {course_title} on {date}',
    issuerName: 'Your Academy',
    signatureName: 'Instructor',
    dateFormat: 'YYYY-MM-DD',
  })
  const [demoImage, setDemoImage] = useState<string|undefined>(initial?.demoImageDataUrl)
  const [status, setStatus] = useState<CertificateStatus>(initial?.status || 'draft')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))

  React.useEffect(()=>{
    setTitle(initial?.title || '')
    setDescription(initial?.description || '')
    setTemplateId(initial?.templateId || (templates[0]?.id || ''))
    setContent(initial?.content || {
      titleText: 'Certificate of Completion',
      subtitleText: 'Presented to {student_name}',
      bodyText: 'For completing {course_title} on {date}',
      issuerName: 'Your Academy',
      signatureName: 'Instructor',
      dateFormat: 'YYYY-MM-DD',
    })
    setDemoImage(initial?.demoImageDataUrl)
    setStatus(initial?.status || 'draft')
    setTags((initial?.tags || []).join(', '))
  }, [initial, open, templates])

  // When template changes, if creating, load its defaults to help user
  React.useEffect(()=>{
    if (mode==='create'){
      const tpl = templates.find(t => t.id === templateId)
      if (tpl?.defaults){
        setContent(prev => ({ ...prev, ...tpl.defaults }))
      }
    }
  }, [templateId])

  const canSubmit = title.trim().length > 1 && !!templateId

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New certificate' : 'Edit certificate'}>
      <form className="space-y-4 max-h-[70vh] overflow-y-auto pr-1" onSubmit={async (e)=>{
        e.preventDefault(); if(!canSubmit) return
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          templateId,
          content,
          demoImageDataUrl: demoImage,
          status,
          tags: tags ? tags.split(',').map(s=> s.trim()).filter(Boolean) : undefined
        } as any)
      }}>
        {/* Template picker */}
        <div>
          <Label>Choose a design</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {templates.map(t => (
              <button key={t.id} type="button"
                onClick={()=> setTemplateId(t.id)}
                className={`rounded-lg border p-2 text-left hover:bg-slate-50 ${templateId===t.id ? 'ring-2 ring-blue-500' : ''}`}>
                <img src={t.previewDataUrl} alt={t.name} className="w-full h-28 object-cover rounded-md border"/>
                <div className="mt-2 text-sm font-medium">{t.name}</div>
              </button>
            ))}
            {templates.length===0 && <div className="text-sm text-slate-500">No templates found</div>}
          </div>
        </div>

        {/* Content editor */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="Internal title" />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e)=> setDescription(e.target.value)} placeholder="Optional" />
          </div>

          <div className="sm:col-span-2">
            <div className="text-xs text-slate-600 mb-1">
              Use placeholders: <code>{'{student_name}'}</code>, <code>{'{course_title}'}</code>, <code>{'{date}'}</code>
            </div>
          </div>

          <div>
            <Label>Heading</Label>
            <Input value={content.titleText} onChange={(e)=> setContent(prev=> ({...prev, titleText: e.target.value}))} />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input value={content.subtitleText||''} onChange={(e)=> setContent(prev=> ({...prev, subtitleText: e.target.value}))} />
          </div>
          <div className="sm:col-span-2">
            <Label>Body</Label>
            <Input value={content.bodyText||''} onChange={(e)=> setContent(prev=> ({...prev, bodyText: e.target.value}))} />
          </div>
          <div>
            <Label>Issuer name</Label>
            <Input value={content.issuerName||''} onChange={(e)=> setContent(prev=> ({...prev, issuerName: e.target.value}))} />
          </div>
          <div>
            <Label>Signature name</Label>
            <Input value={content.signatureName||''} onChange={(e)=> setContent(prev=> ({...prev, signatureName: e.target.value}))} />
          </div>
          <div>
            <Label>Date format (display)</Label>
            <Input value={content.dateFormat||''} onChange={(e)=> setContent(prev=> ({...prev, dateFormat: e.target.value}))} placeholder="YYYY-MM-DD" />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e)=> setStatus(e.target.value as CertificateStatus)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Tags (comma separated)</Label>
            <Input value={tags} onChange={(e)=> setTags(e.target.value)} placeholder="certificate, course" />
          </div>
        </div>

        {/* Demo image */}
        <div className="space-y-2">
          <Label>Demo certificate image (optional)</Label>
          <div className="flex items-center gap-3">
            <label className="px-3 py-2 rounded-md border cursor-pointer hover:bg-slate-50 inline-flex items-center gap-2">
              <Img size={16}/> Upload image
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e)=> {
                  const f = e.target.files?.[0]; if(!f) return
                  const dataUrl = await fileToDataURL(f)
                  setDemoImage(dataUrl)
                }}/>
            </label>
            {demoImage && <img src={demoImage} className="h-16 rounded border" alt="demo"/>}
            {demoImage && (
              <button type="button" className="text-sm text-red-600 underline" onClick={()=> setDemoImage(undefined)}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>{mode==='create' ? 'Create' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function PreviewModal({ open, cert, tpl, onClose }:{
  open:boolean, cert: Certificate|null, tpl?: CertificateTemplate, onClose:()=>void
}){
  if (!cert) return null
  const sample = {
    student_name: 'John Doe',
    course_title: 'React Fundamentals',
    date: new Date().toLocaleDateString(),
  }
const replaceVars = (s?: string) => {
  if (!s) return ''
  return s
    .split('{student_name}').join(sample.student_name)
    .split('{course_title}').join(sample.course_title)
    .split('{date}').join(sample.date)
}

  return (
    <Modal open={open} onClose={onClose} title="Certificate preview">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="text-sm text-slate-600">Template: <span className="font-medium">{tpl?.name || '—'}</span></div>
          <img
            src={cert.demoImageDataUrl || tpl?.previewDataUrl}
            alt="preview"
            className="w-full h-auto rounded border"
          />
        </div>
        <div className="space-y-2">
          <div className="text-xs text-slate-500">Rendered text (with placeholders):</div>
          <div className="rounded-md border p-3 bg-slate-50 text-sm space-y-1">
            <div><span className="text-slate-500">Heading:</span> {replaceVars(cert.content.titleText)}</div>
            {cert.content.subtitleText && <div><span className="text-slate-500">Subtitle:</span> {replaceVars(cert.content.subtitleText)}</div>}
            {cert.content.bodyText && <div><span className="text-slate-500">Body:</span> {replaceVars(cert.content.bodyText)}</div>}
            {cert.content.issuerName && <div><span className="text-slate-500">Issuer:</span> {replaceVars(cert.content.issuerName)}</div>}
            {cert.content.signatureName && <div><span className="text-slate-500">Signature:</span> {replaceVars(cert.content.signatureName)}</div>}
          </div>
          <div className="text-xs text-slate-600">
            Note: On the student side, <code>{'{student_name}'}</code> and <code>{'{date}'}</code> are filled automatically upon successful course completion.
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
