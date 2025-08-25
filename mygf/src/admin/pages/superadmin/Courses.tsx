import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Course, CourseFilters, CourseStatus, CourseVisibility } from '../../types/course'
import { listSaCourses, createSaCourse, updateSaCourse, deleteSaCourse, setSaCourseStatus } from '../../api/saCourses'
// import { listOrgs } from '../../api/orgs' // removed
import { listSaUsers } from '../../api/saUsers'
// import type { Organization } from '../../types/org' // removed
import type { SAUser } from '../../types/user'
import { Input, Label, Select } from '../../components/Input'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Rocket, Archive, Pencil, Trash2, /* Building2, */ User, BadgeDollarSign, Plus } from 'lucide-react'

type Filters = { q: string; status: 'all' | CourseStatus; ownerEmail?: string }

export default function SACourses(){
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q:'', status:'all' })
  const [open, setOpen] = useState<{mode:'create'|'edit', initial?: Course}|null>(null)

  // lookups (orgs removed)
  const adminsQ = useQuery({ queryKey:['sa-admins:lookup'], queryFn: ()=> listSaUsers({ role:'admin' } as any) })

  // data
  const query = useQuery({ queryKey:['sa-courses', filters], queryFn: ()=> listSaCourses(filters as CourseFilters) })

  const createMut = useMutation({ mutationFn: createSaCourse, onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-courses'] }) })
  const updateMut = useMutation({ mutationFn: ({id, patch}:{id:string, patch: Partial<Course>})=> updateSaCourse(id, patch), onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-courses'] }) })
  const deleteMut = useMutation({ mutationFn: deleteSaCourse, onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-courses'] }) })
  const statusMut = useMutation({ mutationFn: ({id, status}:{id:string, status:CourseStatus})=> setSaCourseStatus(id, status), onSuccess: ()=> qc.invalidateQueries({ queryKey:['sa-courses'] }) })

  const rows = query.data ?? []
  const admins = (adminsQ.data ?? []) as SAUser[]

  const owners = useMemo(()=> admins.map(a => ({ label: a.name ? `${a.name} (${a.email})` : a.email, value: a.email })), [admins])

  return (
    <div className="space-y-4">
      <header className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2 space-y-2">
          <Label>Search</Label>
          <Input placeholder="Title, owner..." value={filters.q} onChange={(e)=> setFilters(f=> ({...f, q: e.target.value}))} />
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
          <Label>Owner (Admin)</Label>
          <Select value={filters.ownerEmail||''} onChange={(e)=> setFilters(f=> ({...f, ownerEmail: e.target.value || undefined}))}>
            <option value="">Any</option>
            {owners.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="md:col-span-2 flex items-end justify-end">
          <Button onClick={()=> setOpen({ mode: 'create' })}><Plus size={16}/> New</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Course</th>
              {/* Organization column removed */}
              <th className="text-left font-medium p-3">Owner</th>
              <th className="text-left font-medium p-3">Price</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-[360px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{c.title}</div>
                  {(c.slug || c.category) && (
                    <div className="text-xs text-slate-500">
                      {c.slug ? `/${c.slug}` : ''}{c.slug && c.category ? ' • ' : ''}{c.category || ''}
                    </div>
                  )}
                </td>
                {/* Organization cell removed */}
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-500"/>
                    <span>{c.ownerName || c.ownerEmail || '—'}</span>
                  </div>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1"><BadgeDollarSign size={14}/> {typeof c.price==='number' ? c.price.toFixed(2) : '—'}</span>
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
                    {c.status!=='published' && <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> statusMut.mutate({ id:c.id, status:'published' })}><Rocket size={16}/> Publish</button>}
                    {c.status==='published' && <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> statusMut.mutate({ id:c.id, status:'draft' })}><Archive size={16}/> Unpublish</button>}
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> setOpen({ mode:'edit', initial: c })}><Pencil size={16}/> Edit</button>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50 inline-flex items-center gap-1" onClick={()=> { if(confirm('Delete course?')) deleteMut.mutate(c.id) }}><Trash2 size={16}/> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>No courses</td></tr>}
          </tbody>
        </table>
      </div>

      <CourseModal
        open={!!open}
        mode={open?.mode ?? 'create'}
        initial={open?.initial}
        admins={admins}
        onClose={()=> setOpen(null)}
        onSubmit={(payload)=> {
          if (open?.mode==='create') createMut.mutate(payload as any, { onSuccess: ()=> setOpen(null) })
          else if (open?.initial) updateMut.mutate({ id: open.initial.id, patch: payload as any }, { onSuccess: ()=> setOpen(null) })
        }}
      />
    </div>
  )
}

function CourseModal({
  open, mode, initial, admins, onClose, onSubmit
}:{
  open:boolean
  mode:'create'|'edit'
  initial?: Course
  admins: SAUser[]
  onClose:()=>void
  onSubmit:(payload: Omit<Course,'id'|'createdAt'|'updatedAt'>)=> void
}){
  const [title, setTitle] = useState(initial?.title || '')
  const [slug, setSlug] = useState(initial?.slug || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [category, setCategory] = useState(initial?.category || '')
  const [price, setPrice] = useState(String(initial?.price ?? ''))
  const [visibility, setVisibility] = useState<CourseVisibility>(initial?.visibility || 'public')
  const [status, setStatus] = useState<CourseStatus>(initial?.status || 'draft')
  // org removed
  const [ownerEmail, setOwnerEmail] = useState(initial?.ownerEmail || (admins[0]?.email || ''))
  const [tags, setTags] = useState((initial?.tags || []).join(', '))

  React.useEffect(()=>{
    setTitle(initial?.title || '')
    setSlug(initial?.slug || '')
    setDescription(initial?.description || '')
    setCategory(initial?.category || '')
    setPrice(String(initial?.price ?? ''))
    setVisibility(initial?.visibility || 'public')
    setStatus(initial?.status || 'draft')
    setOwnerEmail(initial?.ownerEmail || (admins[0]?.email || ''))
    setTags((initial?.tags || []).join(', '))
  }, [initial, open, admins])

  const canSubmit = title.trim().length>1

  return (
    <Modal open={open} onClose={onClose} title={mode==='create' ? 'New course' : 'Edit course'}>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1" onSubmit={(e)=>{
        e.preventDefault(); if(!canSubmit) return
        onSubmit({
          title: title.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          price: price ? parseFloat(price) : undefined,
          visibility,
          status,
          ownerEmail: ownerEmail || undefined,
          // ownerName auto-enriched on list()
          tags: tags ? tags.split(',').map(s=> s.trim()).filter(Boolean) : undefined
        } as any)
      }}>
        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="Course title" />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={slug} onChange={(e)=> setSlug(e.target.value)} placeholder="react-fundamentals" />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e)=> setCategory(e.target.value)} placeholder="Web" />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Input value={description} onChange={(e)=> setDescription(e.target.value)} placeholder="Optional" />
        </div>
        {/* Organization field removed */}
        <div>
          <Label>Owner (Admin)</Label>
          <Select value={ownerEmail} onChange={(e)=> setOwnerEmail(e.target.value)}>
            {admins.map(a => <option key={a.email} value={a.email}>{a.name ? `${a.name} (${a.email})` : a.email}</option>)}
          </Select>
        </div>
        <div>
          <Label>Price</Label>
          <Input type="number" min="0" step="0.01" value={price} onChange={(e)=> setPrice(e.target.value)} />
        </div>
        <div>
          <Label>Visibility</Label>
          <Select value={visibility} onChange={(e)=> setVisibility(e.target.value as CourseVisibility)}>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e)=> setStatus(e.target.value as CourseStatus)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Tags (comma separated)</Label>
          <Input value={tags} onChange={(e)=> setTags(e.target.value)} placeholder="react, frontend" />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>{mode==='create' ? 'Create' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}
