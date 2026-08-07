import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { toVectorLiteral } from '../database/vector';
import { StorageService } from '../storage/storage.service';
import { EMBEDDINGS_PROVIDER } from '../embeddings/embeddings.constants';
import type { EmbeddingsProvider } from '../embeddings/embeddings.interface';
import { DOCUMENT_PROCESSING_QUEUE } from '../queue/queue.constants';
import { parseDocument } from './parsing/parse-document';
import { chunkText } from './chunking/chunk-text';
import type { DocumentFormat } from './document.entity';

interface ProcessDocumentJob {
  documentId: string;
}

interface DocumentRow {
  id: string;
  format: DocumentFormat;
  s3_key: string;
}

@Processor(DOCUMENT_PROCESSING_QUEUE)
export class DocumentsProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentsProcessor.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly storage: StorageService,
    @Inject(EMBEDDINGS_PROVIDER)
    private readonly embeddings: EmbeddingsProvider,
  ) {
    super();
  }

  async process(job: Job<ProcessDocumentJob>): Promise<void> {
    const { documentId } = job.data;

    const { rows } = await this.pool.query<DocumentRow>(
      'SELECT id, format, s3_key FROM documents WHERE id = $1',
      [documentId],
    );
    const document = rows[0];
    if (!document) {
      this.logger.warn(`Document ${documentId} not found, skipping`);
      return;
    }

    await this.pool.query(
      "UPDATE documents SET status = 'indexing', updated_at = now() WHERE id = $1",
      [documentId],
    );

    try {
      const buffer = await this.storage.download(document.s3_key);
      const text = await parseDocument(document.format, buffer);
      const chunks = chunkText(text, {
        markdown: document.format === 'markdown',
      });

      if (chunks.length === 0) {
        throw new Error('No extractable text found in document');
      }

      await this.pool.query(
        'DELETE FROM document_chunks WHERE document_id = $1',
        [documentId],
      );

      for (const chunk of chunks) {
        const embedding = await this.embeddings.embed(chunk.content);
        await this.pool.query(
          `INSERT INTO document_chunks (id, document_id, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            randomUUID(),
            documentId,
            chunk.index,
            chunk.content,
            toVectorLiteral(embedding),
          ],
        );
      }

      await this.pool.query(
        "UPDATE documents SET status = 'indexed', failure_reason = NULL, updated_at = now() WHERE id = $1",
        [documentId],
      );
      this.logger.log(
        `Indexed document ${documentId} (${chunks.length} chunks)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.pool.query(
        "UPDATE documents SET status = 'failed', failure_reason = $2, updated_at = now() WHERE id = $1",
        [documentId, message],
      );
      throw error;
    }
  }
}
