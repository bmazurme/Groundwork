import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import type { DocumentChunkRecord, DocumentRecord } from './document.entity';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(): Promise<DocumentRecord[]> {
    return this.documentsService.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(@UploadedFile() file: Express.Multer.File): Promise<DocumentRecord> {
    return this.documentsService.upload(file);
  }

  @Get(':id/chunks')
  getChunks(@Param('id') id: string): Promise<DocumentChunkRecord[]> {
    return this.documentsService.getChunks(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.documentsService.remove(id);
  }
}
