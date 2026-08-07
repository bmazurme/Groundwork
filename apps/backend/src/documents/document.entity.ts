export type DocumentFormat = 'pdf' | 'docx' | 'html' | 'markdown';

export type DocumentIndexStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

export interface DocumentRecord {
  id: string;
  name: string;
  format: DocumentFormat;
  status: DocumentIndexStatus;
  version: number;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkRecord {
  index: number;
  content: string;
}

export function formatFromFilename(filename: string): DocumentFormat | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'html':
    case 'htm':
      return 'html';
    case 'md':
    case 'markdown':
    case 'txt':
      return 'markdown';
    default:
      return null;
  }
}
