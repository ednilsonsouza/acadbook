/**
 * Client da Perplexity API.
 * Este módulo deve ser importado SOMENTE em Appwrite Functions ou API Routes server-side.
 * NUNCA importar em componentes client do Next.js.
 */

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface PerplexityCitation {
  url: string
  title?: string
  snippet?: string
}

export interface PerplexityResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
    delta?: {
      role: string
      content: string
    }
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  citations?: string[]
  search_results?: Array<{
    title: string
    url: string
    date?: string
    author?: string
  }>
}

const PERPLEXITY_API_URL =
  process.env.PERPLEXITY_API_URL ?? 'https://api.perplexity.ai'

const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL ?? 'sonar-pro'

const TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '60000', 10)

export async function perplexityChat(
  messages: PerplexityMessage[],
  options?: {
    model?: string
    maxTokens?: number
    temperature?: number
    returnCitations?: boolean
    returnSearchResults?: boolean
  },
): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY não configurada')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${PERPLEXITY_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? PERPLEXITY_MODEL,
        messages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.2,
        return_citations: options?.returnCitations ?? true,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
        ...(options?.returnSearchResults ? { return_search_results: true } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Perplexity API erro ${response.status}: ${errorText}`)
    }

    return await response.json() as PerplexityResponse
  } finally {
    clearTimeout(timer)
  }
}
