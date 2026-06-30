"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_appwrite_1 = require("node-appwrite");
/**
 * Appwrite Function: retry-generation
 * Retry de etapas falhas — pesquisa ou geração de capítulo
 *
 * Entrada (body JSON):
 *   bookId: string
 *   chapterId: string
 *   step: 'research' | 'generate'
 *   planId?: string
 *   paragraphsPerSection?: number
 *   citationStyle?: string
 *   bookTitle?: string
 */
const DB_ID = process.env.APPWRITE_DATABASE_ID ?? 'acadbook';
const COLL_BOOKS = process.env.APPWRITE_COLLECTION_BOOKS ?? 'books';
const COLL_CHAPTERS = process.env.APPWRITE_COLLECTION_CHAPTERS ?? 'chapters';
const COLL_LOGS = process.env.APPWRITE_COLLECTION_GENERATION_LOGS ?? 'generation_logs';
const MAX_RETRIES = parseInt(process.env.MAX_GENERATION_RETRIES ?? '3', 10);
const FN_RESEARCH = process.env.APPWRITE_FUNCTION_RESEARCH_CHAPTER ?? 'research-chapter';
const FN_GENERATE = process.env.APPWRITE_FUNCTION_GENERATE_CHAPTER ?? 'generate-chapter';
function truncate(s, max) {
    return (s ?? '').slice(0, max);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
exports.default = async ({ req, res, log, error }) => {
    const client = new node_appwrite_1.Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? '')
        .setKey(process.env.APPWRITE_API_KEY ?? '');
    const databases = new node_appwrite_1.Databases(client);
    const functionsClient = new node_appwrite_1.Functions(client);
    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
    catch {
        return res.json({ success: false, error: 'Body JSON inválido' }, 400);
    }
    const { bookId, chapterId, step, planId, paragraphsPerSection, citationStyle, bookTitle } = body;
    try {
        const chapterDoc = await databases.getDocument(DB_ID, COLL_CHAPTERS, chapterId);
        const retryCount = chapterDoc.retryCount ?? 0;
        if (retryCount >= MAX_RETRIES) {
            return res.json({
                success: false,
                error: `Máximo de ${MAX_RETRIES} tentativas atingido. Intervenção manual necessária.`,
            }, 400);
        }
        log(`Retry ${step} para capítulo ${chapterId} (tentativa ${retryCount + 1})`);
        // Resetar status para permitir nova execução
        await databases.updateDocument(DB_ID, COLL_CHAPTERS, chapterId, {
            status: 'pending',
            errorMessage: null,
        });
        // Registrar log de retry
        await databases.createDocument(DB_ID, COLL_LOGS, node_appwrite_1.ID.unique(), {
            bookId,
            chapterId,
            agent: 'retry-generation',
            step: `retry_${step}`,
            status: 'info',
            message: `Retry iniciado para etapa ${step} (tentativa ${retryCount + 1} de ${MAX_RETRIES})`,
            metadata: null,
        });
        // Buscar dados do capítulo para o retry
        const bookDoc = await databases.getDocument(DB_ID, COLL_BOOKS, bookId);
        if (step === 'research') {
            // Recarregar dados do plano para montar o payload correto
            const plansRes = await databases.listDocuments(DB_ID, 'book_plans', []);
            const plan = plansRes.documents.find((p) => p.bookId === bookId && p.status === 'approved');
            if (!plan) {
                return res.json({ success: false, error: 'Plano aprovado não encontrado' }, 400);
            }
            const planChapters = JSON.parse(plan.chapters);
            const chapterPlan = planChapters.find((c) => c.chapterNumber === chapterDoc.chapterNumber);
            if (!chapterPlan) {
                return res.json({ success: false, error: 'Capítulo não encontrado no plano' }, 400);
            }
            await functionsClient.createExecution(FN_RESEARCH, JSON.stringify({
                bookId,
                chapterId,
                chapterTitle: chapterPlan.title,
                chapterObjective: chapterPlan.objective,
                chapterKeywords: chapterPlan.keywords,
                sections: chapterPlan.sections,
                bookTitle: bookDoc.title,
            }), true);
        }
        else if (step === 'generate') {
            if (!planId) {
                return res.json({ success: false, error: 'planId obrigatório para retry de generate' }, 400);
            }
            await functionsClient.createExecution(FN_GENERATE, JSON.stringify({
                bookId,
                chapterId,
                planId,
                chapterNumber: chapterDoc.chapterNumber,
                paragraphsPerSection: paragraphsPerSection ?? bookDoc.paragraphsPerSection ?? 5,
                citationStyle: citationStyle ?? bookDoc.citationStyle ?? 'ABNT',
                bookTitle: bookTitle ?? bookDoc.title,
            }), true);
        }
        else {
            return res.json({ success: false, error: 'step inválido. Use: research | generate' }, 400);
        }
        log(`Retry disparado para capítulo ${chapterId}, etapa ${step}`);
        return res.json({ success: true, chapterId, step, attempt: retryCount + 1 });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Falha no retry de ${chapterId}: ${message}`);
        try {
            await databases.createDocument(DB_ID, COLL_LOGS, node_appwrite_1.ID.unique(), {
                bookId,
                chapterId,
                agent: 'retry-generation',
                step: `retry_${step}`,
                status: 'error',
                message: truncate(message, 500),
                metadata: null,
            });
        }
        catch {
            // Falha silenciosa
        }
        return res.json({ success: false, error: 'Falha no retry', detail: message }, 500);
    }
};
