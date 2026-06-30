import { z } from 'zod'

export const citationRefSchema = z.object({
  sourceId: z.string().min(1, 'sourceId é obrigatório — toda citação precisa de fonte real'),
  text: z.string().min(1).max(2000),
  type: z.enum(['direct', 'indirect']),
  page: z.string().optional(),
})

export const sectionContentSchema = z.object({
  sectionNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  paragraphs: z
    .array(
      z.string()
        .min(150, 'Cada parágrafo deve ter no mínimo 150 caracteres')
        .max(1000, 'Cada parágrafo deve ter no máximo 1000 caracteres')
    )
    .min(3, 'Cada seção deve ter no mínimo 3 parágrafos')
    .max(8, 'Cada seção deve ter no máximo 8 parágrafos'),
  citations: z.array(citationRefSchema),
})

export const chapterContentSchema = z.object({
  introduction: z.string().max(2000).optional(),
  sections: z.array(sectionContentSchema).min(1),
  conclusion: z.string().max(2000).optional(),
})

export const retryChapterSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
})

export type CitationRefValues = z.infer<typeof citationRefSchema>
export type SectionContentValues = z.infer<typeof sectionContentSchema>
export type ChapterContentValues = z.infer<typeof chapterContentSchema>
