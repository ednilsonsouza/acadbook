import { z } from 'zod'

export const BOOK_LIMITS = {
  chaptersMin: 3,
  chaptersMax: 12,
  sectionsMin: 3,
  sectionsMax: 6,
  paragraphsMin: 3,
  paragraphsMax: 8,
  titleMaxLength: 200,
  descriptionMaxLength: 2000,
  authorsMaxLength: 500,
} as const

export const citationStyleSchema = z.enum(['ABNT', 'APA', 'Vancouver', 'Chicago'])

export const bookTemplateSchema = z.enum([
  'academic-classic',
  'academic-modern',
  'academic-minimal',
])

export const createBookSchema = z.object({
  title: z
    .string()
    .min(3, 'Título deve ter no mínimo 3 caracteres')
    .max(BOOK_LIMITS.titleMaxLength, `Título deve ter no máximo ${BOOK_LIMITS.titleMaxLength} caracteres`)
    .trim(),

  description: z
    .string()
    .min(20, 'Descrição deve ter no mínimo 20 caracteres')
    .max(BOOK_LIMITS.descriptionMaxLength, `Descrição deve ter no máximo ${BOOK_LIMITS.descriptionMaxLength} caracteres`)
    .trim(),

  authors: z
    .string()
    .min(3, 'Informe ao menos um autor')
    .max(BOOK_LIMITS.authorsMaxLength, `Campo de autores deve ter no máximo ${BOOK_LIMITS.authorsMaxLength} caracteres`)
    .trim(),

  chaptersCount: z
    .number({ error: 'Quantidade de capítulos deve ser um número' })
    .int()
    .min(BOOK_LIMITS.chaptersMin, `O livro deve ter no mínimo ${BOOK_LIMITS.chaptersMin} capítulos`)
    .max(BOOK_LIMITS.chaptersMax, `O livro deve ter no máximo ${BOOK_LIMITS.chaptersMax} capítulos`),

  sectionsPerChapter: z
    .number({ error: 'Quantidade de seções deve ser um número' })
    .int()
    .min(BOOK_LIMITS.sectionsMin, `Cada capítulo deve ter no mínimo ${BOOK_LIMITS.sectionsMin} seções`)
    .max(BOOK_LIMITS.sectionsMax, `Cada capítulo deve ter no máximo ${BOOK_LIMITS.sectionsMax} seções`),

  paragraphsPerSection: z
    .number({ error: 'Quantidade de parágrafos deve ser um número' })
    .int()
    .min(BOOK_LIMITS.paragraphsMin, `Cada seção deve ter no mínimo ${BOOK_LIMITS.paragraphsMin} parágrafos`)
    .max(BOOK_LIMITS.paragraphsMax, `Cada seção deve ter no máximo ${BOOK_LIMITS.paragraphsMax} parágrafos`),

  citationStyle: citationStyleSchema,

  templateId: bookTemplateSchema.optional(),
})

export type CreateBookFormValues = z.infer<typeof createBookSchema>

export const updateBookSchema = createBookSchema.partial()

export type UpdateBookFormValues = z.infer<typeof updateBookSchema>
