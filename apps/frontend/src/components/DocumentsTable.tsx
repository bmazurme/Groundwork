import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Button,
  Flex,
  Icon,
  Label,
  PlaceholderContainer,
  Select,
  Skeleton,
  Text,
} from '@gravity-ui/uikit';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Files, TrashBin } from '@gravity-ui/icons';
import type { DocumentFormat, DocumentIndexStatus, DocumentRecord } from '../api/types';

const PAGE_SIZE = 8;

const STATUS_THEME: Record<DocumentIndexStatus, 'utility' | 'info' | 'success' | 'danger'> = {
  pending: 'utility',
  indexing: 'info',
  indexed: 'success',
  failed: 'danger',
};

const FORMAT_OPTIONS: DocumentFormat[] = ['pdf', 'docx', 'html', 'markdown'];
const STATUS_OPTIONS: DocumentIndexStatus[] = ['pending', 'indexing', 'indexed', 'failed'];

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelativeTime(iso: string): string {
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return relativeTime.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeTime.format(diffHours, 'hour');
  return relativeTime.format(Math.round(diffHours / 24), 'day');
}

function buildColumns(
  onDelete: (doc: DocumentRecord) => void,
  deletingId: string | null,
): ColumnDef<DocumentRecord>[] {
  return [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'format', header: 'Format' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <Flex alignItems="center" gap={1}>
            <Label theme={STATUS_THEME[doc.status]} title={doc.failureReason ?? undefined}>
              {doc.status}
            </Label>
            {(doc.status === 'pending' || doc.status === 'indexing') && (
              <span className="documents-table-status-pulse" aria-hidden="true" />
            )}
          </Flex>
        );
      },
    },
    { accessorKey: 'version', header: 'Version' },
    {
      accessorKey: 'createdAt',
      header: 'Uploaded',
      cell: ({ row }) => (
        <Text color="secondary" title={new Date(row.original.createdAt).toLocaleString()}>
          {formatRelativeTime(row.original.createdAt)}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <Button
            view="flat-danger"
            size="s"
            loading={deletingId === doc.id}
            onClick={() => onDelete(doc)}
            title={`Delete ${doc.name}`}
          >
            <Icon data={TrashBin} size={16} />
          </Button>
        );
      },
    },
  ];
}

interface DocumentsTableProps {
  documents: DocumentRecord[];
  isLoading: boolean;
  onDelete: (doc: DocumentRecord) => void;
  deletingId: string | null;
}

export function DocumentsTable({ documents, isLoading, onDelete, deletingId }: DocumentsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [formatFilter, setFormatFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });

  const data = useMemo(
    () =>
      documents.filter(
        (doc) =>
          (formatFilter.length === 0 || formatFilter.includes(doc.format)) &&
          (statusFilter.length === 0 || statusFilter.includes(doc.status)),
      ),
    [documents, formatFilter, statusFilter],
  );
  const columns = useMemo(() => buildColumns(onDelete, deletingId), [onDelete, deletingId]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (isLoading) {
    return (
      <div className="documents-table-skeleton">
        <Skeleton style={{ height: 32 }} />
        <Skeleton style={{ height: 32 }} />
        <Skeleton style={{ height: 32 }} />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <PlaceholderContainer
        size="s"
        align="left"
        image={<Icon data={Files} size={32} />}
        title="No documents yet"
        description="Upload a PDF, DOCX, HTML, or Markdown file above to start indexing."
      />
    );
  }

  return (
    <Flex direction="column" gap={2}>
      <Flex gap={2}>
        <Select
          placeholder="Format"
          multiple
          value={formatFilter}
          onUpdate={setFormatFilter}
          options={FORMAT_OPTIONS.map((format) => ({ value: format, content: format }))}
          hasClear
          width={150}
        />
        <Select
          placeholder="Status"
          multiple
          value={statusFilter}
          onUpdate={setStatusFilter}
          options={STATUS_OPTIONS.map((status) => ({ value: status, content: status }))}
          hasClear
          width={150}
        />
      </Flex>

      {data.length === 0 ? (
        <Text color="secondary">No documents match these filters.</Text>
      ) : (
        <table className="documents-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id}>
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="documents-table-sort-button"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted && <Icon data={sorted === 'asc' ? ChevronUp : ChevronDown} size={14} />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {table.getPageCount() > 1 && (
        <Flex alignItems="center" justifyContent="space-between">
          <Text color="secondary">
            Page {pagination.pageIndex + 1} of {table.getPageCount()}
          </Text>
          <Flex gap={1}>
            <Button
              view="flat"
              size="s"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <Icon data={ChevronLeft} size={16} />
            </Button>
            <Button view="flat" size="s" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              <Icon data={ChevronRight} size={16} />
            </Button>
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}
