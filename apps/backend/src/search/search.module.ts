import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [EmbeddingsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
