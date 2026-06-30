export type CitationType = 'direct' | 'indirect' | 'reference_only'

export interface SourceMetadata {
  doi?: string
  isbn?: string
  volume?: string
  issue?: string
  pages?: string
  language?: string
  [key: string]: string | undefined
}

export interface Source {
  $id: string
  $createdAt: string
  $updatedAt: string
  bookId: string
  chapterId: string
  sectionId?: string
  title: string
  authors: string
  url: string
  publisher?: string
  publishedAt?: string
  accessedAt: string
  excerpt?: string
  citationType: CitationType
  usedInParagraphId?: string
  metadata?: SourceMetadata
  isComplete: boolean
}

export interface CreateSourceInput {
  bookId: string
  chapterId: string
  sectionId?: string
  title: string
  authors: string
  url: string
  publisher?: string
  publishedAt?: string
  accessedAt: string
  excerpt?: string
  citationType: CitationType
  metadata?: SourceMetadata
  isComplete: boolean
}

export interface Reference {
  $id: string
  $createdAt: string
  bookId: string
  sourceId: string
  style: string
  formattedReference: string
}
