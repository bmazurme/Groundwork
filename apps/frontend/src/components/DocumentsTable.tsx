import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Label, Text } from '@gravity-ui/uikit';
import type { DocumentIndexStatus, DocumentRecord } from '../api/types';

const STATUS_THEME: Record<DocumentIndexStatus, 'utility' | 'info' | 'success' | 'danger'> = {
  pending: 'utility',
  indexing: 'info',
  indexed: 'success',
  failed: 'danger',
};

const columns: ColumnDef<DocumentRecord>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'format', header: 'Format' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const doc = row.original;
      return (
        <Label theme={STATUS_THEME[doc.status]} title={doc.failureReason ?? undefined}>
          {doc.status}
        </Label>
      );
    },
  },
  { accessorKey: 'version', header: 'Version' },
];

interface DocumentsTableProps {
  documents: DocumentRecord[];
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const data = useMemo(() => documents, [documents]);
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  if (documents.length === 0) {
    return (
      <Text color="secondary" variant="body-1">
        No documents yet — upload one above.
      </Text>
    );
  }

  return (
    <table className="documents-table">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
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
  );
}
