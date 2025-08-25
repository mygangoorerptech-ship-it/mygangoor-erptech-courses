// mockdb.ts
import type { Course } from '../types/course'

const KEY='mock:courses'
function read():Course[]{ try{ const raw=localStorage.getItem(KEY); if(!raw) return seed(); return JSON.parse(raw) }catch{ return seed() } }
function write(c:Course[]){ localStorage.setItem(KEY, JSON.stringify(c)) }

function seed():Course[]{
  const now = new Date().toISOString()
  const d: Course[] = [
    { id: crypto.randomUUID(), title:'React Fundamentals',     slug:'react-fundamentals',   category:'Frontend', price:1499, status:'published', visibility:'public',  createdAt: now, updatedAt: now },
    { id: crypto.randomUUID(), title:'Node API Mastery',       slug:'node-api-mastery',     category:'Backend',  price:1999, status:'draft',     visibility:'unlisted', createdAt: now, updatedAt: now },
    { id: crypto.randomUUID(), title:'TypeScript Deep Dive',   slug:'typescript-deep-dive', category:'Language', price:1299, status:'published', visibility:'public',  createdAt: now, updatedAt: now },
  ]
  write(d); return d
}

export const CoursesDB={
  list(q?:{q?:string;status?:string}){
    let a = read()
    if (q?.q) {
      const s = q.q.toLowerCase()
      a = a.filter(c =>
        [c.title, c.slug, c.category ?? '']
          .some((t) => (t ?? '').toLowerCase().includes(s)) // ✅ safe
      )
    }
    if (q?.status && q.status!=='all') a = a.filter(c=>c.status===q.status)
    a.sort((x,y)=> y.updatedAt.localeCompare(x.updatedAt))
    return Promise.resolve(a)
  },

  create(input: Omit<Course,'id'|'createdAt'|'updatedAt'>){
    const now = new Date().toISOString()
    const item: Course = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now } // ✅ add createdAt
    const a = read(); a.push(item); write(a); return Promise.resolve(item)
  },

  update(id:string, patch: Partial<Omit<Course,'id'|'createdAt'>>){
    const a = read(); const i = a.findIndex(c=>c.id===id)
    if (i===-1) return Promise.reject(new Error('Course not found'))
    const u: Course = { ...a[i], ...patch, updatedAt: new Date().toISOString() }
    a[i]=u; write(a); return Promise.resolve(u)
  },

  remove(id:string){
    const a = read(); const i = a.findIndex(c=>c.id===id)
    if (i===-1) return Promise.reject(new Error('Course not found'))
    a.splice(i,1); write(a); return Promise.resolve({id})
  }
}
