/**
 * Tipos auxiliares para respostas do Appwrite SDK
 */
import type { Models } from 'appwrite'

export type AppwriteDocument = Models.Document

export interface AppwriteListResponse<T> {
  total: number
  documents: T[]
}

export interface AppwriteError {
  code: number
  message: string
  type: string
  version: string
}

/**
 * Tipo utilitário para combinar Document com campos customizados
 */
export type WithDocument<T> = T & Models.Document
