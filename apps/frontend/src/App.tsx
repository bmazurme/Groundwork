import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Label,
  Text,
  ThemeProvider,
  ToasterComponent,
  ToasterProvider,
  type Theme,
  useToaster,
} from '@gravity-ui/uikit';
import { toaster } from '@gravity-ui/uikit/toaster-singleton';
import type { DocumentRecord } from './api/types';
import { api } from './api/client';
import { useTheme } from './hooks/useTheme';
import { ThemeToggle } from './components/ThemeToggle';
import { DocumentsTable } from './components/DocumentsTable';
import { UploadDropzone } from './components/UploadDropzone';
import { SearchPanel } from './components/SearchPanel';
import './App.css';

const ACTIVE_STATUSES = new Set(['pending', 'indexing']);

function App() {
  const [theme, setTheme] = useTheme();

  return (
    <ThemeProvider theme={theme}>
      <ToasterProvider toaster={toaster}>
        <Dashboard theme={theme} onThemeChange={setTheme} />
        <ToasterComponent />
      </ToasterProvider>
    </ThemeProvider>
  );
}

interface DashboardProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

function Dashboard({ onThemeChange }: DashboardProps) {
  const queryClient = useQueryClient();
  const { add: addToast } = useToaster();
  const [docPendingDelete, setDocPendingDelete] = useState<DocumentRecord | null>(null);

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15000,
    retry: false,
  });

  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: api.documents,
    refetchInterval: (query) =>
      query.state.data?.some((doc) => ACTIVE_STATUSES.has(doc.status)) ? 2000 : false,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadDocument(file),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      addToast({
        name: `upload-${doc.id}-${doc.version}`,
        title: `"${doc.name}" uploaded`,
        theme: 'success',
        autoHiding: 4000,
      });
    },
    onError: (error) => {
      addToast({
        name: `upload-error-${Date.now()}`,
        title: 'Upload failed',
        content: error instanceof Error ? error.message : undefined,
        theme: 'danger',
        isClosable: true,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      const name = docPendingDelete?.name ?? 'Document';
      addToast({
        name: `delete-${id}`,
        title: `"${name}" deleted`,
        theme: 'success',
        autoHiding: 4000,
      });
    },
    onError: (error) => {
      addToast({
        name: `delete-error-${Date.now()}`,
        title: 'Delete failed',
        content: error instanceof Error ? error.message : undefined,
        theme: 'danger',
        isClosable: true,
      });
    },
    onSettled: () => setDocPendingDelete(null),
  });

  const healthLabel = healthQuery.isError
    ? 'backend unreachable'
    : healthQuery.data
      ? `backend ${healthQuery.data.status}`
      : 'checking backend…';
  const healthTheme = healthQuery.isError ? 'danger' : healthQuery.data ? 'success' : 'utility';

  return (
    <div className="dashboard">
      <Flex justifyContent="space-between" alignItems="center" className="dashboard-header">
        <Text variant="header-1">Groundwork</Text>
        <Flex alignItems="center" gap={2}>
          <Label theme={healthTheme}>{healthLabel}</Label>
          <ThemeToggle onChange={onThemeChange} />
        </Flex>
      </Flex>

      <Card view="outlined" type="container" className="dashboard-card">
        <Flex direction="column" gap={3}>
          <Text variant="subheader-2">Document library</Text>
          <UploadDropzone
            onFileSelected={(file) => uploadMutation.mutate(file)}
            disabled={uploadMutation.isPending}
          />
          <DocumentsTable
            documents={documentsQuery.data ?? []}
            isLoading={documentsQuery.isLoading}
            onDelete={setDocPendingDelete}
            deletingId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
          />
        </Flex>
      </Card>

      <Card view="outlined" type="container" className="dashboard-card">
        <Flex direction="column" gap={3}>
          <Text variant="subheader-2">Grounded search</Text>
          <SearchPanel />
        </Flex>
      </Card>

      <Dialog open={docPendingDelete !== null} onClose={() => setDocPendingDelete(null)}>
        <DialogHeader caption="Delete document" />
        <DialogBody>
          <Text>
            Delete <strong>{docPendingDelete?.name}</strong>? This removes it and all of its
            indexed chunks. This can&apos;t be undone.
          </Text>
        </DialogBody>
        <DialogFooter
          textButtonApply="Delete"
          textButtonCancel="Cancel"
          loading={deleteMutation.isPending}
          propsButtonApply={{ view: 'outlined-danger' }}
          onClickButtonApply={() => docPendingDelete && deleteMutation.mutate(docPendingDelete.id)}
          onClickButtonCancel={() => setDocPendingDelete(null)}
        />
      </Dialog>
    </div>
  );
}

export default App;
