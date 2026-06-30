'use client'

import { Client, Account, Databases, Storage, Functions } from 'appwrite'

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!

function createClient() {
  const client = new Client()
  if (endpoint && projectId) {
    client.setEndpoint(endpoint).setProject(projectId)
  }
  return client
}

// Instâncias do SDK para uso no browser (client components)
export const client = createClient()
export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)
export const functions = new Functions(client)

export function isAppwriteConfigured(): boolean {
  return Boolean(endpoint && projectId)
}

export function getFileViewUrl(bucketId: string, fileId: string): string {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`
}

export function getFileDownloadUrl(bucketId: string, fileId: string): string {
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/download?project=${projectId}`
}
