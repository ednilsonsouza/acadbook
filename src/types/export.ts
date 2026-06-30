export type ExportStatus = 'pending' | 'generating' | 'completed' | 'failed'

export type ExportFormat = 'pdf'

export type BookTemplate = 'academic-classic' | 'academic-modern' | 'academic-minimal'

export interface BookExport {
  $id: string
  $createdAt: string
  $updatedAt: string
  bookId: string
  format: ExportFormat
  fileId?: string
  status: ExportStatus
  errorMessage?: string
  templateId: BookTemplate
}

export interface CreateExportInput {
  bookId: string
  format: ExportFormat
  templateId: BookTemplate
}

export interface GenerationLog {
  $id: string
  $createdAt: string
  bookId: string
  chapterId?: string
  agent: string
  step: string
  status: 'info' | 'success' | 'warning' | 'error'
  message: string
  metadata?: Record<string, unknown>
}
