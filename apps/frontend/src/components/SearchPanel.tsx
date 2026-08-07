import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Flex, Label, Text, Loader, TextInput } from '@gravity-ui/uikit';
import type { MatchType } from '../api/types';
import { api } from '../api/client';
import { MarkdownContent } from './MarkdownContent';
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

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const searchMutation = useMutation({ mutationFn: (q: string) => api.search(q) });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query);
  };

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

      {searchMutation.isPending && <Loader size="s" />}

      {searchMutation.data && (
        <Card view="outlined" type="container" className={styles.resultsCard}>
          <Flex direction="column" gap={2}>
            <Text variant="body-1">{searchMutation.data.answer}</Text>
            <Flex direction="column" gap={3} as="ul" className={styles.sourceList}>
              {searchMutation.data.sources.map((source, i) => (
                <li key={i}>
                  <Flex alignItems="center" gap={2}>
                    <Text variant="body-1" color="primary">
                      <strong>{source.documentName}</strong>
                    </Text>
                    <Label theme={MATCH_THEME[source.matchType]}>{MATCH_LABEL[source.matchType]}</Label>
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
    </Flex>
  );
}
