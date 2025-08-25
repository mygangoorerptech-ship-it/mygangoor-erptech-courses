// src/api/certificates.ts
import { api } from './client'
import { USE_MOCK } from './env'
import { CertificatesDB } from './mockCertificates'
import type { Certificate, CertificateFilters, CertificateStatus, CertificateTemplate } from '../types/certificate'
import { logAudit } from '../api/audit'

export function listCertificates(filters: CertificateFilters){
  if (USE_MOCK) return CertificatesDB.list(filters)
  return api.get('/certificates', { params: filters }).then(r => r.data as Certificate[])
}

export function createCertificate(payload: Omit<Certificate,'id'|'createdAt'|'updatedAt'>){
  if (USE_MOCK) {
    return CertificatesDB.create(payload).then(rec => {
      logAudit({ action:'create', resource:'certificate', resourceId:rec.id, message:`Created certificate ${rec.title}`, after:rec })
      return rec
    })
  }
  return api.post('/certificates', payload).then(r => r.data as Certificate)
}

export function updateCertificate(id: string, patch: Partial<Certificate>){
  if (USE_MOCK) {
    return CertificatesDB.update(id, patch).then(rec => {
      logAudit({ action:'update', resource:'certificate', resourceId:id, message:`Updated certificate ${rec.title}`, after:rec })
      return rec
    })
  }
  return api.patch(`/certificates/${id}`, patch).then(r => r.data as Certificate)
}

export function deleteCertificate(id: string){
  if (USE_MOCK) {
    return CertificatesDB.delete(id).then(res => {
      logAudit({ action:'delete', resource:'certificate', resourceId:id, message:`Deleted certificate ${id}` })
      return res
    })
  }
  return api.delete(`/certificates/${id}`).then(r => r.data as any)
}

export function setCertificateStatus(id: string, status: CertificateStatus){
  if (USE_MOCK) {
    return CertificatesDB.setStatus(id, status).then(rec => {
      logAudit({ action:'status_change', resource:'certificate', resourceId:id, message:`Certificate status -> ${status}`, after:rec })
      return rec
    })
  }
  return api.post(`/certificates/${id}/status`, { status }).then(r => r.data as Certificate)
}

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

export function listCertificateTemplates(){
  if (USE_MOCK) {
    const anyDB = CertificatesDB as any
    const stamp = () => new Date().toISOString()

    if (typeof anyDB.listTemplates === 'function') {
      // normalize DB results so they always have createdAt/updatedAt
      return (anyDB.listTemplates() as Promise<CertificateTemplate[]>)
        .then(list => list.map(t => ({
          ...t,
          createdAt: t.createdAt ?? stamp(),
          updatedAt: t.updatedAt ?? stamp(),
        })))
    }

    // Fallback set (previews + defaults) WITH timestamps
    const now = stamp()
    const fallback: CertificateTemplate[] = [
      {
        id: 'tpl-classic',
        name: 'Classic',
        previewDataUrl: TINY_PNG,
        defaults: {
          titleText: 'Certificate of Completion',
          subtitleText: 'Presented to {student_name}',
          bodyText: 'For completing {course_title} on {date}',
          issuerName: 'Your Academy',
          signatureName: 'Instructor',
          dateFormat: 'YYYY-MM-DD'
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tpl-modern',
        name: 'Modern',
        previewDataUrl: TINY_PNG,
        defaults: {
          titleText: 'Course Certificate',
          subtitleText: '{student_name}',
          bodyText: 'has successfully completed {course_title} ({date})',
          issuerName: 'Training Team',
          signatureName: 'Lead Instructor',
          dateFormat: 'DD MMM, YYYY'
        },
        createdAt: now,
        updatedAt: now,
      }
    ]
    return Promise.resolve(fallback)
  }

  return api.get('/certificates/templates').then(r => r.data as CertificateTemplate[])
}

export function addDemoCertificate(templateId: string){
  if (USE_MOCK) {
    return CertificatesDB.addDemo(templateId).then(rec => {
      logAudit({ action:'create', resource:'certificate', resourceId:rec.id, message:`Added demo certificate via template ${templateId}`, after:rec })
      return rec
    })
  }
  return api.post('/certificates/demo', { templateId }).then(r => r.data as Certificate)
}
