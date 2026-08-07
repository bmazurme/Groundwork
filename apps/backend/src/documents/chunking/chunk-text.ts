export interface TextChunk {
  index: number;
  content: string;
}

export interface ChunkTextOptions {
  /** Parse markdown structure (fenced code, mermaid, YAML frontmatter) instead of plain prose. */
  markdown?: boolean;
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---(?:\n|$)/;
const FENCE_RE = /^([`~]{3,})/;
const HEADING_RE = /^#{1,6}\s/;

interface Unit {
  text: string;
  /** Atomic units (code fences, frontmatter) are never split or merged with prose. */
  atomic: boolean;
}

export function chunkText(
  text: string,
  options: ChunkTextOptions = {},
): TextChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const units = options.markdown
    ? splitMarkdown(normalized)
    : splitProse(normalized);
  return packUnits(units);
}

function splitMarkdown(text: string): Unit[] {
  const units: Unit[] = [];
  let rest = text;

  const frontmatter = rest.match(FRONTMATTER_RE);
  if (frontmatter) {
    units.push({ text: frontmatter[0].trim(), atomic: true });
    rest = rest.slice(frontmatter[0].length);
  }

  const lines = rest.split('\n');
  let proseBuffer: string[] = [];
  let i = 0;

  const flushProse = () => {
    if (proseBuffer.length === 0) return;
    units.push(...splitProse(proseBuffer.join('\n')));
    proseBuffer = [];
  };

  while (i < lines.length) {
    const fenceMatch = lines[i].trim().match(FENCE_RE);
    if (fenceMatch) {
      flushProse();
      const marker = fenceMatch[1];
      const codeLines = [lines[i]];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) {
        codeLines.push(lines[i]);
        i += 1;
      }
      units.push({ text: codeLines.join('\n').trim(), atomic: true });
      continue;
    }
    proseBuffer.push(lines[i]);
    i += 1;
  }
  flushProse();

  return units;
}

function splitProse(text: string): Unit[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs: string[] = [];
  for (const block of trimmed.split(/\n{2,}/)) {
    let buffer: string[] = [];
    for (const line of block.split('\n')) {
      if (HEADING_RE.test(line) && buffer.length > 0) {
        paragraphs.push(buffer.join('\n').trim());
        buffer = [];
      }
      buffer.push(line);
    }
    if (buffer.length > 0) paragraphs.push(buffer.join('\n').trim());
  }

  return paragraphs
    .filter((p) => p.length > 0)
    .flatMap((p): Unit[] =>
      p.length > CHUNK_SIZE ? splitOversized(p) : [{ text: p, atomic: false }],
    );
}

/** Splits an over-long paragraph at sentence, then whitespace boundaries — never mid-word. */
function splitOversized(text: string): Unit[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const pieces: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    pieces.push(buffer.join(' '));
    buffer = [];
  };

  for (const sentence of sentences) {
    if (sentence.length > CHUNK_SIZE) {
      flush();
      pieces.push(...splitByWhitespace(sentence));
      continue;
    }
    const current = buffer.join(' ');
    if (
      buffer.length > 0 &&
      current.length + 1 + sentence.length > CHUNK_SIZE
    ) {
      flush();
    }
    buffer.push(sentence);
  }
  flush();

  return pieces
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, atomic: false }));
}

function splitByWhitespace(text: string): string[] {
  const pieces: string[] = [];
  let remaining = text.trim();

  while (remaining.length > CHUNK_SIZE) {
    const slice = remaining.slice(0, CHUNK_SIZE);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > 0 ? lastSpace : CHUNK_SIZE;
    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) pieces.push(remaining);

  return pieces;
}

/** Greedily packs units up to CHUNK_SIZE, carrying the trailing paragraph forward for overlap. */
function packUnits(units: Unit[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let buffer: string[] = [];
  let index = 0;

  const flush = (carryOverlap: boolean) => {
    if (buffer.length === 0) return;
    chunks.push({ index, content: buffer.join('\n\n').trim() });
    index += 1;
    const tail = carryOverlap ? buffer[buffer.length - 1] : null;
    buffer = tail && tail.length <= CHUNK_OVERLAP ? [tail] : [];
  };

  for (const unit of units) {
    if (unit.atomic) {
      flush(false);
      chunks.push({ index, content: unit.text.trim() });
      index += 1;
      continue;
    }

    const current = buffer.join('\n\n');
    if (
      buffer.length > 0 &&
      current.length + 2 + unit.text.length > CHUNK_SIZE
    ) {
      flush(true);
    }
    buffer.push(unit.text);
  }
  flush(false);

  return chunks;
}
