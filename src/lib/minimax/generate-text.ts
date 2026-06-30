import { minimaxChat, extractText } from './client'
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildWriterSystemPrompt,
  buildWriterUserPrompt,
  buildAssemblerIntroductionPrompt,
  buildAssemblerConclusionPrompt,
} from './prompts'
import type { PlanChapter } from '@/types/plan'
import type { Source } from '@/types/source'
import type { ChapterContent } from '@/types/chapter'
import type { CitationStyle } from '@/types/book'

// ─── AGENTE 1 ────────────────────────────────────────────────────────────────

export interface GeneratedPlan {
  chapters: PlanChapter[]
}

export async function generateBookPlan(params: {
  title: string
  description: string
  authors: string
  chaptersCount: number
  sectionsPerChapter: number
}): Promise<GeneratedPlan> {
  const response = await minimaxChat(
    [
      { role: 'system', content: buildPlannerSystemPrompt() },
      { role: 'user', content: buildPlannerUserPrompt(params) },
    ],
    { temperature: 0.5, maxTokens: 8000 },
  )

  const raw = extractText(response)

  // Extrair JSON mesmo que haja texto extra ao redor
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('MiniMax não retornou JSON válido no plano')
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedPlan

  if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
    throw new Error('Plano gerado não contém capítulos válidos')
  }

  if (parsed.chapters.length !== params.chaptersCount) {
    throw new Error(
      `Plano gerado tem ${parsed.chapters.length} capítulos, mas eram esperados ${params.chaptersCount}`,
    )
  }

  return parsed
}

// ─── AGENTE 2 ────────────────────────────────────────────────────────────────

export async function generateChapter(params: {
  chapter: PlanChapter
  sources: Source[]
  paragraphsPerSection: number
  citationStyle: CitationStyle
  bookTitle: string
}): Promise<ChapterContent> {
  const response = await minimaxChat(
    [
      { role: 'system', content: buildWriterSystemPrompt(params.citationStyle) },
      { role: 'user', content: buildWriterUserPrompt(params) },
    ],
    { temperature: 0.6, maxTokens: 12000 },
  )

  const raw = extractText(response)

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`MiniMax não retornou JSON válido no capítulo ${params.chapter.chapterNumber}`)
  }

  const parsed = JSON.parse(jsonMatch[0]) as ChapterContent

  // Validação básica de rastreabilidade: cada citação deve ter sourceId
  const allCitations = parsed.sections.flatMap((s) => s.citations ?? [])
  const invalidCitations = allCitations.filter((c) => !c.sourceId || c.sourceId.trim() === '')

  if (invalidCitations.length > 0) {
    throw new Error(
      `Capítulo ${params.chapter.chapterNumber} contém ${invalidCitations.length} citação(ões) sem sourceId válido`,
    )
  }

  // Validar que os sourceIds referenciados existem nas fontes fornecidas
  const validSourceIds = new Set(params.sources.map((s) => s.$id))
  const orphanCitations = allCitations.filter(
    (c) => c.sourceId && !validSourceIds.has(c.sourceId),
  )

  if (orphanCitations.length > 0) {
    // Remover citações órfãs em vez de falhar — log para auditoria
    console.warn(
      `[generateChapter] ${orphanCitations.length} citação(ões) com sourceId inválido removidas do capítulo ${params.chapter.chapterNumber}`,
    )
    for (const section of parsed.sections) {
      section.citations = (section.citations ?? []).filter(
        (c) => !c.sourceId || validSourceIds.has(c.sourceId),
      )
    }
  }

  return parsed
}

// ─── AGENTE 3 ────────────────────────────────────────────────────────────────

export async function generateIntroduction(params: {
  bookTitle: string
  description: string
  authors: string
  chapterTitles: string[]
}): Promise<string> {
  const response = await minimaxChat(
    [
      {
        role: 'system',
        content:
          'Você é um professor universitário especialista em redação acadêmica. Escreva em português brasileiro formal. Nunca invente dados ou referências.',
      },
      { role: 'user', content: buildAssemblerIntroductionPrompt(params) },
    ],
    { temperature: 0.5, maxTokens: 3000 },
  )
  return extractText(response)
}

export async function generateConclusion(params: {
  bookTitle: string
  chapterTitles: string[]
  chapterObjectives: string[]
}): Promise<string> {
  const response = await minimaxChat(
    [
      {
        role: 'system',
        content:
          'Você é um professor universitário especialista em redação acadêmica. Escreva em português brasileiro formal. Nunca invente dados ou referências.',
      },
      { role: 'user', content: buildAssemblerConclusionPrompt(params) },
    ],
    { temperature: 0.5, maxTokens: 3000 },
  )
  return extractText(response)
}
