export interface HealthStatus {
  status: string;
  service: string;
  database: 'ok' | 'down';
  time: string;
}

export type DocumentIndexStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

export interface DocumentRecord {
  id: string;
  name: string;
  format: 'pdf' | 'docx' | 'html' | 'markdown';
  status: DocumentIndexStatus;
  version: number;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MatchType = 'keyword' | 'semantic' | 'both';

export interface SearchSource {
  documentId: string;
  documentName: string;
  excerpt: string;
  score: number;
  matchType: MatchType;
}

export interface SearchResult {
  query: string;
  answer: string;
  sources: SearchSource[];
}
