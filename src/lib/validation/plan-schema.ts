import { z } from 'zod'

export const planSectionSchema = z.object({
  sectionNumber: z.number().int().positive(),
  title: z.string().min(3, 'Título da seção deve ter no mínimo 3 caracteres').max(200).trim(),
  objective: z.string().min(10, 'Objetivo deve ter no mínimo 10 caracteres').max(500).trim(),
  keywords: z.array(z.string().min(1).max(100)).min(1, 'Informe ao menos uma palavra-chave').max(10),
})

export const planChapterSchema = z.object({
  chapterNumber: z.number().int().positive(),
  title: z.string().min(3, 'Título do capítulo deve ter no mínimo 3 caracteres').max(200).trim(),
  objective: z.string().min(10, 'Objetivo deve ter no mínimo 10 caracteres').max(500).trim(),
  keywords: z.array(z.string().min(1).max(100)).min(1, 'Informe ao menos uma palavra-chave').max(10),
  sections: z.array(planSectionSchema).min(3, 'Cada capítulo deve ter ao menos 3 seções').max(6),
})

export const bookPlanSchema = z.object({
  bookId: z.string().min(1),
  version: z.number().int().positive(),
  chapters: z.array(planChapterSchema).min(3, 'O plano deve ter ao menos 3 capítulos').max(12),
})

export const updatePlanSchema = z.object({
  chapters: z.array(planChapterSchema).min(3).max(12).optional(),
  status: z.enum(['draft', 'generated', 'edited', 'approved', 'rejected']).optional(),
})

export type PlanSectionFormValues = z.infer<typeof planSectionSchema>
export type PlanChapterFormValues = z.infer<typeof planChapterSchema>
export type BookPlanFormValues = z.infer<typeof bookPlanSchema>
