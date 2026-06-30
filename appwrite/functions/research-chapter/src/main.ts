import { Client, Databases, ID } from 'node-appwrite'

/**
 * Appwrite Function: research-chapter
 * Agente 2 (parte 1) — Pesquisa de fontes com Perplexity
 *
 * Entrada (body JSON):
 *   bookId: string
 *   chapterId: string
 *   chapterTitle: string
 *   chapterObjective: string
 *   chapterKeywords: string[]
 *   sections: Array<{ sectionNumber: number; title: string; objective: string; keywords: string[] }>
 *   bookTitle: string
 */

const DB_ID = process.env.APPWRITE_DATABASE_ID ?? 'acadbook'
const COLL_CHAPTERS = process.env.APPWRITE_COLLECTION_CHAPTERS ?? 'chapters'
const COLL_SOURCES = process.env.APPWRITE_COLLECTION_SOURCES ?? 'sources'
const COLL_LOGS = process.env.APPWRITE_COLLECTION_GENERATION_LOGS ?? 'generation_logs'
const PERPLEXITY_API_URL = process.env.PERPLEXITY_API_URL ?? 'https://api.perplexity.ai'
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL ?? 'sonar-pro'

function truncate(s: string | undefined | null, max: number): string {
  return (s ?? '').slice(0, max)
}

interface SearchResult {
  title: string
  url: string
  date?: string
  author?: string
  snippet?: string
}

interface PerplexityResp {
  citations?: string[]
  search_results?: SearchResult[]
  choices?: Array<{ message: { content: string } }>
}

async function searchPerplexity(query: string): Promise<PerplexityResp> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY não configurada')

  const res = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        { role: 'system', content: 'Especialista em pesquisa acadêmica. Retorne apenas fontes reais.' },
        { role: 'user', content: query },
      ],
      max_tokens: 2048,
      temperature: 0.1,
      return_citations: true,
      return_images: false,
      search_recency_filter: 'month',
    }),
  })

  if (!res.ok) throw new Error(`Perplexity erro ${res.status}: ${await res.text()}`)
  return await res.json() as PerplexityResp
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async ({ req, res, log, error }: any) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? '')
    .setKey(process.env.APPWRITE_API_KEY ?? '')

  const databases = new Databases(client)

  let body: {
    bookId: string
    chapterId: string
    chapterTitle: string
    chapterObjective: string
    chapterKeywords: string[]
    sections: Array<{ sectionNumber: number; title: string; objective: string; keywords: string[] }>
    bookTitle: string
  }

  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.json({ success: false, error: 'Body JSON inválido' }, 400)
  }

  const { bookId, chapterId, chapterTitle, chapterKeywords, sections, bookTitle } = body

  try {
    await databases.updateDocument(DB_ID, COLL_CHAPTERS, chapterId, { status: 'researching' })
    log(`Pesquisando fontes para capítulo ${chapterId}`)

    const query = `Pesquise fontes acadêmicas reais para o capítulo "${chapterTitle}" do livro "${bookTitle}".
Palavras-chave: ${chapterKeywords.join(', ')}
Seções: ${sections.map((s) => s.title).join(', ')}
Retorne fontes verificáveis com autor, título, URL e data. NÃO invente referências.`

    const perplexityData = await searchPerplexity(query)

    const rawSources: SearchResult[] = perplexityData.search_results ?? []
    if (rawSources.length === 0 && perplexityData.citations) {
      perplexityData.citations.forEach((url) => rawSources.push({ title: '', url }))
    }

    const now = new Date().toISOString()
    const savedSourceIds: string[] = []

    for (const src of rawSources) {
      if (!src.url) continue
      try { new URL(src.url) } catch { continue }

      const isComplete = Boolean(src.title && src.author)
      const sourceDoc = await databases.createDocument(DB_ID, COLL_SOURCES, ID.unique(), {
        bookId,
        chapterId,
        sectionId: null,
        title: truncate(src.title || '[Título não disponível]', 500),
        authors: truncate(src.author || '[Autor não identificado]', 500),
        url: truncate(src.url, 2048),
        publisher: null,
        publishedAt: src.date ?? null,
        accessedAt: now,
        excerpt: truncate(src.snippet ?? '', 2000),
        citationType: 'reference_only',
        usedInParagraphId: null,
        metadata: null,
        isComplete,
      })
      savedSourceIds.push(sourceDoc.$id)
    }

    log(`${savedSourceIds.length} fontes salvas para capítulo ${chapterId}`)

    // Registrar log
    await databases.createDocument(DB_ID, COLL_LOGS, ID.unique(), {
      bookId,
      chapterId,
      agent: 'research-chapter',
      step: 'perplexity_search',
      status: 'success',
      message: `${savedSourceIds.length} fontes encontradas e salvas`,
      metadata: null,
    })

    return res.json({ success: true, sourceIds: savedSourceIds, count: savedSourceIds.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error(`Falha na pesquisa do capítulo ${chapterId}: ${message}`)

    try {
      await databases.updateDocument(DB_ID, COLL_CHAPTERS, chapterId, {
        status: 'failed',
        errorMessage: truncate(message, 500),
      })
      await databases.createDocument(DB_ID, COLL_LOGS, ID.unique(), {
        bookId,
        chapterId,
        agent: 'research-chapter',
        step: 'perplexity_search',
        status: 'error',
        message: truncate(message, 500),
        metadata: null,
      })
    } catch {
      // Falha silenciosa
    }

    return res.json({ success: false, error: 'Falha na pesquisa', detail: message }, 500)
  }
}
