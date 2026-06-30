# ARCHITECTURE.md — acadbook

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER / USUÁRIO                       │
│  Next.js 16 App Router (React 19 + TypeScript + Tailwind CSS)  │
│  shadcn/ui — componentes acessíveis e reutilizáveis             │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/Appwrite SDK (browser)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APPWRITE SELF-HOSTED                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Auth    │  │ Database │  │ Storage  │  │  Functions   │  │
│  │ (session)│  │(7 colls) │  │ (PDFs)   │  │  (agentes)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
└─────────────────────┬──────────────────────┬────────────────────┘
                      │                      │ Chamadas internas
                      ▼                      ▼
              ┌───────────────┐    ┌──────────────────────┐
              │ Perplexity API│    │   MiniMax API         │
              │ sonar-pro     │    │   api.minimaxi.com    │
              │ (pesquisa)    │    │   (geração textual)   │
              └───────────────┘    └──────────────────────┘
```

---

## Camadas da aplicação

### Frontend (Next.js 16 App Router)

- **Server Components**: busca de dados, listagem de livros, detalhes
- **Client Components**: formulários interativos, editor de plano, progresso em tempo real
- **API Routes** (`src/app/api/`): proxy seguro para disparar Appwrite Functions com validação
- **Middleware**: verificação de sessão para rotas protegidas

### Backend (Appwrite)

- **Auth**: sessões com email/senha, cookie `acadbook-session` (httpOnly)
- **Database**: 7 collections com permissões por documento (por userId)
- **Storage**: bucket `book-exports` com PDFs finais
- **Functions**: 6 funções Node.js para execução dos agentes

---

## Fluxo de dados por etapa

### Etapa 1 — Criar livro

```
Frontend → POST /api/books
  → valida com Zod (chaptersCount 3–12, sectionsPerChapter 3–6, etc.)
  → createAdminClient().databases.createDocument(books)
  → livro com status: draft
```

### Etapa 2 — Gerar plano (Agente 1)

```
Frontend → POST /api/books/[id]/plan
  → atualiza status: planning
  → dispara Appwrite Function generate-book-plan
    → MiniMax gera plano JSON
    → salva em book_plans com status: generated
    → atualiza livro: awaiting_plan_approval
```

### Etapa 3 — Aprovar plano

```
Frontend → PATCH /api/books/[id]/plan/approve
  → atualiza book_plans: status: approved
  → atualiza books: status: plan_approved, approvedPlanId
  → cria registros vazios em chapters (um por capítulo)
  → atualiza books: status: generating_chapters
```

### Etapa 4 — Pesquisar fontes (Agente 2 — parte 1)

```
Para cada capítulo:
Frontend → POST /api/books/[id]/chapters/[chapterId]/research
  → dispara Appwrite Function research-chapter
    → Perplexity busca fontes reais
    → normaliza e salva em sources
    → atualiza chapter: status: researching → (concluído pela function generate-chapter)
```

### Etapa 5 — Gerar capítulo (Agente 2 — parte 2)

```
Frontend → POST /api/books/[id]/chapters/[chapterId]/generate
  → dispara Appwrite Function generate-chapter
    → carrega fontes do chapterId
    → MiniMax gera conteúdo com base nas fontes
    → valida rastreabilidade das citações
    → salva em chapters: content (JSON)
    → status: completed
    → se todos concluídos: atualiza books: status: assembling
```

### Etapa 6 — Montar livro (Agente 3)

```
Frontend → POST /api/books/[id]/assemble
  → dispara Appwrite Function assemble-book
    → gera introdução e considerações finais com MiniMax
    → consolida e deduplica referências (salva em references)
    → monta HTML editorial completo
    → salva assembledHtml no livro
    → atualiza books: status: exporting_pdf
```

### Etapa 7 — Exportar PDF

```
Frontend → POST /api/books/[id]/export
  → cria registro em exports: status: pending
  → dispara Appwrite Function export-pdf
    → Playwright renderiza HTML em A4
    → gera PDF com estilos premium
    → upload para Storage bucket book-exports
    → atualiza exports: status: completed, fileId
    → atualiza books: status: completed, pdfFileId
```

---

## Segurança

| Medida | Implementação |
|---|---|
| Chaves de IA no servidor | Apenas em Appwrite Functions (env variables) |
| Sessões | Cookie httpOnly, sameSite: lax, secure em produção |
| Permissões por usuário | `Permission.read(Role.user(userId))` em cada documento |
| Validação dupla | Zod no frontend + validação nas Functions |
| Sanitização HTML | Antes do Playwright renderizar o PDF |
| Proteção contra prompt injection | Limitar tamanho dos campos, escapar inputs nos prompts |
| API Key | Apenas no servidor (node-appwrite), nunca no browser |

---

## Estrutura de pastas

```
src/
  app/
    (auth)/           # Login, registro (sem layout de livros)
    books/            # Dashboard e CRUD
      [id]/           # Detalhes, plano, capítulos, preview, export
    api/              # Route Handlers (backend Next.js)
  components/
    book/             # Componentes do domínio
    ui/               # shadcn/ui
  lib/
    appwrite/         # client, server, databases, storage, auth, collections
    perplexity/       # client, research, normalize-sources
    minimax/          # client, generate-text, prompts
    agents/           # Orquestração (helpers compartilhados)
    pdf/              # Templates e geração de HTML editorial
    validation/       # Schemas Zod
  types/              # Tipos TypeScript globais

appwrite/
  functions/
    generate-book-plan/
    research-chapter/
    generate-chapter/
    assemble-book/
    export-pdf/         # Requer imagem Docker com Playwright
    retry-generation/
```

---

## Decisões de design

| Decisão | Razão |
|---|---|
| Capítulos gerados individualmente | Evitar timeout das Appwrite Functions (limite 15–30s) |
| JSON como string no Appwrite | Appwrite não tem tipo JSON nativo; serializar/desserializar no código |
| Agentes separados por Function | Isolamento, retry independente, monitoramento granular |
| MiniMax para geração + Perplexity para pesquisa | Separação de responsabilidades — Perplexity tem acesso a fontes reais; MiniMax tem melhor capacidade de geração textual longa em português |
| Playwright no Appwrite (Docker customizado) | PDF de alta fidelidade ao HTML/CSS; alternativa: Gotenberg |
| pnpm workspace | Gerenciamento eficiente de monorepo com Functions compartilhando tipos |
