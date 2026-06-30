import type { PerplexityResponse } from './client'
import type { CreateSourceInput } from '@/types/source'

export interface RawPerplexitySource {
  title: string
  url: string
  date?: string
  author?: string
  snippet?: string
}

/**
 * Normaliza os resultados de busca da Perplexity em objetos Source prontos para salvar.
 * Descarta fontes sem URL ou título (incompletas críticas).
 * Marca fontes parcialmente incompletas com isComplete: false.
 */
export function normalizeSources(
  response: PerplexityResponse,
  bookId: string,
  chapterId: string,
  sectionId?: string,
): Array<CreateSourceInput & { isIncomplete: boolean }> {
  const rawSources: RawPerplexitySource[] = response.search_results ?? []

  // Também extrair citations (URLs simples) quando search_results não está disponível
  const citationUrls = response.citations ?? []
  if (rawSources.length === 0 && citationUrls.length > 0) {
    citationUrls.forEach((url) => {
      rawSources.push({ title: '', url })
    })
  }

  const now = new Date().toISOString()

  return rawSources
    .filter((src) => {
      // Descartar fontes absolutamente inúteis (sem URL)
      if (!src.url || src.url.trim() === '') return false
      // Descartar URLs claramente inválidas
      try {
        new URL(src.url)
        return true
      } catch {
        return false
      }
    })
    .map((src) => {
      const isComplete = Boolean(src.title && src.author && src.url)
      const isIncomplete = !isComplete

      return {
        bookId,
        chapterId,
        sectionId,
        title: src.title || '[Título não disponível]',
        authors: src.author || '[Autor não identificado]',
        url: src.url,
        publisher: undefined,
        publishedAt: src.date ?? undefined,
        accessedAt: now,
        excerpt: src.snippet ?? undefined,
        citationType: 'reference_only' as const,
        metadata: {},
        isComplete,
        isIncomplete,
      }
    })
}

/**
 * Filtra fontes completas o suficiente para citação direta ou indireta.
 * Fontes incompletas só podem ser usadas como referência.
 */
export function filterCitableSources(
  sources: ReturnType<typeof normalizeSources>,
): ReturnType<typeof normalizeSources> {
  return sources.filter((s) => s.isComplete)
}

/**
 * Deduplica fontes por URL.
 */
export function deduplicateSources<T extends { url: string }>(sources: T[]): T[] {
  const seen = new Set<string>()
  return sources.filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })
}
