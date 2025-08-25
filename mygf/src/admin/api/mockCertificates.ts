//src/api/mockCertificates.ts
import type {
  Certificate,
  CertificateFilters,
  CertificateStatus,
  CertificateTemplate,
  CertificateContent,
} from '../types/certificate'

const KEY_CERTS = 'mock:certificates'
const KEY_TMPLS = 'mock:certificate-templates'

function nowISO(){ return new Date().toISOString() }
function readCerts(): Certificate[] {
  try {
    const raw = localStorage.getItem(KEY_CERTS)
    if (!raw) { writeCerts([]); return [] }
    return JSON.parse(raw)
  } catch { writeCerts([]); return [] }
}
function writeCerts(rows: Certificate[]){ localStorage.setItem(KEY_CERTS, JSON.stringify(rows)) }

function readTemplates(): CertificateTemplate[] {
  try {
    const raw = localStorage.getItem(KEY_TMPLS)
    if (!raw) return seedTemplates()
    return JSON.parse(raw)
  } catch { return seedTemplates() }
}
function writeTemplates(rows: CertificateTemplate[]){ localStorage.setItem(KEY_TMPLS, JSON.stringify(rows)) }

// tiny SVG previews as dataURLs to keep repo lightweight
function svgTemplate(label:string, bg:string){
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560">
      <rect width="100%" height="100%" fill="${bg}"/>
      <rect x="30" y="30" width="740" height="500" fill="white" rx="16" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="36" fill="#334155">${label}</text>
    </svg>`
  )
  return `data:image/svg+xml;utf8,${svg}`
}

function seedTemplates(): CertificateTemplate[] {
  const t = nowISO()
  const rows: CertificateTemplate[] = [
    {
      id: crypto.randomUUID(),
      name: 'Elegant Blue',
      previewDataUrl: svgTemplate('Elegant Blue', '#DBEAFE'),
      defaults: {
        titleText: 'Certificate of Completion',
        subtitleText: 'Presented to {student_name}',
        bodyText: 'For successfully completing {course_title} on {date}',
        issuerName: 'Your Academy',
        signatureName: 'Course Instructor',
      },
      createdAt: t, updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      name: 'Minimal Sand',
      previewDataUrl: svgTemplate('Minimal Sand', '#FDE68A'),
      defaults: {
        titleText: 'Certificate',
        subtitleText: 'Awarded to {student_name}',
        bodyText: 'In recognition of completing {course_title} on {date}',
        issuerName: 'Learning Co.',
        signatureName: 'Head of Training',
      },
      createdAt: t, updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      name: 'Classic Green',
      previewDataUrl: svgTemplate('Classic Green', '#DCFCE7'),
      defaults: {
        titleText: 'Completion Certificate',
        subtitleText: 'This is to certify that {student_name}',
        bodyText: 'Has completed {course_title} on {date}',
        issuerName: 'School of Tech',
        signatureName: 'Program Director',
      },
      createdAt: t, updatedAt: t,
    },
  ]
  writeTemplates(rows); return rows
}

export const CertificateTemplatesDB = {
  list(){
    return Promise.resolve(readTemplates())
  },
  create(payload: Omit<CertificateTemplate,'id'|'createdAt'|'updatedAt'>){
    const t = nowISO()
    const rec: CertificateTemplate = { id: crypto.randomUUID(), createdAt: t, updatedAt: t, ...payload }
    const all = readTemplates(); all.unshift(rec); writeTemplates(all)
    return Promise.resolve(rec)
  },
  update(id: string, patch: Partial<Omit<CertificateTemplate,'id'|'createdAt'>>){
    const all = readTemplates()
    const i = all.findIndex(x => x.id === id)
    if (i === -1) return Promise.reject(new Error('Template not found'))
    all[i] = { ...all[i], ...patch, updatedAt: nowISO() }
    writeTemplates(all); return Promise.resolve(all[i])
  },
  delete(id: string){
    const all = readTemplates().filter(x => x.id !== id)
    writeTemplates(all); return Promise.resolve({ id })
  },
}

export const CertificatesDB = {
  list(filters: CertificateFilters){
    let rows = readCerts()

    if (filters.q){
      const q = filters.q.toLowerCase()
      rows = rows.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.description||'').toLowerCase().includes(q)
      )
    }
    if (filters.templateId){
      rows = rows.filter(c => c.templateId === filters.templateId)
    }
    if (filters.status && filters.status !== 'all'){
      rows = rows.filter(c => c.status === filters.status)
    }

    rows.sort((a,b)=> (b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt))
    return Promise.resolve(rows)
  },

  create(payload: Omit<Certificate,'id'|'createdAt'|'updatedAt'>){
    const t = nowISO()
    const rec: Certificate = { id: crypto.randomUUID(), createdAt: t, updatedAt: t, ...payload }
    const all = readCerts(); all.unshift(rec); writeCerts(all)
    return Promise.resolve(rec)
  },

  update(id: string, patch: Partial<Omit<Certificate,'id'|'createdAt'>>){
    const all = readCerts()
    const i = all.findIndex(c => c.id === id)
    if (i === -1) return Promise.reject(new Error('Certificate not found'))
    all[i] = { ...all[i], ...patch, updatedAt: nowISO() }
    writeCerts(all); return Promise.resolve(all[i])
  },

  delete(id: string){
    const all = readCerts().filter(c => c.id !== id)
    writeCerts(all); return Promise.resolve({ id })
  },

  setStatus(id: string, status: CertificateStatus){
    const all = readCerts()
    const i = all.findIndex(c => c.id === id)
    if (i === -1) return Promise.reject(new Error('Certificate not found'))
    all[i].status = status
    all[i].updatedAt = nowISO()
    writeCerts(all); return Promise.resolve(all[i])
  },

  // convenience: add a demo image certificate quickly
  addDemo(templateId: string){
    const t = nowISO()
    const demoPreview = svgTemplate('Demo Certificate', '#E5E7EB')
    const defaults = (readTemplates().find(tpl => tpl.id === templateId)?.defaults) || {}
    const rec: Certificate = {
      id: crypto.randomUUID(),
      title: 'Demo Certificate',
      description: 'Preview-only demo certificate',
      templateId,
      content: {
        titleText: defaults.titleText || 'Certificate of Completion',
        subtitleText: defaults.subtitleText || 'Presented to {student_name}',
        bodyText: defaults.bodyText || 'For completing {course_title} on {date}',
        issuerName: defaults.issuerName || 'Your Org',
        signatureName: defaults.signatureName || 'Instructor',
      },
      demoImageDataUrl: demoPreview,
      status: 'draft',
      createdAt: t,
      updatedAt: t,
    }
    const all = readCerts(); all.unshift(rec); writeCerts(all)
    return Promise.resolve(rec)
  },
}
