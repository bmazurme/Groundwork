import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { StorageService } from '../storage/storage.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queue/queue.constants';
import {
  DocumentChunkRecord,
  DocumentRecord,
  formatFromFilename,
} from './document.entity';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

interface DocumentRow {
  id: string;
  name: string;
  format: string;
  status: string;
  version: number;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

function toDocumentRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    name: row.name,
    format: row.format as DocumentRecord['format'],
    status: row.status as DocumentRecord['status'],
    version: row.version,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const DOCUMENT_COLUMNS =
  'id, name, format, status, version, failure_reason, created_at, updated_at';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly storage: StorageService,
    @InjectQueue(DOCUMENT_PROCESSING_QUEUE) private readonly queue: Queue,
  ) {}

  async findAll(): Promise<DocumentRecord[]> {
    const result = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} FROM documents ORDER BY created_at DESC`,
    );
    return result.rows.map(toDocumentRecord);
  }

  async upload(file: UploadedFile): Promise<DocumentRecord> {
    const format = formatFromFilename(file.originalname);
    if (!format) {
      throw new BadRequestException(
        `Unsupported file type: ${file.originalname}`,
      );
    }

    // Re-uploading a file with the same name replaces it as a new version of
    // the same document, instead of creating a duplicate row.
    const existing = await this.pool.query<{
      id: string;
      s3_key: string;
      version: number;
    }>('SELECT id, s3_key, version FROM documents WHERE name = $1', [
      file.originalname,
    ]);
    const previous = existing.rows[0];

    const id = previous?.id ?? randomUUID();
    const version = (previous?.version ?? 0) + 1;
    const s3Key = `documents/${id}-v${version}-${file.originalname}`;
    await this.storage.upload(s3Key, file.buffer, file.mimetype);

    if (previous) {
      await this.storage.delete(previous.s3_key).catch(() => {
        // Best-effort cleanup of the replaced version's object.
      });
    }

    const result = previous
      ? await this.pool.query<DocumentRow>(
          `UPDATE documents
           SET format = $2, s3_key = $3, status = 'pending', version = $4,
               failure_reason = NULL, updated_at = now()
           WHERE id = $1
           RETURNING ${DOCUMENT_COLUMNS}`,
          [id, format, s3Key, version],
        )
      : await this.pool.query<DocumentRow>(
          `INSERT INTO documents (id, name, format, s3_key, status, version)
           VALUES ($1, $2, $3, $4, 'pending', 1)
           RETURNING ${DOCUMENT_COLUMNS}`,
          [id, file.originalname, format, s3Key],
        );

    await this.queue.add('process', { documentId: id });

    return toDocumentRecord(result.rows[0]);
  }

  async getChunks(id: string): Promise<DocumentChunkRecord[]> {
    const document = await this.pool.query('SELECT id FROM documents WHERE id = $1', [id]);
    if (document.rows.length === 0) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const result = await this.pool.query<{ chunk_index: number; content: string }>(
      'SELECT chunk_index, content FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index',
      [id],
    );
    return result.rows.map((row) => ({ index: row.chunk_index, content: row.content }));
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query<{ s3_key: string }>(
      'SELECT s3_key FROM documents WHERE id = $1',
      [id],
    );
    const document = result.rows[0];
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
    await this.storage.delete(document.s3_key).catch(() => {
      // Best-effort cleanup — the document row is already gone either way.
    });
  }
}
