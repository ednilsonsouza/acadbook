export type ChapterStatus =
  | 'pending'
  | 'researching'
  | 'generating'
  | 'validating'
  | 'completed'
  | 'failed'

export interface CitationRef {
  sourceId: string
  text: string
  type: 'direct' | 'indirect'
  page?: string
}

export interface SectionContent {
  sectionNumber: number
  title: string
  paragraphs: string[]
  citations: CitationRef[]
}

export interface ChapterContent {
  introduction?: string
  sections: SectionContent[]
  conclusion?: string
}

export interface Chapter {
  $id: string
  $createdAt: string
  $updatedAt: string
  bookId: string
  planId: string
  chapterNumber: number
  title: string
  content: ChapterContent | null
  status: ChapterStatus
  errorMessage?: string
  generatedAt?: string
  retryCount: number
}

export interface CreateChapterInput {
  bookId: string
  planId: string
  chapterNumber: number
  title: string
}

export interface UpdateChapterInput {
  status?: ChapterStatus
  content?: ChapterContent
  errorMessage?: string
  generatedAt?: string
  retryCount?: number
}
