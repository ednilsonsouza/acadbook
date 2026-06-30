import { ID, Query, Permission, Role } from 'node-appwrite'
import { createAdminClient } from './server'
import { APPWRITE_DATABASE_ID, COLLECTIONS } from './collections'
import type { Book, BookStatus, CreateBookInput } from '@/types/book'
import type { BookPlan, CreateBookPlanInput, BookPlanStatus, PlanChapter } from '@/types/plan'
import type { Chapter, ChapterStatus, ChapterContent } from '@/types/chapter'
import type { Source, CreateSourceInput } from '@/types/source'
import type { GenerationLog } from '@/types/export'

// Utilitário: truncar string para não ultrapassar o limite da collection
const t = (s: string | undefined | null, max: number): string =>
  (s ?? '').slice(0, max)

// ─── BOOKS ──────────────────────────────────────────────────────────────────

export async function createBook(input: CreateBookInput, userId: string): Promise<Book> {
  const { databases } = createAdminClient()
  const doc = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    COLLECTIONS.BOOKS,
    ID.unique(),
    {
      title: t(input.title, 200),
      description: t(input.description, 2000),
      authors: t(input.authors, 500),
      chaptersCount: input.chaptersCount,
      sectionsPerChapter: input.sectionsPerChapter,
      paragraphsPerSection: input.paragraphsPerSection,
      status: 'draft' satisfies BookStatus,
      citationStyle: input.citationStyle,
      templateId: input.templateId ?? 'academic-classic',
      createdBy: userId,
      approvedPlanId: null,
      pdfFileId: null,
      errorMessage: null,
    },
    [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ],
  )
  return doc as unknown as Book
}

export async function getBook(bookId: string): Promise<Book | null> {
  const { databases } = createAdminClient()
  try {
    const doc = await databases.getDocument(APPWRITE_DATABASE_ID, COLLECTIONS.BOOKS, bookId)
    return doc as unknown as Book
  } catch {
    return null
  }
}

export async function listBooksByUser(userId: string): Promise<Book[]> {
  const { databases } = createAdminClient()
  const res = await databases.listDocuments(APPWRITE_DATABASE_ID, COLLECTIONS.BOOKS, [
    Query.equal('createdBy', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ])
  return res.documents as unknown as Book[]
}

export async function updateBookStatus(
  bookId: string,
  status: BookStatus,
  extra?: { approvedPlanId?: string; pdfFileId?: string; errorMessage?: string },
): Promise<void> {
  const { databases } = createAdminClient()
  await databases.updateDocument(APPWRITE_DATABASE_ID, COLLECTIONS.BOOKS, bookId, {
    status,
    ...(extra ?? {}),
  })
}

// ─── BOOK PLANS ─────────────────────────────────────────────────────────────

export async function createBookPlan(input: CreateBookPlanInput): Promise<BookPlan> {
  const { databases } = createAdminClient()
  const doc = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    COLLECTIONS.BOOK_PLANS,
    ID.unique(),
    {
      bookId: input.bookId,
      version: input.version,
      status: 'generated' satisfies BookPlanStatus,
      chapters: JSON.stringify(input.chapters),
      approvedAt: null,
    },
  )
  return {
    ...doc,
    chapters: JSON.parse(doc.chapters as string) as PlanChapter[],
  } as unknown as BookPlan
}

export async function getLatestBookPlan(bookId: string): Promise<BookPlan | null> {
  const { databases } = createAdminClient()
  try {
    const res = await databases.listDocuments(APPWRITE_DATABASE_ID, COLLECTIONS.BOOK_PLANS, [
      Query.equal('bookId', bookId),
      Query.orderDesc('version'),
      Query.limit(1),
    ])
    if (res.total === 0) return null
    const doc = res.documents[0]
    return {
      ...doc,
      chapters: JSON.parse(doc.chapters as string) as PlanChapter[],
    } as unknown as BookPlan
  } catch {
    return null
  }
}

export async function updateBookPlan(
  planId: string,
  data: { status?: BookPlanStatus; chapters?: PlanChapter[]; approvedAt?: string },
): Promise<void> {
  const { databases } = createAdminClient()
  const payload: Record<string, unknown> = {}
  if (data.status) payload.status = data.status
  if (data.chapters) payload.chapters = JSON.stringify(data.chapters)
  if (data.approvedAt) payload.approvedAt = data.approvedAt
  await databases.updateDocument(APPWRITE_DATABASE_ID, COLLECTIONS.BOOK_PLANS, planId, payload)
}

// ─── CHAPTERS ────────────────────────────────────────────────────────────────

export async function createChapterRecords(
  bookId: string,
  planId: string,
  chaptersCount: number,
  planChapters: PlanChapter[],
): Promise<Chapter[]> {
  const { databases } = createAdminClient()
  const created: Chapter[] = []
  for (const ch of planChapters.slice(0, chaptersCount)) {
    const doc = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTIONS.CHAPTERS,
      ID.unique(),
      {
        bookId,
        planId,
        chapterNumber: ch.chapterNumber,
        title: t(ch.title, 200),
        content: null,
        status: 'pending' satisfies ChapterStatus,
        errorMessage: null,
        generatedAt: null,
        retryCount: 0,
      },
    )
    created.push(doc as unknown as Chapter)
  }
  return created
}

export async function getChaptersByBook(bookId: string): Promise<Chapter[]> {
  const { databases } = createAdminClient()
  const res = await databases.listDocuments(APPWRITE_DATABASE_ID, COLLECTIONS.CHAPTERS, [
    Query.equal('bookId', bookId),
    Query.orderAsc('chapterNumber'),
    Query.limit(25),
  ])
  return res.documents.map((doc) => ({
    ...doc,
    content: doc.content ? (JSON.parse(doc.content as string) as ChapterContent) : null,
  })) as unknown as Chapter[]
}

export async function updateChapter(
  chapterId: string,
  data: {
    status?: ChapterStatus
    content?: ChapterContent
    errorMessage?: string | null
    generatedAt?: string
    retryCount?: number
  },
): Promise<void> {
  const { databases } = createAdminClient()
  const payload: Record<string, unknown> = {}
  if (data.status) payload.status = data.status
  if (data.content !== undefined) payload.content = JSON.stringify(data.content)
  if (data.errorMessage !== undefined) payload.errorMessage = data.errorMessage
  if (data.generatedAt) payload.generatedAt = data.generatedAt
  if (data.retryCount !== undefined) payload.retryCount = data.retryCount
  await databases.updateDocument(APPWRITE_DATABASE_ID, COLLECTIONS.CHAPTERS, chapterId, payload)
}

// ─── SOURCES ─────────────────────────────────────────────────────────────────

export async function createSource(input: CreateSourceInput): Promise<Source> {
  const { databases } = createAdminClient()
  const doc = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    COLLECTIONS.SOURCES,
    ID.unique(),
    {
      bookId: input.bookId,
      chapterId: input.chapterId,
      sectionId: input.sectionId ?? null,
      title: t(input.title, 500),
      authors: t(input.authors, 500),
      url: t(input.url, 2048),
      publisher: t(input.publisher ?? '', 200),
      publishedAt: input.publishedAt ?? null,
      accessedAt: input.accessedAt,
      excerpt: t(input.excerpt ?? '', 2000),
      citationType: input.citationType,
      usedInParagraphId: null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      isComplete: input.isComplete,
    },
  )
  return doc as unknown as Source
}

export async function getSourcesByChapter(chapterId: string): Promise<Source[]> {
  const { databases } = createAdminClient()
  const res = await databases.listDocuments(APPWRITE_DATABASE_ID, COLLECTIONS.SOURCES, [
    Query.equal('chapterId', chapterId),
    Query.limit(100),
  ])
  return res.documents as unknown as Source[]
}

// ─── GENERATION LOGS ─────────────────────────────────────────────────────────

export async function logGeneration(
  entry: Omit<GenerationLog, '$id' | '$createdAt'>,
): Promise<void> {
  const { databases } = createAdminClient()
  try {
    await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTIONS.GENERATION_LOGS,
      ID.unique(),
      {
        bookId: entry.bookId,
        chapterId: entry.chapterId ?? null,
        agent: t(entry.agent, 100),
        step: t(entry.step, 100),
        status: entry.status,
        message: t(entry.message, 1000),
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    )
  } catch {
    // Falha no log não deve interromper o fluxo principal
    console.error('[logGeneration] Falha ao registrar log', entry)
  }
}

export { ID, Query, Permission, Role }
