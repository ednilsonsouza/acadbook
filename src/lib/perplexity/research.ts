import { perplexityChat } from './client'
import { normalizeSources, deduplicateSources } from './normalize-sources'
import type { PlanChapter, PlanSection } from '@/types/plan'
import type { CreateSourceInput } from '@/types/source'

/**
 * Pesquisa fontes acadêmicas reais para um capítulo inteiro.
 * Retorna fontes normalizadas e deduplicadas.
 */
export async function researchChapter(
  chapter: PlanChapter,
  bookTitle: string,
  bookId: string,
  chapterId: string,
): Promise<Array<CreateSourceInput & { isIncomplete: boolean }>> {
  const keywordsStr = chapter.keywords.join(', ')
  const sectionsKeywords = chapter.sections
    .flatMap((s) => s.keywords)
    .join(', ')

  const prompt = `
Você é um assistente de pesquisa acadêmica especializado em buscar fontes reais e verificáveis.

Tema do livro: "${bookTitle}"
Capítulo: "${chapter.title}"
Objetivo: ${chapter.objective}
Palavras-chave do capítulo: ${keywordsStr}
Palavras-chave das seções: ${sectionsKeywords}

Sua tarefa:
1. Busque fontes acadêmicas reais e verificáveis sobre este tema.
2. Priorize artigos científicos, livros acadêmicos, teses e publicações de instituições reconhecidas.
3. Inclua autores, títulos, datas de publicação e URLs verificáveis.
4. Para cada fonte, forneça um trecho relevante (excerpt) que possa embasar citações.
5. NÃO invente fontes. Apenas use fontes que você encontrar nas buscas.
6. Apresente no mínimo 5 e no máximo 15 fontes relevantes.

Contexto adicional sobre as seções do capítulo:
${chapter.sections.map((s) => `- ${s.title}: ${s.objective}`).join('\n')}
`.trim()

  const response = await perplexityChat(
    [
      {
        role: 'system',
        content:
          'Você é um especialista em pesquisa acadêmica. Retorne apenas fontes reais e verificáveis. Nunca invente referências.',
      },
      { role: 'user', content: prompt },
    ],
    {
      returnCitations: true,
      returnSearchResults: true,
      temperature: 0.1,
    },
  )

  const sources = normalizeSources(response, bookId, chapterId)
  return deduplicateSources(sources)
}

/**
 * Pesquisa fontes específicas para uma seção de um capítulo.
 */
export async function researchSection(
  section: PlanSection,
  chapterTitle: string,
  bookTitle: string,
  bookId: string,
  chapterId: string,
): Promise<Array<CreateSourceInput & { isIncomplete: boolean }>> {
  const keywordsStr = section.keywords.join(', ')

  const prompt = `
Pesquise fontes acadêmicas reais para embasar a seguinte seção de um livro acadêmico.

Livro: "${bookTitle}"
Capítulo: "${chapterTitle}"
Seção: "${section.title}"
Objetivo da seção: ${section.objective}
Palavras-chave: ${keywordsStr}

Encontre 3 a 8 fontes reais, verificáveis e relevantes para este tópico específico.
Priorize artigos peer-reviewed, livros acadêmicos e publicações científicas.
Para cada fonte, inclua um trecho (excerpt) que possa ser usado como citação direta ou indireta.
NÃO invente fontes.
`.trim()

  const response = await perplexityChat(
    [
      {
        role: 'system',
        content:
          'Especialista em pesquisa acadêmica. Somente fontes reais. Nunca invente referências.',
      },
      { role: 'user', content: prompt },
    ],
    {
      returnCitations: true,
      returnSearchResults: true,
      temperature: 0.1,
    },
  )

  const sources = normalizeSources(response, bookId, chapterId, `section-${section.sectionNumber}`)
  return deduplicateSources(sources)
}
