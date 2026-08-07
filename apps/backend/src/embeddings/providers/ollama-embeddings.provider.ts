import { Injectable } from '@nestjs/common';
import type { EmbeddingsProvider } from '../embeddings.interface';

interface OllamaEmbeddingsResponse {
  embedding: number[];
}

// Not wired up in docker-compose.yml by default — for when a local Ollama
// service is added later (e.g. once it's also serving answer synthesis).
// Point OLLAMA_HOST at it and set EMBEDDINGS_PROVIDER=ollama.
@Injectable()
export class OllamaEmbeddingsProvider implements EmbeddingsProvider {
  private readonly host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
  private readonly model =
    process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.host}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embeddings request failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as OllamaEmbeddingsResponse;
    return body.embedding;
  }
}
