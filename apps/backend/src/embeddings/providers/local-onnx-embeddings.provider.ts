import { Injectable, Logger } from '@nestjs/common';
import type { EmbeddingsProvider } from '../embeddings.interface';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

interface FeatureExtractionOutput {
  data: Float32Array | number[];
}

type FeatureExtractionFn = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<FeatureExtractionOutput>;

// Runs fully in-process via ONNX Runtime — no external API key, no separate
// service. Requires a glibc runtime (see apps/backend/Dockerfile: onnxruntime-node
// ships prebuilt binaries that don't dlopen on musl/alpine).
@Injectable()
export class LocalOnnxEmbeddingsProvider implements EmbeddingsProvider {
  private readonly logger = new Logger(LocalOnnxEmbeddingsProvider.name);
  private extractorPromise: Promise<FeatureExtractionFn> | null = null;

  // Called explicitly by EmbeddingsModule's factory (not a Nest lifecycle
  // hook) so the model only loads when this provider is actually selected.
  async warmUp(): Promise<void> {
    await this.getExtractor();
  }

  private getExtractor(): Promise<FeatureExtractionFn> {
    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        const { pipeline, env } = await import('@huggingface/transformers');
        if (process.env.TRANSFORMERS_CACHE_DIR) {
          env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR;
        }
        this.logger.log(`Loading local embedding model "${MODEL_NAME}"...`);
        const extractor = (await pipeline(
          'feature-extraction',
          MODEL_NAME,
        )) as unknown as FeatureExtractionFn;
        this.logger.log('Local embedding model ready');
        return extractor;
      })();
    }
    return this.extractorPromise;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}
