import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';
import { DocumentsModule } from './documents/documents.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    HealthModule,
    DocumentsModule,
    SearchModule,
  ],
})
export class AppModule {}
