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
