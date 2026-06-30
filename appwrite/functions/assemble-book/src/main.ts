import { Client, Databases, Query, ID } from 'node-appwrite'

/**
 * Appwrite Function: assemble-book
 * Agente 3 — Montador Editorial
 *
 * Entrada (body JSON):
 *   bookId: string
 *   planId: string
 *
 * Saída: HTML do livro completo salvo no documento do livro
 */

const DB_ID = process.env.APPWRITE_DATABASE_ID ?? 'acadbook'
const COLL_BOOKS = process.env.APPWRITE_COLLECTION_BOOKS ?? 'books'
const COLL_PLANS = process.env.APPWRITE_COLLECTION_BOOK_PLANS ?? 'book_plans'
const COLL_CHAPTERS = process.env.APPWRITE_COLLECTION_CHAPTERS ?? 'chapters'
const COLL_SOURCES = process.env.APPWRITE_COLLECTION_SOURCES ?? 'sources'
const COLL_REFERENCES = process.env.APPWRITE_COLLECTION_REFERENCES ?? 'references'
const COLL_LOGS = process.env.APPWRITE_COLLECTION_GENERATION_LOGS ?? 'generation_logs'
const MINIMAX_API_URL = process.env.MINIMAX_API_URL ?? 'https://api.minimaxi.com/v1'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL ?? 'MiniMax-Text-01'

function truncate(s: string | undefined | null, max: number): string {
  return (s ?? '').slice(0, max)
}

async function minimaxChat(messages: Array<{ role: string; content: string }>, maxTokens = 3000) {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY não configurada')
  const res = await fetch(`${MINIMAX_API_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MINIMAX_MODEL, messages, max_tokens: maxTokens, temperature: 0.5, stream: false }),
  })
  if (!res.ok) throw new Error(`MiniMax erro ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async ({ req, res, log, error }: any) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? '')
    .setKey(process.env.APPWRITE_API_KEY ?? '')

  const databases = new Databases(client)

  let body: { bookId: string; planId: string }
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.json({ success: false, error: 'Body JSON inválido' }, 400)
  }

  const { bookId, planId } = body

  try {
    await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, { status: 'assembling' })
    log(`Montando livro ${bookId}`)

    // Carregar dados do livro
    const bookDoc = await databases.getDocument(DB_ID, COLL_BOOKS, bookId)
    const planDoc = await databases.getDocument(DB_ID, COLL_PLANS, planId)

    interface PlanChapter {
      chapterNumber: number
      title: string
      objective: string
      keywords: string[]
      sections: Array<{ sectionNumber: number; title: string; objective: string; keywords: string[] }>
    }
    const planChapters = JSON.parse(planDoc.chapters as string) as PlanChapter[]

    // Carregar capítulos concluídos
    const chaptersRes = await databases.listDocuments(DB_ID, COLL_CHAPTERS, [
      Query.equal('bookId', bookId),
      Query.equal('status', 'completed'),
      Query.orderAsc('chapterNumber'),
      Query.limit(25),
    ])

    if (chaptersRes.total < bookDoc.chaptersCount) {
      throw new Error(
        `Apenas ${chaptersRes.total} de ${bookDoc.chaptersCount} capítulos concluídos`,
      )
    }

    // Carregar fontes de todos os capítulos
    const sourcesRes = await databases.listDocuments(DB_ID, COLL_SOURCES, [
      Query.equal('bookId', bookId),
      Query.limit(200),
    ])

    // Deduplica fontes por URL
    const seenUrls = new Set<string>()
    const uniqueSources = sourcesRes.documents.filter((s) => {
      if (seenUrls.has(s.url)) return false
      seenUrls.add(s.url)
      return true
    })

    log(`${uniqueSources.length} fontes únicas consolidadas`)

    // Formatar referências (ABNT simplificado)
    const citationStyle = (bookDoc.citationStyle as string) ?? 'ABNT'

    for (const source of uniqueSources) {
      if (!source.isComplete) continue
      const formatted =
        citationStyle === 'ABNT'
          ? `${source.authors}. **${source.title}**. ${source.publisher ?? ''}, ${source.publishedAt ?? 'S.d.'}. Disponível em: <${source.url}>. Acesso em: ${new Date(source.accessedAt as string).toLocaleDateString('pt-BR')}.`
          : `${source.authors} (${source.publishedAt ?? 'S.d.'}). *${source.title}*. Retrieved from ${source.url}`

      await databases.createDocument(DB_ID, COLL_REFERENCES, ID.unique(), {
        bookId,
        sourceId: source.$id,
        style: citationStyle,
        formattedReference: truncate(formatted, 2000),
      })
    }

    // Gerar Introdução
    const chapterTitles = planChapters.map((c) => c.title)
    const introduction = await minimaxChat([
      { role: 'system', content: 'Professor universitário. Escreva em português acadêmico formal. Nunca invente dados.' },
      {
        role: 'user',
        content: `Escreva a Introdução do livro "${bookDoc.title}" (${bookDoc.authors}).
Descrição: ${bookDoc.description}
Capítulos: ${chapterTitles.map((t, i) => `${i + 1}. ${t}`).join(', ')}
4 a 6 parágrafos acadêmicos. Não inventar referências.`,
      },
    ])

    // Gerar Considerações Finais
    const conclusion = await minimaxChat([
      { role: 'system', content: 'Professor universitário. Escreva em português acadêmico formal. Nunca invente dados.' },
      {
        role: 'user',
        content: `Escreva as Considerações Finais do livro "${bookDoc.title}".
Capítulos: ${chapterTitles.map((t, i) => `${i + 1}. ${t} — ${planChapters[i]?.objective ?? ''}`).join('\n')}
4 a 6 parágrafos. Sintetize as contribuições. Aponte limitações e pesquisas futuras. Não inventar referências.`,
      },
    ])

    log('Introdução e considerações finais geradas')

    // Montar HTML editorial
    const chaptersHtml = chaptersRes.documents
      .map((ch) => {
        const content = ch.content
          ? (JSON.parse(ch.content as string) as {
              introduction?: string
              sections: Array<{ sectionNumber: number; title: string; paragraphs: string[] }>
              conclusion?: string
            })
          : null

        if (!content) return ''

        const sectionsHtml = content.sections
          .map(
            (s) =>
              `<section class="book-section">
  <h3>${s.sectionNumber}. ${s.title}</h3>
  ${s.paragraphs.map((p) => `<p>${p}</p>`).join('\n  ')}
</section>`,
          )
          .join('\n')

        return `<chapter class="book-chapter" id="chapter-${ch.chapterNumber}">
  <h2>Capítulo ${ch.chapterNumber}: ${ch.title}</h2>
  ${content.introduction ? `<p class="chapter-intro">${content.introduction}</p>` : ''}
  ${sectionsHtml}
  ${content.conclusion ? `<p class="chapter-conclusion">${content.conclusion}</p>` : ''}
</chapter>`
      })
      .join('\n\n')

    // Recuperar referências salvas
    const refsRes = await databases.listDocuments(DB_ID, COLL_REFERENCES, [
      Query.equal('bookId', bookId),
      Query.limit(200),
    ])

    const referencesHtml = refsRes.documents
      .map((r) => `<li>${r.formattedReference}</li>`)
      .join('\n')

    // Sumário
    const summaryHtml = chaptersRes.documents
      .map(
        (ch) =>
          `<li><a href="#chapter-${ch.chapterNumber}">Capítulo ${ch.chapterNumber}: ${ch.title}</a></li>`,
      )
      .join('\n')

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${bookDoc.title}</title>
</head>
<body class="book">
  <div class="book-cover">
    <h1>${bookDoc.title}</h1>
    <p class="authors">${bookDoc.authors}</p>
  </div>
  <div class="front-matter">
    <h2>Folha de Rosto</h2>
    <p>${bookDoc.title}</p>
    <p>${bookDoc.authors}</p>
  </div>
  <div class="cataloging-note">
    <p><em>Nota: A ficha catalográfica abaixo é preliminar e deve ser validada por bibliotecário profissional antes da publicação oficial.</em></p>
    <p>Título: ${bookDoc.title} / ${bookDoc.authors}. ${new Date().getFullYear()}.</p>
  </div>
  <nav class="summary">
    <h2>Sumário</h2>
    <ol>${summaryHtml}</ol>
  </nav>
  <section class="introduction">
    <h2>Introdução</h2>
    ${introduction.split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('\n    ')}
  </section>
  ${chaptersHtml}
  <section class="conclusion">
    <h2>Considerações Finais</h2>
    ${conclusion.split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('\n    ')}
  </section>
  <section class="references">
    <h2>Referências Bibliográficas</h2>
    <ol>${referencesHtml}</ol>
  </section>
</body>
</html>`

    // Salvar HTML no livro (campo assembledHtml — precisa existir na collection)
    await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, {
      status: 'exporting_pdf',
      assembledHtml: truncate(fullHtml, 65535),
    })

    await databases.createDocument(DB_ID, COLL_LOGS, ID.unique(), {
      bookId,
      chapterId: null,
      agent: 'assemble-book',
      step: 'html_assembly',
      status: 'success',
      message: 'Livro montado com sucesso. Pronto para exportação PDF.',
      metadata: null,
    })

    log(`Livro ${bookId} montado. Status: exporting_pdf`)
    return res.json({ success: true, htmlLength: fullHtml.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error(`Falha ao montar livro ${bookId}: ${message}`)

    try {
      await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, {
        status: 'failed',
        errorMessage: truncate(message, 500),
      })
    } catch {
      // Falha silenciosa
    }

    return res.json({ success: false, error: 'Falha na montagem', detail: message }, 500)
  }
}
