import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { StorageService } from '../storage/storage.service';
import { DOCUMENT_PROCESSING_QUEUE } from '../queue/queue.constants';
import { DocumentRecord, formatFromFilename } from './document.entity';

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

    const id = randomUUID();
    const s3Key = `documents/${id}-${file.originalname}`;
    await this.storage.upload(s3Key, file.buffer, file.mimetype);

    const result = await this.pool.query<DocumentRow>(
      `INSERT INTO documents (id, name, format, s3_key, status, version)
       VALUES ($1, $2, $3, $4, 'pending', 1)
       RETURNING ${DOCUMENT_COLUMNS}`,
      [id, file.originalname, format, s3Key],
    );

    await this.queue.add('process', { documentId: id });

    return toDocumentRecord(result.rows[0]);
  }
}
