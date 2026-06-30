import { Client, Databases, Storage, ID } from 'node-appwrite'
import { chromium } from 'playwright'

/**
 * Appwrite Function: export-pdf
 * Agente 3 — Exportação PDF com Playwright
 *
 * IMPORTANTE: Esta função requer imagem Docker customizada com Playwright instalado.
 * Dockerfile de referência deve incluir:
 *   FROM node:20-bookworm
 *   RUN npx playwright install chromium --with-deps
 *
 * Entrada (body JSON):
 *   bookId: string
 *   exportId: string
 *
 * Saída: PDF salvo no Appwrite Storage
 */

const DB_ID = process.env.APPWRITE_DATABASE_ID ?? 'acadbook'
const COLL_BOOKS = process.env.APPWRITE_COLLECTION_BOOKS ?? 'books'
const COLL_EXPORTS = process.env.APPWRITE_COLLECTION_EXPORTS ?? 'exports'
const COLL_LOGS = process.env.APPWRITE_COLLECTION_GENERATION_LOGS ?? 'generation_logs'
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID ?? 'book-exports'

function truncate(s: string | undefined | null, max: number): string {
  return (s ?? '').slice(0, max)
}

function buildPdfStyles(templateId: string): string {
  const baseStyles = `
    @page {
      size: A4;
      margin: 3cm 2.5cm 2.5cm 3cm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #111;
    }
    h1 { font-size: 20pt; text-align: center; margin-bottom: 1cm; }
    h2 { font-size: 16pt; margin-top: 1.5cm; margin-bottom: 0.5cm; page-break-before: always; }
    h2:first-of-type { page-break-before: avoid; }
    h3 { font-size: 13pt; margin-top: 0.8cm; margin-bottom: 0.3cm; }
    p { text-align: justify; margin-bottom: 0.4cm; text-indent: 1.25cm; }
    .book-cover {
      text-align: center;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      page-break-after: always;
    }
    .authors { font-size: 14pt; margin-top: 0.5cm; }
    .front-matter, .cataloging-note {
      page-break-before: always;
      page-break-after: always;
      padding: 1cm;
    }
    .cataloging-note {
      border: 1px solid #ccc;
      font-size: 10pt;
      padding: 0.5cm;
    }
    nav.summary { page-break-before: always; page-break-after: always; }
    nav.summary ol { list-style: decimal; padding-left: 1cm; }
    nav.summary li { margin-bottom: 0.2cm; }
    .references ol { list-style: none; padding-left: 0; }
    .references li { margin-bottom: 0.4cm; text-indent: -1.25cm; padding-left: 1.25cm; font-size: 11pt; }
    .book-chapter { page-break-before: always; }
    .chapter-intro { font-style: italic; }
    .chapter-conclusion { font-style: italic; margin-top: 0.5cm; }
  `

  if (templateId === 'academic-modern') {
    return baseStyles + `
      body { font-family: 'Georgia', serif; }
      h1, h2, h3 { font-family: 'Arial', sans-serif; }
      h2 { color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 0.1cm; }
    `
  }

  if (templateId === 'academic-minimal') {
    return baseStyles + `
      body { font-family: 'Palatino', 'Book Antiqua', serif; }
      h2 { font-weight: 400; letter-spacing: 0.05em; }
    `
  }

  return baseStyles // academic-classic
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async ({ req, res, log, error }: any) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? '')
    .setKey(process.env.APPWRITE_API_KEY ?? '')

  const databases = new Databases(client)
  const storageClient = new Storage(client)

  let body: { bookId: string; exportId: string }
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.json({ success: false, error: 'Body JSON inválido' }, 400)
  }

  const { bookId, exportId } = body

  let browser = null
  try {
    await databases.updateDocument(DB_ID, COLL_EXPORTS, exportId, { status: 'generating' })
    log(`Exportando PDF para livro ${bookId}`)

    const bookDoc = await databases.getDocument(DB_ID, COLL_BOOKS, bookId)
    const html = bookDoc.assembledHtml as string
    const templateId = (bookDoc.templateId as string) ?? 'academic-classic'

    if (!html) throw new Error('HTML do livro não encontrado. Execute a montagem primeiro.')

    const styles = buildPdfStyles(templateId)
    const fullHtml = html.replace('</head>', `<style>${styles}</style></head>`)

    // Gerar PDF com Playwright
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: 'networkidle' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '3cm', right: '2.5cm', bottom: '2.5cm', left: '3cm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font-size:9pt;text-align:center;width:100%;color:#666">
        ${bookDoc.title as string} — Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>`,
    })

    await browser.close()
    browser = null

    log(`PDF gerado: ${pdfBuffer.length} bytes`)

    // Upload para Appwrite Storage
    const filename = `${bookId}-${Date.now()}.pdf`
    const safeBuf = new ArrayBuffer(pdfBuffer.byteLength)
    new Uint8Array(safeBuf).set(pdfBuffer)
    const blob = new Blob([safeBuf], { type: 'application/pdf' })
    const file = new File([blob], filename, { type: 'application/pdf' })

    const uploaded = await storageClient.createFile(BUCKET_ID, ID.unique(), file)

    log(`PDF salvo no Storage: ${uploaded.$id}`)

    // Atualizar export e livro
    await databases.updateDocument(DB_ID, COLL_EXPORTS, exportId, {
      status: 'completed',
      fileId: uploaded.$id,
    })

    await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, {
      status: 'completed',
      pdfFileId: uploaded.$id,
    })

    await databases.createDocument(DB_ID, COLL_LOGS, ID.unique(), {
      bookId,
      chapterId: null,
      agent: 'export-pdf',
      step: 'playwright_pdf',
      status: 'success',
      message: `PDF exportado com sucesso. FileId: ${uploaded.$id}`,
      metadata: null,
    })

    return res.json({ success: true, fileId: uploaded.$id })
  } catch (err) {
    if (browser) {
      try { await browser.close() } catch { /* silencioso */ }
    }

    const message = err instanceof Error ? err.message : String(err)
    error(`Falha ao exportar PDF do livro ${bookId}: ${message}`)

    try {
      await databases.updateDocument(DB_ID, COLL_EXPORTS, exportId, {
        status: 'failed',
        errorMessage: truncate(message, 500),
      })
      await databases.createDocument(DB_ID, COLL_LOGS, ID.unique(), {
        bookId,
        chapterId: null,
        agent: 'export-pdf',
        step: 'playwright_pdf',
        status: 'error',
        message: truncate(message, 500),
        metadata: null,
      })
    } catch {
      // Falha silenciosa
    }

    return res.json({ success: false, error: 'Falha na exportação PDF', detail: message }, 500)
  }
}
