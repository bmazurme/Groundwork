import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogBody, DialogHeader, Loader, Text } from '@gravity-ui/uikit';
import { api } from '../api/client';
import { MarkdownContent } from './MarkdownContent';
import styles from './DocumentViewerDialog.module.css';

interface DocumentViewerDialogProps {
  documentId: string | null;
  documentName: string;
  targetChunkIndex: number | null;
  onClose: () => void;
}

export function DocumentViewerDialog({
  documentId,
  documentName,
  targetChunkIndex,
  onClose,
}: DocumentViewerDialogProps) {
  const chunksQuery = useQuery({
    queryKey: ['document-chunks', documentId],
    queryFn: () => api.documentChunks(documentId!),
    enabled: documentId !== null,
  });
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chunksQuery.data) return;

    // One-shot scroll lands short when a chunk earlier in the document renders
    // asynchronously (e.g. a mermaid diagram resolving after mount) and pushes
    // the target down. A follow-up scroll after that settles corrects for it.
    const scrollToTarget = () => targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scrollToTarget();
    const settleTimer = setTimeout(scrollToTarget, 500);
    return () => clearTimeout(settleTimer);
  }, [chunksQuery.data, targetChunkIndex]);

  return (
    <Dialog open={documentId !== null} onClose={onClose} maxWidth="l" contentOverflow="auto">
      <DialogHeader caption={documentName} />
      <DialogBody>
        <div className={styles.scrollArea}>
          {chunksQuery.isPending && <Loader size="m" />}
          {chunksQuery.isError && <Text color="danger">Failed to load document content.</Text>}
          {chunksQuery.data?.map((chunk) => (
            <div
              key={chunk.index}
              ref={chunk.index === targetChunkIndex ? targetRef : undefined}
              className={chunk.index === targetChunkIndex ? styles.targetChunk : undefined}
            >
              <MarkdownContent content={chunk.content} />
            </div>
          ))}
        </div>
      </DialogBody>
    </Dialog>
  );
}
