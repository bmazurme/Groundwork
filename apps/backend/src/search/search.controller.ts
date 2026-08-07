import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import type { SearchResult } from './search.types';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  query(@Query('q') q = ''): Promise<SearchResult> {
    return this.searchService.query(q);
  }
}
