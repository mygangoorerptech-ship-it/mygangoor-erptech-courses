//src/types/certificate.ts
export type CertificateStatus = 'draft' | 'published' | 'archived'

export interface CertificateTemplate {
  id: string
  name: string
  // Small preview image (dataURL). Real backend would store a URL.
  previewDataUrl: string
  // Optional default content
  defaults?: Partial<CertificateContent>
  createdAt: string
  updatedAt: string
}

export interface CertificateContent {
  titleText: string
  subtitleText?: string
  bodyText?: string
  issuerName?: string
  signatureName?: string
  dateFormat?: string // e.g., 'YYYY-MM-DD' (for real backend use)
}

export interface Certificate {
  id: string
  title: string
  description?: string
  templateId: string
  content: CertificateContent
  // Optional “demo” image uploaded in admin to visualize
  demoImageDataUrl?: string
  status: CertificateStatus
  createdAt: string
  updatedAt: string
  tags?: string[]
}

export type CertificateFilters = {
  q?: string
  status?: 'all' | CertificateStatus
  templateId?: string
}
