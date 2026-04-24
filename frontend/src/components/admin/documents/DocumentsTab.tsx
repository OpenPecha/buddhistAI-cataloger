
import type { Document } from '../shared/types';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';



import DocumentRow from './DocumentRow';
import { UserFilter } from './UserFilter';
import DocumentStatusFilter from './DocumentStatusFilter';
import { useDocuments, useOutlinerUsers, type DocumentFilters } from '@/hooks';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';



interface DocumentsTabProps {
  onDocumentSelect: (document: Document) => void;
  onDocumentDelete: (documentId: string) => void;
}

function DocumentsTab({
  onDocumentSelect,
  onDocumentDelete,
}: Readonly<DocumentsTabProps>) {
 
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || undefined;
  const annotator = searchParams.get('annotator') || undefined;
  const debouncedTitle=searchParams.get('title') || undefined
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const filters:DocumentFilters = useMemo(
    () => ({
      status,
      userId: annotator,
      title: debouncedTitle || undefined,
      page,
      pageSize: 20,
      excludeOwnAssignedDocuments: true,
    }),
    [status, annotator, debouncedTitle, page]
  );


  const {
    documents,
    isFetching,
  } = useDocuments(filters);

  const { users: outlinerUsers } = useOutlinerUsers();
  const annotatorIdToDisplay = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of outlinerUsers) {
      m.set(u.id, u.name?.trim() || u.email || u.id);
    }
    return m;
  }, [outlinerUsers]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0  pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Document Management</h3>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <DocumentStatusFilter  />
          </div>

          <div className="flex items-center gap-2">
            <UserFilter />
          </div>

          <div className="relative w-full min-w-[200px] max-w-xs sm:w-64">
           
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable] rounded-md border border-gray-200 bg-white">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] transition-opacity">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        <Table
          wrapperClassName="min-w-0 overflow-visible"
          className="min-w-full divide-y divide-gray-200"
        >
          <TableHeader className="sticky top-0 z-1 bg-gray-50 shadow-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Filename
              </TableHead>

              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Checked / total
              </TableHead>

              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white divide-y divide-gray-200">
            {documents.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  {debouncedTitle?.trim()
                    ? 'No documents match your search.'
                    : 'No documents found for the selected filters.'}
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  annotatorName={
                    doc.user_id
                      ? (annotatorIdToDisplay.get(doc.user_id) ?? 'Unknown user')
                      : ''
                  }
                  onSelect={onDocumentSelect}
                  onDelete={onDocumentDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default DocumentsTab;

