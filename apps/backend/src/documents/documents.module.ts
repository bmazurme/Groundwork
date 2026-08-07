import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsProcessor } from './documents.processor';
import { StorageModule } from '../storage/storage.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { DOCUMENT_PROCESSING_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: DOCUMENT_PROCESSING_QUEUE }),
    StorageModule,
    EmbeddingsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}
