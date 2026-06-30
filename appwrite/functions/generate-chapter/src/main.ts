import { Client, Databases, Query, ID } from 'node-appwrite'

/**
 * Appwrite Function: generate-chapter
 * Agente 2 (parte 2) — Geração textual com MiniMax
 *
 * Entrada (body JSON):
 *   bookId: string
 *   chapterId: string
 *   planId: string
 *   chapterNumber: number
 *   paragraphsPerSection: number
 *   citationStyle: string
 *   bookTitle: string
 */

const DB_ID = process.env.APPWRITE_DATABASE_ID ?? 'acadbook'
const COLL_BOOKS = process.env.APPWRITE_COLLECTION_BOOKS ?? 'books'
const COLL_PLANS = process.env.APPWRITE_COLLECTION_BOOK_PLANS ?? 'book_plans'
const COLL_CHAPTERS = process.env.APPWRITE_COLLECTION_CHAPTERS ?? 'chapters'
const COLL_SOURCES = process.env.APPWRITE_COLLECTION_SOURCES ?? 'sources'
const COLL_LOGS = process.env.APPWRITE_COLLECTION_GENERATION_LOGS ?? 'generation_logs'
const MINIMAX_API_URL = process.env.MINIMAX_API_URL ?? 'https://api.minimaxi.com/v1'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL ?? 'MiniMax-Text-01'
const MAX_RETRIES = parseInt(process.env.MAX_GENERATION_RETRIES ?? '3', 10)

function truncate(s: string | undefined | null, max: number): string {
  return (s ?? '').slice(0, max)
}

interface PlanSection {
  sectionNumber: number
  title: string
  objective: string
  keywords: string[]
}

interface PlanChapter {
  chapterNumber: number
  title: string
  objective: string
  keywords: string[]
  sections: PlanSection[]
}

async function minimaxChat(messages: Array<{ role: string; content: string }>, maxTokens = 12000) {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY não configurada')

  const res = await fetch(`${MINIMAX_API_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.6,
      top_p: 0.9,
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`MiniMax erro ${res.status}: ${await res.text()}`)
  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    base_resp?: { status_code: number; status_msg: string }
  }
  if (data.base_resp && data.base_resp.status_code !== 0)
    throw new Error(`MiniMax: ${data.base_resp.status_msg}`)
  return data.choices[0]?.message?.content ?? ''
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
    planId: string
    chapterNumber: number
    paragraphsPerSection: number
    citationStyle: string
    bookTitle: string
  }

  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.json({ success: false, error: 'Body JSON inválido' }, 400)
  }

  const { bookId, chapterId, planId, chapterNumber, paragraphsPerSection, citationStyle, bookTitle } = body

  try {
    // Buscar dados do capítulo e verificar retryCount
    const chapterDoc = await databases.getDocument(DB_ID, COLL_CHAPTERS, chapterId)
    const retryCount = (chapterDoc.retryCount as number) ?? 0

    if (retryCount >= MAX_RETRIES) {
      return res.json({
        success: false,
        error: `Máximo de ${MAX_RETRIES} tentativas atingido para este capítulo`,
      }, 400)
    }

    await databases.updateDocument(DB_ID, COLL_CHAPTERS, chapterId, {
      status: 'generating',
      retryCount: retryCount + 1,
    })

    log(`Gerando capítulo ${chapterNumber} (tentativa ${retryCount + 1})`)

    // Buscar plano
    const planDoc = await databases.getDocument(DB_ID, COLL_PLANS, planId)
    const planChapters = JSON.parse(planDoc.chapters as string) as PlanChapter[]
    const chapter = planChapters.find((c) => c.chapterNumber === chapterNumber)
    if (!chapter) throw new Error(`Capítulo ${chapterNumber} não encontrado no plano`)

    // Buscar fontes do capítulo
    const sourcesRes = await databases.listDocuments(DB_ID, COLL_SOURCES, [
      Query.equal('chapterId', chapterId),
      Query.limit(50),
    ])
    const sources = sourcesRes.documents

    if (sources.length === 0) {
      throw new Error('Nenhuma fonte encontrada para este capítulo. Execute a pesquisa primeiro.')
    }

    // Construir prompt
    const sourcesJson = sources.map((s) => ({
      id: s.$id,
      title: s.title,
      authors: s.authors,
      url: s.url,
      publishedAt: s.publishedAt,
      excerpt: s.excerpt,
      isComplete: s.isComplete,
    }))

    const systemPrompt = `Você é um professor e pesquisador acadêmico sênior especializado em redação científica.
Escreva em português brasileiro formal. Use APENAS as fontes fornecidas.
NUNCA invente autores, títulos, editoras, anos ou URLs.
Estilo de citação: ${citationStyle}.
Responda APENAS com JSON válido.`

    const userPrompt = `Escreva o capítulo ${chapterNumber} do livro "${bookTitle}".

CAPÍTULO:
Título: ${chapter.title}
Objetivo: ${chapter.objective}
Seções:
${chapter.sections.map((s: PlanSection) => `  ${s.sectionNumber}. ${s.title} — ${s.objective}`).join('\n')}

FONTES DISPONÍVEIS (use APENAS estas):
${JSON.stringify(sourcesJson, null, 2)}

Regras:
- ${paragraphsPerSection} parágrafos por seção, cada um com 150-250 palavras.
- Citações diretas: use aspas e inclua o sourceId da fonte.
- Citações indiretas: paráfrases fiéis com sourceId.
- Inclua SOMENTE sourceIds das fontes listadas acima.

Formato JSON:
{
  "introduction": "Introdução breve do capítulo.",
  "sections": [
    {
      "sectionNumber": 1,
      "title": "Título da seção",
      "paragraphs": ["parágrafo 1...", "parágrafo 2..."],
      "citations": [{"sourceId": "ID_REAL", "text": "...", "type": "direct"}]
    }
  ],
  "conclusion": "Conclusão do capítulo."
}`

    const rawResponse = await minimaxChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Resposta da MiniMax não contém JSON válido')

    const content = JSON.parse(jsonMatch[0]) as {
      introduction?: string
      sections: Array<{
        sectionNumber: number
        title: string
        paragraphs: string[]
        citations: Array<{ sourceId: string; text: string; type: string }>
      }>
      conclusion?: string
    }

    // Validar rastreabilidade das citações
    const validSourceIds = new Set(sources.map((s) => s.$id))
    let removedCitations = 0

    for (const section of content.sections) {
      const before = section.citations.length
      section.citations = section.citations.filter((c) => {
        if (!c.sourceId) return false
        return validSourceIds.has(c.sourceId)
      })
      removedCitations += before - section.citations.length
    }

    if (removedCitations > 0) {
      log(`AVISO: ${removedCitations} citação(ões) com sourceId inválido removidas`)
    }

    // Atualizar status para validating
    await databases.updateDocument(DB_ID, COLL_CHAPTERS, chapterId, {
      status: 'validating',
      content: JSON.stringify(content),
    })

    // Validação básica: verificar estrutura mínima
    if (!content.sections || content.sections.length === 0) {
      throw new Error('Capítulo gerado sem seções')
    }

    // Marcar como completed
    await databases.updateDocument(DB_ID, COLL_CHAPTERS, chapterId, {
      status: 'completed',
      generatedAt: new Date().toISOString(),
      errorMessage: null,
    })

    // Log de sucesso
    await databases.createDocument(DB_ID, COLL_LOGS, ID.unique(), {
      bookId,
      chapterId,
      agent: 'generate-chapter',
      step: 'minimax_generation',
      status: 'success',
      message: `Capítulo ${chapterNumber} gerado com ${content.sections.length} seções`,
      metadata: null,
    })

    log(`Capítulo ${chapterNumber} gerado com sucesso`)

    // Verificar se todos os capítulos do livro estão completos
    const allChapters = await databases.listDocuments(DB_ID, COLL_CHAPTERS, [
      Query.equal('bookId', bookId),
      Query.limit(25),
    ])

    const allCompleted = allChapters.documents.every(
      (c) => c.$id === chapterId || c.status === 'completed',
    )

    if (allCompleted) {
      await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, { status: 'assembling' })
      log(`Todos os capítulos concluídos. Livro ${bookId} pronto para montagem.`)
    }

    return res.json({ success: true, chapterId, allCompleted })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error(`Falha ao gerar capítulo ${chapterId}: ${message}`)

    try {
      await databases.updateDocument(DB_ID, COLL_CHAPTERS, chapterId, {
        status: 'failed',
        errorMessage: truncate(message, 500),
      })
      await databases.createDocument(DB_ID, COLL_LOGS, ID.unique(), {
        bookId,
        chapterId,
        agent: 'generate-chapter',
        step: 'minimax_generation',
        status: 'error',
        message: truncate(message, 500),
        metadata: null,
      })
    } catch {
      // Falha silenciosa no rollback
    }

    return res.json({ success: false, error: 'Falha ao gerar capítulo', detail: message }, 500)
  }
}
