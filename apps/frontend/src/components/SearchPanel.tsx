import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Flex,
  Icon,
  Label,
  Loader,
  PlaceholderContainer,
  Text,
  TextInput,
} from '@gravity-ui/uikit';
import { ArrowUpRightFromSquare, FileQuestion, Magnifier } from '@gravity-ui/icons';
import type { MatchType, SearchSource } from '../api/types';
import { api } from '../api/client';
import { MarkdownContent } from './MarkdownContent';
import { DocumentViewerDialog } from './DocumentViewerDialog';
import styles from './SearchPanel.module.css';

function tokenizeQuery(query: string): string[] {
  return query.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1);
}

// RRF fusion scores aren't a calibrated relevance measure — normalizing them
// to "% match" implied false confidence (a weak, semantic-only top result
// would still show 100%). Surfacing *how* it matched is honest instead.
const MATCH_LABEL: Record<MatchType, string> = {
  keyword: 'keyword match',
  semantic: 'semantic match only',
  both: 'keyword + semantic match',
};
const MATCH_THEME: Record<MatchType, 'success' | 'utility'> = {
  keyword: 'success',
  both: 'success',
  semantic: 'utility',
};

interface OpenDocument {
  id: string;
  name: string;
  chunkIndex: number;
}

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [openDocument, setOpenDocument] = useState<OpenDocument | null>(null);
  const searchMutation = useMutation({ mutationFn: (q: string) => api.search(q) });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query);
  };

  const openSource = (source: SearchSource) =>
    setOpenDocument({ id: source.documentId, name: source.documentName, chunkIndex: source.chunkIndex });

  return (
    <Flex direction="column" gap={3}>
      <form onSubmit={handleSearch}>
        <Flex gap={2}>
          <TextInput
            value={query}
            onUpdate={setQuery}
            placeholder="Ask a question about your documents…"
            size="l"
            hasClear
          />
          <Button type="submit" view="action" size="l" loading={searchMutation.isPending}>
            Search
          </Button>
        </Flex>
      </form>

      {searchMutation.isPending && (
        <Flex alignItems="center" gap={2}>
          <Loader size="s" />
          <Text color="secondary">Searching…</Text>
        </Flex>
      )}

      {searchMutation.isError && (
        <Alert
          theme="danger"
          title="Search failed"
          message={
            searchMutation.error instanceof Error
              ? searchMutation.error.message
              : 'Something went wrong — try again.'
          }
        />
      )}

      {searchMutation.isIdle && (
        <PlaceholderContainer
          size="s"
          align="left"
          image={<Icon data={Magnifier} size={32} />}
          title="Ask a question"
          description="Search runs hybrid keyword + semantic retrieval across your indexed documents and shows the matching passages."
        />
      )}

      {searchMutation.data && searchMutation.data.sources.length === 0 && (
        <PlaceholderContainer
          size="s"
          align="left"
          image={<Icon data={FileQuestion} size={32} />}
          title="No matches"
          description={searchMutation.data.answer}
        />
      )}

      {searchMutation.data && searchMutation.data.sources.length > 0 && (
        <Card view="outlined" type="container" className={styles.resultsCard}>
          <Flex direction="column" gap={2}>
            <Text variant="body-1">{searchMutation.data.answer}</Text>
            <Flex direction="column" gap={3} as="ul" className={styles.sourceList}>
              {searchMutation.data.sources.map((source, i) => (
                <li key={i}>
                  <Flex alignItems="center" gap={2}>
                    <Text color="hint" variant="body-1">
                      #{i + 1}
                    </Text>
                    <Text variant="body-1" color="primary">
                      <strong>{source.documentName}</strong>
                    </Text>
                    <Label theme={MATCH_THEME[source.matchType]}>{MATCH_LABEL[source.matchType]}</Label>
                    <Button view="flat" size="s" onClick={() => openSource(source)}>
                      <Icon data={ArrowUpRightFromSquare} size={14} />
                      View in document
                    </Button>
                  </Flex>
                  <MarkdownContent
                    content={source.excerpt}
                    highlightTerms={tokenizeQuery(searchMutation.data!.query)}
                  />
                </li>
              ))}
            </Flex>
          </Flex>
        </Card>
      )}

      <DocumentViewerDialog
        documentId={openDocument?.id ?? null}
        documentName={openDocument?.name ?? ''}
        targetChunkIndex={openDocument?.chunkIndex ?? null}
        onClose={() => setOpenDocument(null)}
      />
    </Flex>
  );
}
