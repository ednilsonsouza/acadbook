# DATABASE_SCHEMA.md — acadbook

## Database ID: `acadbook`

---

## Collection: `books`

| Atributo | Tipo | Tamanho | Obrigatório | Notas |
|---|---|---|---|---|
| `title` | string | 200 | Sim | Título do livro |
| `description` | string | 2000 | Sim | Descrição geral |
| `authors` | string | 500 | Sim | Nomes dos autores |
| `chaptersCount` | integer | — | Sim | 3–12 |
| `sectionsPerChapter` | integer | — | Sim | 3–6 |
| `paragraphsPerSection` | integer | — | Sim | 3–8 |
| `status` | string | 50 | Sim | Ver status abaixo |
| `approvedPlanId` | string | 64 | Não | ID do plano aprovado |
| `pdfFileId` | string | 64 | Não | ID do arquivo no Storage |
| `createdBy` | string | 64 | Sim | User ID do Appwrite |
| `errorMessage` | string | 500 | Não | Mensagem de erro em caso de falha |
| `templateId` | string | 64 | Não | academic-classic / academic-modern / academic-minimal |
| `citationStyle` | string | 20 | Sim | ABNT / APA / Vancouver / Chicago |
| `assembledHtml` | string | 65535 | Não | HTML editorial montado |

**Status possíveis:** `draft` → `planning` → `awaiting_plan_approval` → `plan_approved` → `generating_chapters` → `assembling` → `exporting_pdf` → `completed` | `failed`

**Índices:** `createdBy` (key), `status` (key), `$createdAt` (key)

**Permissões por documento:** `read("user:ID")`, `update("user:ID")`, `delete("user:ID")`

---

## Collection: `book_plans`

| Atributo | Tipo | Tamanho | Obrigatório | Notas |
|---|---|---|---|---|
| `bookId` | string | 64 | Sim | FK para books |
| `version` | integer | — | Sim | Versão do plano (1, 2, 3...) |
| `status` | string | 20 | Sim | Ver status abaixo |
| `chapters` | string | 65535 | Sim | JSON com estrutura do plano |
| `approvedAt` | string | 32 | Não | ISO datetime de aprovação |

**Status possíveis:** `draft` → `generated` → `edited` → `approved` | `rejected`

**Índices:** `bookId` (key), `bookId + version` (key)

---

## Collection: `chapters`

| Atributo | Tipo | Tamanho | Obrigatório | Notas |
|---|---|---|---|---|
| `bookId` | string | 64 | Sim | FK para books |
| `planId` | string | 64 | Sim | FK para book_plans |
| `chapterNumber` | integer | — | Sim | 1-12 |
| `title` | string | 200 | Sim | Título do capítulo |
| `content` | string | 65535 | Não | JSON com conteúdo gerado |
| `status` | string | 20 | Sim | Ver status abaixo |
| `errorMessage` | string | 500 | Não | Mensagem de erro |
| `generatedAt` | string | 32 | Não | ISO datetime da geração |
| `retryCount` | integer | — | Sim | Número de tentativas (default: 0) |

**Status possíveis:** `pending` → `researching` → `generating` → `validating` → `completed` | `failed`

**Índices:** `bookId` (key), `bookId + status` (key), `bookId + chapterNumber` (unique)

---

## Collection: `sources`

| Atributo | Tipo | Tamanho | Obrigatório | Notas |
|---|---|---|---|---|
| `bookId` | string | 64 | Sim | FK para books |
| `chapterId` | string | 64 | Sim | FK para chapters |
| `sectionId` | string | 64 | Não | Referência à seção |
| `title` | string | 500 | Sim | Título da fonte |
| `authors` | string | 500 | Sim | Autores da fonte |
| `url` | string | 2048 | Sim | URL verificável |
| `publisher` | string | 200 | Não | Editora |
| `publishedAt` | string | 50 | Não | Data de publicação |
| `accessedAt` | string | 32 | Sim | ISO datetime de acesso |
| `excerpt` | string | 2000 | Não | Trecho relevante |
| `citationType` | string | 20 | Sim | direct / indirect / reference_only |
| `usedInParagraphId` | string | 64 | Não | Rastreabilidade |
| `metadata` | string | 2000 | Não | JSON com metadados extras |
| `isComplete` | boolean | — | Sim | Se tem todos os dados mínimos |

**Índices:** `bookId` (key), `chapterId` (key), `isComplete` (key)

---

## Collection: `references`

| Atributo | Tipo | Tamanho | Obrigatório | Notas |
|---|---|---|---|---|
| `bookId` | string | 64 | Sim | FK para books |
| `sourceId` | string | 64 | Sim | FK para sources |
| `style` | string | 20 | Sim | ABNT / APA / etc. |
| `formattedReference` | string | 2000 | Sim | Referência formatada |

**Índices:** `bookId` (key), `sourceId` (key)

---

## Collection: `exports`

| Atributo | Tipo | Tamanho | Obrigatório | Notas |
|---|---|---|---|---|
| `bookId` | string | 64 | Sim | FK para books |
| `format` | string | 10 | Sim | pdf |
| `fileId` | string | 64 | Não | ID do arquivo no Storage |
| `status` | string | 20 | Sim | Ver status abaixo |
| `errorMessage` | string | 500 | Não | Mensagem de erro |
| `templateId` | string | 64 | Sim | ID do template usado |

**Status possíveis:** `pending` → `generating` → `completed` | `failed`

**Índices:** `bookId` (key), `status` (key)

---

## Collection: `generation_logs`

| Atributo | Tipo | Tamanho | Obrigatório | Notas |
|---|---|---|---|---|
| `bookId` | string | 64 | Sim | FK para books |
| `chapterId` | string | 64 | Não | FK para chapters |
| `agent` | string | 100 | Sim | Nome da function/agente |
| `step` | string | 100 | Sim | Etapa do processo |
| `status` | string | 20 | Sim | info / success / warning / error |
| `message` | string | 1000 | Sim | Mensagem legível |
| `metadata` | string | 2000 | Não | JSON com dados extras |

**Índices:** `bookId` (key), `$createdAt` (key), `status` (key)

---

## Storage Bucket: `book-exports`

| Configuração | Valor |
|---|---|
| Tamanho máximo de arquivo | 30.000.000 bytes (28.6 MB) |
| Extensões permitidas | `pdf` |
| Encryption | false (self-hosted) |
| Antivirus | false (self-hosted) |
| File Security | true (permissão por documento) |

---

## Orçamento de bytes por collection

```
books:           200+2000+500+64+64+64+500+64+65535 = ~69.000 (campo assembledHtml domina)
book_plans:      64+20+65535+32 = ~65.651
chapters:        64+64+20+200+65535+500+32+0 = ~66.415
sources:         64+64+64+500+500+2048+200+50+32+2000+20+64+2000+0 = ~7.610 ✓
references:      64+64+20+2000 = ~2.148 ✓
exports:         64+10+64+20+500+64 = ~722 ✓
generation_logs: 64+64+100+100+20+1000+2000 = ~3.348 ✓
```

> **NOTA:** As collections `books`, `book_plans` e `chapters` armazenam campos JSON grandes como string.
> O limite de 16.384 bytes aplica-se à **soma dos sizes declarados dos atributos string**, não ao conteúdo real.
> Configure `size: 65535` apenas para campos que realmente precisam (assembledHtml, chapters, content).
> Verifique o orçamento total antes de adicionar novos atributos.
