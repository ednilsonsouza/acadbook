export type BookStatus =
  | 'draft'
  | 'planning'
  | 'awaiting_plan_approval'
  | 'plan_approved'
  | 'generating_chapters'
  | 'assembling'
  | 'exporting_pdf'
  | 'completed'
  | 'failed'

export type CitationStyle = 'ABNT' | 'APA' | 'Vancouver' | 'Chicago'

export interface Book {
  $id: string
  $createdAt: string
  $updatedAt: string
  title: string
  description: string
  authors: string
  chaptersCount: number
  sectionsPerChapter: number
  paragraphsPerSection: number
  status: BookStatus
  approvedPlanId?: string
  pdfFileId?: string
  createdBy: string
  errorMessage?: string
  templateId?: string
  citationStyle: CitationStyle
}

export interface CreateBookInput {
  title: string
  description: string
  authors: string
  chaptersCount: number
  sectionsPerChapter: number
  paragraphsPerSection: number
  citationStyle: CitationStyle
  templateId?: string
}

export interface UpdateBookInput extends Partial<CreateBookInput> {
  status?: BookStatus
  approvedPlanId?: string
  pdfFileId?: string
  errorMessage?: string
}
