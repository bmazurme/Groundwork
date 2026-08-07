import { Module } from '@nestjs/common';
import { EMBEDDINGS_PROVIDER } from './embeddings.constants';
import type { EmbeddingsProvider } from './embeddings.interface';
import { LocalOnnxEmbeddingsProvider } from './providers/local-onnx-embeddings.provider';
import { OllamaEmbeddingsProvider } from './providers/ollama-embeddings.provider';

@Module({
  providers: [
    {
      provide: EMBEDDINGS_PROVIDER,
      useFactory: async (): Promise<EmbeddingsProvider> => {
        if (process.env.EMBEDDINGS_PROVIDER === 'ollama') {
          return new OllamaEmbeddingsProvider();
        }
        const provider = new LocalOnnxEmbeddingsProvider();
        await provider.warmUp();
        return provider;
      },
    },
  ],
  exports: [EMBEDDINGS_PROVIDER],
})
export class EmbeddingsModule {}
