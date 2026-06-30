<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key breaking changes in Next.js 16:
- `params` in Route Handlers and Pages is ASYNC: always `await ctx.params` before accessing properties
- Route Handlers use native Web `Request`/`Response` APIs
- Route context typed with global `RouteContext<'/path/[param]'>` helper
- `headers()`, `cookies()` are async — must be awaited
- No `getServerSideProps` or `getStaticProps` — use Server Components and Route Handlers only
<!-- END:nextjs-agent-rules -->

# AGENTS.md — acadbook

## Objetivo

App gerador de livros acadêmicos completos com IA multiagente.

- **Backend / Auth / Storage**: Appwrite (self-hosted)
- **Pesquisa e fundamentação**: Perplexity API (`sonar-pro`)
- **Geração textual**: MiniMax API (`api.minimaxi.com`)
- **Execução dos agentes**: Appwrite Functions (Node.js runtime)
- **Exportação PDF**: Playwright (headless, dentro de Appwrite Function)
- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui

## Regras obrigatórias

- Não modificar arquivos sem autorização explícita.
- Não inventar referências bibliográficas. Nunca.
- Toda citação direta ou indireta deve ter `sourceId` vinculado a fonte real da Perplexity.
- O plano do livro deve ser aprovado pelo autor antes da geração dos capítulos.
- Capítulos são gerados individualmente (um por execução de Function) para evitar timeout.
- Salvar progresso no Appwrite após cada etapa concluída.
- Permitir retry em caso de falha — registrar erro, manter status `failed`, habilitar novo disparo.
- Chaves da Perplexity e MiniMax NUNCA devem ser expostas no frontend.
- Todas as chamadas às APIs de IA são feitas exclusivamente dentro de Appwrite Functions.
- Validar entradas no frontend (Zod) e novamente no backend (Appwrite Function) antes de processar.
- Sanitizar HTML antes de gerar PDF.
- Evitar injeção de prompt nos campos de entrada do usuário.

## Estrutura de pastas

```
src/
  app/                        # Next.js App Router
    (auth)/                   # Rotas de login/registro
    books/                    # Dashboard e CRUD de livros
      [id]/                   # Detalhes, plano, capítulos, preview, export
    api/                      # Route Handlers (backend seguro)
  components/
    book/                     # Componentes do domínio de livros
    ui/                       # shadcn/ui components
  lib/
    appwrite/                 # Client, server, databases, storage, auth, collections
    perplexity/               # Client e funções de pesquisa
    minimax/                  # Client e funções de geração de texto
    agents/                   # Orquestração dos agentes (lógica compartilhada)
    pdf/                      # Templates e geração de HTML editorial
    validation/               # Schemas Zod
  types/                      # Tipos TypeScript globais

appwrite/
  functions/
    generate-book-plan/       # Agente 1 — Planejador
    research-chapter/         # Parte do Agente 2 — Perplexity
    generate-chapter/         # Parte do Agente 2 — MiniMax
    assemble-book/            # Agente 3 — Montador
    export-pdf/               # Agente 3 — Playwright PDF
    retry-generation/         # Retry de etapas falhas

docs/
  DATABASE_SCHEMA.md
  ARCHITECTURE.md
  PROMPTS.md
```

## Agentes

### Agente 1 — Planejador Acadêmico (`generate-book-plan`)

- **Entrada**: título, descrição, autores, chaptersCount, sectionsPerChapter
- **Saída**: plano JSON com capítulos, seções, objetivos, keywords
- **Regras**: respeitar exatamente os limites, salvar em `book_plans`, status `generated`

### Agente 2 — Escritor Acadêmico (`research-chapter` + `generate-chapter`)

- **Pesquisa** (Perplexity): fontes reais por capítulo/seção, salvas em `sources`
- **Geração** (MiniMax): capítulo completo com citações rastreáveis, salvo em `chapters`
- **Regras**: uma execução por capítulo; não inventar fontes; validar antes de salvar

### Agente 3 — Editor e Montador (`assemble-book` + `export-pdf`)

- **Entrada**: todos os capítulos concluídos, fontes consolidadas, template escolhido
- **Saída**: HTML editorial → PDF via Playwright → upload no Appwrite Storage
- **Regras**: referências deduplicadas; avisar que ficha catalográfica é preliminar

## Status dos documentos

### books
`draft` → `planning` → `awaiting_plan_approval` → `plan_approved` → `generating_chapters` → `assembling` → `exporting_pdf` → `completed` | `failed`

### book_plans
`draft` → `generated` → `edited` → `approved` | `rejected`

### chapters
`pending` → `researching` → `generating` → `validating` → `completed` | `failed`

### exports
`pending` → `generating` → `completed` | `failed`

## Limites de validação

| Campo | Mínimo | Máximo |
|---|---|---|
| Capítulos | 3 | 12 |
| Seções por capítulo | 3 | 6 |
| Parágrafos por seção | 3 | 8 |
| Tamanho do parágrafo | ~150 chars | ~250 chars |

## Qualidade técnica

- TypeScript estrito em todo o projeto
- Componentes reutilizáveis com props tipadas
- Validação com Zod no frontend e backend
- Logs por etapa na collection `generation_logs`
- Tratamento de erros com mensagem sem expor dados sensíveis
- Código simples, seguro e testável
- Sem `any` implícito

## Variáveis de ambiente

Ver `.env.example` para lista completa e documentação de cada variável.
Nunca commitar `.env.local` ou qualquer arquivo com segredos reais.
