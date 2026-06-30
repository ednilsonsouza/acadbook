"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_appwrite_1 = require("node-appwrite");
/**
 * Appwrite Function: generate-book-plan
 * Agente 1 — Planejador Acadêmico
 *
 * Entrada (body JSON):
 *   bookId: string
 *   title: string
 *   description: string
 *   authors: string
 *   chaptersCount: number
 *   sectionsPerChapter: number
 *
 * Saída: plano salvo em book_plans, status do livro atualizado
 */
const DB_ID = process.env.APPWRITE_DATABASE_ID ?? 'acadbook';
const COLL_BOOKS = process.env.APPWRITE_COLLECTION_BOOKS ?? 'books';
const COLL_PLANS = process.env.APPWRITE_COLLECTION_BOOK_PLANS ?? 'book_plans';
const MINIMAX_API_URL = process.env.MINIMAX_API_URL ?? 'https://api.minimaxi.com/v1';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL ?? 'MiniMax-Text-01';
function truncate(s, max) {
    return (s ?? '').slice(0, max);
}
async function minimaxChat(messages, maxTokens = 8000) {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey)
        throw new Error('MINIMAX_API_KEY não configurada');
    const res = await fetch(`${MINIMAX_API_URL}/text/chatcompletion_v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MINIMAX_MODEL, messages, max_tokens: maxTokens, temperature: 0.5, stream: false }),
    });
    if (!res.ok)
        throw new Error(`MiniMax erro ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.base_resp && data.base_resp.status_code !== 0)
        throw new Error(`MiniMax: ${data.base_resp.status_msg}`);
    return data.choices[0]?.message?.content ?? '';
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
exports.default = async ({ req, res, log, error }) => {
    const client = new node_appwrite_1.Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? '')
        .setKey(process.env.APPWRITE_API_KEY ?? '');
    const databases = new node_appwrite_1.Databases(client);
    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
    catch {
        return res.json({ success: false, error: 'Body JSON inválido' }, 400);
    }
    const { bookId, title, description, authors, chaptersCount, sectionsPerChapter } = body;
    if (!bookId || !title || !chaptersCount || !sectionsPerChapter) {
        return res.json({ success: false, error: 'Campos obrigatórios ausentes' }, 400);
    }
    if (chaptersCount < 3 || chaptersCount > 12 || sectionsPerChapter < 3 || sectionsPerChapter > 6) {
        return res.json({ success: false, error: 'Limites de capítulos/seções inválidos' }, 400);
    }
    try {
        // Atualizar status do livro para 'planning'
        await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, { status: 'planning' });
        log(`Livro ${bookId} atualizado para status planning`);
        // Verificar versão atual do plano
        const existingPlans = await databases.listDocuments(DB_ID, COLL_PLANS, []);
        const version = existingPlans.documents.filter((d) => d.bookId === bookId).length + 1;
        const systemPrompt = `Você é um professor universitário e especialista em metodologia acadêmica.
Crie planos estruturados para livros acadêmicos com rigor metodológico.
Responda APENAS com JSON válido, sem texto adicional fora do JSON.
Nunca invente informações.`;
        const userPrompt = `Crie um plano acadêmico para o livro:
Título: ${title}
Descrição: ${description}
Autores: ${authors}
Capítulos: ${chaptersCount}
Seções por capítulo: ${sectionsPerChapter}

Retorne JSON com a estrutura:
{"chapters":[{"chapterNumber":1,"title":"...","objective":"...","keywords":["..."],"sections":[{"sectionNumber":1,"title":"...","objective":"...","keywords":["..."]}]}]}

Exatamente ${chaptersCount} capítulos, cada um com exatamente ${sectionsPerChapter} seções.`;
        const rawResponse = await minimaxChat([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]);
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error('Resposta da MiniMax não contém JSON válido');
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.chapters || parsed.chapters.length !== chaptersCount) {
            throw new Error(`Plano gerou ${parsed.chapters?.length} capítulos, esperado ${chaptersCount}`);
        }
        log(`Plano gerado com ${parsed.chapters.length} capítulos`);
        // Salvar plano
        const plan = await databases.createDocument(DB_ID, COLL_PLANS, 'unique()', {
            bookId,
            version,
            status: 'generated',
            chapters: JSON.stringify(parsed.chapters),
            approvedAt: null,
        });
        // Atualizar status do livro
        await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, {
            status: 'awaiting_plan_approval',
        });
        log(`Plano ${plan.$id} salvo. Livro aguardando aprovação.`);
        return res.json({ success: true, planId: plan.$id, version });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Falha ao gerar plano para livro ${bookId}: ${message}`);
        try {
            await databases.updateDocument(DB_ID, COLL_BOOKS, bookId, {
                status: 'failed',
                errorMessage: truncate(message, 500),
            });
        }
        catch {
            // Falha silenciosa no rollback
        }
        return res.json({ success: false, error: 'Falha ao gerar plano', detail: message }, 500);
    }
};
