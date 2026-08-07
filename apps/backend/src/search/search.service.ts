import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { toVectorLiteral } from '../database/vector';
import { EMBEDDINGS_PROVIDER } from '../embeddings/embeddings.constants';
import type { EmbeddingsProvider } from '../embeddings/embeddings.interface';
import type { MatchType, SearchResult, SearchSource } from './search.types';

const RRF_K = 60;
const CANDIDATES_PER_METHOD = 20;
const TOP_RESULTS = 5;
// Cosine distance cutoff for semantic-only results (no keyword corroboration).
// RRF score can't do this job — it encodes rank, not similarity, so a
// semantically-irrelevant chunk that happens to be the vector search's #1
// candidate scores identically to a genuinely close one. Picked empirically
// from a real query ("e2e"): a legit match landed at ~0.66, the nearest
// unrelated filler at ~0.76 — 0.72 sits between them with some margin, but
// this is a heuristic tuned on one small corpus, not a principled bound.
const SEMANTIC_ONLY_MAX_DISTANCE = 0.72;

interface ChunkRow {
  id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
}

interface VectorChunkRow extends ChunkRow {
  distance: number;
}

interface RankedChunk {
  row: ChunkRow;
  score: number;
  matchType: MatchType;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(EMBEDDINGS_PROVIDER)
    private readonly embeddings: EmbeddingsProvider,
  ) {}

  async query(query: string): Promise<SearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        query,
        answer: 'Enter a question to search your documents.',
        sources: [],
      };
    }

    const queryEmbedding = toVectorLiteral(
      await this.embeddings.embed(trimmed),
    );

    const [fullText, vector] = await Promise.all([
      this.pool.query<ChunkRow>(
        `SELECT dc.id, dc.document_id, d.name AS document_name, dc.chunk_index, dc.content
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id
         WHERE to_tsvector('english', dc.content) @@ websearch_to_tsquery('english', $1)
         ORDER BY ts_rank_cd(to_tsvector('english', dc.content), websearch_to_tsquery('english', $1)) DESC
         LIMIT $2`,
        [trimmed, CANDIDATES_PER_METHOD],
      ),
      this.pool.query<VectorChunkRow>(
        `SELECT dc.id, dc.document_id, d.name AS document_name, dc.chunk_index, dc.content,
                dc.embedding <=> $1::vector AS distance
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id
         ORDER BY distance
         LIMIT $2`,
        [queryEmbedding, CANDIDATES_PER_METHOD],
      ),
    ]);

    const distanceById = new Map(
      vector.rows.map((row) => [row.id, row.distance]),
    );

    const top = reciprocalRankFusion(fullText.rows, vector.rows)
      .filter(
        (chunk) =>
          chunk.matchType !== 'semantic' ||
          (distanceById.get(chunk.row.id) ?? Infinity) <=
            SEMANTIC_ONLY_MAX_DISTANCE,
      )
      .slice(0, TOP_RESULTS);

    const sources: SearchSource[] = top.map(({ row, score, matchType }) => ({
      documentId: row.document_id,
      documentName: row.document_name,
      chunkIndex: row.chunk_index,
      excerpt: row.content,
      score,
      matchType,
    }));

    return {
      query: trimmed,
      answer:
        sources.length > 0
          ? `Top ${sources.length} matching passage(s) from your documents (retrieval only — LLM answer synthesis is not wired up yet).`
          : 'No indexed passages matched this query.',
      sources,
    };
  }
}

// Reciprocal Rank Fusion: merges the full-text and vector result lists by
// rank rather than raw score, since ts_rank and cosine distance aren't on
// comparable scales. See init.md's "гибридный поиск" section.
function reciprocalRankFusion(
  fullText: ChunkRow[],
  vector: ChunkRow[],
): RankedChunk[] {
  const scores = new Map<string, RankedChunk>();
  const contributedBy = new Map<string, Set<'keyword' | 'semantic'>>();

  const lists: Array<[ChunkRow[], 'keyword' | 'semantic']> = [
    [fullText, 'keyword'],
    [vector, 'semantic'],
  ];

  for (const [list, source] of lists) {
    list.forEach((row, index) => {
      const contribution = 1 / (RRF_K + index + 1);
      const existing = scores.get(row.id);
      if (existing) {
        existing.score += contribution;
      } else {
        scores.set(row.id, { row, score: contribution, matchType: source });
      }
      const sources = contributedBy.get(row.id) ?? new Set();
      sources.add(source);
      contributedBy.set(row.id, sources);
    });
  }

  for (const chunk of scores.values()) {
    const sources = contributedBy.get(chunk.row.id);
    chunk.matchType = sources && sources.size > 1 ? 'both' : chunk.matchType;
  }

  return [...scores.values()].sort((a, b) => b.score - a.score);
}
