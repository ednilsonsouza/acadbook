/**
 * Client da MiniMax API (endpoint global: api.minimaxi.com).
 * Este módulo deve ser importado SOMENTE em Appwrite Functions ou API Routes server-side.
 * NUNCA importar em componentes client do Next.js.
 */

export interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface MiniMaxResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
    logprobs: null
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  base_resp?: {
    status_code: number
    status_msg: string
  }
}

const MINIMAX_API_URL = process.env.MINIMAX_API_URL ?? 'https://api.minimaxi.com/v1'
const MINIMAX_MODEL = process.env.MINIMAX_MODEL ?? 'MiniMax-Text-01'
const TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '60000', 10)

export async function minimaxChat(
  messages: MiniMaxMessage[],
  options?: {
    model?: string
    maxTokens?: number
    temperature?: number
    topP?: number
  },
): Promise<MiniMaxResponse> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY não configurada')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${MINIMAX_API_URL}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? MINIMAX_MODEL,
        messages,
        max_tokens: options?.maxTokens ?? 8192,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP ?? 0.9,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MiniMax API erro ${response.status}: ${errorText}`)
    }

    const data = await response.json() as MiniMaxResponse

    // Verificar erro na resposta mesmo com status 200
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax API erro interno: ${data.base_resp.status_msg}`)
    }

    return data
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Extrai o texto da primeira choice da resposta MiniMax.
 */
export function extractText(response: MiniMaxResponse): string {
  return response.choices[0]?.message?.content ?? ''
}
