/**
 * IDs centralizados do Appwrite.
 * Alterar apenas aqui — nunca hardcodar em outros arquivos.
 */

export const APPWRITE_DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? 'acadbook'

export const COLLECTIONS = {
  BOOKS: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_BOOKS ?? 'books',
  BOOK_PLANS: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_BOOK_PLANS ?? 'book_plans',
  CHAPTERS: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_CHAPTERS ?? 'chapters',
  SOURCES: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_SOURCES ?? 'sources',
  REFERENCES: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_REFERENCES ?? 'references',
  EXPORTS: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_EXPORTS ?? 'exports',
  GENERATION_LOGS:
    process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_GENERATION_LOGS ?? 'generation_logs',
} as const

export const STORAGE = {
  BOOK_EXPORTS:
    process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID ?? 'book-exports',
} as const

export const FUNCTIONS = {
  GENERATE_PLAN: process.env.APPWRITE_FUNCTION_GENERATE_PLAN ?? 'generate-book-plan',
  RESEARCH_CHAPTER: process.env.APPWRITE_FUNCTION_RESEARCH_CHAPTER ?? 'research-chapter',
  GENERATE_CHAPTER: process.env.APPWRITE_FUNCTION_GENERATE_CHAPTER ?? 'generate-chapter',
  ASSEMBLE_BOOK: process.env.APPWRITE_FUNCTION_ASSEMBLE_BOOK ?? 'assemble-book',
  EXPORT_PDF: process.env.APPWRITE_FUNCTION_EXPORT_PDF ?? 'export-pdf',
  RETRY_GENERATION: process.env.APPWRITE_FUNCTION_RETRY_GENERATION ?? 'retry-generation',
} as const
