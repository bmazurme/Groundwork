import type { DocumentRecord, HealthStatus, SearchResult } from './types';

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function upload<T>(path: string, file: File): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`/api${path}`, { method: 'POST', body });
  if (!response.ok) {
    throw new Error(`Upload to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => get<HealthStatus>('/health'),
  documents: () => get<DocumentRecord[]>('/documents'),
  uploadDocument: (file: File) => upload<DocumentRecord>('/documents', file),
  search: (query: string) => get<SearchResult>(`/search?q=${encodeURIComponent(query)}`),
};
