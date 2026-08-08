# Groundwork

[![CI](https://github.com/bmazurme/Groundwork/actions/workflows/ci.yml/badge.svg)](https://github.com/bmazurme/Groundwork/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)

Grounded answers over your internal documents, with the evals to prove it.

## Tech stack

**Backend** — [NestJS](https://nestjs.com/) (TypeScript), REST API mounted under `/api`:

- **PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector)** — one store for document/chunk metadata *and* embeddings (HNSW index), queried via `pg`. See [Data & vector store](#data--vector-store-postgres--pgvector-not-a-separate-vector-db) below for why.
- **[BullMQ](https://docs.bullmq.io/) + Redis** — background queue for the parse → chunk → embed pipeline; uploads return immediately.
- **S3-compatible object storage** — `@aws-sdk/client-s3` against MinIO locally, real AWS S3 in prod (same client, different env vars).
- **Document parsing** — `pdf-parse` (PDF), `mammoth` (DOCX), a tag-stripping pass (HTML), pass-through (Markdown).
- **Chunking** — a structure-aware chunker (`documents/chunking/chunk-text.ts`): markdown fenced code blocks, mermaid diagrams, and YAML frontmatter are kept as atomic units and never split mid-token; prose is split on paragraph/sentence boundaries.
- **Embeddings** — `@huggingface/transformers` (ONNX Runtime) running `Xenova/paraphrase-multilingual-MiniLM-L12-v2` in-process by default — multilingual, since the corpus and queries mix Russian and English and an English-only model collapses cross-lingual pairs into near-random similarity. Swappable behind an `EmbeddingsProvider` interface; an Ollama-backed implementation also ships.
- **Search** — hybrid full-text (`tsvector`/`ts_rank`) + vector (pgvector `<=>`) retrieval fused via Reciprocal Rank Fusion, with a cosine-distance floor on semantic-only matches so unrelated chunks with no keyword corroboration don't crowd out real results.

**Frontend** — React 19 + TypeScript on Vite:

- **[Gravity UI](https://gravity-ui.com/)** (`@gravity-ui/uikit` + `@gravity-ui/icons`) — component library and theming (light/dark, persisted to `localStorage`).
- **[TanStack Query](https://tanstack.com/query)** — server state (documents list, search, upload/delete mutations), with polling while documents are indexing.
- **[TanStack Table](https://tanstack.com/table)** — sorting, format/status filtering, and pagination for the document library.
- **[react-markdown](https://github.com/remarkjs/react-markdown)** (remark/rehype/unist) — renders retrieved passages as real markdown (links, code blocks), with custom plugins that strip editorial HTML comments and highlight matched query terms without touching code blocks.
- **[Mermaid](https://mermaid.js.org/)** — renders `mermaid` code fences in source documents as actual diagrams, with a fallback to raw text on parse errors.

**Infra / dev** — Docker Compose (Postgres+pgvector, Redis, MinIO, backend, frontend, each hot-reloading from a bind mount); npm workspaces monorepo, one lockfile.

## Structure

npm workspaces monorepo:

- `apps/backend` — NestJS API, mounted under `/api`.
  - `health` — liveness + Postgres connectivity check
  - `documents` — upload endpoint, document library, BullMQ producer
  - `search` — hybrid (full-text + pgvector) retrieval merged via Reciprocal Rank Fusion
  - `database` — Postgres pool + schema bootstrap (the `vector` extension, `documents`/`document_chunks` tables)
  - `storage` — S3-compatible object storage client (MinIO locally, AWS S3 in prod)
  - `queue` — BullMQ/Redis connection
  - `embeddings` — embedding generation, pluggable behind an `EmbeddingsProvider` interface (local ONNX by default — see below)
- `apps/frontend` — React (Vite + TS) dashboard: upload a document, watch it move through pending → indexing → indexed, and query it. Dev server proxies `/api` to the backend.

### Why this layout: `apps/*` + a single hoisted `node_modules`

- **One dependency tree, one lockfile.** npm workspaces install everything once at the repo root and hoist shared packages (`typescript`, `eslint`, etc.) instead of duplicating them per app. Faster installs, no version drift between backend and frontend on shared tooling, one `package-lock.json` to review in PRs.
- **Apps stay independently deployable despite sharing a tree.** `apps/backend` and `apps/frontend` each keep their own `package.json`, build output, and Dockerfile, so they build, version, and ship as separate images even though development happens in one repo.
- **Root for orchestration, `apps/*` for product code.** The root `package.json` only holds cross-cutting scripts (`dev`, `build`, `lint`) that fan out to each workspace with `-w <name>`; it carries no runtime code of its own. This keeps the door open for a future `packages/` directory (e.g. shared types between backend and frontend) without restructuring anything that exists today.
- **Matches how the product is actually shaped.** init.md describes one deployable API plus one dashboard, not a constellation of services — a two-app workspace is the smallest structure that keeps them decoupled without the overhead of separate repos (shared CI, shared lint/tsconfig baseline, atomic cross-app commits when an API contract changes).

## Data & vector store: Postgres + pgvector, not a separate vector DB

init.md's core pitch is engineering discipline around RAG, not "we have an LLM" — and the storage choice follows from that:

- **Metadata and embeddings are one write, not two.** A chunk's text, its vector, and the document row it belongs to change together (re-indexing, deletes, version bumps). In a dedicated vector DB (Qdrant/Pinecone/Weaviate) that's two systems to keep consistent, with no shared transaction — a failed write to one leaves the other stale. Here it's one `INSERT`/`DELETE` inside Postgres, so `document_chunks` can never point at a document that no longer exists (`ON DELETE CASCADE` on `document_id`).
- **Hybrid search is one query, not an app-level merge across two databases.** init.md's hybrid retrieval needs full-text (`tsvector`/`ts_rank`) and vector (`<=>` cosine distance) signals fused via RRF. With Postgres, both live in the same `document_chunks` row, queried in parallel and merged in `search.service.ts`. A separate vector DB would still need Postgres (or another store) for full-text and metadata anyway — hybrid search would mean joining results across two network calls to two different systems instead of two SQL queries to one.
- **Nothing new to operate, back up, or pay for.** The buyer profile in init.md is a mid-size company running a 3–6 month contract engagement, typically already running Postgres. pgvector (via the `pgvector/pgvector` image) adds one extension, not a new stateful service with its own HA story, backup tooling, and access control to design and hand off at the end of the engagement.
- **The trade-off, honestly:** a dedicated vector DB wins at very large scale or with retrieval patterns Postgres's indexing can't express (e.g. some ANN algorithms, massive horizontal sharding). pgvector's HNSW index (used here — see `database/schema.ts`) comfortably covers the document volumes this product targets (internal knowledge bases, not web-scale corpora). If that ever changes, it's a swap behind `search.service.ts`, not a rewrite of the ingestion pipeline.

## Ingestion pipeline: S3 → BullMQ → parse, chunk, embed

`POST /api/documents` (multipart `file` field) does the minimum synchronously and pushes everything expensive onto a queue:

1. **Upload lands in S3-compatible storage.** `storage/storage.service.ts` wraps `@aws-sdk/client-s3`. Locally it points at MinIO (path-style, explicit keys, `S3_ENDPOINT` set); against real AWS S3 you drop `S3_ENDPOINT`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` and the same client resolves credentials via the SDK's default chain (IAM role). Same code, same bucket API — that's the "natural transition from MinIO" this was asked for.
2. **A `documents` row is inserted with `status = 'pending'`**, and a job (`{ documentId }`) is pushed onto the `document-processing` BullMQ queue (Redis-backed). The HTTP response returns immediately — indexing doesn't block the upload request.
3. **`documents.processor.ts` (a BullMQ worker) picks up the job:**
   - downloads the object from S3/MinIO
   - **parses** it by format: `pdf-parse` for PDF, `mammoth` for DOCX, a tag-stripping pass for HTML, pass-through for Markdown
   - **chunks** the extracted text structure-aware (`documents/chunking/chunk-text.ts`): markdown fenced code blocks, mermaid diagrams, and YAML frontmatter are kept whole; prose is packed up to a target size and split on paragraph/sentence boundaries, never mid-token
   - **embeds** each chunk and writes `(content, embedding)` rows into `document_chunks`
   - flips the document to `indexed` (or `failed`, with a reason, on error — visible in the dashboard's document table)

### Embeddings: local by default, swappable behind one interface

`embeddings/embeddings.interface.ts` defines a one-method `EmbeddingsProvider` (`embed(text): Promise<number[]>`). `embeddings.module.ts` picks the implementation from `EMBEDDINGS_PROVIDER` at startup — nothing in `documents.processor.ts` or `search.service.ts` knows which one is active.

- **Default: `LocalOnnxEmbeddingsProvider`** (`EMBEDDINGS_PROVIDER=onnx`) — runs `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384-dim) in-process via `@huggingface/transformers` (ONNX Runtime), no external API key, no extra container. This is why `apps/backend/Dockerfile` is `node:22-slim`, not `alpine`: `onnxruntime-node` ships prebuilt glibc binaries that fail to load on musl. The model downloads on first use and is cached in the `onnx-model-cache` volume so it survives container restarts. Multilingual specifically because the corpus and queries mix Russian and English: an earlier English-only model (`Xenova/all-MiniLM-L6-v2`) collapsed cross-lingual pairs (Russian query, English document) into a near-random similarity band with no separation between the right document and unrelated ones; the multilingual model gives the right document +0.53 cosine similarity and unrelated ones ~0.0/−0.05 on the same pair. See [ISSUES.md](ISSUES.md) #9.
- **Available: `OllamaEmbeddingsProvider`** (`EMBEDDINGS_PROVIDER=ollama`) — calls a local Ollama server's `/api/embeddings` (`OLLAMA_HOST`, `OLLAMA_EMBEDDING_MODEL`, default `nomic-embed-text`). Not wired into `docker-compose.yml` — add an `ollama` service there when needed. Worth moving to if this project also ends up hosting a local model for answer synthesis (`search.service.ts`'s `answer` field is currently just the top retrieved passages, not an LLM-generated answer), since Ollama would then serve both.
- Both ship with a known trade-off: `@huggingface/transformers`' dependency tree (`onnxruntime-node`'s `adm-zip`, and `sharp`'s bundled `libvips`) currently carries high-severity CVEs with no upstream fix yet, in code paths this project doesn't exercise (ZIP handling, image processing — text-only embeddings never touch either). Worth tracking via `npm audit`, not a blocker for a dev scaffold.
- To change models/dimensions: update `MODEL_NAME` in `local-onnx-embeddings.provider.ts` and `EMBEDDING_DIMENSIONS` in `embeddings.constants.ts` (the `document_chunks.embedding` column is sized to it) — the only coupling point between the provider and the schema.

## Requirements

- Node.js 22+ (native dev), or Docker + Docker Compose (containerized dev)
- Postgres (with pgvector), Redis, and an S3-compatible store (MinIO locally) — `docker-compose.yml` provides all three either way (see below)

## Getting started (native)

```bash
docker compose up -d postgres redis minio   # infra only
cp apps/backend/.env.example apps/backend/.env  # adjust if needed
npm install
npm run dev
```

This runs the backend on `http://localhost:3001` and the frontend on `http://localhost:5173` (Vite proxies `/api/*` to the backend). Open the frontend URL — it shows backend/database health, the document library with an upload control, and a search box wired to `/api/search`.

Run them individually with `npm run dev:backend` / `npm run dev:frontend`.

## Getting started (Docker)

```bash
docker compose up --build
```

Brings up Postgres (pgvector), Redis, MinIO, the backend, and the frontend. Same URLs as above (`localhost:3001` for the API, `localhost:5173` for the dashboard); MinIO's console is at `localhost:9003` (user/pass `groundwork` / `groundwork-secret`). The backend creates the `vector` extension, tables, and indexes on first boot, and creates its MinIO bucket automatically — no manual setup.

The repo is bind-mounted into the backend/frontend containers with `node_modules` excluded from the mount, so edits on the host hot-reload inside the containers exactly like native dev — only rebuild (`docker compose up --build`) when a `package.json` changes.

Each `apps/*/Dockerfile` also has a `build` stage and a `production` stage (backend runs the compiled `dist/main`; frontend is a static build served by nginx), used for the eventual Docker Swarm deployment — not needed for local dev.

## Scripts (root)

- `npm run dev` — backend + frontend concurrently
- `npm run build` — build both apps
- `npm run lint` — lint both apps
- `npm run test` — backend unit tests

## Current state vs. the product spec

Per init.md, still to build:

- A cross-encoder reranker on top of the RRF-merged candidates, and LLM-based answer synthesis (search currently returns retrieved passages, not a generated answer)
- Operational dashboard: virtualized tables, streaming answers, cost/latency analytics, eval regression runs, like/dislike feedback capture
- Real Postgres migrations (schema bootstrap is currently an idempotent `CREATE ... IF NOT EXISTS` in `database/schema.ts`, fine for a scaffold, not a substitute for versioned migrations)
- Langfuse tracing, Docker Swarm deployment (stack file), CI eval runs per PR

## Environment variables

Backend (see `apps/backend/.env.example`):

- `PORT` (default `3001`), `FRONTEND_ORIGIN` (default `http://localhost:5173`)
- `DATABASE_URL` — Postgres connection string
- `REDIS_HOST` / `REDIS_PORT` — BullMQ connection
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` — object storage; drop the endpoint/keys against real AWS S3 (see the ingestion pipeline section above)
- `EMBEDDINGS_PROVIDER` (`onnx` default, or `ollama`), `TRANSFORMERS_CACHE_DIR` (onnx model cache path), `OLLAMA_HOST` / `OLLAMA_EMBEDDING_MODEL` (ollama only)

Frontend:

- `API_PROXY_TARGET` — where Vite proxies `/api` to (default `http://localhost:3001`, set to `http://backend:3001` in `docker-compose.yml`)
