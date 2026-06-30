export type BookPlanStatus = 'draft' | 'generated' | 'edited' | 'approved' | 'rejected'

export interface PlanSection {
  sectionNumber: number
  title: string
  objective: string
  keywords: string[]
}

export interface PlanChapter {
  chapterNumber: number
  title: string
  objective: string
  keywords: string[]
  sections: PlanSection[]
}

export interface BookPlan {
  $id: string
  $createdAt: string
  $updatedAt: string
  bookId: string
  version: number
  status: BookPlanStatus
  chapters: PlanChapter[]
  approvedAt?: string
}

export interface CreateBookPlanInput {
  bookId: string
  version: number
  chapters: PlanChapter[]
}

export interface UpdateBookPlanInput {
  status?: BookPlanStatus
  chapters?: PlanChapter[]
  approvedAt?: string
}
