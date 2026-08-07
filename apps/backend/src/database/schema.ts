import type { Pool } from 'pg';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embeddings.constants';

export async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      version INT NOT NULL DEFAULT 1,
      failure_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id UUID PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(
    'CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks (document_id)',
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS document_chunks_content_fts_idx ON document_chunks USING GIN (to_tsvector('english', content))`,
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)',
  );
}
