import type { DocumentChunk, DocumentRecord, HealthStatus, SearchResult } from './types';

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

async function del(path: string): Promise<void> {
  const response = await fetch(`/api${path}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Delete ${path} failed with status ${response.status}`);
  }
}

export const api = {
  health: () => get<HealthStatus>('/health'),
  documents: () => get<DocumentRecord[]>('/documents'),
  uploadDocument: (file: File) => upload<DocumentRecord>('/documents', file),
  deleteDocument: (id: string) => del(`/documents/${id}`),
  documentChunks: (id: string) => get<DocumentChunk[]>(`/documents/${id}/chunks`),
  search: (query: string) => get<SearchResult>(`/search?q=${encodeURIComponent(query)}`),
};
