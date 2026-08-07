import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Flex, Label, Text, ThemeProvider, type Theme } from '@gravity-ui/uikit';
import { api } from './api/client';
import { ThemeToggle } from './components/ThemeToggle';
import { DocumentsTable } from './components/DocumentsTable';
import { SearchPanel } from './components/SearchPanel';
import './App.css';

const ACTIVE_STATUSES = new Set(['pending', 'indexing']);

function App() {
  const [theme, setTheme] = useState<Theme>('system');

  return (
    <ThemeProvider theme={theme}>
      <Dashboard theme={theme} onThemeChange={setTheme} />
    </ThemeProvider>
  );
}

interface DashboardProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

function Dashboard({ onThemeChange }: DashboardProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file, {
      onSettled: () => {
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

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

      <Flex direction="column" gap={2} className="dashboard-section">
        <Text variant="subheader-2">Document library</Text>
        <Flex alignItems="center" gap={2}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.html,.htm,.md,.markdown,.txt"
            onChange={handleUpload}
            disabled={uploadMutation.isPending}
          />
          {uploadMutation.isPending && <Text color="secondary">Uploading…</Text>}
        </Flex>
        {uploadMutation.isError && (
          <Alert
            theme="danger"
            message={
              uploadMutation.error instanceof Error
                ? uploadMutation.error.message
                : 'Upload failed'
            }
          />
        )}
        <DocumentsTable documents={documentsQuery.data ?? []} />
      </Flex>

      <Flex direction="column" gap={2} className="dashboard-section">
        <Text variant="subheader-2">Grounded search</Text>
        <SearchPanel />
      </Flex>
    </div>
  );
}

export default App;
