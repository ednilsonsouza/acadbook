# Appwrite Functions Deployment Guide

## ⚠️ Important: Server Runtime Requirement

The Appwrite Functions in this project are written in **TypeScript / Node.js 20**. They require the Appwrite server to have the **Node.js** runtime installed.

If your Appwrite self-hosted server only has the **Python 3.9** runtime (common on lightweight EasyPanel installations), you have three options:

1. **Install Node.js runtime on your Appwrite server** (recommended for production)
2. **Rewrite the functions in Python** (significant refactor)
3. **Use the Vercel API Routes approach** (execute the agent logic directly in Next.js)

---

## Option 1: Install Node.js runtime on Appwrite (Recommended)

The Appwrite server needs the Node.js Docker image to be available. On EasyPanel:

1. Go to your Appwrite service in EasyPanel
2. Edit the `docker-compose.yml` or service configuration
3. Add the Node.js runtime to the `appwrite` service environment:

```yaml
environment:
  - _APP_FUNCTIONS_RUNTIMES=node-20.0
  - _APP_FUNCTIONS_BUILD_TIMEOUT=300
  - _APP_FUNCTIONS_CONTAINER_CPU=1000
  - _APP_FUNCTIONS_CONTAINER_MEMORY=1024
```

4. Restart the Appwrite service
5. Verify: `curl -H "X-Appwrite-Project: YOUR_ID" -H "X-Appwrite-Key: YOUR_KEY" https://your-appwrite/v1/functions/runtimes`

You should see `node-20.0` in the list.

### Deploy the functions

Once Node.js is available:

```bash
# Install Appwrite CLI (v22+)
npm install -g appwrite-cli

# Login
appwrite login --endpoint https://your-appwrite/v1

# Deploy all functions
cd acadbook
appwrite deploy function --all
```

The `appwrite.json` config file is already configured with:
- 5 standard functions (generate-book-plan, research-chapter, generate-chapter, assemble-book, retry-generation)
- `export-pdf` is NOT included (requires custom Docker image with Playwright)

### Manual deployment via REST API

If CLI doesn't work, you can deploy manually:

1. **Create function** (POST /v1/functions):
```bash
curl -X POST -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_ID" \
  -H "X-Appwrite-Key: YOUR_KEY" \
  -d '{"functionId":"generate-book-plan","name":"Generate Book Plan","runtime":"node-20.0","execute":["any"],"events":[],"schedule":"","timeout":60}' \
  https://your-appwrite/v1/functions
```

2. **Upload code** (create a tarball with `dist/main.js` + `node_modules` + `package.json`):
```bash
cd appwrite/functions/generate-book-plan
tar -czf code.tar.gz dist package.json node_modules
```

3. **Create deployment** (POST /v1/functions/{id}/deployments):
```bash
curl -X POST -H "Content-Type: application/gzip" \
  -H "X-Appwrite-Project: YOUR_ID" \
  -H "X-Appwrite-Key: YOUR_KEY" \
  -H "Content-Disposition: attachment; filename=\"code.tar.gz\"" \
  --data-binary @code.tar.gz \
  https://your-appwrite/v1/functions/generate-book-plan/deployments
```

4. **Set environment variables** (POST /v1/functions/{id}/variables):
```bash
curl -X POST -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_ID" \
  -H "X-Appwrite-Key: YOUR_KEY" \
  -d '{"key":"MINIMAX_API_KEY","value":"sk-cp-..."}' \
  https://your-appwrite/v1/functions/generate-book-plan/variables
```

---

## Option 2: Vercel API Routes (No Appwrite Functions needed)

If you can't install Node.js on your Appwrite server, the agent logic can run directly in Next.js API Routes on Vercel.

**Pros:**
- No need for Appwrite Functions runtime
- Everything in one deployment
- Better error handling and logging
- Simpler architecture

**Cons:**
- Vercel has request timeouts (10s on Hobby, 60s on Pro, 300s on Enterprise)
- Long generations (e.g., 12 chapters) may need sequential API calls from the frontend
- PDF generation needs `@react-pdf/renderer` or similar (no Playwright on Vercel)

### Implementation

Create API Routes that contain the agent logic directly:

```
src/app/api/books/[id]/plan/route.ts       → generates plan (MiniMax)
src/app/api/books/[id]/chapters/[chapterId]/research/route.ts → Perplexity
src/app/api/books/[id]/chapters/[chapterId]/generate/route.ts → MiniMax
src/app/api/books/[id]/assemble/route.ts   → assembles HTML
src/app/api/books/[id]/export/route.ts     → generates PDF
```

Each route:
- Validates user ownership
- Updates book/chapter status in Appwrite
- Calls Perplexity or MiniMax
- Saves results to Appwrite
- Returns success/error

Configure Vercel for longer timeouts in `vercel.json`:

```json
{
  "functions": {
    "src/app/api/books/[id]/chapters/[chapterId]/generate/route.ts": {
      "maxDuration": 60
    }
  }
}
```

---

## Environment Variables Required for Functions

All functions need these environment variables (set in Appwrite Console or via API):

| Variable | Value | Description |
|---|---|---|
| `APPWRITE_ENDPOINT` | `https://your-appwrite/v1` | Appwrite API endpoint |
| `APPWRITE_PROJECT_ID` | Your project ID | |
| `APPWRITE_API_KEY` | Server API key | Admin access |
| `APPWRITE_DATABASE_ID` | `academicbook` | |
| `APPWRITE_COLLECTION_BOOKS` | `books` | |
| `APPWRITE_COLLECTION_BOOK_PLANS` | `book_plans` | |
| `APPWRITE_COLLECTION_CHAPTERS` | `chapters` | |
| `APPWRITE_COLLECTION_SOURCES` | `sources` | |
| `APPWRITE_COLLECTION_REFERENCES` | `references` | |
| `APPWRITE_COLLECTION_EXPORTS` | `exports` | |
| `APPWRITE_COLLECTION_GENERATION_LOGS` | `generation_logs` | |
| `APPWRITE_STORAGE_BUCKET_ID` | `book-exports` | |
| `PERPLEXITY_API_KEY` | `pplx-...` | |
| `PERPLEXITY_API_URL` | `https://api.perplexity.ai` | |
| `PERPLEXITY_MODEL` | `sonar-pro` | |
| `MINIMAX_API_KEY` | `sk-cp-...` | |
| `MINIMAX_API_URL` | `https://api.minimaxi.com/v1` | |
| `MINIMAX_MODEL` | `MiniMax-Text-01` | |
| `AI_REQUEST_TIMEOUT_MS` | `60000` | |
| `MAX_GENERATION_RETRIES` | `3` | |

---

## Current Status

The functions are fully written and tested at the code level. The blocker is the Appwrite server runtime configuration on EasyPanel.

**For this project, the recommended path is Option 1** — add `_APP_FUNCTIONS_RUNTIMES=node-20.0` to the Appwrite service environment in EasyPanel, restart, then deploy with `appwrite deploy function`.
