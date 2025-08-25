// superadmin-admin-dashboard/src/pages/admin/Courses.tsx
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCourses, createCourse, updateCourse, deleteCourse } from '../../api/courses'
import type { Course, CourseStatus } from '../../types/course' // ⬅️ removed Visibility import
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Input, Label, Select } from '../../components/Input'
import { Edit, Plus, Trash2 } from 'lucide-react'

type Filters = { q: string; status: 'all' | CourseStatus }

export default function Courses(){
  const [filters,setFilters] = useState<Filters>({ q:'', status:'all' })
  const [openCreate,setOpenCreate] = useState(false)
  const [editTarget,setEditTarget] = useState<Course|null>(null)
  const [deleteTarget,setDeleteTarget] = useState<Course|null>(null)

  const qc = useQueryClient()
  const query = useQuery({
    queryKey:['courses',filters],
    queryFn:()=>fetchCourses({ q:filters.q||undefined, status:filters.status })
  })
  const createMut = useMutation({
    mutationFn: createCourse,
    onSuccess:()=> qc.invalidateQueries({queryKey:['courses']})
  })
  const updateMut = useMutation({
    mutationFn: ({id,patch}:{id:string,patch:Partial<Omit<Course,'id'>>}) => updateCourse(id,patch),
    onSuccess:()=> qc.invalidateQueries({queryKey:['courses']})
  })
  const deleteMut = useMutation({
    mutationFn: (id:string)=> deleteCourse(id),
    onSuccess:()=> qc.invalidateQueries({queryKey:['courses']})
  })

  const rows = query.data ?? []

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 w-full sm:max-w-md">
          <Label>Search</Label>
          <Input
            placeholder="Search by title, slug, category..."
            value={filters.q}
            onChange={e=>setFilters(f=>({...f,q:e.target.value}))}
          />
          <div className="flex items-center gap-2">
            <Label>Status</Label>
            <Select
              value={filters.status}
              onChange={e=>setFilters(f=>({...f,status:e.target.value as Filters['status']}))}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={()=>setOpenCreate(true)}><Plus size={16}/> New Course</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Title</th>
              <th className="text-left font-medium p-3">Category</th>
              <th className="text-left font-medium p-3">Price</th>
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3">Visibility</th>
              <th className="text-left font-medium p-3">Updated</th>
              <th className="text-left font-medium p-3 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: Course) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.slug}</div>
                </td>
                <td className="p-3">{c.category ?? '—'}</td>
                <td className="p-3">₹{(((c.price ?? 0)/100).toFixed(2))}</td>
                <td className="p-3">
                  <span className={
                    c.status==='published'
                      ? 'text-green-700 bg-green-50 rounded px-2 py-0.5'
                      : c.status==='draft'
                      ? 'text-amber-700 bg-amber-50 rounded px-2 py-0.5'
                      : 'text-slate-700 bg-slate-100 rounded px-2 py-0.5'
                  }>
                    {c.status}
                  </span>
                </td>
                <td className="p-3">{c.visibility ?? 'unlisted'}</td>
                <td className="p-3">{new Date(c.updatedAt).toLocaleString()}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 rounded border hover:bg-slate-50" onClick={()=>setEditTarget(c)}>
                      <Edit size={16}/>
                    </button>
                    <button className="px-2 py-1 rounded border hover:bg-slate-50" onClick={()=>setDeleteTarget(c)}>
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td className="p-6 text-center text-slate-500" colSpan={7}>No courses</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CourseFormModal
        title="Create course"
        open={openCreate}
        onClose={()=>setOpenCreate(false)}
        onSubmit={(data)=>createMut.mutate(data,{onSuccess:()=>setOpenCreate(false)})}
      />

      <CourseFormModal
        title="Edit course"
        open={!!editTarget}
        initial={editTarget ?? undefined}
        onClose={()=>setEditTarget(null)}
        onSubmit={(data)=> editTarget && updateMut.mutate(
          {id:editTarget.id, patch:data},
          {onSuccess:()=>setEditTarget(null)}
        )}
      />

      <Modal open={!!deleteTarget} onClose={()=>setDeleteTarget(null)} title="Delete course">
        <div className="space-y-4">
          <p>Are you sure you want to delete <b>{deleteTarget?.title}</b>? This action cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <button className="rounded-md border px-3 py-2 text-sm" onClick={()=>setDeleteTarget(null)}>Cancel</button>
            <Button variant="danger" onClick={()=>{
              if (!deleteTarget) return
              deleteMut.mutate(deleteTarget.id,{onSuccess:()=>setDeleteTarget(null)})
            }}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CourseFormModal({
  title, open, onClose, onSubmit, initial
}:{
  title:string
  open:boolean
  onClose:()=>void
  onSubmit:(data: Omit<Course,'id'|'createdAt'|'updatedAt'>)=>void
  initial?: Course
}){
  const safe = (s?: string) => s ?? ''  // <- helper

  const [titleV, setTitleV]   = useState<string>(safe(initial?.title))
  const [slug, setSlug]       = useState<string>(safe(initial?.slug))
  const [category, setCategory]=useState<string>(safe(initial?.category))
  const [price, setPrice]     = useState<string>(initial ? String((initial.price ?? 0)/100) : '9.99')
  const [status, setStatus]   = useState<CourseStatus>(initial?.status ?? 'draft')
  const [visibility, setVisibility] = useState<Course['visibility']>(initial?.visibility ?? 'unlisted')

  React.useEffect(()=>{
    if (initial){
      setTitleV(safe(initial.title))
      setSlug(safe(initial.slug))              // <- no undefined
      setCategory(safe(initial.category))      // <- no undefined
      setPrice(String((initial.price ?? 0)/100))
      setStatus(initial.status)
      setVisibility(initial.visibility ?? 'unlisted')
    } else {
      setTitleV('')
      setSlug('')
      setCategory('')
      setPrice('9.99')
      setStatus('draft')
      setVisibility('unlisted')
    }
  }, [initial, open])

  const canSubmit = titleV.trim().length>2 && slug.trim().length>2

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        className="space-y-3"
        onSubmit={(e)=>{
          e.preventDefault(); if(!canSubmit) return
          onSubmit({
            title: titleV.trim(),
            slug: slug.trim(),
            category: category.trim() || undefined,
            price: Math.round(parseFloat(price || '0') * 100),
            status,
            visibility
          })
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Title</Label>
            <Input
              value={titleV}
              onChange={e=>{
                const v = e.target.value
                setTitleV(v)
                if (!initial){
                  setSlug(
                    v.toLowerCase()
                     .replace(/[^a-z0-9]+/g,'-')
                     .replace(/(^-|-$)/g,'')
                  )
                }
              }}
              placeholder="e.g., React Fundamentals"
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="react-fundamentals" />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Frontend" />
          </div>
          <div>
            <Label>Price (INR)</Label>
            <Input type="number" step="0.01" min="0" value={price} onChange={e=>setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={e=>setStatus(e.target.value as CourseStatus)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div>
            <Label>Visibility</Label>
            <Select value={visibility} onChange={e=>setVisibility(e.target.value as Course['visibility'])}>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          <Button type="submit" disabled={!canSubmit}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

