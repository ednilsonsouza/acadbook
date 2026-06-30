import { z } from 'zod'

export const sourceMetadataSchema = z.record(z.string(), z.string().optional())

export const createSourceSchema = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
  sectionId: z.string().optional(),
  title: z.string().min(1, 'Título da fonte é obrigatório').max(500),
  authors: z.string().min(1, 'Autores são obrigatórios').max(500),
  url: z.string().url('URL da fonte deve ser válida'),
  publisher: z.string().max(200).optional(),
  publishedAt: z.string().max(50).optional(),
  accessedAt: z.string().datetime({ message: 'Data de acesso inválida' }),
  excerpt: z.string().max(2000).optional(),
  citationType: z.enum(['direct', 'indirect', 'reference_only']),
  metadata: sourceMetadataSchema.optional(),
  isComplete: z.boolean(),
})

export const sourceValidationSchema = createSourceSchema.refine(
  (data) => {
    // Citações diretas exigem excerpt e url completa
    if (data.citationType === 'direct') {
      return !!data.excerpt && data.excerpt.length > 0
    }
    return true
  },
  {
    message: 'Citações diretas devem ter um trecho (excerpt) da fonte',
    path: ['excerpt'],
  }
)

export type CreateSourceValues = z.infer<typeof createSourceSchema>
